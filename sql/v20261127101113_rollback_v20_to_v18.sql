-- MANUAL ROLLBACK WITH DESTRUCTIVE DDL (DROP TABLE). NOT A STARTUP HOOK.
-- Scope: a database upgraded from 95eea57 (v18) by v20261126182423, v20261126182717 and
-- v20261126192807, or one where that upgrade stopped part-way. Returns it to the v18 state:
--   1. removes what the seed step recorded as added: rule lead.assigned (its pending jobs are
--      cancelled, never replayed), the system Lark group marker (name back to the 95eea57 default),
--      the four enroll-* promotion presets with their index rows and short links;
--   2. removes the personal Lark delivery decision saved by the delivery step;
--   3. drops the 28 tables created by the schema step and deletes version rows 19 and 20.
-- Refused without any change when one of those tables holds data, because the new application
-- has then been used and dropping would destroy business records. Restore or review manually instead.
-- Required session inputs: @uper_expected_database (independently verified database name) and
-- @uper_rollback_confirm='v20-to-v18'. Fresh mysql batch session, abort on first error, no --force.
-- Keep application and queue consumers stopped. Take a backup first. A repeated run changes nothing.
-- Not restored: updatedAt of campaign social-bio. Audit rows written by the upgrade are kept.
-- DDL implicitly commits. On failure inspect the database and the ownership of the residual routine
-- before manual cleanup, then run this file again.
DELIMITER $$
CREATE PROCEDURE uper_rollback_20261127101113()
SQL SECURITY INVOKER
BEGIN
  DECLARE v_tables JSON DEFAULT JSON_ARRAY(
    'crm_payment_analytics','enrollment_assisted_applications','enrollment_class_openings','enrollment_classes',
    'enrollment_customer_records','enrollment_demands','enrollment_email_challenges','enrollment_email_sessions',
    'enrollment_interest_events','enrollment_mail_attempts','enrollment_mail_bindings','enrollment_mail_configuration',
    'enrollment_notification_receipts','enrollment_opportunities','enrollment_opportunity_progress','enrollment_orders',
    'enrollment_payment_credits','enrollment_proofs','enrollment_receipts','enrollment_record_attribution',
    'enrollment_refund_cases','enrollment_refund_payments','enrollment_refund_returns','enrollment_transfer_invitations',
    'enrollment_transfers','enrollment_vacancy_cycles','enrollment_waitlist','integration_credentials');
  DECLARE v_presets JSON DEFAULT JSON_ARRAY('enroll-ig','enroll-tt','enroll-yt','enroll-th');
  DECLARE v_system_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT CONCAT('Lark ',CONVERT(0xE7BEA4E9809AE79FA5 USING utf8mb4));
  DECLARE v_table VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_present INT DEFAULT 0;
  DECLARE v_since BIGINT UNSIGNED DEFAULT 0;
  DECLARE v_rules INT DEFAULT 0;
  DECLARE v_groups INT DEFAULT 0;
  DECLARE v_preset_count INT DEFAULT 0;
  DECLARE v_index_count INT DEFAULT 0;
  DECLARE v_mode_records INT DEFAULT 0;
  DECLARE v_simulated INT DEFAULT 0;
  DECLARE v_campaign JSON;
  DECLARE v_links JSON;
  DECLARE v_kept JSON;
  DECLARE v_link JSON;
  DECLARE v_jobs_cancelled INT DEFAULT 0;
  DECLARE v_rules_removed INT DEFAULT 0;
  DECLARE v_groups_restored INT DEFAULT 0;
  DECLARE v_presets_removed INT DEFAULT 0;
  DECLARE v_index_removed INT DEFAULT 0;
  DECLARE v_short_removed INT DEFAULT 0;
  DECLARE v_setting_removed INT DEFAULT 0;
  DECLARE v_versions_removed INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE()<>BINARY @uper_expected_database OR VERSION() NOT LIKE '8.%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Check the intended database';
  END IF;
  IF @uper_rollback_confirm IS NULL OR BINARY @uper_rollback_confirm<>BINARY 'v20-to-v18' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rollback drops tables; explicit confirmation required';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,21)='access_restore_guard_') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Interrupted access restore; stop';
  END IF;
  IF (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 18 AND state='ready')<>18
     OR EXISTS(SELECT 1 FROM trial_schema_versions WHERE version NOT BETWEEN 1 AND 20 OR state<>'ready') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expected a v18 to v20 database; inspect version state';
  END IF;
  -- Nothing is changed unless every table created by the schema step is still unused.
  WHILE v_i<JSON_LENGTH(v_tables) DO
    SET v_table=JSON_UNQUOTE(JSON_EXTRACT(v_tables,CONCAT('$[',v_i,']')));
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=v_table) THEN
      SET v_present=v_present+1;
      -- The delivery step leaves one row per environment holding only its decision; anything else is business data.
      SET @uper_rollback_statement=CONCAT('SELECT EXISTS(SELECT 1 FROM `',v_table,'`',
        IF(v_table='enrollment_mail_configuration',' WHERE revision<>0 OR JSON_LENGTH(config)<>1 OR JSON_CONTAINS_PATH(config,''one'',''$.delivery'')=0',''),
        ') INTO @uper_rollback_used');
      PREPARE uper_rollback_statement FROM @uper_rollback_statement;
      EXECUTE uper_rollback_statement;
      DEALLOCATE PREPARE uper_rollback_statement;
      IF @uper_rollback_used THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Tables of the new version hold data; rollback would destroy it. Nothing changed';
      END IF;
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  -- Only what the upgrade recorded since the previous rollback is undone.
  SET v_since=COALESCE((SELECT MAX(id) FROM portal_audit WHERE actor='manual-sql' AND action='release.rollback'),0);
  SELECT COALESCE(SUM(CAST(data->>'$.rules' AS UNSIGNED)),0),COALESCE(SUM(CAST(data->>'$.systemGroups' AS UNSIGNED)),0),
         COALESCE(SUM(CAST(data->>'$.promotionPresets' AS UNSIGNED)),0),COALESCE(SUM(CAST(data->>'$.promotionIndex' AS UNSIGNED)),0)
    INTO v_rules,v_groups,v_preset_count,v_index_count
    FROM portal_audit WHERE actor='manual-sql' AND action='system.defaults.seed' AND id>v_since;
  SELECT COUNT(*),COALESCE(SUM(CAST(data->>'$.simulatedGroupCount' AS UNSIGNED)),0) INTO v_mode_records,v_simulated
    FROM portal_audit WHERE actor='manual-sql' AND action='channel.mode.migrate' AND id>v_since;
  IF v_rules NOT IN (0,1) OR v_groups NOT IN (0,1) OR v_preset_count NOT IN (0,4) OR v_index_count NOT IN (0,4) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Seed record does not match a 95eea57 baseline; manual review required';
  END IF;
  IF v_simulated<>0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Group channels were switched to simulation by the upgrade; restore them from the recorded list first';
  END IF;
  START TRANSACTION;
  IF v_rules=1 THEN
    UPDATE notification_jobs SET state='cancelled',result='Rule removed by manual rollback; no replay',completed_at=UTC_TIMESTAMP(6)
     WHERE rule_id='lead.assigned' AND state='pending';
    SET v_jobs_cancelled=ROW_COUNT();
    DELETE FROM notification_rules WHERE id='lead.assigned';
    SET v_rules_removed=ROW_COUNT();
  END IF;
  IF v_groups=1 THEN
    IF (SELECT COUNT(*) FROM notification_channels WHERE id<>'lark-group-default' AND COALESCE(config->>'$.systemManaged','false')='true')>1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='More than one marked system Lark group; manual review required';
    END IF;
    UPDATE notification_channels
       SET config=JSON_REMOVE(IF(BINARY (config->>'$.groupName')=BINARY v_system_name,JSON_SET(config,'$.groupName','CRM Lark Bot'),config),'$.systemManaged')
     WHERE id<>'lark-group-default' AND COALESCE(config->>'$.systemManaged','false')='true';
    SET v_groups_restored=ROW_COUNT();
  END IF;
  IF v_preset_count=4 THEN
    SET v_campaign=(SELECT config FROM trial_campaigns WHERE id='social-bio' AND code='social-bio' FOR UPDATE);
    SET v_links=JSON_EXTRACT(v_campaign,'$.promotionLinks');
    IF v_links IS NULL OR JSON_TYPE(v_links)<>'ARRAY' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Malformed social-bio promotion links; manual review required';
    END IF;
    SET v_kept=JSON_ARRAY();
    SET v_i=0;
    WHILE v_i<JSON_LENGTH(v_links) DO
      SET v_link=JSON_EXTRACT(v_links,CONCAT('$[',v_i,']'));
      IF JSON_CONTAINS(v_presets,JSON_EXTRACT(v_link,'$.id')) THEN
        SET v_presets_removed=v_presets_removed+1;
      ELSE
        SET v_kept=JSON_ARRAY_APPEND(v_kept,'$',v_link);
      END IF;
      SET v_i=v_i+1;
    END WHILE;
    IF v_presets_removed>0 THEN
      UPDATE trial_campaigns SET config=JSON_SET(config,'$.promotionLinks',v_kept) WHERE id='social-bio';
    END IF;
  END IF;
  IF v_preset_count=4 OR v_index_count=4 THEN
    DELETE FROM campaign_promotion_short_links WHERE p IN ('enroll-ig','enroll-tt','enroll-yt','enroll-th');
    SET v_short_removed=ROW_COUNT();
    DELETE FROM campaign_promotion_index WHERE p IN ('enroll-ig','enroll-tt','enroll-yt','enroll-th') AND BINARY campaign_id=BINARY 'social-bio';
    SET v_index_removed=ROW_COUNT();
  END IF;
  IF v_mode_records>0 THEN
    DELETE FROM portal_settings WHERE id='lark_personal_channel';
    SET v_setting_removed=ROW_COUNT();
  END IF;
  SET v_versions_removed=(SELECT COUNT(*) FROM trial_schema_versions WHERE version IN (19,20));
  IF v_present+v_versions_removed+v_rules_removed+v_jobs_cancelled+v_groups_restored+v_presets_removed+v_index_removed+v_short_removed+v_setting_removed>0 THEN
    INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','release.rollback',
      JSON_OBJECT('rules',v_rules_removed,'cancelledJobs',v_jobs_cancelled,'systemGroups',v_groups_restored,'promotionPresets',v_presets_removed,
        'promotionIndex',v_index_removed,'shortLinks',v_short_removed,'personalChannel',v_setting_removed,'tables',v_present,'versions',v_versions_removed));
  END IF;
  COMMIT;
  SET v_i=0;
  WHILE v_i<JSON_LENGTH(v_tables) DO
    SET v_table=JSON_UNQUOTE(JSON_EXTRACT(v_tables,CONCAT('$[',v_i,']')));
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=v_table) THEN
      SET @uper_rollback_statement=CONCAT('DROP TABLE `',v_table,'`');
      PREPARE uper_rollback_statement FROM @uper_rollback_statement;
      EXECUTE uper_rollback_statement;
      DEALLOCATE PREPARE uper_rollback_statement;
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  START TRANSACTION;
  DELETE FROM trial_schema_versions WHERE version IN (19,20);
  COMMIT;
END$$
DELIMITER ;
CALL uper_rollback_20261127101113();
DROP PROCEDURE uper_rollback_20261127101113;
