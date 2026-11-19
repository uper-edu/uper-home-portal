ALTER TABLE enrollment_mail_attempts
  ADD COLUMN pool_id VARCHAR(40) NULL,
  ADD KEY mail_pool_daily (environment, day_key, pool_id);
