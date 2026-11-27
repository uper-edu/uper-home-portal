-- MANUAL ONLY. Existing 95eea57 (v18) database, no application/worker writes during maintenance.
-- Use a fresh MySQL 8 batch client, abort on first error, NO --force; set @uper_expected_database
-- to the independently verified DB name in that session. Backup/restore rehearsal required.
-- No business DML. An incompatible partially migrated table is rejected, never rewritten.
-- DDL implicitly commits. On failure inspect the database AND ownership of the residual routine
-- before manual cleanup. Never drop a pre-existing routine. Never invoke this file on startup.
DELIMITER $$
CREATE PROCEDURE uper_release_20261126182423()
SQL SECURITY INVOKER
BEGIN
  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE() <> BINARY @uper_expected_database OR VERSION() NOT LIKE '8.%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong database or unsupported server';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,21)='access_restore_guard_') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Interrupted access restore; stop';
  END IF;
  IF (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 18 AND state='ready')<>18 OR EXISTS (SELECT 1 FROM trial_schema_versions WHERE version NOT BETWEEN 1 AND 20 OR state<>'ready') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expected clean v18 baseline; inspect version state';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND engine='InnoDB' AND table_name IN ('access_handovers','access_operations','access_roles','access_state','ai_attempts','campaign_promotion_index','campaign_promotion_short_links','campaign_source_reviews','cms_collections','cms_media','conversations','crm_ai_extractions','crm_courses','crm_engagements','crm_facts','crm_login_limits','crm_operations','crm_payment_images','crm_payment_ledgers','crm_payment_references','crm_sessions','crm_users','followup_tasks','hsk_attempts','identity_candidates','lead_daily_counters','messages','notification_channels','notification_inbox','notification_jobs','notification_migration_holds','notification_rules','outbox','portal_audit','portal_leads','portal_settings','rule_versions','site_submissions','trial_campaigns','trial_members','trial_schema_versions','visitor_sessions'))<>42 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing v18 baseline tables';
  END IF;
  IF EXISTS (SELECT 1 FROM trial_schema_versions WHERE version=20) AND (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('crm_payment_analytics','enrollment_assisted_applications','enrollment_class_openings','enrollment_classes','enrollment_customer_records','enrollment_demands','enrollment_email_challenges','enrollment_email_sessions','enrollment_interest_events','enrollment_mail_attempts','enrollment_mail_bindings','enrollment_mail_configuration','enrollment_notification_receipts','enrollment_opportunities','enrollment_opportunity_progress','enrollment_orders','enrollment_payment_credits','enrollment_proofs','enrollment_receipts','enrollment_record_attribution','enrollment_refund_cases','enrollment_refund_payments','enrollment_refund_returns','enrollment_transfer_invitations','enrollment_transfers','enrollment_vacancy_cycles','enrollment_waitlist','integration_credentials'))<>28 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Marked v20 but target tables missing: investigate before any DDL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics' AND (
      (column_name='id' AND LOWER(column_type)='char(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='ascii_bin') OR
      (column_name='environment' AND LOWER(column_type)='enum(''dev'',''test'',''prod'')' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='project_id' AND LOWER(column_type)='varchar(191)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='source_entry_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='ascii_bin') OR
      (column_name='kind' AND LOWER(column_type)='enum(''purchase'',''refund'')' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='sequence_no' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='amount' AND LOWER(column_type)='bigint unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='course_id' AND LOWER(column_type)='varchar(191)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='state' AND LOWER(column_type)='enum(''held'',''cancelled'')' AND is_nullable='NO' AND (LOWER(column_default) <=> 'held') AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> 'current_timestamp(6)')) OR
      (column_name='dispatch_state' AND LOWER(column_type)='enum(''sending'',''accepted'',''rejected'',''unknown'',''blocked'')' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='attempted_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='occurred_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL))))<>13 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crm_payment_analytics: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crm_payment_analytics: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics' AND index_name='payment_analytics_order' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,project_id,sequence_no') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crm_payment_analytics: incompatible index payment_analytics_order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics' AND index_name='payment_analytics_queue' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,state,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crm_payment_analytics: incompatible index payment_analytics_queue';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics' AND index_name='payment_analytics_dispatch' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,dispatch_state,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crm_payment_analytics: incompatible index payment_analytics_dispatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='crm_payment_analytics' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='crm_payment_analytics: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_assisted_applications') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_assisted_applications' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='token_digest' AND LOWER(column_type)='char(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='opportunity_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='customer_id' AND LOWER(column_type)='varchar(191)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='class_revision' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='actor' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='email' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='data' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='expires_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='confirmed_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin')))<>13 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_assisted_applications: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_assisted_applications' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_assisted_applications: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_assisted_applications' AND index_name='enrollment_assisted_token' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='token_digest') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_assisted_applications: incompatible index enrollment_assisted_token';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_assisted_applications' AND index_name='enrollment_assisted_opportunity' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='opportunity_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_assisted_applications: incompatible index enrollment_assisted_opportunity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_assisted_applications' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_assisted_applications: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_class_openings') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_class_openings' AND (
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='opened_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_class_openings: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_class_openings' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='class_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_class_openings: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_class_openings' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_class_openings: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_classes') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_classes' AND (
      (column_name='id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='course_id' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='revision' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='first_lesson_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='enrollment_closes_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='data' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='updated_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>8 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_classes: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_classes' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_classes: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_classes' AND index_name='enrollment_class_catalog' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='state,first_lesson_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_classes: incompatible index enrollment_class_catalog';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_classes' AND index_name='enrollment_class_course' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='course_id,first_lesson_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_classes: incompatible index enrollment_class_course';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_classes' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_classes: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_customer_records') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_customer_records' AND (
      (column_name='kind' AND LOWER(column_type)='varchar(12)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='record_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='lead_id' AND LOWER(column_type)='varchar(191)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='opportunity_id' AND LOWER(column_type)='char(36)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_customer_records: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_customer_records' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='kind,record_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_customer_records: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_customer_records' AND index_name='enrollment_customer_records_lead' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='lead_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_customer_records: incompatible index enrollment_customer_records_lead';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_customer_records' AND index_name='enrollment_customer_records_opportunity' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='opportunity_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_customer_records: incompatible index enrollment_customer_records_opportunity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_customer_records' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_customer_records: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_demands') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_demands' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='email' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='revision' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='criteria' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='updated_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_demands: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_demands' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_demands: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_demands' AND index_name='enrollment_demands_owner' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='email,updated_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_demands: incompatible index enrollment_demands_owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_demands' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_demands: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_email_challenges') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_email_challenges' AND (
      (column_name='email' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='challenge_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='digest' AND LOWER(column_type)='char(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='expires_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='resend_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='locked_until' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='attempts' AND LOWER(column_type)='tinyint unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> '0')) OR
      (column_name='used' AND LOWER(column_type)='tinyint(1)' AND is_nullable='NO' AND (LOWER(column_default) <=> '0'))))<>8 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_challenges: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_email_challenges' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='email') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_challenges: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_email_challenges' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_challenges: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_email_sessions') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_email_sessions' AND (
      (column_name='digest' AND LOWER(column_type)='char(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='email' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='expires_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_sessions: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_email_sessions' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='digest') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_sessions: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_email_sessions' AND index_name='enrollment_email_session_expiry' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='expires_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_sessions: incompatible index enrollment_email_session_expiry';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_email_sessions' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_email_sessions: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_interest_events') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_interest_events' AND (
      (column_name='kind' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='interest_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='cycle' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_interest_events: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_interest_events' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='kind,interest_id,class_id,cycle') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_interest_events: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_interest_events' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_interest_events: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='environment' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='event_key' AND LOWER(column_type)='varchar(160)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='account' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='recipient' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='is_external' AND LOWER(column_type)='tinyint(1)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='day_key' AND LOWER(column_type)='char(10)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='month_key' AND LOWER(column_type)='char(7)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='started_ms' AND LOWER(column_type)='bigint' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='pool_id' AND LOWER(column_type)='varchar(40)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin')))<>11 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='mail_rate' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,started_ms') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index mail_rate';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='mail_daily' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,day_key,account') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index mail_daily';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='mail_monthly' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,month_key,account') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index mail_monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='mail_event' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,event_key') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index mail_event';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='mail_recipient' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,recipient,state') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index mail_recipient';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND index_name='mail_pool_daily' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,day_key,pool_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: incompatible index mail_pool_daily';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_mail_attempts' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_attempts: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_mail_bindings') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_mail_bindings' AND (
      (column_name='environment' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='recipient' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='account' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin')))<>3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_bindings: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_bindings' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,recipient') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_bindings: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_mail_bindings' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_bindings: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_mail_configuration') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_mail_configuration' AND (
      (column_name='environment' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='revision' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='config' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_configuration: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_mail_configuration' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_configuration: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_mail_configuration' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_mail_configuration: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_notification_receipts') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_notification_receipts' AND (
      (column_name='event_key' AND LOWER(column_type)='varchar(160)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='channel' AND LOWER(column_type)='varchar(8)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='kind' AND LOWER(column_type)='varchar(32)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='subject_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='payload' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='recorded_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>7 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_notification_receipts: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_notification_receipts' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='event_key') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_notification_receipts: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_notification_receipts' AND index_name='enrollment_notification_subject' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='subject_id,recorded_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_notification_receipts: incompatible index enrollment_notification_subject';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_notification_receipts' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_notification_receipts: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_opportunities') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_opportunities' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='lead_id' AND LOWER(column_type)='varchar(191)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='level' AND LOWER(column_type)='varchar(24)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='revision' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> '0')) OR
      (column_name='sales_stage' AND LOWER(column_type)='varchar(32)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunities: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_opportunities' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunities: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_opportunities' AND index_name='enrollment_opportunity_lead' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='lead_id,level,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunities: incompatible index enrollment_opportunity_lead';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_opportunities' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunities: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_opportunity_progress') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_opportunity_progress' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='opportunity_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='actor' AND LOWER(column_type)='varchar(191)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='sales_stage' AND LOWER(column_type)='varchar(32)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='note' AND LOWER(column_type)='varchar(2000)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunity_progress: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_opportunity_progress' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunity_progress: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_opportunity_progress' AND index_name='enrollment_opportunity_progress_history' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='opportunity_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunity_progress: incompatible index enrollment_opportunity_progress_history';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_opportunity_progress' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_opportunity_progress: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_orders') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_orders' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='email' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='request_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='fingerprint' AND LOWER(column_type)='char(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='price' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='received' AND LOWER(column_type)='bigint unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> '0')) OR
      (column_name='payment_due_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='upload_id' AND LOWER(column_type)='char(36)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='upload_expires_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='data' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='activity_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL))))<>14 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_orders: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_orders' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_orders: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_orders' AND index_name='enrollment_order_request' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='email,request_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_orders: incompatible index enrollment_order_request';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_orders' AND index_name='enrollment_order_seats' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='class_id,state,payment_due_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_orders: incompatible index enrollment_order_seats';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_orders' AND index_name='enrollment_order_email' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='email,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_orders: incompatible index enrollment_order_email';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_orders' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_orders: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='receipt_reference' AND LOWER(column_type)='varchar(120)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='source_order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='target_order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='amount' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_payment_credits: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_payment_credits: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits' AND index_name='enrollment_credit_receipt' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='receipt_reference') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_payment_credits: incompatible index enrollment_credit_receipt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits' AND index_name='enrollment_credit_source' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='source_order_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_payment_credits: incompatible index enrollment_credit_source';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits' AND index_name='enrollment_credit_target' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='target_order_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_payment_credits: incompatible index enrollment_credit_target';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_payment_credits' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_payment_credits: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_proofs') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_proofs' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='mime' AND LOWER(column_type)='varchar(24)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='digest' AND LOWER(column_type)='char(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='proof' AND LOWER(column_type)='longblob' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='transfer_details' AND LOWER(column_type)='json' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL))))<>7 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_proofs: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_proofs' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_proofs: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_proofs' AND index_name='enrollment_proof_order' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='order_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_proofs: incompatible index enrollment_proof_order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_proofs' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_proofs: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_receipts') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_receipts' AND (
      (column_name='reference' AND LOWER(column_type)='varchar(120)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='amount' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='actor' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='settled_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='receiving_account' AND LOWER(column_type)='varchar(160)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin')))<>7 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_receipts: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_receipts' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='reference') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_receipts: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_receipts' AND index_name='enrollment_receipt_order' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='order_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_receipts: incompatible index enrollment_receipt_order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_receipts' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_receipts: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_record_attribution') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_record_attribution' AND (
      (column_name='kind' AND LOWER(column_type)='varchar(12)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='record_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='attribution' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_record_attribution: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_record_attribution' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='kind,record_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_record_attribution: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_record_attribution' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_record_attribution: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_refund_cases') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_refund_cases' AND (
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='actor' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='reason' AND LOWER(column_type)='varchar(1000)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='delivered_sessions' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='expected' AND LOWER(column_type)='bigint unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='timing' AND LOWER(column_type)='json' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL))))<>8 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_cases: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_refund_cases' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='order_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_cases: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_refund_cases' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_cases: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_refund_payments') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_refund_payments' AND (
      (column_name='reference' AND LOWER(column_type)='varchar(120)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='receipt_reference' AND LOWER(column_type)='varchar(120)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='amount' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='actor' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_payments: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_refund_payments' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='reference') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_payments: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_refund_payments' AND index_name='enrollment_refund_order' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='order_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_payments: incompatible index enrollment_refund_order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_refund_payments' AND index_name='enrollment_refund_receipt' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='receipt_reference') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_payments: incompatible index enrollment_refund_receipt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_refund_payments' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_payments: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_refund_returns') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_refund_returns' AND (
      (column_name='reference' AND LOWER(column_type)='varchar(120)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='refund_reference' AND LOWER(column_type)='varchar(120)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='amount' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='actor' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_returns: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_refund_returns' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='reference') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_returns: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_refund_returns' AND index_name='enrollment_refund_return_payment' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='refund_reference') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_returns: incompatible index enrollment_refund_return_payment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_refund_returns' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_refund_returns: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_transfer_invitations') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_transfer_invitations' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='source_class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='target_class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='actor' AND LOWER(column_type)='varchar(100)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='expires_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>8 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfer_invitations: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_transfer_invitations' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfer_invitations: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_transfer_invitations' AND index_name='enrollment_transfer_order' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='order_id,state,expires_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfer_invitations: incompatible index enrollment_transfer_order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_transfer_invitations' AND index_name='enrollment_transfer_target' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='target_class_id,state,expires_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfer_invitations: incompatible index enrollment_transfer_target';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_transfer_invitations' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfer_invitations: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_transfers') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_transfers' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='source_class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='target_class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='invitation_id' AND LOWER(column_type)='char(36)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>6 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfers: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_transfers' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfers: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_transfers' AND index_name='enrollment_transfers_order' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='order_id,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfers: incompatible index enrollment_transfers_order';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_transfers' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_transfers: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_vacancy_cycles') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_vacancy_cycles' AND (
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='is_full' AND LOWER(column_type)='tinyint(1)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='cycle' AND LOWER(column_type)='int unsigned' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_vacancy_cycles: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_vacancy_cycles' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='class_id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_vacancy_cycles: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_vacancy_cycles' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_vacancy_cycles: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_waitlist') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollment_waitlist' AND (
      (column_name='id' AND LOWER(column_type)='char(36)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='class_id' AND LOWER(column_type)='varchar(64)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='email' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='phone' AND LOWER(column_type)='varchar(26)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='state' AND LOWER(column_type)='varchar(16)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='order_id' AND LOWER(column_type)='char(36)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='created_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL)) OR
      (column_name='learner_name' AND LOWER(column_type)='varchar(120)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='activity_at' AND LOWER(column_type)='datetime(6)' AND is_nullable='YES' AND (LOWER(column_default) <=> NULL))))<>9 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_waitlist: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_waitlist' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='id') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_waitlist: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_waitlist' AND index_name='enrollment_waitlist_owner' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='email,created_at') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_waitlist: incompatible index enrollment_waitlist_owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='enrollment_waitlist' AND index_name='enrollment_waitlist_class' GROUP BY index_name HAVING MAX(non_unique)=1 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='class_id,state') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_waitlist: incompatible index enrollment_waitlist_class';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='enrollment_waitlist' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='enrollment_waitlist: expected InnoDB';
  END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='integration_credentials') THEN
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='integration_credentials' AND (
      (column_name='environment' AND LOWER(column_type)='varchar(4)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='ascii_bin') OR
      (column_name='kind' AND LOWER(column_type)='varchar(20)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='ascii_bin') OR
      (column_name='resource' AND LOWER(column_type)='varchar(254)' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL) AND collation_name='utf8mb4_0900_bin') OR
      (column_name='state' AND LOWER(column_type)='json' AND is_nullable='NO' AND (LOWER(column_default) <=> NULL))))<>4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='integration_credentials: incompatible columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='integration_credentials' AND index_name='PRIMARY' GROUP BY index_name HAVING MAX(non_unique)=0 AND COUNT(sub_part)=0 AND GROUP_CONCAT(column_name ORDER BY seq_in_index)='environment,kind,resource') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='integration_credentials: incompatible index PRIMARY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='integration_credentials' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='integration_credentials: expected InnoDB';
  END IF;
  END IF;
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
    KEY payment_analytics_queue (environment, state, created_at),
    dispatch_state ENUM('sending','accepted','rejected','unknown','blocked') NULL,
    attempted_at DATETIME(6) NULL,
    INDEX payment_analytics_dispatch (environment,dispatch_state,created_at),
    occurred_at DATETIME(6) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
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
  CREATE TABLE IF NOT EXISTS enrollment_class_openings (
    class_id VARCHAR(64) PRIMARY KEY,
    opened_at DATETIME(6) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_classes (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(100) NOT NULL,
    revision INT UNSIGNED NOT NULL,
    state VARCHAR(16) NOT NULL,
    first_lesson_at DATETIME(6) NOT NULL,
    enrollment_closes_at DATETIME(6) NOT NULL,
    data JSON NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    KEY enrollment_class_catalog (state, first_lesson_at),
    KEY enrollment_class_course (course_id, first_lesson_at)
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
  CREATE TABLE IF NOT EXISTS enrollment_demands (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    revision INT UNSIGNED NOT NULL,
    state VARCHAR(16) NOT NULL,
    criteria JSON NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    KEY enrollment_demands_owner (email,updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_email_challenges (
    email VARCHAR(254) PRIMARY KEY,
    challenge_id CHAR(36) NOT NULL,
    digest CHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    resend_at DATETIME(6) NOT NULL,
    locked_until DATETIME(6) NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_email_sessions (
    digest CHAR(64) PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    KEY enrollment_email_session_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_interest_events (
    kind VARCHAR(16) NOT NULL,
    interest_id CHAR(36) NOT NULL,
    class_id VARCHAR(64) NOT NULL,
    cycle INT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY(kind,interest_id,class_id,cycle)
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
    KEY mail_recipient(environment,recipient,state),
    pool_id VARCHAR(40) NULL,
    KEY mail_pool_daily (environment, day_key, pool_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_mail_bindings (
    environment VARCHAR(16) NOT NULL,
    recipient VARCHAR(254) NOT NULL,
    account VARCHAR(254) NOT NULL,
    PRIMARY KEY(environment,recipient)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_mail_configuration (
    environment VARCHAR(16) PRIMARY KEY,
    revision INT UNSIGNED NOT NULL,
    config JSON NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_notification_receipts (
    event_key VARCHAR(160) PRIMARY KEY,
    channel VARCHAR(8) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    state VARCHAR(16) NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    KEY enrollment_notification_subject(subject_id,recorded_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
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
  CREATE TABLE IF NOT EXISTS enrollment_orders (
    id CHAR(36) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL,
    email VARCHAR(254) NOT NULL,
    request_id CHAR(36) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL,
    price INT UNSIGNED NOT NULL,
    received BIGINT UNSIGNED NOT NULL DEFAULT 0,
    payment_due_at DATETIME(6) NOT NULL,
    upload_id CHAR(36) NULL,
    upload_expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    data JSON NOT NULL,
    UNIQUE KEY enrollment_order_request (email,request_id),
    KEY enrollment_order_seats (class_id,state,payment_due_at),
    KEY enrollment_order_email (email,created_at),
    activity_at DATETIME(6) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_payment_credits (
    id CHAR(36) PRIMARY KEY,
    receipt_reference VARCHAR(120) NOT NULL,
    source_order_id CHAR(36) NOT NULL,
    target_order_id CHAR(36) NOT NULL,
    amount INT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_credit_receipt (receipt_reference),
    KEY enrollment_credit_source (source_order_id,created_at),
    KEY enrollment_credit_target (target_order_id,created_at),
    CHECK (amount > 0 AND source_order_id <> target_order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_proofs (
    id CHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    mime VARCHAR(24) NOT NULL,
    digest CHAR(64) NOT NULL,
    proof LONGBLOB NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_proof_order (order_id,created_at),
    transfer_details JSON DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_receipts (
    reference VARCHAR(120) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    amount INT UNSIGNED NOT NULL,
    actor VARCHAR(100) NOT NULL,
    settled_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_receipt_order (order_id),
    receiving_account VARCHAR(160) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_record_attribution (
    kind VARCHAR(12) NOT NULL,
    record_id CHAR(36) NOT NULL,
    attribution JSON NOT NULL,
    PRIMARY KEY(kind,record_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_refund_cases (
    order_id CHAR(36) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    delivered_sessions INT UNSIGNED NOT NULL,
    expected BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    timing JSON DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_refund_payments (
    reference VARCHAR(120) PRIMARY KEY,
    receipt_reference VARCHAR(120) NOT NULL,
    order_id CHAR(36) NOT NULL,
    amount INT UNSIGNED NOT NULL,
    actor VARCHAR(100) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_refund_order (order_id),
    KEY enrollment_refund_receipt (receipt_reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_refund_returns (
    reference VARCHAR(120) PRIMARY KEY,
    refund_reference VARCHAR(120) NOT NULL,
    amount INT UNSIGNED NOT NULL,
    actor VARCHAR(100) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_refund_return_payment (refund_reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_transfer_invitations (
    id CHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    source_class_id VARCHAR(64) NOT NULL,
    target_class_id VARCHAR(64) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    state VARCHAR(16) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_transfer_order (order_id,state,expires_at),
    KEY enrollment_transfer_target (target_class_id,state,expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_transfers (
    id CHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    source_class_id VARCHAR(64) NOT NULL,
    target_class_id VARCHAR(64) NOT NULL,
    invitation_id CHAR(36) NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_transfers_order (order_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_vacancy_cycles (
    class_id VARCHAR(64) PRIMARY KEY,
    is_full BOOLEAN NOT NULL,
    cycle INT UNSIGNED NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS enrollment_waitlist (
    id CHAR(36) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(26) NOT NULL,
    state VARCHAR(16) NOT NULL,
    order_id CHAR(36) NULL,
    created_at DATETIME(6) NOT NULL,
    KEY enrollment_waitlist_owner (email,created_at),
    KEY enrollment_waitlist_class (class_id,state),
    learner_name VARCHAR(120) NULL,
    activity_at DATETIME(6) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
  CREATE TABLE IF NOT EXISTS integration_credentials (
    environment VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resource VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    state JSON NOT NULL,
    PRIMARY KEY (environment, kind, resource)
  ) ENGINE=InnoDB;
  INSERT INTO trial_schema_versions(version,state) SELECT 19,'ready' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM trial_schema_versions WHERE version=19);
  INSERT INTO trial_schema_versions(version,state) SELECT 20,'ready' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM trial_schema_versions WHERE version=20);
END$$
DELIMITER ;
CALL uper_release_20261126182423();
DROP PROCEDURE uper_release_20261126182423;
