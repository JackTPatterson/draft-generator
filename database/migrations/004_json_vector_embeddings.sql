-- Migration: 004_json_vector_embeddings.sql
-- Description: Add JSON-based vector embeddings for semantic search (fallback for systems without pgvector)
-- Created: 2025-08-01

BEGIN;

-- Add vector embedding columns as JSON arrays to knowledge_documents
ALTER TABLE knowledge_documents 
ADD COLUMN IF NOT EXISTS title_embedding JSONB,
ADD COLUMN IF NOT EXISTS content_embedding JSONB,
ADD COLUMN IF NOT EXISTS combined_embedding JSONB;

-- Add vector embedding columns to knowledge_chunks
ALTER TABLE knowledge_chunks 
ADD COLUMN IF NOT EXISTS chunk_embedding JSONB;

-- Create indexes for faster JSON operations
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_title_embedding 
ON knowledge_documents USING gin (title_embedding);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_embedding 
ON knowledge_documents USING gin (content_embedding);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_combined_embedding 
ON knowledge_documents USING gin (combined_embedding);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON knowledge_chunks USING gin (chunk_embedding);

-- Function to calculate cosine similarity between two JSON vectors
CREATE OR REPLACE FUNCTION cosine_similarity(vec1 JSONB, vec2 JSONB)
RETURNS REAL AS $$
DECLARE
    dot_product REAL := 0;
    norm1 REAL := 0;
    norm2 REAL := 0;
    i INTEGER;
    val1 REAL;
    val2 REAL;
    array_length INTEGER;
BEGIN
    -- Check if vectors exist and have same length
    IF vec1 IS NULL OR vec2 IS NULL THEN
        RETURN 0;
    END IF;
    
    array_length := jsonb_array_length(vec1);
    IF array_length != jsonb_array_length(vec2) THEN
        RETURN 0;
    END IF;
    
    -- Calculate dot product and norms
    FOR i IN 0..array_length-1 LOOP
        val1 := (vec1->>i)::REAL;
        val2 := (vec2->>i)::REAL;
        dot_product := dot_product + val1 * val2;
        norm1 := norm1 + val1 * val1;
        norm2 := norm2 + val2 * val2;
    END LOOP;
    
    -- Avoid division by zero
    IF norm1 = 0 OR norm2 = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN dot_product / (sqrt(norm1) * sqrt(norm2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find similar documents using vector search
CREATE OR REPLACE FUNCTION find_similar_documents_json(
    p_user_id VARCHAR(255),
    p_query_embedding JSONB,
    p_category VARCHAR(100) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold REAL DEFAULT 0.7
) RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    snippet TEXT,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kd.id,
        kd.title,
        kd.description,
        kd.category,
        LEFT(kd.extracted_text, 200) as snippet,
        cosine_similarity(kd.combined_embedding, p_query_embedding) as similarity_score
    FROM knowledge_documents kd
    WHERE kd.user_id = p_user_id 
        AND kd.is_active = true
        AND kd.status = 'processed'
        AND kd.combined_embedding IS NOT NULL
        AND (p_category IS NULL OR kd.category = p_category)
        AND cosine_similarity(kd.combined_embedding, p_query_embedding) > p_similarity_threshold
    ORDER BY cosine_similarity(kd.combined_embedding, p_query_embedding) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar chunks using vector search
CREATE OR REPLACE FUNCTION find_similar_chunks_json(
    p_user_id VARCHAR(255),
    p_query_embedding JSONB,
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold REAL DEFAULT 0.7
) RETURNS TABLE (
    chunk_text TEXT,
    document_title VARCHAR(500),
    section_title VARCHAR(500),
    similarity_score REAL,
    document_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kc.chunk_text,
        kd.title as document_title,
        kc.section_title,
        cosine_similarity(kc.chunk_embedding, p_query_embedding) as similarity_score,
        kc.document_id
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE kc.user_id = p_user_id 
        AND kd.is_active = true
        AND kd.status = 'processed'
        AND kc.chunk_embedding IS NOT NULL
        AND cosine_similarity(kc.chunk_embedding, p_query_embedding) > p_similarity_threshold
    ORDER BY cosine_similarity(kc.chunk_embedding, p_query_embedding) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Hybrid search function combining vector and text search
CREATE OR REPLACE FUNCTION hybrid_search_knowledge_json(
    p_user_id VARCHAR(255),
    p_query_text TEXT,
    p_query_embedding JSONB DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_vector_weight REAL DEFAULT 0.7,
    p_text_weight REAL DEFAULT 0.3
) RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    snippet TEXT,
    vector_score REAL,
    text_score REAL,
    combined_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kd.id,
        kd.title,
        kd.description,
        kd.category,
        LEFT(kd.extracted_text, 200) as snippet,
        CASE 
            WHEN p_query_embedding IS NOT NULL AND kd.combined_embedding IS NOT NULL 
            THEN cosine_similarity(kd.combined_embedding, p_query_embedding)
            ELSE 0.0
        END as vector_score,
        CASE 
            WHEN kd.search_vector IS NOT NULL 
            THEN ts_rank(kd.search_vector, plainto_tsquery('english', p_query_text))
            ELSE 0.0
        END as text_score,
        (
            CASE 
                WHEN p_query_embedding IS NOT NULL AND kd.combined_embedding IS NOT NULL 
                THEN p_vector_weight * cosine_similarity(kd.combined_embedding, p_query_embedding)
                ELSE 0.0
            END +
            CASE 
                WHEN kd.search_vector IS NOT NULL 
                THEN p_text_weight * ts_rank(kd.search_vector, plainto_tsquery('english', p_query_text))
                ELSE 0.0
            END
        ) as combined_score
    FROM knowledge_documents kd
    WHERE kd.user_id = p_user_id 
        AND kd.is_active = true
        AND kd.status = 'processed'
        AND (p_category IS NULL OR kd.category = p_category)
        AND (
            (p_query_embedding IS NOT NULL AND kd.combined_embedding IS NOT NULL) OR
            (kd.search_vector IS NOT NULL AND kd.search_vector @@ plainto_tsquery('english', p_query_text))
        )
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add embedding metadata table
CREATE TABLE IF NOT EXISTS embedding_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
    model_dimensions INTEGER NOT NULL DEFAULT 1536,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert default embedding model info
INSERT INTO embedding_metadata (model_name, model_dimensions) 
VALUES ('text-embedding-ada-002', 1536)
ON CONFLICT DO NOTHING;

COMMIT;