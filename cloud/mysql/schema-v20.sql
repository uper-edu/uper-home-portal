ALTER TABLE crm_payment_analytics
  ADD COLUMN dispatch_state ENUM('sending','accepted','rejected','unknown','blocked') NULL,
  ADD COLUMN attempted_at DATETIME(6) NULL,
  ADD INDEX payment_analytics_dispatch (environment,dispatch_state,created_at);
