CREATE TABLE IF NOT EXISTS enrollment_payment_credits (
  id CHAR(36) PRIMARY KEY,
  receipt_reference VARCHAR(120) NOT NULL,
  source_order_id CHAR(36) NOT NULL,
  target_order_id CHAR(36) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_credit_receipt (receipt_reference),
  KEY enrollment_credit_source (source_order_id,created_at),
  KEY enrollment_credit_target (target_order_id,created_at),
  CHECK (amount > 0 AND source_order_id <> target_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
