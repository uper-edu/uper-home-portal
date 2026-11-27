-- MANUAL ROLLBACK WITH DESTRUCTIVE DDL. Use only with the matching tracked upgrade scripts.
-- Keep application, workers, and every other database writer stopped. Back up first.
-- Select the verified database, set @uper_expected_database and
-- @uper_rollback_confirm='v20-to-v18', and use a fresh mysql batch session without --force.
-- If a CALL fails, inspect and remove only this script's verified residual routine before retrying.
DELIMITER $$
CREATE PROCEDURE uper_rollback_20261127101113()
SQL SECURITY INVOKER
main: BEGIN
  DECLARE v_tables JSON DEFAULT JSON_ARRAY(
    'crm_payment_analytics','enrollment_assisted_applications','enrollment_class_openings','enrollment_classes',
    'enrollment_customer_records','enrollment_demands','enrollment_email_challenges','enrollment_email_sessions',
    'enrollment_interest_events','enrollment_mail_attempts','enrollment_mail_bindings','enrollment_mail_configuration',
    'enrollment_notification_receipts','enrollment_opportunities','enrollment_opportunity_progress','enrollment_orders',
    'enrollment_payment_credits','enrollment_proofs','enrollment_receipts','enrollment_record_attribution',
    'enrollment_refund_cases','enrollment_refund_payments','enrollment_refund_returns','enrollment_transfer_invitations',
    'enrollment_transfers','enrollment_vacancy_cycles','enrollment_waitlist','integration_credentials');
  DECLARE v_begin_id BIGINT UNSIGNED;
  DECLARE v_run CHAR(36) CHARACTER SET ascii;
  DECLARE v_marker VARCHAR(64) CHARACTER SET ascii;
  DECLARE v_lock VARCHAR(64) CHARACTER SET ascii;
  DECLARE v_locked BOOLEAN DEFAULT FALSE;
  DECLARE v_table VARCHAR(64) CHARACTER SET ascii;
  DECLARE v_present INT;
  DECLARE v_drop TEXT;
  DECLARE v_versions INT;
  DECLARE v_schema BOOLEAN;
  DECLARE v_resume BOOLEAN;
  DECLARE v_delivery JSON;
  DECLARE v_seed JSON;
  DECLARE v_patch JSON;
  DECLARE v_config JSON;
  DECLARE v_links JSON;
  DECLARE v_indexes JSON;
  DECLARE v_ids JSON;
  DECLARE v_channels JSON;
  DECLARE v_group JSON;
  DECLARE v_kept JSON;
  DECLARE v_link JSON;
  DECLARE v_key VARCHAR(191);
  DECLARE v_i INT;
  DECLARE v_hash CHAR(64) CHARACTER SET ascii;
  DECLARE v_before CHAR(64) CHARACTER SET ascii;
  DECLARE v_group_checked BOOLEAN DEFAULT FALSE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    IF v_locked THEN DO RELEASE_LOCK(v_lock); END IF;
    RESIGNAL;
  END;

  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE()<>BINARY @uper_expected_database OR VERSION() NOT LIKE '8.%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Check the intended database';
  END IF;
  IF @uper_rollback_confirm IS NULL OR BINARY @uper_rollback_confirm<>BINARY 'v20-to-v18' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rollback drops tables; explicit confirmation required';
  END IF;
  SET v_lock=CONCAT('uper-db-release:',LEFT(SHA2(DATABASE(),256),40));
  IF NOT COALESCE(GET_LOCK(v_lock,0),0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another upgrade or rollback is running';
  END IF;
  SET v_locked=TRUE;
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,21)='access_restore_guard_') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Interrupted access restore; stop';
  END IF;
  IF (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 18 AND state='ready')<>18
     OR EXISTS(SELECT 1 FROM trial_schema_versions WHERE version NOT BETWEEN 1 AND 20) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expected a v18 to v20 database; inspect version state';
  END IF;

  SET v_present=(SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema=DATABASE() AND JSON_CONTAINS(v_tables,JSON_QUOTE(table_name)));
  SET v_versions=(SELECT COUNT(*) FROM trial_schema_versions WHERE version IN (19,20));
  SET v_begin_id=(SELECT MAX(id) FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.begin');
  SET v_run=(SELECT data->>'$.run' FROM portal_audit WHERE id=v_begin_id);
  IF v_run IS NULL OR EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.reverted' AND data->>'$.run'=v_run) THEN
    IF v_present<>0 OR v_versions<>0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Upgrade origin unavailable; use the pre-upgrade backup or review manually';
    END IF;
    DO RELEASE_LOCK(v_lock);
    LEAVE main;
  END IF;
  IF v_run NOT REGEXP '^[0-9a-f-]{36}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid upgrade origin';
  END IF;
  SET v_marker=CONCAT('uper-v18v20:',v_run);
  SET v_schema=EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.schema' AND data->>'$.run'=v_run);
  SET v_resume=EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.reverting' AND data->>'$.run'=v_run);
  IF (v_schema AND v_versions<>2) OR (NOT v_schema AND v_versions<>0)
     OR (v_schema AND NOT v_resume AND v_present<>JSON_LENGTH(v_tables)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Tracked schema or version rows changed; review manually';
  END IF;
  IF EXISTS(SELECT 1 FROM trial_schema_versions WHERE version IN (19,20) AND state<>IF(v_resume,'rolling_back','ready')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Schema version no longer matches its rollback checkpoint';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND engine='InnoDB'
      AND table_name IN ('trial_schema_versions','portal_audit','notification_rules','trial_campaigns',
        'campaign_promotion_index','notification_channels','portal_settings'))<>7 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expected InnoDB for all rollout journal and configuration tables';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND JSON_CONTAINS(v_tables,JSON_QUOTE(table_name))
      AND (table_type<>'BASE TABLE' OR engine<>'InnoDB' OR BINARY table_comment<>BINARY v_marker)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Target table is not owned by this upgrade';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.triggers WHERE event_object_schema=DATABASE()
      AND (JSON_CONTAINS(v_tables,JSON_QUOTE(event_object_table)) OR event_object_table IN
        ('trial_schema_versions','portal_audit','notification_rules','trial_campaigns','campaign_promotion_index','notification_channels','portal_settings')))
     OR EXISTS(SELECT 1 FROM information_schema.key_column_usage WHERE referenced_table_schema=DATABASE()
         AND JSON_CONTAINS(v_tables,JSON_QUOTE(referenced_table_name))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Target tables have added triggers or relationships; review manually';
  END IF;

  IF EXISTS(SELECT 1 FROM portal_audit WHERE id>v_begin_id AND actor='manual-sql'
      AND action IN ('channel.mode.migrate','enrollment.mail.mode.migrate','system.defaults.seed')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Older upgrade SQL was mixed into this run; review manually';
  END IF;
  SET v_delivery=(SELECT data FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.delivery' AND data->>'$.run'=v_run);
  SET v_seed=(SELECT data FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.seed' AND data->>'$.run'=v_run);
  SET v_i=0;
  WHILE v_i<JSON_LENGTH(v_tables) DO
    SET v_table=JSON_UNQUOTE(JSON_EXTRACT(v_tables,CONCAT('$[',v_i,']')));
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=v_table) THEN
      IF v_table='enrollment_mail_configuration' AND v_delivery IS NOT NULL THEN
        IF (SELECT COUNT(*) FROM enrollment_mail_configuration)<>1 OR NOT EXISTS(
          SELECT 1 FROM enrollment_mail_configuration WHERE BINARY environment=BINARY (JSON_UNQUOTE(JSON_EXTRACT(v_delivery,'$.environment'))) AND revision=0
          AND SHA2(CAST(config AS CHAR CHARACTER SET utf8mb4),256)=JSON_UNQUOTE(JSON_EXTRACT(v_delivery,'$.mailHash'))) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Enrollment mail configuration changed; stop';
        END IF;
      ELSE
        SET @uper_rollback_statement=CONCAT('SELECT EXISTS(SELECT 1 FROM `',v_table,'`) INTO @uper_rollback_used');
        PREPARE uper_rollback_statement FROM @uper_rollback_statement;
        EXECUTE uper_rollback_statement;
        DEALLOCATE PREPARE uper_rollback_statement;
        IF @uper_rollback_used THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Tables of the new version hold business data; stop';
        END IF;
      END IF;
    END IF;
    SET v_i=v_i+1;
  END WHILE;

  START TRANSACTION;
  -- Reverse the seed before delivery because both can update the same channel.
  -- Every comparison, restore and the DML checkpoint share a transaction.
  IF CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(v_seed,'$.ruleHash')))=64 THEN
    IF EXISTS(SELECT 1 FROM notification_jobs WHERE rule_id='lead.assigned')
       OR EXISTS(SELECT 1 FROM rule_versions WHERE id='lead.assigned') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='New notification rule has business history; stop';
    END IF;
    SET v_hash=(SELECT SHA2(CAST(JSON_ARRAY(version,config,enabled,effective_at) AS CHAR CHARACTER SET utf8mb4),256)
      FROM notification_rules WHERE id='lead.assigned' FOR UPDATE);
    IF v_resume THEN
      IF v_hash IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Notification rule changed after rollback began'; END IF;
    ELSE
      IF NOT (v_hash<=>JSON_UNQUOTE(JSON_EXTRACT(v_seed,'$.ruleHash'))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Notification rule changed; stop'; END IF;
      DELETE FROM notification_rules WHERE id='lead.assigned';
    END IF;
  END IF;

  SET v_patch=JSON_EXTRACT(v_seed,'$.campaign');
  SET v_links=COALESCE(JSON_EXTRACT(v_patch,'$.links'),JSON_ARRAY());
  SET v_indexes=COALESCE(JSON_EXTRACT(v_seed,'$.indexes'),JSON_ARRAY());
  SET v_ids=JSON_MERGE_PRESERVE(v_links,v_indexes);
  SET v_i=0;
  WHILE v_i<JSON_LENGTH(v_ids) DO
    SET v_key=JSON_UNQUOTE(JSON_EXTRACT(v_ids,CONCAT('$[',v_i,']')));
    -- This upgrade never created short links or assigned customers to a promotion.
    IF EXISTS(SELECT 1 FROM campaign_promotion_short_links WHERE p=v_key)
       OR EXISTS(SELECT 1 FROM portal_leads WHERE profile->>'$.promotionLinkId'=v_key OR profile->>'$.rawPromotionLinkId'=v_key
          OR profile->>'$.promotionReview.linkId'=v_key OR JSON_CONTAINS(JSON_EXTRACT(profile,'$.identitySources[*].promotionLinkId'),JSON_QUOTE(v_key)))
       OR EXISTS(SELECT 1 FROM portal_audit WHERE action='campaign.promotion.review'
          AND (data->>'$.before.linkId'=v_key OR data->>'$.after.linkId'=v_key)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Upgrade promotion has links or customer attribution; stop';
    END IF;
    SET v_i=v_i+1;
  END WHILE;

  IF JSON_TYPE(v_patch)='OBJECT' THEN
    SET v_config=(SELECT config FROM trial_campaigns WHERE id='social-bio' AND code='social-bio' FOR UPDATE);
    IF NOT v_resume THEN
      IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.after'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Social-bio campaign changed; stop';
      END IF;
      SET v_kept=JSON_ARRAY();
      SET v_link=JSON_EXTRACT(v_config,'$.promotionLinks');
      SET v_i=0;
      WHILE v_i<JSON_LENGTH(v_link) DO
        SET v_ids=JSON_EXTRACT(v_link,CONCAT('$[',v_i,']'));
        IF NOT COALESCE(JSON_CONTAINS(v_links,JSON_EXTRACT(v_ids,'$.id')),FALSE) THEN
          SET v_kept=JSON_ARRAY_APPEND(v_kept,'$',v_ids);
        END IF;
        SET v_i=v_i+1;
      END WHILE;
      SET v_config=JSON_REMOVE(v_config,'$.promotionLinks','$.systemManaged','$.updatedAt');
      IF JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.hadLinks'))='1' THEN SET v_config=JSON_SET(v_config,'$.promotionLinks',v_kept); END IF;
      IF JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.hadManaged'))='1' THEN SET v_config=JSON_SET(v_config,'$.systemManaged',JSON_EXTRACT(v_patch,'$.managed')); END IF;
      IF JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.hadUpdatedAt'))='1' THEN SET v_config=JSON_SET(v_config,'$.updatedAt',JSON_EXTRACT(v_patch,'$.updatedAt')); END IF;
      UPDATE trial_campaigns SET config=v_config WHERE id='social-bio';
    END IF;
    IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.before'))) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Social-bio campaign does not match its original configuration';
    END IF;
  END IF;

  SET v_i=0;
  WHILE v_i<JSON_LENGTH(v_indexes) DO
    SET v_key=JSON_UNQUOTE(JSON_EXTRACT(v_indexes,CONCAT('$[',v_i,']')));
    IF v_resume THEN
      IF EXISTS(SELECT 1 FROM campaign_promotion_index WHERE p=v_key) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Promotion index changed after rollback began';
      END IF;
    ELSE
      DELETE FROM campaign_promotion_index WHERE p=v_key AND BINARY campaign_id=BINARY 'social-bio';
      IF ROW_COUNT()<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Promotion index changed; stop'; END IF;
    END IF;
    SET v_i=v_i+1;
  END WHILE;

  SET v_group=JSON_EXTRACT(v_seed,'$.group');
  IF JSON_TYPE(v_group)='OBJECT' AND NOT v_resume THEN
    SET v_key=JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.id'));
    SET v_config=(SELECT config FROM notification_channels WHERE id=v_key FOR UPDATE);
    IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.after'))) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='System Lark group changed; stop';
    END IF;
    SET v_config=JSON_REMOVE(JSON_SET(v_config,'$.groupName',JSON_EXTRACT(v_group,'$.groupName')),'$.systemManaged');
    IF JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.hadManaged'))='1' THEN SET v_config=JSON_SET(v_config,'$.systemManaged',JSON_EXTRACT(v_group,'$.managed')); END IF;
    IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.before'))) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot restore the original Lark group configuration';
    END IF;
    UPDATE notification_channels SET config=v_config WHERE id=v_key;
  END IF;

  SET v_channels=COALESCE(JSON_EXTRACT(v_delivery,'$.channels'),JSON_ARRAY());
  SET v_i=0;
  WHILE v_i<JSON_LENGTH(v_channels) DO
    SET v_patch=JSON_EXTRACT(v_channels,CONCAT('$[',v_i,']'));
    SET v_key=JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.id'));
    IF BINARY v_key=BINARY (JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.id'))) THEN SET v_group_checked=TRUE; END IF;
    SET v_config=(SELECT config FROM notification_channels WHERE id=v_key FOR UPDATE);
    IF NOT v_resume THEN
      IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.after'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Lark group delivery configuration changed; stop';
      END IF;
      SET v_config=JSON_SET(v_config,'$.mode',JSON_EXTRACT(v_patch,'$.mode'));
      UPDATE notification_channels SET config=v_config WHERE id=v_key;
    END IF;
    IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.before'))) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Lark group mode does not match its original configuration';
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  IF v_resume AND JSON_TYPE(v_group)='OBJECT' AND NOT v_group_checked THEN
    SET v_config=(SELECT config FROM notification_channels WHERE id=JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.id')) FOR UPDATE);
    IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_group,'$.before'))) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='System Lark group changed after rollback began';
    END IF;
  END IF;

  SET v_patch=JSON_EXTRACT(v_delivery,'$.personal');
  IF JSON_TYPE(v_patch)='OBJECT' THEN
    SET v_before=NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.before')),'null');
    SET v_config=(SELECT value FROM portal_settings WHERE id='lark_personal_channel' FOR UPDATE);
    IF NOT v_resume THEN
      IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.after'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Personal Lark configuration changed; stop';
      END IF;
      IF v_before IS NULL THEN
        DELETE FROM portal_settings WHERE id='lark_personal_channel';
        SET v_config=NULL;
      ELSE
        SET v_config=JSON_REMOVE(v_config,'$.mode','$.revision');
        IF JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.hadMode'))='1' THEN SET v_config=JSON_SET(v_config,'$.mode',JSON_EXTRACT(v_patch,'$.mode')); END IF;
        IF JSON_UNQUOTE(JSON_EXTRACT(v_patch,'$.hadRevision'))='1' THEN SET v_config=JSON_SET(v_config,'$.revision',JSON_EXTRACT(v_patch,'$.revision')); END IF;
        UPDATE portal_settings SET value=v_config WHERE id='lark_personal_channel';
      END IF;
    END IF;
    IF NOT (SHA2(CAST(v_config AS CHAR CHARACTER SET utf8mb4),256)<=>v_before) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Personal Lark configuration does not match its original value';
    END IF;
  END IF;

  IF NOT v_resume THEN
    UPDATE trial_schema_versions SET state='rolling_back' WHERE version IN (19,20);
    INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','release.v18v20.reverting',JSON_OBJECT('run',v_run));
  END IF;
  COMMIT;

  -- MySQL 8 drops this InnoDB list atomically in a single DDL statement, separate
  -- from the reversible data transaction. A retry verifies the restored values.
  SET v_i=0;
  WHILE v_i<JSON_LENGTH(v_tables) DO
    SET v_table=JSON_UNQUOTE(JSON_EXTRACT(v_tables,CONCAT('$[',v_i,']')));
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=v_table) THEN
      IF NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=v_table
          AND table_type='BASE TABLE' AND BINARY table_comment=BINARY v_marker) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Table ownership changed before DROP; stop';
      END IF;
      SET v_drop=CONCAT_WS(',',v_drop,CONCAT('`',v_table,'`'));
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  IF v_drop IS NOT NULL THEN
    SET @uper_rollback_statement=CONCAT('DROP TABLE ',v_drop);
    PREPARE uper_rollback_statement FROM @uper_rollback_statement;
    EXECUTE uper_rollback_statement;
    DEALLOCATE PREPARE uper_rollback_statement;
  END IF;
  START TRANSACTION;
  DELETE FROM trial_schema_versions WHERE version IN (19,20);
  INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','release.v18v20.reverted',JSON_OBJECT('run',v_run));
  COMMIT;
  DO RELEASE_LOCK(v_lock);
END$$
DELIMITER ;
CALL uper_rollback_20261127101113();
DROP PROCEDURE uper_rollback_20261127101113;
