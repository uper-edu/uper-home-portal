-- MANUAL ONLY. Fresh MySQL 8 database. Obtain the expected database name independently.
-- Use one fresh mysql client per file, without --force. No existing deployment data is imported.
DO CASE WHEN @uper_expected_database IS NOT NULL
  AND BINARY @uper_expected_database = BINARY DATABASE()
  AND VERSION() REGEXP '^8[.]' AND VERSION() NOT LIKE '%MariaDB%'
  THEN 0 ELSE JSON_EXTRACT('Verify MySQL 8 and the explicitly selected empty database', '$') END;
SET @uper_bootstrap_lock = CONCAT('uper:empty:', LEFT(SHA2(DATABASE(), 256), 48));
DO CASE WHEN GET_LOCK(@uper_bootstrap_lock, 0) = 1
  THEN 0 ELSE JSON_EXTRACT('Another initialization session holds the database lock', '$') END;

-- Fingerprints describe the 70 current tables (columns, indexes and check constraints). DDL is recovered only
-- if every surviving table bears this batch's comment, matches its shape, and has no rows.
SET SESSION group_concat_max_len=1048576;
DELIMITER //
CREATE PROCEDURE uper_bootstrap_empty_schema_v20()
SQL SECURITY INVOKER
bootstrap: BEGIN
  DECLARE v_owner VARCHAR(64) DEFAULT 'uper:empty-v20:20261126213651';
  DECLARE v_signatures JSON;
  DECLARE v_phase INT DEFAULT 0;
  DECLARE v_count INT;
  DECLARE v_bad INT;
  DECLARE v_table VARCHAR(64);
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE present_tables CURSOR FOR SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;

  SET v_signatures = JSON_OBJECT(
    'access_handovers', '6051ee3b0cf03334fdf21ffd0bddd991619d24d48d748230734ad767554b65d1',
    'access_operations', 'c802ba7337294df71b202ea6b724fcf5dbc760b97f3ad552fa1089d6f35fb952',
    'access_roles', '71d4f4b9ce15be3fa007844ac07fb75eae8f25a04e008e82d69443c9213e6427',
    'access_state', '1c64056e74dbd9144cb9e69d85b809088827711f9617a7774a3c9b14d16cbcc6',
    'ai_attempts', '25228884f6e231155f2458ec7b0e441dfb2a34368c839e61bb497fb40a4beb81',
    'campaign_promotion_index', 'de57d39dbf56c2ff81e91bc744228ecb0d5be0057f602223600503b3adab180e',
    'campaign_promotion_short_links', '9e477d99fb39fcafa9ccd352a2dd2d155754b26e5040fe93b7bfc880ab237a8a',
    'campaign_source_reviews', '19650d1208a06f833bdaa414b4e609aeb59f08179bc1afab4b0a2e01ed2ad706',
    'cms_collections', 'af2e33deb2ad6b18494296fc6cbd0805559a800e6cedf86fa460748d25057308',
    'cms_media', 'df38adbfcb766a512db51a71fd21e891fbd3176141f12e7ba167b3b15dace95b',
    'conversations', '659c361c45b15a4f44ece5ff8fcaac92d09783606b2c2d22cd37c3014ec46ceb',
    'crm_ai_extractions', 'f72ec6281fad4078535ce433983e596cd1f4f4d095e2549e423b0fa21e3d4eb7',
    'crm_courses', 'dadc6221a952cc9e7a2285f598492b6ebea94d87a00c97d1d59e936474b6f1dc',
    'crm_engagements', 'bc043ed64f36802ec7c0393935e10b7474eb620d5c34298637cd8b555ddf0da8',
    'crm_facts', '3c6a77cab37fd43204b4297ba6965b817a075541072eaa94056b6c8d20fc7960',
    'crm_login_limits', '6a46c9ab630ee42d8f94fb10baa1e4c2177808e7f304194fc426ccd619a2b631',
    'crm_operations', 'fdf9136c494e956869e098ffbce145e77c758c1f56716d7e18bb761768e0763f',
    'crm_payment_analytics', 'd43d80a4a6947902b8ff249a722010ece9588b61c57f5826ec4cac2e25081850',
    'crm_payment_images', 'd24a0d0ea84fee5e106aaec4f0f0a7b9e7dc8c84605321dfb513fa35aec3eb10',
    'crm_payment_ledgers', 'fa53b2cc2e9a613ca9292ce39511187a261f805d1664c92a97587f71dfd80aca',
    'crm_payment_references', 'e333186778c114ff571a39f724fc73bf85e75481c6f9a6b49aef820d4673390f',
    'crm_sessions', 'dfd8f5d3b9be9a4f06bca0c40ba3c7956f6ba553bcdc69bf60fc03c5d1cab0ec',
    'crm_users', '52035fa66f8af0eda4cdb0c834fb99487bbd53a1634c4cee2012a31726dec28c',
    'enrollment_assisted_applications', '160a211d9f2625ac1bc49b387ad71babdbe481c04dc4fea556ad9da0e8be40f2',
    'enrollment_class_openings', '88fb71ba1a24f751a6ec5fe04b1874c44678e30806091bace8f759466516bd9b',
    'enrollment_classes', '58e2c1b493aff9e297e8b76df38f1a33449155d8b7c275ecd449952e47ee9aef',
    'enrollment_customer_records', '8fe052c60d0fa1b82bc50d0b7fb5d3151214dda06bf8dd464aadc8d58ea82226',
    'enrollment_demands', '8680daa37785029612a7a3923c5936fe54d404b3ab1d98ffeee30c88908a64dd',
    'enrollment_email_challenges', '71ea5fc2bf0c20b238772e95f6105741ddd4d6be914774ae036bfb35cba5c2c8',
    'enrollment_email_sessions', '9745fc04407ba59634b245197d256c9ae01da6db3273507d167d0276e022fdca',
    'enrollment_interest_events', '23ba3b49774fe754c2e0fb46a35c614d269d5ed65ca6e152325a59edc7088898',
    'enrollment_mail_attempts', '58f32a8554cc20db6fa2ab4f383ceb70822b6a43d777d90262c3a93f050aa28b',
    'enrollment_mail_bindings', '41f9329606d107833da4e00d2091ebb4681dd4d8a2e2f129be9e8475755baf2d',
    'enrollment_mail_configuration', '9591d0397e0d64697eb78c654ff57de5bf998ca786959cd6b7743402f5253454',
    'enrollment_notification_receipts', 'c02e6d09fc916600f0890569ab21d05331de280df02aa93952f0eae72196e3cf',
    'enrollment_opportunities', 'f76dd770bf5250d2d0e5757cfd165f1d7e6743737d57f6f208605e3cdf026901',
    'enrollment_opportunity_progress', '23df35d96b4ee12ef375df9b83e9c06932b00fd7c1fdb48dbf39dd52b151ccec',
    'enrollment_orders', 'a27c6ff0a6f7efcebac86b472420a67d0c8feaabb95ef0f4693f93e66fc3fc93',
    'enrollment_payment_credits', 'b09cb42dcf729a0d70e196bca7ef0c886d41bfc53e60aeab789591a98aa7320d',
    'enrollment_proofs', '298da1ceb89541a61c282456e7431a27c0f4664876e5f830e530331cd5c38151',
    'enrollment_receipts', 'fcf2390baca474d2c6ba20e19f8d0f7c104a412f8ed41ce3e20d127fb19fbc06',
    'enrollment_record_attribution', '59c535bd508bf71491889470d49a7859dc291b93b5cc5919faab817293446f86',
    'enrollment_refund_cases', 'a87191a32661a1a28ebcb8829c18d25f37d463c894de943e9e2945ed9259742c',
    'enrollment_refund_payments', 'aeb54969be9d3d201536cdcc5d46d4997ecbf6b73751a719d0a5a6698f83c014',
    'enrollment_refund_returns', '31b0e78d1f61a8bf6e7cb570f4fccb93ba82f3a1206b5bd135e8a57c3e21a4d3',
    'enrollment_transfer_invitations', '861050896a6876f1169358947806b58c50fd0344e7d7d0f50482ce6fbeff7fcc',
    'enrollment_transfers', '50fc0881cc3a4ffa7150b61553b94b246b646b30a67a8cf54022c742e99f45e6',
    'enrollment_vacancy_cycles', 'ff38850566d4d33c70158118051cafa297e09bdde8f9a86c2833a06e38bf8149',
    'enrollment_waitlist', 'b2f8bfb8bf31f1e4fb65c10c47e799d00f7ef66d4be9b3230e2f5d7cdadd7cc9',
    'followup_tasks', 'd7cb0cc957d86a1502953f5b4a093780d9a3dbafc4070859228f2236ed50328d',
    'hsk_attempts', '2f649bb2096836d22cdd954e4470086c2c834195b9127c04beac7e9d86501fc7',
    'identity_candidates', 'a6e9ada7b1af5a195b40703a5bd4f5dba18471b055bc884481ec4a650ed98af5',
    'integration_credentials', '0672f026a9d3bdd549f9ea331dbb43de53f2611609d61733dd4893c5b773646b',
    'lead_daily_counters', '1e7c50a80ee23b18fbf8af2d10612b22da42b866e7c9586d90c9816a29ef522b',
    'messages', 'e4d73ae77016dab4c97a2ac0d2bc0b668906baebb5ef02b9aa172b84ef075df9',
    'notification_channels', 'c0c6816fd6c3ffa9a6b1a5e5c02a9667b2d2a8baef4f597127dad1e62b408843',
    'notification_inbox', 'e13f1ed00f72168a72711e380a7350ae17cce14974768cd914986486b2fe2496',
    'notification_jobs', '0aa111c3fee8ab20cb6cfa86e83493259119859e12ab03094153842cfd930c45',
    'notification_migration_holds', '36338bb36889b22240ba70eaa3e34f9804aa46a320ee422a51be4a98ee84b4a8',
    'notification_rules', 'cc9267128701f390f3d9f7db0c0a267d8b18e90def3a9d45305696fef9a20e39',
    'outbox', 'd8ef889104c16f9dac03d9f152556352bfd70468acd700bb5463785afc45a332',
    'portal_audit', 'b163be9e1cd792948ed8151df898c056527c3dee2c1e35a314248b4adcfd3261',
    'portal_leads', 'f0e116951d5b5bca705776bae2a963f013bca2203f99529c242d8f1b4305c377',
    'portal_settings', '8f56ce741f9c40514d14d4a60e5b0951da1c71bdaf51b1ea639328838bc86bc2',
    'rule_versions', '422a504390b976f802771b0747c4fde16c3f107b3e7ed4055618db78ee740c07',
    'site_submissions', '92b9bb0eaebf621ad6337f7315067795c1cc1c844bdccf4c1cd491f79bf47e9b',
    'trial_campaigns', '67acef5ff75f1f6e517194702d57af18ffe3d0be1549a0a4591a55b6c716151a',
    'trial_members', '9461ca37587361c9915c1f319012547f323c68e8a498cf0c65f39b28ec1c683b',
    'trial_schema_versions', 'b434a52aa55f0e1812dff4bc29b1a7e8ceb5d5e1ace1f5124c75f1b3da6bad9d',
    'visitor_sessions', '91f9ee0ae492695236166fddd1a3812ff2a4173c09680bb90d92e7d767ca74bf'
  );
  IF EXISTS(SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE())
    OR EXISTS(SELECT 1 FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE())
    OR EXISTS(SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE())
    OR EXISTS(SELECT 1 FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()
      AND ROUTINE_NAME<>'uper_bootstrap_empty_schema_v20') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected constraint, trigger, event or routine in bootstrap database';
  END IF;

  catalog_check: LOOP
    SELECT COUNT(*), COALESCE(SUM(TABLE_TYPE<>'BASE TABLE' OR BINARY TABLE_COMMENT<>BINARY v_owner),0)
      INTO v_count,v_bad FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE();
    IF v_bad<>0 OR (v_count>0 AND NOT EXISTS(SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trial_schema_versions')) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Database contains tables or views not owned by this empty bootstrap';
    END IF;

    SELECT COUNT(*) INTO v_bad FROM (
WITH cols AS (
  SELECT TABLE_NAME, GROUP_CONCAT(SHA2(JSON_ARRAY(COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
    COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME, EXTRA, GENERATION_EXPRESSION), 256)
    ORDER BY ORDINAL_POSITION SEPARATOR '') AS sig
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_NAME
), keys_by_table AS (
  SELECT TABLE_NAME, GROUP_CONCAT(SHA2(JSON_ARRAY(INDEX_NAME, NON_UNIQUE, COLUMN_NAME,
    SUB_PART, COLLATION, INDEX_TYPE, IS_VISIBLE, EXPRESSION), 256)
    ORDER BY INDEX_NAME COLLATE utf8mb3_bin, SEQ_IN_INDEX SEPARATOR '') AS sig
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_NAME),
  checks_by_table AS (
    SELECT tc.TABLE_NAME, GROUP_CONCAT(SHA2(JSON_ARRAY(tc.CONSTRAINT_NAME, ch.CHECK_CLAUSE, tc.ENFORCED), 256)
      ORDER BY tc.CONSTRAINT_NAME COLLATE utf8mb3_bin SEPARATOR '') AS sig
    FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.CHECK_CONSTRAINTS ch
      ON ch.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND ch.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.CONSTRAINT_TYPE='CHECK' GROUP BY tc.TABLE_NAME
  )
SELECT t.TABLE_NAME AS name, SHA2(CONCAT(t.ENGINE, ':', t.TABLE_COLLATION, ':',
  cols.sig, ':', COALESCE(keys_by_table.sig,''), ':', COALESCE(checks_by_table.sig,'')), 256) AS signature
FROM information_schema.TABLES t JOIN cols ON cols.TABLE_NAME=t.TABLE_NAME
LEFT JOIN keys_by_table ON keys_by_table.TABLE_NAME=t.TABLE_NAME
LEFT JOIN checks_by_table ON checks_by_table.TABLE_NAME=t.TABLE_NAME
WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='BASE TABLE'
    ) AS actual_catalog
    WHERE NOT (actual_catalog.signature <=> JSON_UNQUOTE(JSON_EXTRACT(v_signatures,
      CONCAT('$.',actual_catalog.name))));
    IF v_bad<>0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Table structure differs from the approved empty bootstrap';
    END IF;

    IF v_phase=1 THEN
      IF v_count<>70 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='New database schema is incomplete';
      END IF;
      INSERT INTO trial_schema_versions(version,state) VALUES
        (1,'ready'), (2,'ready'), (3,'ready'), (4,'ready'), (5,'ready'), (6,'ready'), (7,'ready'), (8,'ready'), (9,'ready'), (10,'ready'), (11,'ready'), (12,'ready'), (13,'ready'), (14,'ready'), (15,'ready'), (16,'ready'), (17,'ready'), (18,'ready'), (19,'ready'), (20,'ready');
      LEAVE bootstrap;
    END IF;

    IF v_count>0 THEN
      IF EXISTS(SELECT 1 FROM trial_schema_versions) THEN
        IF v_count=70 AND (SELECT COUNT(*) FROM trial_schema_versions)=20
          AND (SELECT COUNT(*) FROM trial_schema_versions WHERE version BETWEEN 1 AND 20 AND state='ready')=20 THEN
          LEAVE bootstrap;
        END IF;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected schema version state; inspect before retrying';
      END IF;
    END IF;

    OPEN present_tables;
    ensure_empty: LOOP
      FETCH present_tables INTO v_table;
      IF v_done THEN LEAVE ensure_empty; END IF;
      SET @uper_check_rows = CONCAT('SELECT EXISTS(SELECT 1 FROM `',v_table,'`) INTO @uper_has_rows');
      PREPARE uper_rows FROM @uper_check_rows;
      EXECUTE uper_rows;
      DEALLOCATE PREPARE uper_rows;
      IF @uper_has_rows<>0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Partially initialized database contains records; stop for review';
      END IF;
    END LOOP;
    CLOSE present_tables;

    CREATE TABLE IF NOT EXISTS `trial_schema_versions` (
      `version` int NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`version`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `access_handovers` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `user_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` bigint NOT NULL DEFAULT '1',
      `state` varchar(24) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'pending',
      `causes` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `handover_user` (`user_id`,`state`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `access_operations` (
      `actor_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `operation_id` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `action` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `fingerprint` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `result` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`actor_id`,`operation_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `access_roles` (
      `id` varchar(80) COLLATE utf8mb4_0900_bin NOT NULL,
      `config` json NOT NULL,
      `enabled` tinyint(1) NOT NULL DEFAULT '1',
      `revision` bigint NOT NULL DEFAULT '1',
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `access_state` (
      `id` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `value` json NOT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `ai_attempts` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `message_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `model` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `content` longtext COLLATE utf8mb4_0900_bin NOT NULL,
      `error` text COLLATE utf8mb4_0900_bin,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `message_id` (`message_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `campaign_promotion_index` (
      `p` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      `campaign_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      PRIMARY KEY (`p`),
      KEY `campaign_promotion_owner` (`campaign_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `campaign_promotion_short_links` (
      `short_code` char(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      `p` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      PRIMARY KEY (`short_code`),
      UNIQUE KEY `p` (`p`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `campaign_source_reviews` (
      `id` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `raw_code` varchar(200) COLLATE utf8mb4_0900_bin NOT NULL,
      `status` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `campaign_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `revision` bigint NOT NULL DEFAULT '1',
      `config` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `campaign_id` (`campaign_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `cms_collections` (
      `name` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` bigint unsigned NOT NULL DEFAULT '0',
      `items` json NOT NULL,
      `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `items_text` longtext COLLATE utf8mb4_0900_bin,
      PRIMARY KEY (`name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `cms_media` (
      `id` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `mime` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `content` mediumblob,
      `uploaded_by` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `legacy_name` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `storage_type` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'database',
      `cos_url` varchar(1024) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `object_key` varchar(255) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `byte_size` bigint unsigned DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `legacy_name` (`legacy_name`),
      KEY `idx_cms_media_storage` (`storage_type`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `conversations` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `visitor_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `source` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `attribution` json NOT NULL DEFAULT (json_object()),
      `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `visitor_id` (`visitor_id`),
      KEY `conversation_history` (`lead_id`,`updated_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_ai_extractions` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_type` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_revision` varchar(80) COLLATE utf8mb4_0900_bin NOT NULL,
      `input_hash` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `contract_version` varchar(40) COLLATE utf8mb4_0900_bin NOT NULL,
      `input` json NOT NULL,
      `status` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `output` json DEFAULT NULL,
      `model` varchar(100) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `error_code` varchar(80) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `attempts` int NOT NULL DEFAULT '0',
      `lease_until` datetime(6) DEFAULT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `completed_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `extraction_source` (`source_type`,`source_id`,`source_revision`,`contract_version`),
      KEY `extraction_ready` (`status`,`lease_until`),
      KEY `extraction_lead` (`lead_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_courses` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` int NOT NULL,
      `value` json NOT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_engagements` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `kind` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `data` json NOT NULL,
      `state` varchar(24) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'pending',
      `task_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `version` int NOT NULL DEFAULT '0',
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `engagement_lead` (`lead_id`,`state`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_facts` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `kind` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `actor` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `data` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `fact_lead` (`lead_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_login_limits` (
      `key` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `failures` int NOT NULL DEFAULT '0',
      `window_start` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_operations` (
      `actor` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `request_id` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `fingerprint` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `result` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`actor`,`request_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_payment_analytics` (
      `id` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      `environment` enum('dev','test','prod') COLLATE utf8mb4_0900_bin NOT NULL,
      `project_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_entry_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      `kind` enum('purchase','refund') COLLATE utf8mb4_0900_bin NOT NULL,
      `sequence_no` int unsigned NOT NULL,
      `amount` bigint unsigned NOT NULL,
      `course_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `state` enum('held','cancelled') COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'held',
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `dispatch_state` enum('sending','accepted','rejected','unknown','blocked') COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `attempted_at` datetime(6) DEFAULT NULL,
      `occurred_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `payment_analytics_order` (`environment`,`project_id`,`sequence_no`),
      KEY `payment_analytics_queue` (`environment`,`state`,`created_at`),
      KEY `payment_analytics_dispatch` (`environment`,`dispatch_state`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_payment_images` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `entry_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `created_by` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `name` varchar(160) COLLATE utf8mb4_0900_bin NOT NULL,
      `mime` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `bytes` int NOT NULL,
      `sha256` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `content` longblob NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `payment_image_entry` (`lead_id`,`entry_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_payment_ledgers` (
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` int NOT NULL DEFAULT '0',
      `value` json NOT NULL,
      PRIMARY KEY (`lead_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_payment_references` (
      `fingerprint` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `entry_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      PRIMARY KEY (`fingerprint`),
      KEY `lead_id` (`lead_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_sessions` (
      `token_hash` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `user_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `expires_at` datetime(6) NOT NULL,
      PRIMARY KEY (`token_hash`),
      KEY `user_id` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `crm_users` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `login_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `display_name` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `password_hash` text COLLATE utf8mb4_0900_bin NOT NULL,
      `roles` json NOT NULL,
      `teams` json NOT NULL,
      `active` tinyint(1) NOT NULL DEFAULT '1',
      `login_key` varchar(191) COLLATE utf8mb4_0900_bin GENERATED ALWAYS AS (lower(`login_id`)) STORED,
      `access_revision` bigint NOT NULL DEFAULT '1',
      `email` varchar(254) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `email_key` varchar(254) COLLATE utf8mb4_0900_bin GENERATED ALWAYS AS (nullif(lower(trim(`email`)),_utf8mb4'')) STORED,
      PRIMARY KEY (`id`),
      UNIQUE KEY `login_key` (`login_key`),
      UNIQUE KEY `email_key` (`email_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_assisted_applications` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `token_digest` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `opportunity_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `customer_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `class_revision` int unsigned NOT NULL,
      `actor` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `email` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `data` json NOT NULL,
      `expires_at` datetime(6) NOT NULL,
      `created_at` datetime(6) NOT NULL,
      `confirmed_at` datetime(6) DEFAULT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `enrollment_assisted_token` (`token_digest`),
      KEY `enrollment_assisted_opportunity` (`opportunity_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_class_openings` (
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `opened_at` datetime(6) NOT NULL,
      PRIMARY KEY (`class_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_classes` (
      `id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `course_id` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` int unsigned NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `first_lesson_at` datetime(6) NOT NULL,
      `enrollment_closes_at` datetime(6) NOT NULL,
      `data` json NOT NULL,
      `updated_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_class_catalog` (`state`,`first_lesson_at`),
      KEY `enrollment_class_course` (`course_id`,`first_lesson_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_customer_records` (
      `kind` varchar(12) COLLATE utf8mb4_0900_bin NOT NULL,
      `record_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `opportunity_id` char(36) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`kind`,`record_id`),
      KEY `enrollment_customer_records_lead` (`lead_id`,`created_at`),
      KEY `enrollment_customer_records_opportunity` (`opportunity_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_demands` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `email` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` int unsigned NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `criteria` json NOT NULL,
      `updated_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_demands_owner` (`email`,`updated_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_email_challenges` (
      `email` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `challenge_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `digest` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `expires_at` datetime(6) NOT NULL,
      `resend_at` datetime(6) NOT NULL,
      `locked_until` datetime(6) DEFAULT NULL,
      `attempts` tinyint unsigned NOT NULL DEFAULT '0',
      `used` tinyint(1) NOT NULL DEFAULT '0',
      PRIMARY KEY (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_email_sessions` (
      `digest` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `email` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `expires_at` datetime(6) NOT NULL,
      PRIMARY KEY (`digest`),
      KEY `enrollment_email_session_expiry` (`expires_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_interest_events` (
      `kind` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `interest_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `cycle` int unsigned NOT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`kind`,`interest_id`,`class_id`,`cycle`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_mail_attempts` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `environment` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `event_key` varchar(160) COLLATE utf8mb4_0900_bin NOT NULL,
      `account` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `recipient` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `is_external` tinyint(1) NOT NULL,
      `day_key` char(10) COLLATE utf8mb4_0900_bin NOT NULL,
      `month_key` char(7) COLLATE utf8mb4_0900_bin NOT NULL,
      `started_ms` bigint NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `pool_id` varchar(40) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      PRIMARY KEY (`id`),
      KEY `mail_rate` (`environment`,`started_ms`),
      KEY `mail_daily` (`environment`,`day_key`,`account`),
      KEY `mail_monthly` (`environment`,`month_key`,`account`),
      KEY `mail_event` (`environment`,`event_key`),
      KEY `mail_recipient` (`environment`,`recipient`,`state`),
      KEY `mail_pool_daily` (`environment`,`day_key`,`pool_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_mail_bindings` (
      `environment` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `recipient` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `account` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      PRIMARY KEY (`environment`,`recipient`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_mail_configuration` (
      `environment` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` int unsigned NOT NULL,
      `config` json NOT NULL,
      PRIMARY KEY (`environment`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_notification_receipts` (
      `event_key` varchar(160) COLLATE utf8mb4_0900_bin NOT NULL,
      `channel` varchar(8) COLLATE utf8mb4_0900_bin NOT NULL,
      `kind` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `subject_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `payload` json NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `recorded_at` datetime(6) NOT NULL,
      PRIMARY KEY (`event_key`),
      KEY `enrollment_notification_subject` (`subject_id`,`recorded_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_opportunities` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `level` varchar(24) COLLATE utf8mb4_0900_bin NOT NULL,
      `revision` int unsigned NOT NULL DEFAULT '0',
      `sales_stage` varchar(32) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_opportunity_lead` (`lead_id`,`level`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_opportunity_progress` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `opportunity_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `actor` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `sales_stage` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `note` varchar(2000) COLLATE utf8mb4_0900_bin NOT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_opportunity_progress_history` (`opportunity_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_orders` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `email` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `request_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `fingerprint` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `price` int unsigned NOT NULL,
      `received` bigint unsigned NOT NULL DEFAULT '0',
      `payment_due_at` datetime(6) NOT NULL,
      `upload_id` char(36) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `upload_expires_at` datetime(6) DEFAULT NULL,
      `created_at` datetime(6) NOT NULL,
      `data` json NOT NULL,
      `activity_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `enrollment_order_request` (`email`,`request_id`),
      KEY `enrollment_order_seats` (`class_id`,`state`,`payment_due_at`),
      KEY `enrollment_order_email` (`email`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_payment_credits` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `receipt_reference` varchar(120) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `target_order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `amount` int unsigned NOT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_credit_receipt` (`receipt_reference`),
      KEY `enrollment_credit_source` (`source_order_id`,`created_at`),
      KEY `enrollment_credit_target` (`target_order_id`,`created_at`),
      CONSTRAINT `enrollment_payment_credits_chk_1` CHECK (((`amount` > 0) and (`source_order_id` <> `target_order_id`)))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_proofs` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `mime` varchar(24) COLLATE utf8mb4_0900_bin NOT NULL,
      `digest` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `proof` longblob NOT NULL,
      `created_at` datetime(6) NOT NULL,
      `transfer_details` json DEFAULT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_proof_order` (`order_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_receipts` (
      `reference` varchar(120) COLLATE utf8mb4_0900_bin NOT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `amount` int unsigned NOT NULL,
      `actor` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `settled_at` datetime(6) NOT NULL,
      `created_at` datetime(6) NOT NULL,
      `receiving_account` varchar(160) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      PRIMARY KEY (`reference`),
      KEY `enrollment_receipt_order` (`order_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_record_attribution` (
      `kind` varchar(12) COLLATE utf8mb4_0900_bin NOT NULL,
      `record_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `attribution` json NOT NULL,
      PRIMARY KEY (`kind`,`record_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_refund_cases` (
      `order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `actor` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `reason` varchar(1000) COLLATE utf8mb4_0900_bin NOT NULL,
      `delivered_sessions` int unsigned NOT NULL,
      `expected` bigint unsigned NOT NULL,
      `created_at` datetime(6) NOT NULL,
      `timing` json DEFAULT NULL,
      PRIMARY KEY (`order_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_refund_payments` (
      `reference` varchar(120) COLLATE utf8mb4_0900_bin NOT NULL,
      `receipt_reference` varchar(120) COLLATE utf8mb4_0900_bin NOT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `amount` int unsigned NOT NULL,
      `actor` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`reference`),
      KEY `enrollment_refund_order` (`order_id`),
      KEY `enrollment_refund_receipt` (`receipt_reference`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_refund_returns` (
      `reference` varchar(120) COLLATE utf8mb4_0900_bin NOT NULL,
      `refund_reference` varchar(120) COLLATE utf8mb4_0900_bin NOT NULL,
      `amount` int unsigned NOT NULL,
      `actor` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`reference`),
      KEY `enrollment_refund_return_payment` (`refund_reference`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_transfer_invitations` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `target_class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `actor` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `expires_at` datetime(6) NOT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_transfer_order` (`order_id`,`state`,`expires_at`),
      KEY `enrollment_transfer_target` (`target_class_id`,`state`,`expires_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_transfers` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `source_class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `target_class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `invitation_id` char(36) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `created_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_transfers_order` (`order_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_vacancy_cycles` (
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `is_full` tinyint(1) NOT NULL,
      `cycle` int unsigned NOT NULL,
      PRIMARY KEY (`class_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `enrollment_waitlist` (
      `id` char(36) COLLATE utf8mb4_0900_bin NOT NULL,
      `class_id` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `email` varchar(254) COLLATE utf8mb4_0900_bin NOT NULL,
      `phone` varchar(26) COLLATE utf8mb4_0900_bin NOT NULL,
      `state` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `order_id` char(36) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `created_at` datetime(6) NOT NULL,
      `learner_name` varchar(120) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `activity_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`id`),
      KEY `enrollment_waitlist_owner` (`email`,`created_at`),
      KEY `enrollment_waitlist_class` (`class_id`,`state`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `followup_tasks` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `kind` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `owner_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `status` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'open',
      `due_at` datetime(6) NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `details` json NOT NULL DEFAULT (json_object()),
      `revision` int NOT NULL DEFAULT '0',
      `original_due_at` datetime(6) DEFAULT NULL,
      `scheduled_at` datetime(6) DEFAULT NULL,
      `timing_kind` varchar(24) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'response',
      `request_key` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `task_request` (`lead_id`,`request_key`),
      KEY `task_due` (`status`,`due_at`),
      KEY `task_lead` (`lead_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `hsk_attempts` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `visitor_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `input_hash` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `attempt` json NOT NULL,
      `result` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      KEY `lead_id` (`lead_id`),
      KEY `hsk_attempt_history` (`visitor_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `identity_candidates` (
      `visitor_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `candidate_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `decision` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'pending',
      `decided_by` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `reason` text COLLATE utf8mb4_0900_bin,
      `decided_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`visitor_id`,`candidate_id`),
      KEY `lead_id` (`lead_id`),
      KEY `candidate_id` (`candidate_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `integration_credentials` (
      `environment` varchar(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      `kind` varchar(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      `resource` varchar(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
      `state` json NOT NULL,
      PRIMARY KEY (`environment`,`kind`,`resource`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `lead_daily_counters` (
      `business_date` char(8) COLLATE utf8mb4_0900_bin NOT NULL,
      `last_value` bigint unsigned NOT NULL,
      PRIMARY KEY (`business_date`),
      CONSTRAINT `lead_daily_counters_chk_1` CHECK ((`last_value` > 0))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `messages` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `conversation_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `request_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `role` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `content` longtext COLLATE utf8mb4_0900_bin NOT NULL,
      `status` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `model` varchar(100) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `error` text COLLATE utf8mb4_0900_bin,
      `metadata` json NOT NULL DEFAULT (json_object()),
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `sequence` bigint unsigned NOT NULL AUTO_INCREMENT,
      PRIMARY KEY (`id`),
      UNIQUE KEY `sequence` (`sequence`),
      UNIQUE KEY `message_request` (`conversation_id`,`request_id`,`role`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `notification_channels` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `config` json NOT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `notification_inbox` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `employee_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `content` json NOT NULL,
      PRIMARY KEY (`id`),
      KEY `inbox_employee` (`employee_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `notification_jobs` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `event_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `rule_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `version` int NOT NULL,
      `channel` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `recipient` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `state` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL DEFAULT 'pending',
      `due_at` datetime(6) NOT NULL,
      `attempts` int NOT NULL DEFAULT '0',
      `lease_until` datetime(6) DEFAULT NULL,
      `result` text COLLATE utf8mb4_0900_bin,
      `snapshot` json NOT NULL,
      `completed_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `notification_event` (`event_id`,`rule_id`,`channel`,`recipient`),
      KEY `notification_due` (`state`,`due_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `notification_migration_holds` (
      `kind` varchar(16) COLLATE utf8mb4_0900_bin NOT NULL,
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `held_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `reason` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      PRIMARY KEY (`kind`,`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `notification_rules` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `version` int NOT NULL,
      `config` json NOT NULL,
      `enabled` tinyint(1) NOT NULL DEFAULT '0',
      `effective_at` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `outbox` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `type` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `payload` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      `processed_at` datetime(6) DEFAULT NULL,
      PRIMARY KEY (`id`),
      KEY `outbox_pending` (`processed_at`,`created_at`),
      KEY `outbox_lead` (`lead_id`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `portal_audit` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `actor` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `action` varchar(100) COLLATE utf8mb4_0900_bin NOT NULL,
      `data` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `portal_leads` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `business_number` varchar(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `profile` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      UNIQUE KEY `business_number` (`business_number`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `portal_settings` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `value` json NOT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `rule_versions` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `version` int NOT NULL,
      `config` json NOT NULL,
      PRIMARY KEY (`id`,`version`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `site_submissions` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `kind` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `request_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `input_hash` char(64) COLLATE utf8mb4_0900_bin NOT NULL,
      `visitor_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `payload` json NOT NULL,
      `attachment` mediumblob,
      `attachment_name` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      UNIQUE KEY `submission_request` (`kind`,`request_id`),
      KEY `lead_id` (`lead_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `trial_campaigns` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `code` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `config` json NOT NULL,
      `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (`id`),
      UNIQUE KEY `code` (`code`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `trial_members` (
      `site_user_id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `employee_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `mode` varchar(32) COLLATE utf8mb4_0900_bin NOT NULL,
      `active` tinyint(1) NOT NULL DEFAULT '1',
      PRIMARY KEY (`site_user_id`),
      KEY `employee_id` (`employee_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';

    CREATE TABLE IF NOT EXISTS `visitor_sessions` (
      `id` varchar(191) COLLATE utf8mb4_0900_bin NOT NULL,
      `lead_id` varchar(191) COLLATE utf8mb4_0900_bin DEFAULT NULL,
      `expires_at` datetime(6) NOT NULL,
      PRIMARY KEY (`id`),
      KEY `lead_id` (`lead_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin COMMENT='uper:empty-v20:20261126213651';
    SET v_phase=1;
  END LOOP;
END//
DELIMITER ;
CALL uper_bootstrap_empty_schema_v20();
DROP PROCEDURE uper_bootstrap_empty_schema_v20;
DO RELEASE_LOCK(@uper_bootstrap_lock);
