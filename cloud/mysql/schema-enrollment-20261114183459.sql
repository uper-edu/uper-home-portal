CREATE TABLE IF NOT EXISTS enrollment_record_attribution (
  kind VARCHAR(12) NOT NULL,
  record_id CHAR(36) NOT NULL,
  attribution JSON NOT NULL,
  PRIMARY KEY(kind,record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_notification_receipts (
  event_key VARCHAR(160) PRIMARY KEY,
  channel VARCHAR(8) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  subject_id VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  state VARCHAR(16) NOT NULL,
  recorded_at DATETIME(6) NOT NULL,
  KEY enrollment_notification_subject(subject_id,recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
