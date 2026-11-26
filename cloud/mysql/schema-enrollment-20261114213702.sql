CREATE TABLE IF NOT EXISTS enrollment_refund_returns (
  reference VARCHAR(120) PRIMARY KEY,
  refund_reference VARCHAR(120) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  actor VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_refund_return_payment (refund_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
