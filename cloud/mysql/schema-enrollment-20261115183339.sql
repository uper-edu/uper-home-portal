CREATE TABLE IF NOT EXISTS enrollment_assisted_applications (
  id CHAR(36) PRIMARY KEY,
  token_digest CHAR(64) NOT NULL,
  opportunity_id CHAR(36) NOT NULL,
  customer_id VARCHAR(191) NOT NULL,
  class_id VARCHAR(64) NOT NULL,
  class_revision INT UNSIGNED NOT NULL,
  actor VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  data JSON NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  confirmed_at DATETIME(6) NULL,
  order_id CHAR(36) NULL,
  UNIQUE KEY enrollment_assisted_token (token_digest),
  KEY enrollment_assisted_opportunity (opportunity_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
