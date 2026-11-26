-- MANUAL DATA TRANSITION, NOT A STARTUP HOOK. Existing v20 application database only.
-- Run after v20261126182423 (schema) in a fresh mysql batch session, abort on first error, no --force.
-- Required session input: @uper_expected_database (independently verified database name).
-- Adds only the system presets that releases after 95eea57 used to insert during startup:
--   1. notification rule lead.assigned (version 1, enabled) when no row with that id exists;
--   2. missing evergreen promotion presets of campaign social-bio and their index rows.
-- Existing rules (including disabled or deleted markers), custom links, short links and counters
-- are never rewritten. A conflicting reserved identity is rejected for manual review.
-- Keep application and queue consumers stopped for this change. A repeated run changes nothing.
-- ASCII only: <DOT> is replaced with U+00B7 from its UTF-8 bytes, independent of the client charset.
DELIMITER $$
CREATE PROCEDURE uper_seed_20261126192807()
SQL SECURITY INVOKER
BEGIN
  DECLARE v_dot VARCHAR(4) CHARACTER SET utf8mb4 DEFAULT CONVERT(0xC2B7 USING utf8mb4);
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
  DECLARE v_rules_added INT DEFAULT 0;
  DECLARE v_presets_added INT DEFAULT 0;
  DECLARE v_index_added INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF DATABASE() IS NULL OR @uper_expected_database IS NULL OR BINARY DATABASE()<>BINARY @uper_expected_database THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Check the intended database';
  END IF;
  IF (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 20 AND state='ready')<>20
     OR EXISTS(SELECT 1 FROM trial_schema_versions WHERE version NOT BETWEEN 1 AND 20 OR state<>'ready')
     OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND LEFT(table_name,21)='access_restore_guard_') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complete and verify manual schema preparation first';
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
  START TRANSACTION;
  INSERT INTO notification_rules(id,version,config,enabled)
    SELECT 'lead.assigned',1,v_rule,TRUE FROM DUAL
    WHERE NOT EXISTS(SELECT 1 FROM notification_rules WHERE id='lead.assigned');
  SET v_rules_added=ROW_COUNT();
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
      SET v_presets_added=v_presets_added+1;
    ELSEIF NOT JSON_CONTAINS(JSON_EXTRACT(v_links,LEFT(v_located,CHAR_LENGTH(v_located)-3)),v_preset) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='System promotion reserved identity conflict; manual review required';
    END IF;
    SET v_owner=(SELECT campaign_id FROM campaign_promotion_index WHERE p=v_link_id FOR UPDATE);
    IF v_owner IS NULL THEN
      INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(v_link_id,'social-bio');
      SET v_index_added=v_index_added+1;
    ELSEIF BINARY v_owner<>BINARY 'social-bio' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Promotion index ownership mismatch; manual review required';
    END IF;
    SET v_i=v_i+1;
  END WHILE;
  IF v_presets_added>0 THEN
    UPDATE trial_campaigns
       SET config=JSON_SET(config,'$.systemManaged',CAST('true' AS JSON),'$.promotionLinks',v_links,'$.updatedAt',v_stamp)
     WHERE id='social-bio';
  END IF;
  IF v_rules_added+v_presets_added+v_index_added>0 THEN
    INSERT INTO portal_audit(actor,action,data) VALUES('manual-sql','system.defaults.seed',
      JSON_OBJECT('rules',v_rules_added,'promotionPresets',v_presets_added,'promotionIndex',v_index_added));
  END IF;
  COMMIT;
END$$
DELIMITER ;
CALL uper_seed_20261126192807();
DROP PROCEDURE uper_seed_20261126192807;
