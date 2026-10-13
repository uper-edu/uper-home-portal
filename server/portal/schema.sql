CREATE TABLE IF NOT EXISTS portal_leads(id text PRIMARY KEY, profile jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS visitor_sessions(id text PRIMARY KEY, lead_id text REFERENCES portal_leads, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS conversations(id text PRIMARY KEY, visitor_id text NOT NULL REFERENCES visitor_sessions, lead_id text REFERENCES portal_leads, source text NOT NULL, attribution jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS messages(id text PRIMARY KEY, conversation_id text NOT NULL REFERENCES conversations, request_id text NOT NULL, role text NOT NULL, content text NOT NULL, status text NOT NULL, model text, error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(conversation_id,request_id,role));
CREATE SEQUENCE IF NOT EXISTS message_sequence;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sequence bigint;
WITH ordered AS MATERIALIZED (
  SELECT id, nextval('message_sequence') AS position FROM messages WHERE sequence IS NULL
  ORDER BY created_at, conversation_id,
    CASE WHEN status='legacy' AND request_id ~ '^[0-9]+$' THEN request_id::numeric END,
    request_id, CASE WHEN role='user' THEN 0 ELSE 1 END, id
)
UPDATE messages SET sequence=ordered.position FROM ordered WHERE messages.id=ordered.id;
ALTER TABLE messages ALTER COLUMN sequence SET DEFAULT nextval('message_sequence');
ALTER TABLE messages ALTER COLUMN sequence SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_sequence ON messages(sequence);
CREATE TABLE IF NOT EXISTS ai_attempts(id bigserial PRIMARY KEY, message_id text REFERENCES messages, model text NOT NULL, content text NOT NULL, error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS followup_tasks(id text PRIMARY KEY, lead_id text REFERENCES portal_leads, kind text NOT NULL, owner_id text, status text NOT NULL DEFAULT 'open', due_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS open_task ON followup_tasks(lead_id,kind) WHERE status='open';
CREATE TABLE IF NOT EXISTS outbox(id text PRIMARY KEY, type text NOT NULL, lead_id text, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz);
CREATE TABLE IF NOT EXISTS notification_rules(id text PRIMARY KEY, version integer NOT NULL, config jsonb NOT NULL, enabled boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS rule_versions(id text NOT NULL,version integer NOT NULL,config jsonb NOT NULL, PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS notification_channels(id text PRIMARY KEY, config jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS notification_jobs(id text PRIMARY KEY, event_id text NOT NULL REFERENCES outbox, rule_id text NOT NULL, version integer NOT NULL, channel text NOT NULL, recipient text NOT NULL, state text NOT NULL DEFAULT 'pending', due_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, result text, snapshot jsonb NOT NULL, UNIQUE(event_id,rule_id,channel,recipient));
CREATE TABLE IF NOT EXISTS notification_inbox(id text PRIMARY KEY REFERENCES notification_jobs, employee_id text NOT NULL, content jsonb NOT NULL, read_at timestamptz);
CREATE TABLE IF NOT EXISTS portal_audit(id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS portal_settings(id text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS identity_candidates(visitor_id text NOT NULL REFERENCES visitor_sessions, lead_id text NOT NULL REFERENCES portal_leads, candidate_id text NOT NULL REFERENCES portal_leads, PRIMARY KEY(visitor_id,candidate_id));
CREATE TABLE IF NOT EXISTS lead_read_marks(employee_id text NOT NULL,lead_id text NOT NULL REFERENCES portal_leads,seen_at timestamptz NOT NULL,PRIMARY KEY(employee_id,lead_id));
-- Immutable, visitor-owned attempts. Scores are computed from the server's versioned bank.
CREATE TABLE IF NOT EXISTS hsk_attempts(id text PRIMARY KEY, visitor_id text NOT NULL REFERENCES visitor_sessions, lead_id text REFERENCES portal_leads, input_hash text NOT NULL, attempt jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS hsk_attempt_history ON hsk_attempts(visitor_id,created_at DESC);

-- Notification send time and rule activation are separate from scheduled due time.
ALTER TABLE notification_jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS effective_at timestamptz NOT NULL DEFAULT '1970-01-01 UTC';
UPDATE notification_rules SET effective_at='1970-01-01 UTC' WHERE effective_at='-infinity';
ALTER TABLE notification_rules ALTER COLUMN effective_at SET DEFAULT '1970-01-01 UTC';

-- Local staff identity; kept separate from customer records.
CREATE TABLE IF NOT EXISTS crm_users(id text PRIMARY KEY, login_id text NOT NULL, display_name text NOT NULL, password_hash text NOT NULL, roles jsonb NOT NULL, teams jsonb NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE UNIQUE INDEX IF NOT EXISTS crm_users_login ON crm_users(lower(login_id));
CREATE TABLE IF NOT EXISTS crm_sessions(token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES crm_users(id), expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS crm_login_limits(key text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now());
