CREATE TABLE IF NOT EXISTS enrollment_email_challenges (
  email VARCHAR(254) PRIMARY KEY,
  challenge_id CHAR(36) NOT NULL,
  digest CHAR(64) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  resend_at DATETIME(6) NOT NULL,
  locked_until DATETIME(6) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_email_sessions (
  digest CHAR(64) PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  KEY enrollment_email_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_orders (
  id CHAR(36) PRIMARY KEY,
  class_id VARCHAR(64) NOT NULL,
  email VARCHAR(254) NOT NULL,
  request_id CHAR(36) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL,
  price INT UNSIGNED NOT NULL,
  received BIGINT UNSIGNED NOT NULL DEFAULT 0,
  payment_due_at DATETIME(6) NOT NULL,
  upload_id CHAR(36) NULL,
  upload_expires_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  data JSON NOT NULL,
  UNIQUE KEY enrollment_order_request (email,request_id),
  KEY enrollment_order_seats (class_id,state,payment_due_at),
  KEY enrollment_order_email (email,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_proofs (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  mime VARCHAR(24) NOT NULL,
  digest CHAR(64) NOT NULL,
  proof LONGBLOB NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_proof_order (order_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_receipts (
  reference VARCHAR(120) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  actor VARCHAR(100) NOT NULL,
  settled_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_receipt_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_class_openings (
  class_id VARCHAR(64) PRIMARY KEY,
  opened_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
