CREATE TABLE IF NOT EXISTS enrollment_transfer_invitations (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  source_class_id VARCHAR(64) NOT NULL,
  target_class_id VARCHAR(64) NOT NULL,
  actor VARCHAR(100) NOT NULL,
  state VARCHAR(16) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_transfer_order (order_id,state,expires_at),
  KEY enrollment_transfer_target (target_class_id,state,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_transfers (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  source_class_id VARCHAR(64) NOT NULL,
  target_class_id VARCHAR(64) NOT NULL,
  invitation_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_transfers_order (order_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_refund_cases (
  order_id CHAR(36) PRIMARY KEY,
  class_id VARCHAR(64) NOT NULL,
  actor VARCHAR(100) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  delivered_sessions INT UNSIGNED NOT NULL,
  expected BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_refund_payments (
  reference VARCHAR(120) PRIMARY KEY,
  receipt_reference VARCHAR(120) NOT NULL,
  order_id CHAR(36) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  actor VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_refund_order (order_id),
  KEY enrollment_refund_receipt (receipt_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
