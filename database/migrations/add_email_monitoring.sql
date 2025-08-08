-- Email Monitoring Service Database Schema
-- Adds tables and functionality for scalable multi-user email monitoring

-- ================================
-- EMAIL MONITORING CONFIGURATION
-- ================================

CREATE TYPE monitoring_status AS ENUM (
    'active', 'paused', 'error', 'disabled'
);

CREATE TABLE user_email_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Gmail specific configuration
    gmail_watch_enabled BOOLEAN DEFAULT FALSE,
    gmail_history_id VARCHAR(255), -- Last processed history ID
    gmail_last_checked TIMESTAMP WITH TIME ZONE,
    
    -- Monitoring configuration
    monitoring_status monitoring_status DEFAULT 'active',
    check_interval_minutes INTEGER DEFAULT 5, -- How often to check for new emails
    max_emails_per_check INTEGER DEFAULT 50, -- Limit to prevent API abuse
    
    -- n8n webhook configuration
    n8n_webhook_url TEXT, -- Webhook URL to trigger n8n workflow
    n8n_webhook_secret VARCHAR(255), -- Optional secret for webhook authentication
    
    -- Error handling
    consecutive_errors INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ================================
-- EMAIL PROCESSING QUEUE
-- ================================

CREATE TYPE job_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'retrying'
);

CREATE TYPE job_type AS ENUM (
    'check_emails', 'process_email', 'trigger_webhook', 'sync_gmail'
);

CREATE TABLE email_processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Job details
    job_type job_type NOT NULL,
    status job_status DEFAULT 'pending',
    priority INTEGER DEFAULT 0, -- Higher numbers = higher priority
    
    -- Job data
    payload JSONB, -- Job-specific data (email IDs, webhook data, etc.)
    
    -- Processing tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- EMAIL PROCESSING LOGS
-- ================================

CREATE TYPE processing_result AS ENUM (
    'success', 'skipped', 'failed', 'duplicate'
);

CREATE TABLE email_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    job_id UUID REFERENCES email_processing_jobs(id) ON DELETE SET NULL,
    
    -- Processing details
    gmail_message_id VARCHAR(255),
    processing_result processing_result NOT NULL,
    processing_time_ms INTEGER, -- Time taken to process in milliseconds
    
    -- Webhook details
    webhook_url TEXT,
    webhook_response_code INTEGER,
    webhook_response_body TEXT,
    
    -- Error details
    error_message TEXT,
    error_details JSONB,
    
    -- Timing
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB -- Additional context data
);

-- ================================
-- MONITORING STATISTICS
-- ================================

CREATE TABLE monitoring_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Date bucket (daily aggregation)
    date DATE NOT NULL,
    
    -- Email statistics
    emails_checked INTEGER DEFAULT 0,
    emails_processed INTEGER DEFAULT 0,
    emails_skipped INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_processing_time_ms NUMERIC(10,2),
    max_processing_time_ms INTEGER,
    
    -- Webhook statistics  
    webhook_calls INTEGER DEFAULT 0,
    webhook_successes INTEGER DEFAULT 0,
    webhook_failures INTEGER DEFAULT 0,
    
    -- Error tracking
    total_errors INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Email monitoring
CREATE INDEX idx_user_email_monitoring_user_id ON user_email_monitoring(user_id);
CREATE INDEX idx_user_email_monitoring_status ON user_email_monitoring(monitoring_status);
CREATE INDEX idx_user_email_monitoring_last_checked ON user_email_monitoring(gmail_last_checked);

-- Processing jobs
CREATE INDEX idx_email_processing_jobs_user_id ON email_processing_jobs(user_id);
CREATE INDEX idx_email_processing_jobs_status ON email_processing_jobs(status);
CREATE INDEX idx_email_processing_jobs_job_type ON email_processing_jobs(job_type);
CREATE INDEX idx_email_processing_jobs_scheduled_at ON email_processing_jobs(scheduled_at);
CREATE INDEX idx_email_processing_jobs_priority_scheduled ON email_processing_jobs(priority DESC, scheduled_at ASC);

-- Processing logs
CREATE INDEX idx_email_processing_logs_user_id ON email_processing_logs(user_id);
CREATE INDEX idx_email_processing_logs_processed_at ON email_processing_logs(processed_at DESC);
CREATE INDEX idx_email_processing_logs_gmail_message_id ON email_processing_logs(gmail_message_id);
CREATE INDEX idx_email_processing_logs_result ON email_processing_logs(processing_result);

-- Monitoring stats
CREATE INDEX idx_monitoring_stats_user_date ON monitoring_stats(user_id, date);
CREATE INDEX idx_monitoring_stats_date ON monitoring_stats(date);

-- ================================
-- TRIGGERS AND FUNCTIONS
-- ================================

-- Update triggers for timestamps
CREATE TRIGGER update_user_email_monitoring_updated_at 
    BEFORE UPDATE ON user_email_monitoring 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_processing_jobs_updated_at 
    BEFORE UPDATE ON email_processing_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_stats_updated_at 
    BEFORE UPDATE ON monitoring_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get next email processing job
CREATE OR REPLACE FUNCTION get_next_email_job()
RETURNS TABLE(
    job_id UUID,
    user_id UUID,
    job_type job_type,
    payload JSONB
) AS $$
BEGIN
    RETURN QUERY
    UPDATE email_processing_jobs 
    SET 
        status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = (
        SELECT epj.id 
        FROM email_processing_jobs epj
        WHERE epj.status = 'pending' 
        AND epj.scheduled_at <= NOW()
        AND epj.attempts < epj.max_attempts
        ORDER BY epj.priority DESC, epj.scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING 
        email_processing_jobs.id as job_id,
        email_processing_jobs.user_id,
        email_processing_jobs.job_type,
        email_processing_jobs.payload;
END;
$$ LANGUAGE plpgsql;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_email_job(
    job_id UUID,
    success BOOLEAN DEFAULT TRUE,
    error_msg TEXT DEFAULT NULL,
    error_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE email_processing_jobs 
    SET 
        status = CASE WHEN success THEN 'completed' ELSE 'failed' END,
        completed_at = NOW(),
        error_message = error_msg,
        error_details = error_details,
        updated_at = NOW()
    WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to schedule retry for failed jobs
CREATE OR REPLACE FUNCTION schedule_job_retry(
    job_id UUID,
    delay_minutes INTEGER DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
    UPDATE email_processing_jobs 
    SET 
        status = 'pending',
        scheduled_at = NOW() + INTERVAL '1 minute' * delay_minutes,
        updated_at = NOW()
    WHERE id = job_id 
    AND attempts < max_attempts;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily monitoring stats
CREATE OR REPLACE FUNCTION update_monitoring_stats(
    p_user_id UUID,
    p_emails_checked INTEGER DEFAULT 0,
    p_emails_processed INTEGER DEFAULT 0,
    p_emails_skipped INTEGER DEFAULT 0,
    p_emails_failed INTEGER DEFAULT 0,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_webhook_calls INTEGER DEFAULT 0,
    p_webhook_successes INTEGER DEFAULT 0,
    p_webhook_failures INTEGER DEFAULT 0,
    p_total_errors INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    INSERT INTO monitoring_stats (
        user_id, date, emails_checked, emails_processed, emails_skipped, 
        emails_failed, avg_processing_time_ms, max_processing_time_ms,
        webhook_calls, webhook_successes, webhook_failures, total_errors
    ) VALUES (
        p_user_id, today, p_emails_checked, p_emails_processed, p_emails_skipped,
        p_emails_failed, p_processing_time_ms, p_processing_time_ms,
        p_webhook_calls, p_webhook_successes, p_webhook_failures, p_total_errors
    )
    ON CONFLICT (user_id, date) 
    DO UPDATE SET
        emails_checked = monitoring_stats.emails_checked + p_emails_checked,
        emails_processed = monitoring_stats.emails_processed + p_emails_processed,
        emails_skipped = monitoring_stats.emails_skipped + p_emails_skipped,
        emails_failed = monitoring_stats.emails_failed + p_emails_failed,
        avg_processing_time_ms = CASE 
            WHEN p_processing_time_ms IS NOT NULL THEN 
                COALESCE((monitoring_stats.avg_processing_time_ms + p_processing_time_ms) / 2, p_processing_time_ms)
            ELSE monitoring_stats.avg_processing_time_ms 
        END,
        max_processing_time_ms = CASE 
            WHEN p_processing_time_ms IS NOT NULL THEN 
                GREATEST(COALESCE(monitoring_stats.max_processing_time_ms, 0), p_processing_time_ms)
            ELSE monitoring_stats.max_processing_time_ms 
        END,
        webhook_calls = monitoring_stats.webhook_calls + p_webhook_calls,
        webhook_successes = monitoring_stats.webhook_successes + p_webhook_successes,
        webhook_failures = monitoring_stats.webhook_failures + p_webhook_failures,
        total_errors = monitoring_stats.total_errors + p_total_errors,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ================================
-- CLEANUP FUNCTIONS
-- ================================

-- Function to clean old processing logs
CREATE OR REPLACE FUNCTION cleanup_old_processing_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_processing_logs 
    WHERE processed_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean completed/failed jobs
CREATE OR REPLACE FUNCTION cleanup_old_jobs(hours_to_keep INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_processing_jobs 
    WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - INTERVAL '1 hour' * hours_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- USEFUL VIEWS
-- ================================

-- Active monitoring view
CREATE VIEW active_email_monitoring AS
SELECT 
    uem.user_id,
    u.email as user_email,
    u.name as user_name,
    uem.monitoring_status,
    uem.check_interval_minutes,
    uem.gmail_last_checked,
    uem.consecutive_errors,
    uem.n8n_webhook_url,
    CASE 
        WHEN uem.gmail_last_checked IS NULL THEN 'never'
        WHEN uem.gmail_last_checked < NOW() - INTERVAL '1 hour' THEN 'overdue'
        WHEN uem.gmail_last_checked < NOW() - INTERVAL '30 minutes' THEN 'due_soon'
        ELSE 'current'
    END as check_status
FROM user_email_monitoring uem
JOIN users u ON uem.user_id = u.id
WHERE uem.monitoring_status = 'active'
AND u.gmail_connected = TRUE;

-- Job queue status view
CREATE VIEW job_queue_status AS
SELECT 
    job_type,
    status,
    COUNT(*) as job_count,
    AVG(EXTRACT(EPOCH FROM (NOW() - scheduled_at))/60) as avg_wait_minutes
FROM email_processing_jobs
WHERE status IN ('pending', 'processing')
GROUP BY job_type, status
ORDER BY job_type, status;

-- User monitoring dashboard view
CREATE VIEW user_monitoring_dashboard AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    uem.monitoring_status,
    uem.gmail_last_checked,
    uem.consecutive_errors,
    ms.emails_processed as emails_today,
    ms.emails_failed as errors_today,
    COALESCE(pending_jobs.job_count, 0) as pending_jobs
FROM users u
LEFT JOIN user_email_monitoring uem ON u.id = uem.user_id
LEFT JOIN monitoring_stats ms ON u.id = ms.user_id AND ms.date = CURRENT_DATE
LEFT JOIN (
    SELECT user_id, COUNT(*) as job_count
    FROM email_processing_jobs 
    WHERE status = 'pending'
    GROUP BY user_id
) pending_jobs ON u.id = pending_jobs.user_id
WHERE u.gmail_connected = TRUE;

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE user_email_monitoring IS 'Per-user email monitoring configuration and status';
COMMENT ON TABLE email_processing_jobs IS 'Queue for email processing jobs with retry logic';
COMMENT ON TABLE email_processing_logs IS 'Detailed logs of email processing attempts and results';
COMMENT ON TABLE monitoring_stats IS 'Daily aggregated statistics for monitoring performance';

-- Update schema version
INSERT INTO schema_version (version, description) 
VALUES ('1.1.0', 'Added scalable email monitoring service tables');