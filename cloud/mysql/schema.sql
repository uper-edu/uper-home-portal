CREATE TABLE IF NOT EXISTS trial_schema_versions (
 version INT PRIMARY KEY, state VARCHAR(16) NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS portal_settings (
 id VARCHAR(191) PRIMARY KEY, value JSON NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lead_daily_counters (
 business_date CHAR(8) PRIMARY KEY, `last_value` BIGINT UNSIGNED NOT NULL,
 CHECK (`last_value` > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS portal_leads (
 id VARCHAR(191) PRIMARY KEY, business_number VARCHAR(64) NOT NULL UNIQUE,
 profile JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS visitor_sessions (
 id VARCHAR(191) PRIMARY KEY, lead_id VARCHAR(191), expires_at DATETIME(6) NOT NULL,
 FOREIGN KEY (lead_id) REFERENCES portal_leads(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS conversations (
 id VARCHAR(191) PRIMARY KEY, visitor_id VARCHAR(191) NOT NULL, lead_id VARCHAR(191),
 source VARCHAR(100) NOT NULL, attribution JSON NOT NULL DEFAULT (JSON_OBJECT()),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (visitor_id) REFERENCES visitor_sessions(id),
 FOREIGN KEY (lead_id) REFERENCES portal_leads(id), INDEX conversation_history(lead_id,updated_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS messages (
 id VARCHAR(191) PRIMARY KEY, conversation_id VARCHAR(191) NOT NULL,
 request_id VARCHAR(191) NOT NULL, role VARCHAR(32) NOT NULL, content LONGTEXT NOT NULL,
 status VARCHAR(32) NOT NULL, model VARCHAR(100), error TEXT,
 metadata JSON NOT NULL DEFAULT (JSON_OBJECT()),
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 sequence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 FOREIGN KEY (conversation_id) REFERENCES conversations(id),
 UNIQUE message_request(conversation_id,request_id,role)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ai_attempts (
 id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, message_id VARCHAR(191), model VARCHAR(100) NOT NULL,
 content LONGTEXT NOT NULL, error TEXT, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (message_id) REFERENCES messages(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS followup_tasks (
 id VARCHAR(191) PRIMARY KEY, lead_id VARCHAR(191), kind VARCHAR(64) NOT NULL,
 owner_id VARCHAR(191), status VARCHAR(32) NOT NULL DEFAULT 'open',
 due_at DATETIME(6) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 details JSON NOT NULL DEFAULT (JSON_OBJECT()),
 open_kind VARCHAR(64) GENERATED ALWAYS AS (CASE WHEN status='open' THEN kind ELSE NULL END) STORED,
 FOREIGN KEY (lead_id) REFERENCES portal_leads(id), UNIQUE open_task(lead_id,open_kind),
 INDEX task_due(status,due_at), INDEX task_lead(lead_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS outbox (
 id VARCHAR(191) PRIMARY KEY, type VARCHAR(100) NOT NULL, lead_id VARCHAR(191), payload JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), processed_at DATETIME(6),
 INDEX outbox_pending(processed_at,created_at), INDEX outbox_lead(lead_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notification_rules (
 id VARCHAR(191) PRIMARY KEY, version INT NOT NULL, config JSON NOT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE,
 effective_at DATETIME(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000'
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS rule_versions (
 id VARCHAR(191) NOT NULL, version INT NOT NULL, config JSON NOT NULL, PRIMARY KEY(id,version)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notification_channels (
 id VARCHAR(191) PRIMARY KEY, config JSON NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notification_jobs (
 id VARCHAR(191) PRIMARY KEY, event_id VARCHAR(191) NOT NULL, rule_id VARCHAR(191) NOT NULL,
 version INT NOT NULL, channel VARCHAR(32) NOT NULL, recipient VARCHAR(191) NOT NULL,
 state VARCHAR(32) NOT NULL DEFAULT 'pending', due_at DATETIME(6) NOT NULL, attempts INT NOT NULL DEFAULT 0,
 lease_until DATETIME(6), result TEXT, snapshot JSON NOT NULL, completed_at DATETIME(6),
 FOREIGN KEY (event_id) REFERENCES outbox(id),
 UNIQUE notification_event(event_id,rule_id,channel,recipient), INDEX notification_due(state,due_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notification_inbox (
 id VARCHAR(191) PRIMARY KEY, employee_id VARCHAR(191) NOT NULL, content JSON NOT NULL, read_at DATETIME(6),
 FOREIGN KEY (id) REFERENCES notification_jobs(id), INDEX inbox_employee(employee_id,read_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS portal_audit (
 id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, actor VARCHAR(191) NOT NULL, action VARCHAR(100) NOT NULL,
 data JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS identity_candidates (
 visitor_id VARCHAR(191) NOT NULL, lead_id VARCHAR(191) NOT NULL, candidate_id VARCHAR(191) NOT NULL,
 PRIMARY KEY(visitor_id,candidate_id), FOREIGN KEY(visitor_id) REFERENCES visitor_sessions(id),
 FOREIGN KEY(lead_id) REFERENCES portal_leads(id), FOREIGN KEY(candidate_id) REFERENCES portal_leads(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lead_read_marks (
 employee_id VARCHAR(191) NOT NULL, lead_id VARCHAR(191) NOT NULL, seen_at DATETIME(6) NOT NULL,
 PRIMARY KEY(employee_id,lead_id), FOREIGN KEY(lead_id) REFERENCES portal_leads(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hsk_attempts (
 id VARCHAR(191) PRIMARY KEY, visitor_id VARCHAR(191) NOT NULL, lead_id VARCHAR(191),
 input_hash VARCHAR(64) NOT NULL, attempt JSON NOT NULL, result JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(visitor_id) REFERENCES visitor_sessions(id), FOREIGN KEY(lead_id) REFERENCES portal_leads(id),
 INDEX hsk_attempt_history(visitor_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS crm_users (
 id VARCHAR(191) PRIMARY KEY, login_id VARCHAR(191) NOT NULL, display_name VARCHAR(191) NOT NULL,
 password_hash TEXT NOT NULL, roles JSON NOT NULL, teams JSON NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 login_key VARCHAR(191) GENERATED ALWAYS AS (LOWER(login_id)) STORED UNIQUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS crm_sessions (
 token_hash VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, expires_at DATETIME(6) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES crm_users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS crm_login_limits (
 `key` VARCHAR(191) PRIMARY KEY, failures INT NOT NULL DEFAULT 0,
 window_start DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS trial_campaigns (
 id VARCHAR(191) PRIMARY KEY, code VARCHAR(191) NOT NULL UNIQUE, config JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS trial_members (
 site_user_id VARCHAR(191) PRIMARY KEY, employee_id VARCHAR(191), mode VARCHAR(32) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, FOREIGN KEY(employee_id) REFERENCES crm_users(id)
) ENGINE=InnoDB;
