-- MANUAL DATA TRANSITION, NOT A STARTUP HOOK. Existing v20 application database only.
-- Fresh mysql batch session, no --force. Use the same reviewed settings on retry.
-- Required session inputs: @uper_expected_database, @uper_environment. Missing delivery
-- records additionally require the operator to specify modes matching the reviewed old settings.
-- Never authorize a real send here. Keep application/queue consumers stopped for this change.
DELIMITER $$
CREATE PROCEDURE uper_delivery_20261126182717()
SQL SECURITY INVOKER
BEGIN
  DECLARE personal JSON;
  DECLARE mail JSON;
  DECLARE touched INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE()<>BINARY @uper_expected_database
     OR @uper_environment IS NULL OR BINARY @uper_environment NOT IN ('dev','test','prod') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Check the intended database and deployment environment';
  END IF;
  IF (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 20 AND state='ready')<>20
     OR EXISTS(SELECT 1 FROM trial_schema_versions WHERE version NOT BETWEEN 1 AND 20 OR state<>'ready')
     OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,21)='access_restore_guard_') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complete and verify manual schema preparation first';
  END IF;
  START TRANSACTION;
  SET personal=(SELECT value FROM portal_settings WHERE id='lark_personal_channel' FOR UPDATE);
  IF personal IS NULL OR JSON_EXTRACT(personal,'$.revision')=0 THEN
    IF @uper_group_mode IS NULL OR BINARY @uper_group_mode NOT IN ('simulation','live')
       OR @uper_personal_mode IS NULL OR BINARY @uper_personal_mode NOT IN ('simulation','live')
       OR (@uper_group_mode='simulation' AND @uper_personal_mode='live') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review legacy Lark settings; explicit group and personal modes required';
    END IF;
    IF @uper_group_mode='simulation' THEN
      UPDATE notification_channels SET config=JSON_SET(config,'$.mode','simulation')
       WHERE config->>'$.mode'='live' AND COALESCE(config->>'$.deleted','false')<>'true';
      SET touched=ROW_COUNT();
    END IF;
    INSERT INTO portal_settings(id,value) VALUES('lark_personal_channel',JSON_OBJECT('mode',@uper_personal_mode,'revision',1))
      ON DUPLICATE KEY UPDATE value=JSON_SET(value,'$.mode',@uper_personal_mode,'$.revision',1);
    INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','channel.mode.migrate',JSON_OBJECT('personalMode',@uper_personal_mode,'simulatedGroupCount',touched));
  ELSEIF NOT COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(personal,'$.revision')) AS UNSIGNED)>0 AND JSON_UNQUOTE(JSON_EXTRACT(personal,'$.mode')) IN ('live','simulation'),FALSE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Malformed Lark setting; manual review required';
  END IF;
  SET mail=(SELECT config FROM enrollment_mail_configuration WHERE environment=@uper_environment FOR UPDATE);
  IF mail IS NULL OR JSON_CONTAINS_PATH(mail,'one','$.delivery')=0 THEN
    IF @uper_mail_mode IS NULL OR BINARY @uper_mail_mode NOT IN ('disabled','smtp','simulation')
       OR (@uper_environment='prod' AND @uper_mail_mode='simulation') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review the old mail transport; explicit approved mode required';
    END IF;
    -- Revision zero uses the application defaults; keep all existing account/pool settings.
    SET mail=JSON_SET(COALESCE(mail,JSON_OBJECT()),'$.delivery',JSON_OBJECT('mode',@uper_mail_mode,'generation',UUID()));
    INSERT INTO enrollment_mail_configuration(environment,revision,config) VALUES(@uper_environment,0,mail)
      ON DUPLICATE KEY UPDATE config=mail;
    INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','enrollment.mail.mode.migrate',JSON_OBJECT('environment',@uper_environment,'mode',@uper_mail_mode));
  ELSEIF NOT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(mail,'$.delivery.mode')) IN ('disabled','simulation','smtp') AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(mail,'$.delivery.generation')))>0,FALSE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Malformed mail delivery setting; manual review required';
  END IF;
  COMMIT;
END$$
DELIMITER ;
CALL uper_delivery_20261126182717();
DROP PROCEDURE uper_delivery_20261126182717;
