CREATE TABLE IF NOT EXISTS crm_payment_analytics (
  id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  environment ENUM('dev','test','prod') NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  source_entry_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('purchase','refund') NOT NULL,
  sequence_no INT UNSIGNED NOT NULL,
  amount BIGINT UNSIGNED NOT NULL,
  course_id VARCHAR(191) NOT NULL,
  state ENUM('held','cancelled') NOT NULL DEFAULT 'held',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY payment_analytics_order (environment, project_id, sequence_no),
  KEY payment_analytics_queue (environment, state, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
