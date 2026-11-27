-- MANUAL DATA TRANSITION, NOT A STARTUP HOOK. Existing tracked v20 upgrade only.
-- A fresh mysql batch session must select the intended database and use no --force.
-- Keep all writers stopped. The journal stores changed fields and digests, never Webhooks or account credentials.
DELIMITER $$
CREATE PROCEDURE uper_delivery_20261126182717()
SQL SECURITY INVOKER
main: BEGIN
  DECLARE v_run CHAR(36) CHARACTER SET ascii;
  DECLARE v_lock VARCHAR(64) CHARACTER SET ascii;
  DECLARE v_locked BOOLEAN DEFAULT FALSE;
  DECLARE v_personal JSON;
  DECLARE v_personal_after JSON;
  DECLARE v_personal_change JSON;
  DECLARE v_channels JSON DEFAULT JSON_ARRAY();
  DECLARE v_mail JSON;
  DECLARE v_done_environment VARCHAR(16);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    IF v_locked THEN DO RELEASE_LOCK(v_lock); END IF;
    RESIGNAL;
  END;
  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE()<>BINARY @uper_expected_database
     OR @uper_environment IS NULL OR BINARY @uper_environment NOT IN ('dev','test','prod') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Check the intended database and deployment environment';
  END IF;
  SET v_lock=CONCAT('uper-db-release:',LEFT(SHA2(DATABASE(),256),40));
  IF NOT COALESCE(GET_LOCK(v_lock,0),0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another upgrade or rollback is running';
  END IF;
  SET v_locked=TRUE;
  IF (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 20 AND state='ready')<>20
     OR EXISTS(SELECT 1 FROM trial_schema_versions WHERE version NOT BETWEEN 1 AND 20 OR state<>'ready')
     OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,21)='access_restore_guard_') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complete and verify manual schema preparation first';
  END IF;
  SET v_run=(SELECT data->>'$.run' FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.begin' ORDER BY id DESC LIMIT 1);
  IF v_run IS NULL OR v_run NOT REGEXP '^[0-9a-f-]{36}$'
     OR NOT EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.schema' AND data->>'$.run'=v_run)
     OR EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.reverting' AND data->>'$.run'=v_run)
     OR NOT EXISTS(SELECT 1 FROM information_schema.tables
        WHERE table_schema=DATABASE() AND table_name='enrollment_mail_configuration' AND table_type='BASE TABLE'
        AND BINARY table_comment=BINARY CONCAT('uper-v18v20:',v_run)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Mail configuration table has no active tracked upgrade';
  END IF;
  SET v_done_environment=(SELECT data->>'$.environment' FROM portal_audit
    WHERE actor='manual-sql' AND action='release.v18v20.delivery' AND data->>'$.run'=v_run);
  IF v_done_environment IS NOT NULL THEN
    IF BINARY v_done_environment<>BINARY @uper_environment THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Delivery was prepared for a different environment';
    END IF;
    DO RELEASE_LOCK(v_lock);
    LEAVE main;
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND engine='InnoDB'
      AND table_name IN ('portal_settings','notification_channels','enrollment_mail_configuration','portal_audit'))<>4
     OR EXISTS(SELECT 1 FROM information_schema.triggers WHERE event_object_schema=DATABASE()
      AND event_object_table IN ('portal_settings','notification_channels','enrollment_mail_configuration','portal_audit')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Upgrade settings tables must use InnoDB and have no update hooks';
  END IF;
  START TRANSACTION;
  -- A mail row with no journal might have been written by an application or an older script.
  IF EXISTS(SELECT 1 FROM enrollment_mail_configuration) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Untracked enrollment mail configuration; review manually';
  END IF;
  IF @uper_mail_mode IS NULL OR BINARY @uper_mail_mode NOT IN ('disabled','smtp','simulation')
     OR (@uper_environment='prod' AND @uper_mail_mode='simulation') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review the old mail transport; explicit approved mode required';
  END IF;

  SET v_personal=(SELECT value FROM portal_settings WHERE id='lark_personal_channel' FOR UPDATE);
  IF v_personal IS NULL OR JSON_EXTRACT(v_personal,'$.revision')=0 THEN
    IF (v_personal IS NOT NULL AND JSON_TYPE(v_personal)<>'OBJECT')
       OR @uper_group_mode IS NULL OR BINARY @uper_group_mode NOT IN ('simulation','live')
       OR @uper_personal_mode IS NULL OR BINARY @uper_personal_mode NOT IN ('simulation','live')
       OR (@uper_group_mode='simulation' AND @uper_personal_mode='live') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review legacy Lark settings; explicit group and personal modes required';
    END IF;
    IF @uper_group_mode='simulation' THEN
      SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',id,'mode',JSON_EXTRACT(config,'$.mode'),
        'before',SHA2(CAST(config AS CHAR CHARACTER SET utf8mb4),256),
        'after',SHA2(CAST(JSON_SET(config,'$.mode','simulation') AS CHAR CHARACTER SET utf8mb4),256))),JSON_ARRAY())
        INTO v_channels FROM notification_channels
        WHERE config->>'$.mode'='live' AND COALESCE(config->>'$.deleted','false')<>'true';
      UPDATE notification_channels SET config=JSON_SET(config,'$.mode','simulation')
        WHERE config->>'$.mode'='live' AND COALESCE(config->>'$.deleted','false')<>'true';
    END IF;
    SET v_personal_after=JSON_SET(COALESCE(v_personal,JSON_OBJECT()),'$.mode',@uper_personal_mode,'$.revision',1);
    SET v_personal_change=JSON_OBJECT(
      'before',SHA2(CAST(v_personal AS CHAR CHARACTER SET utf8mb4),256),
      'after',SHA2(CAST(v_personal_after AS CHAR CHARACTER SET utf8mb4),256),
      'mode',JSON_EXTRACT(v_personal,'$.mode'),'hadMode',COALESCE(JSON_CONTAINS_PATH(v_personal,'one','$.mode'),0),
      'revision',JSON_EXTRACT(v_personal,'$.revision'),'hadRevision',COALESCE(JSON_CONTAINS_PATH(v_personal,'one','$.revision'),0));
    INSERT INTO portal_settings(id,value) VALUES('lark_personal_channel',v_personal_after)
      ON DUPLICATE KEY UPDATE value=v_personal_after;
  ELSEIF NOT COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(v_personal,'$.revision')) AS UNSIGNED)>0
     AND JSON_UNQUOTE(JSON_EXTRACT(v_personal,'$.mode')) IN ('live','simulation'),FALSE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Malformed Lark setting; manual review required';
  END IF;
  SET v_mail=JSON_OBJECT('delivery',JSON_OBJECT('mode',@uper_mail_mode,'generation',UUID()));
  INSERT INTO enrollment_mail_configuration(environment,revision,config) VALUES(@uper_environment,0,v_mail);
  INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','release.v18v20.delivery',
    JSON_OBJECT('run',v_run,'environment',@uper_environment,'mailHash',SHA2(CAST(v_mail AS CHAR CHARACTER SET utf8mb4),256),
      'personal',v_personal_change,'channels',v_channels));
  COMMIT;
  DO RELEASE_LOCK(v_lock);
END$$
DELIMITER ;
CALL uper_delivery_20261126182717();
DROP PROCEDURE uper_delivery_20261126182717;
