-- Create audit_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all audit logs
CREATE POLICY "Admins can read all audit logs"
    ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Allow system to insert audit logs (using service role)
CREATE POLICY "System can insert audit logs"
    ON audit_logs
    FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE audit_logs IS 'Tracks all administrative actions for security auditing';
COMMENT ON COLUMN audit_logs.action IS 'The action performed (e.g., payment_approved, payment_denied, user_deleted)';
COMMENT ON COLUMN audit_logs.resource_type IS 'The type of resource affected (e.g., payment_request, user, video)';
COMMENT ON COLUMN audit_logs.resource_id IS 'The ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.details IS 'Additional context about the action in JSON format';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the admin who performed the action';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client user agent string';
