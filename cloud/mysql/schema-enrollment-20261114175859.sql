CREATE TABLE IF NOT EXISTS enrollment_waitlist (
  id CHAR(36) PRIMARY KEY,
  class_id VARCHAR(64) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(26) NOT NULL,
  state VARCHAR(16) NOT NULL,
  order_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL,
  KEY enrollment_waitlist_owner (email,created_at),
  KEY enrollment_waitlist_class (class_id,state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_demands (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  state VARCHAR(16) NOT NULL,
  criteria JSON NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  KEY enrollment_demands_owner (email,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_vacancy_cycles (
  class_id VARCHAR(64) PRIMARY KEY,
  is_full BOOLEAN NOT NULL,
  cycle INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS enrollment_interest_events (
  kind VARCHAR(16) NOT NULL,
  interest_id CHAR(36) NOT NULL,
  class_id VARCHAR(64) NOT NULL,
  cycle INT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY(kind,interest_id,class_id,cycle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
