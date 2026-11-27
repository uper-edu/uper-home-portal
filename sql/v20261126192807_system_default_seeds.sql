-- MANUAL DATA TRANSITION, NOT A STARTUP HOOK. Existing v20 application database only.
-- Run after v20261126182423 (schema) in a fresh mysql batch session, abort on first error, no --force.
-- Required session input: @uper_expected_database (independently verified database name).
-- Adds only the system presets that releases after 95eea57 used to insert during startup:
--   1. notification rule lead.assigned (version 1, enabled) when no row with that id exists;
--   2. missing evergreen promotion presets of campaign social-bio and their index rows;
--   3. the system Lark group marker: when no active system group exists, the single active group
--      still carrying a former system name is renamed to the system name and marked systemManaged.
--      Its mode, webhook reference, limits and signing settings are kept.
-- Existing rules (including disabled or deleted markers), custom links, short links, counters and
-- other group channels are never rewritten. A conflicting reserved identity is rejected for manual review.
-- Keep application and queue consumers stopped for this change. A repeated run changes nothing.
-- ASCII only: <DOT> (U+00B7) and the system group name are built from UTF-8 bytes, independent of the client charset.
DELIMITER $$
CREATE PROCEDURE uper_seed_20261126192807()
SQL SECURITY INVOKER
main: BEGIN
  DECLARE v_dot VARCHAR(4) CHARACTER SET utf8mb4 DEFAULT CONVERT(0xC2B7 USING utf8mb4);
  DECLARE v_group_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT CONCAT('Lark ',CONVERT(0xE7BEA4E9809AE79FA5 USING utf8mb4));
  DECLARE v_group_count INT DEFAULT 0;
  DECLARE v_groups_marked INT DEFAULT 0;
  DECLARE v_rule JSON;
  DECLARE v_presets JSON;
  DECLARE v_campaign JSON;
  DECLARE v_links JSON;
  DECLARE v_preset JSON;
  DECLARE v_link_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin;
  DECLARE v_located VARCHAR(64);
  DECLARE v_owner VARCHAR(191);
  DECLARE v_stamp VARCHAR(32);
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_run CHAR(36) CHARACTER SET ascii;
  DECLARE v_lock VARCHAR(64) CHARACTER SET ascii;
  DECLARE v_locked BOOLEAN DEFAULT FALSE;
  DECLARE v_group_id VARCHAR(191);
  DECLARE v_channel JSON;
  DECLARE v_channel_after JSON;
  DECLARE v_channel_change JSON;
  DECLARE v_rule_hash CHAR(64) CHARACTER SET ascii;
  DECLARE v_campaign_after JSON;
  DECLARE v_campaign_change JSON;
  DECLARE v_new_links JSON DEFAULT JSON_ARRAY();
  DECLARE v_new_indexes JSON DEFAULT JSON_ARRAY();
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    IF v_locked THEN DO RELEASE_LOCK(v_lock); END IF;
    RESIGNAL;
  END;
  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE()<>BINARY @uper_expected_database THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Check the intended database';
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
     OR NOT EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.delivery' AND data->>'$.run'=v_run)
     OR EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.reverting' AND data->>'$.run'=v_run) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complete tracked delivery preparation before seeding';
  END IF;
  IF EXISTS(SELECT 1 FROM portal_audit WHERE actor='manual-sql' AND action='release.v18v20.seed' AND data->>'$.run'=v_run) THEN
    DO RELEASE_LOCK(v_lock);
    LEAVE main;
  END IF;
  SET v_rule=CAST(REPLACE(CONVERT(
    '{"calendarMode":"inherit","event":"lead.assigned","channels":["inapp","lark_personal"],"recipient":"owner","group":"","sources":[],"tiers":[],"states":[],"timing":"immediate","delayMinutes":0,"digestTime":"18:00","businessOnly":true,"dedupeMinutes":0,"retries":[1,5,15],"template":"{{event}} <DOT> {{name}} <DOT> {{owner}} <DOT> {{due}}","timezone":"Asia/Jakarta","start":"09:00","end":"20:00","days":[1,2,3,4,5,6],"maxPerHour":100,"language":"en"}'
    USING utf8mb4),'<DOT>',v_dot) AS JSON);
  SET v_presets=CAST(REPLACE(CONVERT(CONCAT('[',
    '{"id":"bio-ig","name":"Instagram <DOT> Link Hub","source":"instagram","medium":"social","content":"profile-bio","landingPath":"/link","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"chat-ig","name":"Instagram <DOT> Chat","source":"instagram","medium":"social","content":"profile-bio","landingPath":"/chat","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"bio-tt","name":"TikTok <DOT> Link Hub","source":"tiktok","medium":"social","content":"profile-bio","landingPath":"/link","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"chat-tt","name":"TikTok <DOT> Chat","source":"tiktok","medium":"social","content":"profile-bio","landingPath":"/chat","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"bio-yt","name":"YouTube <DOT> Link Hub","source":"youtube","medium":"social","content":"channel-description","landingPath":"/link","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"chat-yt","name":"YouTube <DOT> Chat","source":"youtube","medium":"social","content":"channel-description","landingPath":"/chat","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"threads-social-profile-bio-261110092327","name":"Threads <DOT> Link Hub","source":"threads","medium":"social","content":"profile-bio","landingPath":"/link","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"threads-social-profile-bio-261110093006","name":"Threads <DOT> Chat","source":"threads","medium":"social","content":"profile-bio","landingPath":"/chat","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"home-link","name":"UPER <DOT> Link Hub","source":"website","medium":"internal","content":"website-link","landingPath":"/link","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"home-chat","name":"UPER <DOT> Chat","source":"website","medium":"internal","content":"website-chat","landingPath":"/chat","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"enroll-ig","name":"Instagram <DOT> Enrollment","source":"instagram","medium":"social","content":"enrollment","landingPath":"/enrollment","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"enroll-tt","name":"TikTok <DOT> Enrollment","source":"tiktok","medium":"social","content":"enrollment","landingPath":"/enrollment","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"enroll-yt","name":"YouTube <DOT> Enrollment","source":"youtube","medium":"social","content":"enrollment","landingPath":"/enrollment","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',',',
    '{"id":"enroll-th","name":"Threads <DOT> Enrollment","source":"threads","medium":"social","content":"enrollment","landingPath":"/enrollment","language":"id","promotionKind":"unpaid","experience":"questionnaire_assessment_consultation"}',
    ']') USING utf8mb4),'<DOT>',v_dot) AS JSON);
  SET v_stamp=CONCAT(DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%dT%H:%i:%s'),'.000Z');
  IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND engine='InnoDB'
      AND table_name IN ('portal_audit','notification_channels','notification_rules','trial_campaigns','campaign_promotion_index'))<>5
     OR EXISTS(SELECT 1 FROM information_schema.triggers WHERE event_object_schema=DATABASE()
      AND event_object_table IN ('portal_audit','notification_channels','notification_rules','trial_campaigns','campaign_promotion_index')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Upgrade settings tables must use InnoDB and have no update hooks';
  END IF;
  START TRANSACTION;
  INSERT INTO notification_rules(id,version,config,enabled)
    SELECT 'lead.assigned',1,v_rule,TRUE FROM DUAL
    WHERE NOT EXISTS(SELECT 1 FROM notification_rules WHERE id='lead.assigned');
  IF ROW_COUNT()=1 THEN
    SET v_rule_hash=(SELECT SHA2(CAST(JSON_ARRAY(version,config,enabled,effective_at) AS CHAR CHARACTER SET utf8mb4),256)
      FROM notification_rules WHERE id='lead.assigned');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM notification_channels WHERE COALESCE(config->>'$.deleted','false')<>'true'
       AND (id='lark-group-default' OR COALESCE(config->>'$.systemManaged','false')='true')) THEN
    SET v_group_count=(SELECT COUNT(*) FROM notification_channels WHERE COALESCE(config->>'$.deleted','false')<>'true'
       AND TRIM(COALESCE(config->>'$.groupName','')) IN ('CRM Bot','CRM Lark Bot',v_group_name));
    IF v_group_count<>1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='System Lark group cannot be identified; manual review required';
    END IF;
    SELECT id,config INTO v_group_id,v_channel FROM notification_channels
      WHERE COALESCE(config->>'$.deleted','false')<>'true'
      AND TRIM(COALESCE(config->>'$.groupName','')) IN ('CRM Bot','CRM Lark Bot',v_group_name) FOR UPDATE;
    SET v_channel_after=JSON_SET(v_channel,'$.groupName',v_group_name,'$.systemManaged',CAST('true' AS JSON));
    SET v_channel_change=JSON_OBJECT('id',v_group_id,'groupName',JSON_EXTRACT(v_channel,'$.groupName'),
      'hadManaged',JSON_CONTAINS_PATH(v_channel,'one','$.systemManaged'),'managed',JSON_EXTRACT(v_channel,'$.systemManaged'),
      'before',SHA2(CAST(v_channel AS CHAR CHARACTER SET utf8mb4),256),
      'after',SHA2(CAST(v_channel_after AS CHAR CHARACTER SET utf8mb4),256));
    UPDATE notification_channels SET config=v_channel_after WHERE id=v_group_id;
  END IF;
  SET v_campaign=(SELECT config FROM trial_campaigns WHERE id='social-bio' AND code='social-bio' FOR UPDATE);
  IF v_campaign IS NULL OR NOT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_campaign,'$.presetKey'))='social_bio_v1',FALSE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Reserved campaign social-bio is missing or conflicting; manual review required';
  END IF;
  SET v_links=COALESCE(JSON_EXTRACT(v_campaign,'$.promotionLinks'),JSON_ARRAY());
  IF JSON_TYPE(v_links)<>'ARRAY' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Malformed social-bio promotion links; manual review required';
  END IF;
  WHILE v_i<JSON_LENGTH(v_presets) DO
    SET v_preset=JSON_EXTRACT(v_presets,CONCAT('$[',v_i,']'));
    SET v_link_id=JSON_UNQUOTE(JSON_EXTRACT(v_preset,'$.id'));
    -- Preset ids contain no LIKE wildcard, so this is an exact match on the link id.
    SET v_located=JSON_UNQUOTE(JSON_SEARCH(v_links,'one',v_link_id,NULL,'$[*].id'));
    IF v_located IS NULL THEN
      SET v_links=JSON_ARRAY_APPEND(v_links,'$',JSON_SET(v_preset,'$.createdAt',v_stamp));
      SET v_new_links=JSON_ARRAY_APPEND(v_new_links,'$',v_link_id);
    ELSEIF NOT JSON_CONTAINS(JSON_EXTRACT(v_links,LEFT(v_located,CHAR_LENGTH(v_located)-3)),v_preset) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='System promotion reserved identity conflict; manual review required';
    END IF;
    SET v_owner=(SELECT campaign_id FROM campaign_promotion_index WHERE p=v_link_id FOR UPDATE);
    IF v_owner IS NULL THEN
      INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(v_link_id,'social-bio');
      SET v_new_indexes=JSON_ARRAY_APPEND(v_new_indexes,'$',v_link_id);
    ELSEIF BINARY v_owner<>BINARY 'social-bio' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Promotion index ownership mismatch; manual review required';
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  IF JSON_LENGTH(v_new_links)>0 THEN
    SET v_campaign_after=JSON_SET(v_campaign,'$.systemManaged',CAST('true' AS JSON),'$.promotionLinks',v_links,'$.updatedAt',v_stamp);
    SET v_campaign_change=JSON_OBJECT('links',v_new_links,
      'hadLinks',JSON_CONTAINS_PATH(v_campaign,'one','$.promotionLinks'),
      'hadManaged',JSON_CONTAINS_PATH(v_campaign,'one','$.systemManaged'),'managed',JSON_EXTRACT(v_campaign,'$.systemManaged'),
      'hadUpdatedAt',JSON_CONTAINS_PATH(v_campaign,'one','$.updatedAt'),'updatedAt',JSON_EXTRACT(v_campaign,'$.updatedAt'),
      'before',SHA2(CAST(v_campaign AS CHAR CHARACTER SET utf8mb4),256),
      'after',SHA2(CAST(v_campaign_after AS CHAR CHARACTER SET utf8mb4),256));
    UPDATE trial_campaigns SET config=v_campaign_after WHERE id='social-bio';
  END IF;
  INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','release.v18v20.seed',
    JSON_OBJECT('run',v_run,'ruleHash',v_rule_hash,'group',v_channel_change,'campaign',v_campaign_change,'indexes',v_new_indexes));
  COMMIT;
  DO RELEASE_LOCK(v_lock);
END$$
DELIMITER ;
CALL uper_seed_20261126192807();
DROP PROCEDURE uper_seed_20261126192807;
