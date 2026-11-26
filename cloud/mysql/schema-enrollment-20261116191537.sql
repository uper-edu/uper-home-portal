CREATE TABLE IF NOT EXISTS enrollment_mail_configuration (
  environment VARCHAR(16) PRIMARY KEY,
  revision INT UNSIGNED NOT NULL,
  config JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS enrollment_mail_attempts (
  id CHAR(36) PRIMARY KEY,
  environment VARCHAR(16) NOT NULL,
  event_key VARCHAR(160) NOT NULL,
  account VARCHAR(254) NOT NULL,
  recipient VARCHAR(254) NOT NULL,
  is_external BOOLEAN NOT NULL,
  day_key CHAR(10) NOT NULL,
  month_key CHAR(7) NOT NULL,
  started_ms BIGINT NOT NULL,
  state VARCHAR(16) NOT NULL,
  KEY mail_rate(environment,started_ms),
  KEY mail_daily(environment,day_key,account),
  KEY mail_monthly(environment,month_key,account),
  KEY mail_event(environment,event_key),
  KEY mail_recipient(environment,recipient,state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS enrollment_mail_bindings (
  environment VARCHAR(16) NOT NULL,
  recipient VARCHAR(254) NOT NULL,
  account VARCHAR(254) NOT NULL,
  PRIMARY KEY(environment,recipient)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
