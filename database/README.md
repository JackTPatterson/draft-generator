# Fluxyn Email Automation Database Schema

This directory contains the PostgreSQL database schema and setup files for the Fluxyn email automation application.

## 📊 Schema Overview

The database is designed to support:
- **User management** with Gmail OAuth integration
- **Email processing** with full-text search capabilities
- **Template system** for email automation
- **Campaign management** with analytics tracking
- **Knowledge base** for AI-powered assistance
- **Webhook integration** (n8n, Zapier, etc.)
- **Comprehensive audit trails**

## 🗃️ Core Tables

### Authentication & Users
- `users` - User accounts with OAuth tokens
- `user_settings` - User preferences and configuration
- `activity_logs` - User activity audit trail

### Email Management
- `emails` - Core email messages with Gmail integration
- `email_attachments` - File attachments linked to emails
- `email_interactions` - Email engagement tracking (opens, clicks, etc.)

### Automation & Templates
- `email_templates` - Reusable email templates
- `campaigns` - Email marketing campaigns
- `campaign_steps` - Campaign sequence steps

### Knowledge & Integration
- `knowledge_items` - Knowledge base for AI assistance
- `integrations` - Third-party service configurations
- `webhook_logs` - Webhook processing audit trail

## 🚀 Setup Instructions

### Prerequisites
- PostgreSQL 12+ installed
- Database admin access
- pgAdmin or psql command line tool

### 1. Create Database
```sql
CREATE DATABASE fluxyn_email_automation;
CREATE USER fluxyn_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE fluxyn_email_automation TO fluxyn_user;
```

### 2. Run Schema
```bash
# Connect to database
psql -U fluxyn_user -d fluxyn_email_automation

# Or from command line
psql -U fluxyn_user -d fluxyn_email_automation -f database/schema.sql
```

### 3. Environment Variables
Add these to your `.env.local` file:

```bash
# Database Configuration
DATABASE_URL="postgresql://fluxyn_user:your_secure_password@localhost:5432/fluxyn_email_automation"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="fluxyn_email_automation"
DB_USER="fluxyn_user"
DB_PASSWORD="your_secure_password"

# SSL Configuration (for production)
DB_SSL="require"
```

## 🔍 Key Features

### Full-Text Search
- **Email content** searchable via `emails.search_vector`
- **Knowledge base** searchable via `knowledge_items.search_vector`
- Supports ranking and highlighting

### Performance Optimization
- **Strategic indexes** on frequently queried columns
- **Composite indexes** for complex queries
- **GIN indexes** for JSONB and array columns

### Data Integrity
- **Foreign key constraints** maintain referential integrity
- **Check constraints** ensure data validity
- **Unique constraints** prevent duplicates

### Audit Trail
- **Automatic timestamps** via triggers
- **Activity logging** for user actions
- **Webhook logging** for debugging integrations

## 📈 Analytics Views

### Email Summary
```sql
SELECT * FROM email_summary 
WHERE user_id = 'user-uuid' 
AND status = 'inbox' 
ORDER BY received_at DESC;
```

### Campaign Performance
```sql
SELECT * FROM campaign_performance 
WHERE user_id = 'user-uuid' 
ORDER BY open_rate DESC;
```

## 🔧 Maintenance

### Cleanup Old Logs
```sql
-- Clean webhook logs older than 30 days
SELECT cleanup_old_webhook_logs(30);

-- Clean activity logs older than 90 days  
SELECT cleanup_old_activity_logs(90);
```

### Database Statistics
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔐 Security Considerations

### Sensitive Data
- **OAuth tokens** should be encrypted at rest
- **API keys** are stored as hashes
- **Email content** may contain sensitive information

### Recommended Practices
- Use connection pooling (PgBouncer)
- Enable SSL/TLS for connections
- Regular backups with encryption
- Monitor query performance
- Implement row-level security for multi-tenant setup

## 🚀 Production Deployment

### Docker Compose Example
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fluxyn_email_automation
      POSTGRES_USER: fluxyn_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### Migration Strategy
1. **Schema versioning** via `schema_version` table
2. **Incremental migrations** for updates
3. **Rollback procedures** for safety
4. **Data validation** after migrations

## 📝 Example Queries

### Get User's Recent Emails
```sql
SELECT e.*, COUNT(ea.id) as attachment_count
FROM emails e
LEFT JOIN email_attachments ea ON e.id = ea.email_id
WHERE e.user_id = $1 
AND e.status = 'inbox'
GROUP BY e.id
ORDER BY e.received_at DESC
LIMIT 50;
```

### Search Emails
```sql
SELECT e.*, ts_rank(e.search_vector, plainto_tsquery($2)) as rank
FROM emails e
WHERE e.user_id = $1 
AND e.search_vector @@ plainto_tsquery($2)
ORDER BY rank DESC, e.received_at DESC;
```

### Campaign Analytics
```sql
SELECT 
    c.name,
    COUNT(ei.id) FILTER (WHERE ei.type = 'opened') as opens,
    COUNT(ei.id) FILTER (WHERE ei.type = 'clicked') as clicks,
    COUNT(DISTINCT ei.email_id) as unique_recipients
FROM campaigns c
LEFT JOIN email_interactions ei ON c.id = ei.campaign_id
WHERE c.user_id = $1
GROUP BY c.id, c.name;
```

## 🛠️ Development Tips

### Local Development
- Use PostgreSQL Docker container for consistency
- Seed with sample data for testing
- Enable query logging for debugging

### Testing
- Use transactions for test isolation
- Mock external API calls
- Test full-text search functionality

### Performance Monitoring
- Monitor slow queries
- Check index usage
- Analyze query plans with EXPLAIN

## 📞 Support

For database-related issues:
1. Check the logs first
2. Verify environment variables
3. Test connection with psql
4. Review query performance with EXPLAIN ANALYZE