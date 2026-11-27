-- MANUAL ONLY. Fresh MySQL 8 database. Obtain the expected database name independently.
-- Use one fresh mysql client per file, without --force. No existing deployment data is imported.
DO CASE WHEN @uper_expected_database IS NOT NULL
  AND BINARY @uper_expected_database = BINARY DATABASE()
  AND VERSION() REGEXP '^8[.]' AND VERSION() NOT LIKE '%MariaDB%'
  THEN 0 ELSE JSON_EXTRACT('Verify MySQL 8 and the explicitly selected empty database', '$') END;
SET @uper_bootstrap_lock = CONCAT('uper:empty:', LEFT(SHA2(DATABASE(), 256), 48));
DO CASE WHEN GET_LOCK(@uper_bootstrap_lock, 0) = 1
  THEN 0 ELSE JSON_EXTRACT('Another initialization session holds the database lock', '$') END;

DELIMITER //
CREATE PROCEDURE uper_bootstrap_empty_accounts_v20()
SQL SECURITY INVOKER
bootstrap: BEGIN
  DECLARE v_marker JSON;
  DECLARE v_has_business BOOLEAN DEFAULT FALSE;
  DECLARE v_table VARCHAR(64);
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_roster JSON;
  DECLARE v_input JSON;
  DECLARE v_input_digest CHAR(64);
  DECLARE empty_tables CURSOR FOR SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME NOT IN ('trial_schema_versions','portal_settings','access_state','cms_collections','crm_courses',
      'trial_campaigns','campaign_promotion_index','notification_rules','rule_versions',
      'notification_channels','enrollment_mail_configuration')
    ORDER BY TABLE_NAME;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF @uper_environment IS NULL OR BINARY @uper_environment NOT IN ('dev','test','prod') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Set the target environment explicitly: dev, test or prod';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE())<>70
    OR EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
      AND (BINARY TABLE_COMMENT<>'uper:empty-v20:20261126213651' OR TABLE_TYPE<>'BASE TABLE' OR ENGINE<>'InnoDB'))
    OR EXISTS(SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE())
    OR EXISTS(SELECT 1 FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE())
    OR EXISTS(SELECT 1 FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()
      AND ROUTINE_NAME<>'uper_bootstrap_empty_accounts_v20') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Run the matching hand-reviewed empty database schema step first';
  END IF;
  IF (SELECT COUNT(*) FROM trial_schema_versions)<>20 OR
    (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 20 AND state='ready')<>20 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Empty bootstrap schema must have ready versions 1 through 20';
  END IF;
  START TRANSACTION;
  SET v_marker=(SELECT value FROM portal_settings WHERE id='empty_bootstrap_system_v20');
  IF NOT (JSON_UNQUOTE(JSON_EXTRACT(v_marker,'$.batch')) <=> 'uper:empty-v20:20261126213651') OR
     NOT (JSON_UNQUOTE(JSON_EXTRACT(v_marker,'$.environment')) <=> @uper_environment)
     OR NOT EXISTS(SELECT 1 FROM access_state WHERE id='teamless' AND value->>'$.version'='1') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Matching empty database system defaults are required first';
  END IF;
  SET v_has_business=COALESCE(@uper_environment='test' AND
    REGEXP_LIKE(JSON_UNQUOTE(JSON_EXTRACT(v_marker,'$.businessDigest')),'^[0-9a-f]{64}$','c'),FALSE);

  -- The local 3000 staff roster supplies identity and roles. Private input supplies login IDs and new hashes.
  SET v_roster='{
    "Eric":{"id":"aed2c96c-c2b3-4141-b2c6-4abb9e807a7b","name":"Eric Wang","roles":["finance"]},
    "Ethan":{"id":"Ethan","name":"Ethan Xu","roles":["crm_leader","cms_admin","access_admin","sales","academic_admin","finance"]},
    "Fadhil":{"id":"Fadhil","name":"Fadhil","roles":["sales"]},
    "Fenny":{"id":"Fenny","name":"Fenny","roles":["academic_admin","cms_admin","hr_reader"]},
    "Hao":{"id":"93b83045-5b63-4497-8f91-b97f3d514504","name":"Hao Zhang","roles":["finance"]},
    "Monite":{"id":"Monite","name":"Monite Min","roles":["crm_leader","cms_admin","access_admin","sales","academic_admin","finance"]},
    "Robert":{"id":"Robert","name":"Robert Hui","roles":["crm_leader","cms_admin","finance","access_admin","sales","academic_admin"]},
    "Suki":{"id":"Suki","name":"Suki Zhou","roles":["crm_leader","finance","academic_admin"]},
    "Tester":{"id":"Tester","name":"Tester Uper","roles":["crm_leader","sales"]},
    "Wigar":{"id":"Wigar","name":"Wigar","roles":["sales"]},
    "Zainul":{"id":"Zainul","name":"Zainul","roles":["sales"]}
  }';
  SET v_input=@uper_bootstrap_accounts;
  IF v_input IS NULL OR JSON_TYPE(v_input)<>'ARRAY' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='The matching private account input must be loaded in this session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM JSON_TABLE(v_input, '$[*]' COLUMNS(
      id VARCHAR(32) PATH '$.id' ERROR ON EMPTY ERROR ON ERROR)) AS supplied WHERE BINARY id='Robert')
    OR EXISTS (SELECT 1 FROM JSON_TABLE(v_input, '$[*]' COLUMNS(
      id VARCHAR(32) PATH '$.id' ERROR ON EMPTY ERROR ON ERROR,
      password_hash VARCHAR(255) PATH '$.passwordHash' ERROR ON EMPTY ERROR ON ERROR)) AS supplied
      WHERE id IS NULL OR password_hash IS NULL
        OR NOT REGEXP_LIKE(id,'^[A-Za-z]{1,24}$','c')
        OR NOT REGEXP_LIKE(password_hash,'^[0-9a-f]{32}:[0-9a-f]{128}$','c')
        OR JSON_CONTAINS_PATH(v_roster,'one',CONCAT('$.',id))<>1)
    OR (SELECT COUNT(DISTINCT BINARY id) FROM JSON_TABLE(v_input, '$[*]' COLUMNS(
      id VARCHAR(32) PATH '$.id' ERROR ON EMPTY ERROR ON ERROR)) AS supplied)<>JSON_LENGTH(v_input)
    OR (SELECT COUNT(DISTINCT LEFT(password_hash,32)) FROM JSON_TABLE(v_input, '$[*]' COLUMNS(
      password_hash VARCHAR(255) PATH '$.passwordHash' ERROR ON EMPTY ERROR ON ERROR)) AS supplied)<>JSON_LENGTH(v_input) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid approved staff roster or missing first administrator';
  END IF;
  SET v_input_digest=SHA2(CAST(v_input AS CHAR),256);
  SET v_marker=(SELECT value FROM portal_settings WHERE id='empty_bootstrap_access_v20');
  IF v_marker IS NOT NULL THEN
    IF NOT (JSON_UNQUOTE(JSON_EXTRACT(v_marker,'$.batch')) <=> 'uper:empty-v20:20261126213651') OR
       NOT (JSON_UNQUOTE(JSON_EXTRACT(v_marker,'$.environment')) <=> @uper_environment) OR
       NOT (JSON_UNQUOTE(JSON_EXTRACT(v_marker,'$.accountInput')) <=> v_input_digest) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Existing account initialization has a different batch or private input';
    END IF;
    COMMIT;
    LEAVE bootstrap;
  END IF;
  IF (SELECT COUNT(*) FROM access_state)<>1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected existing access state; stop for review';
  END IF;
  OPEN empty_tables;
  ensure_empty: LOOP
    FETCH empty_tables INTO v_table;
    IF v_done THEN LEAVE ensure_empty; END IF;
    IF v_has_business AND v_table IN ('cms_media','enrollment_classes') THEN ITERATE ensure_empty; END IF;
    SET @uper_check_rows = CONCAT('SELECT EXISTS(SELECT 1 FROM `',v_table,'`) INTO @uper_has_rows');
    PREPARE uper_rows FROM @uper_check_rows;
    EXECUTE uper_rows;
    DEALLOCATE PREPARE uper_rows;
    IF @uper_has_rows<>0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Initialization found pre-existing rows; stop for review';
    END IF;
  END LOOP;
  CLOSE empty_tables;

  INSERT INTO access_roles(id,config) VALUES
    ('finance', '{"names":["Finance","Keuangan","财务"],"description":["View customers and verify receipts and refunds; no customer or pricing edits","Lihat pelanggan dan verifikasi penerimaan serta pengembalian; tanpa mengubah data atau harga","查看客户并核验收退款；不可修改客户资料、报价或优惠"],"grants":{"crm.read":"all","crm.payments.verify":"all"}}'),
    ('crm_leader', '{"names":["CRM Manager","Manajer CRM","CRM 管理者"],"description":["Manage sales across all customers","Kelola penjualan seluruh pelanggan","管理全部客户的销售业务"],"grants":{"crm.read":"all","crm.write":"all","crm.followup":"all","crm.attendance":"all","crm.assign":"all","crm.export":"all","crm.leader":"all","campaigns.manage":"all","crm.operations.manage":"all","notifications.read":"all","notifications.manage":"all","crm.dashboard.kpi.manage":"all"}}'),
    ('sales', '{"names":["Sales","Staf penjualan","销售"],"description":["Handle own customers and claim eligible unassigned customers","Tangani pelanggan sendiri dan ambil pelanggan tanpa penanggung jawab","处理本人客户并认领符合范围的未分配客户"],"grants":{"crm.read":"own","crm.write":"own","crm.followup":"own","crm.attendance":"own","crm.own":"own","crm.claim":"all"}}'),
    ('cms_admin', '{"names":["CMS Operator","Operator CMS","CMS 操作员"],"description":["Manage website content","Kelola konten situs","管理网站内容"],"grants":{"cms.manage":"all"}}'),
    ('academic_admin', '{"names":["Academic Administrator","Administrator Akademik","教务管理员"],"description":["Manage courses, class templates, classes, faculty and teacher rates","Kelola kursus, templat kelas, kelas, pengajar, dan tarif pengajar","管理课程、班型模板、班次、教师档案和课酬"],"grants":{"academics.manage":"all"}}'),
    ('hr_reader', '{"names":["HR Recruiter","Staf Rekrutmen","HR招聘专员"],"description":["Read recruitment submissions only","Hanya melihat lamaran kerja","仅查看招聘申请"],"grants":{"applications.read":"all"}}'),
    ('access_admin', '{"names":["System Administrator","Administrator Sistem","系统管理员"],"description":["Manage staff access; business data requires separate roles","Kelola akses staf; data bisnis memerlukan peran lain","管理员工权限；业务数据须另行授予角色"],"grants":{"access.read":"all","access.users":"all","access.roles":"all","access.sessions":"all","access.audit":"all"}}');
  INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams)
    SELECT JSON_UNQUOTE(JSON_EXTRACT(v_roster,CONCAT('$.',login_id,'.id'))),
      login_id,JSON_UNQUOTE(JSON_EXTRACT(v_roster,CONCAT('$.',login_id,'.name'))),
      password_hash,JSON_EXTRACT(v_roster,CONCAT('$.',login_id,'.roles')),JSON_ARRAY()
    FROM JSON_TABLE(v_input,'$[*]' COLUMNS(
      login_id VARCHAR(32) PATH '$.id', password_hash VARCHAR(255) PATH '$.passwordHash')) AS supplied;
  INSERT INTO access_state(id,value)
    SELECT CONCAT('pw:',LEFT(SHA2(id,256),29)),JSON_OBJECT('required',CAST('true' AS JSON))
    FROM crm_users;
  INSERT INTO access_state(id,value) VALUES
    ('policy',JSON_OBJECT('initialized',CAST('true' AS JSON),'bootstrap','Robert'));
  INSERT INTO portal_settings(id,value) VALUES
    ('empty_bootstrap_access_v20',JSON_OBJECT('batch','uper:empty-v20:20261126213651','environment',@uper_environment,'accountInput',v_input_digest));
  INSERT INTO portal_audit(actor,action,data) VALUES
    ('manual-sql','access.bootstrap',JSON_OBJECT('administrator','Robert','accountCount',JSON_LENGTH(v_input)));
  COMMIT;
END//
DELIMITER ;
CALL uper_bootstrap_empty_accounts_v20();
DROP PROCEDURE uper_bootstrap_empty_accounts_v20;
DO RELEASE_LOCK(@uper_bootstrap_lock);
SET @uper_bootstrap_accounts = NULL;
