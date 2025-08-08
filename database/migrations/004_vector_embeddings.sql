-- Migration: 004_vector_embeddings.sql
-- Description: Add vector embeddings for semantic search
-- Created: 2025-08-01

BEGIN;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector embedding columns to knowledge_documents
ALTER TABLE knowledge_documents 
ADD COLUMN IF NOT EXISTS title_embedding vector(1536),
ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
ADD COLUMN IF NOT EXISTS combined_embedding vector(1536);

-- Add vector embedding columns to knowledge_chunks
ALTER TABLE knowledge_chunks 
ADD COLUMN IF NOT EXISTS chunk_embedding vector(1536);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_title_embedding 
ON knowledge_documents USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_embedding 
ON knowledge_documents USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_combined_embedding 
ON knowledge_documents USING ivfflat (combined_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON knowledge_chunks USING ivfflat (chunk_embedding vector_cosine_ops) WITH (lists = 100);

-- Function to find similar documents using vector search
CREATE OR REPLACE FUNCTION find_similar_documents(
    p_user_id VARCHAR(255),
    p_query_embedding vector(1536),
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
        (1 - (kd.combined_embedding <=> p_query_embedding)) as similarity_score
    FROM knowledge_documents kd
    WHERE kd.user_id = p_user_id 
        AND kd.is_active = true
        AND kd.status = 'processed'
        AND kd.combined_embedding IS NOT NULL
        AND (p_category IS NULL OR kd.category = p_category)
        AND (1 - (kd.combined_embedding <=> p_query_embedding)) > p_similarity_threshold
    ORDER BY kd.combined_embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar chunks using vector search
CREATE OR REPLACE FUNCTION find_similar_chunks(
    p_user_id VARCHAR(255),
    p_query_embedding vector(1536),
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
        (1 - (kc.chunk_embedding <=> p_query_embedding)) as similarity_score,
        kc.document_id
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE kc.user_id = p_user_id 
        AND kd.is_active = true
        AND kd.status = 'processed'
        AND kc.chunk_embedding IS NOT NULL
        AND (1 - (kc.chunk_embedding <=> p_query_embedding)) > p_similarity_threshold
    ORDER BY kc.chunk_embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Hybrid search function combining vector and text search
CREATE OR REPLACE FUNCTION hybrid_search_knowledge(
    p_user_id VARCHAR(255),
    p_query_text TEXT,
    p_query_embedding vector(1536) DEFAULT NULL,
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
            THEN (1 - (kd.combined_embedding <=> p_query_embedding))
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
                THEN p_vector_weight * (1 - (kd.combined_embedding <=> p_query_embedding))
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