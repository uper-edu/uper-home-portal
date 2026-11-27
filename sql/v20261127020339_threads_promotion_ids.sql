-- MANUAL ONLY. MySQL 8, ready v20, with application and worker stopped.
-- Set @uper_expected_database independently and @uper_threads_direction to forward or reverse.
-- Reverse is for a paused cutover before the new IDs accept traffic. No business history is rewritten.
DO CASE WHEN @uper_expected_database IS NOT NULL
  AND BINARY @uper_expected_database = BINARY DATABASE()
  AND VERSION() REGEXP '^8[.]' AND VERSION() NOT LIKE '%MariaDB%'
  AND BINARY @uper_threads_direction IN ('forward','reverse')
  THEN 0 ELSE JSON_EXTRACT('Verify MySQL 8, target database and Threads migration direction', '$') END;

SET @uper_threads_lock=CONCAT('uper:threads:',LEFT(SHA2(DATABASE(),256),48));
DO CASE WHEN GET_LOCK(@uper_threads_lock,0)=1
  THEN 0 ELSE JSON_EXTRACT('Another Threads promotion migration holds the database lock', '$') END;

DELIMITER //
CREATE PROCEDURE uper_threads_promotion_ids_20261127020339()
SQL SECURITY INVOKER
COMMENT 'uper:threads:20261127020339'
BEGIN
  DECLARE v_config JSON;
  DECLARE v_i INT DEFAULT 1;
  DECLARE v_old VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_new VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_from VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_to VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_path VARCHAR(16);
  DECLARE v_position INT;
  DECLARE v_count INT;
  DECLARE v_stored VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_owner_from VARCHAR(191);
  DECLARE v_owner_to VARCHAR(191);
  DECLARE v_changed BOOLEAN DEFAULT FALSE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
      AND TABLE_NAME IN ('trial_campaigns','campaign_promotion_index','campaign_promotion_short_links')
      AND ENGINE='InnoDB' AND TABLE_TYPE='BASE TABLE')<>3
    OR (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND (
      (TABLE_NAME='trial_campaigns' AND COLUMN_NAME='config' AND DATA_TYPE='json')
      OR (TABLE_NAME='campaign_promotion_index' AND COLUMN_NAME='p' AND COLUMN_TYPE='varchar(100)' AND COLLATION_NAME='ascii_bin' AND COLUMN_KEY='PRI')
      OR (TABLE_NAME='campaign_promotion_index' AND COLUMN_NAME='campaign_id' AND COLUMN_TYPE='varchar(191)')
      OR (TABLE_NAME='campaign_promotion_short_links' AND COLUMN_NAME='p' AND COLUMN_TYPE='varchar(100)' AND COLLATION_NAME='ascii_bin' AND COLUMN_KEY='UNI')
      OR (TABLE_NAME='campaign_promotion_short_links' AND COLUMN_NAME='short_code' AND COLUMN_TYPE='char(6)' AND COLLATION_NAME='ascii_bin' AND COLUMN_KEY='PRI')
    ))<>5 OR NOT EXISTS(SELECT 1 FROM trial_schema_versions WHERE version=20 AND state='ready')
    OR EXISTS(SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()
      AND EVENT_OBJECT_TABLE IN ('trial_campaigns','campaign_promotion_index','campaign_promotion_short_links')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Incompatible Threads promotion schema';
  END IF;

  START TRANSACTION;
  SET v_config=(SELECT config FROM trial_campaigns WHERE id='social-bio' AND code='social-bio' FOR UPDATE);
  IF v_config IS NULL OR NOT (JSON_UNQUOTE(JSON_EXTRACT(v_config,'$.systemManaged')) <=> 'true')
    OR NOT (JSON_TYPE(JSON_EXTRACT(v_config,'$.promotionLinks')) <=> 'ARRAY') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing system social-bio promotion configuration';
  END IF;
  IF BINARY @uper_threads_direction='reverse' AND (
    EXISTS(SELECT 1 FROM portal_leads WHERE profile->>'$.promotionLinkId' IN ('bio-th','chat-th')
      OR profile->>'$.promotionReview.linkId' IN ('bio-th','chat-th')
      OR JSON_OVERLAPS(JSON_EXTRACT(profile,'$.identitySources[*].promotionLinkId'),JSON_ARRAY('bio-th','chat-th')))
    OR EXISTS(SELECT 1 FROM enrollment_record_attribution WHERE attribution->>'$.promotionId' IN ('bio-th','chat-th'))
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Short Threads IDs are already in use; preserve the database and fix forward';
  END IF;

  WHILE v_i<=2 DO
    SET v_old=IF(v_i=1,'threads-social-profile-bio-261110092327','threads-social-profile-bio-261110093006');
    SET v_new=IF(v_i=1,'bio-th','chat-th');
    SET v_path=IF(v_i=1,'/link','/chat');
    SET v_from=IF(BINARY @uper_threads_direction='forward',v_old,v_new);
    SET v_to=IF(BINARY @uper_threads_direction='forward',v_new,v_old);

    SELECT COUNT(*),MAX(link.position_in_array)-1,MAX(link.link_id)
      INTO v_count,v_position,v_stored
      FROM JSON_TABLE(v_config,'$.promotionLinks[*]' COLUMNS(
        position_in_array FOR ORDINALITY, link_id VARCHAR(100) PATH '$.id')) AS link
      WHERE BINARY link.link_id IN (BINARY v_from,BINARY v_to);
    IF v_count<>1
      OR NOT (JSON_UNQUOTE(JSON_EXTRACT(v_config,CONCAT('$.promotionLinks[',v_position,'].source'))) <=> 'threads')
      OR NOT (JSON_UNQUOTE(JSON_EXTRACT(v_config,CONCAT('$.promotionLinks[',v_position,'].medium'))) <=> 'social')
      OR NOT (JSON_UNQUOTE(JSON_EXTRACT(v_config,CONCAT('$.promotionLinks[',v_position,'].landingPath'))) <=> v_path)
      OR EXISTS(SELECT 1 FROM trial_campaigns AS c
        JOIN JSON_TABLE(c.config,'$.promotionLinks[*]' COLUMNS(link_id VARCHAR(100) PATH '$.id')) AS link
        WHERE c.id<>'social-bio' AND BINARY link.link_id IN (BINARY v_from,BINARY v_to)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing, duplicate or incompatible Threads promotion entry';
    END IF;

    SET v_owner_from=(SELECT campaign_id FROM campaign_promotion_index WHERE p=v_from FOR UPDATE);
    SET v_owner_to=(SELECT campaign_id FROM campaign_promotion_index WHERE p=v_to FOR UPDATE);
    IF (v_stored=v_from AND (NOT (v_owner_from <=> 'social-bio') OR v_owner_to IS NOT NULL
           OR EXISTS(SELECT 1 FROM campaign_promotion_short_links WHERE p=v_to)))
      OR (v_stored=v_to AND (NOT (v_owner_to <=> 'social-bio') OR v_owner_from IS NOT NULL
           OR EXISTS(SELECT 1 FROM campaign_promotion_short_links WHERE p=v_from))) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Threads promotion index or short-code ownership conflict';
    END IF;

    IF v_stored=v_from THEN
      UPDATE campaign_promotion_index SET p=v_to WHERE p=v_from;
      UPDATE campaign_promotion_short_links SET p=v_to WHERE p=v_from;
      SET v_config=JSON_SET(v_config,CONCAT('$.promotionLinks[',v_position,'].id'),v_to);
      SET v_changed=TRUE;
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  IF v_changed THEN
    UPDATE trial_campaigns SET config=v_config WHERE id='social-bio';
  END IF;
  COMMIT;
END//
DELIMITER ;
CALL uper_threads_promotion_ids_20261127020339();
DROP PROCEDURE uper_threads_promotion_ids_20261127020339;
DO RELEASE_LOCK(@uper_threads_lock);
