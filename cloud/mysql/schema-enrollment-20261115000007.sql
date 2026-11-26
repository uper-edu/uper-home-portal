ALTER TABLE enrollment_orders ADD COLUMN activity_at DATETIME(6) DEFAULT NULL;
ALTER TABLE enrollment_waitlist ADD COLUMN activity_at DATETIME(6) DEFAULT NULL;
