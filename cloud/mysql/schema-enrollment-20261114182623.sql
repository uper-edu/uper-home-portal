CREATE TABLE IF NOT EXISTS enrollment_opportunities (
  id CHAR(36) PRIMARY KEY,
  lead_id VARCHAR(191) NOT NULL,
  level VARCHAR(24) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  sales_stage VARCHAR(32) NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_opportunity_lead (lead_id,level,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_opportunity_progress (
  id CHAR(36) PRIMARY KEY,
  opportunity_id CHAR(36) NOT NULL,
  actor VARCHAR(191) NOT NULL,
  sales_stage VARCHAR(32) NOT NULL,
  note VARCHAR(2000) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_opportunity_progress_history(opportunity_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_customer_records (
  kind VARCHAR(12) NOT NULL,
  record_id CHAR(36) NOT NULL,
  lead_id VARCHAR(191) NOT NULL,
  opportunity_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (kind,record_id),
  KEY enrollment_customer_records_lead (lead_id,created_at),
  KEY enrollment_customer_records_opportunity (opportunity_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
