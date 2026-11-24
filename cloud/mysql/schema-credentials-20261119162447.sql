CREATE TABLE IF NOT EXISTS integration_credentials (
  environment VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
  state JSON NOT NULL,
  PRIMARY KEY (environment, kind, resource)
) ENGINE=InnoDB;
