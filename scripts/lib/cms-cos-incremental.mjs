import {cmsMediaUrl, mediaDigest} from '../../cloud/mysql/cms-media-storage.mjs';

// Shared traversal contract: only these top-level image fields, never rich text.
export const imageFields = ['logo', 'image', 'coverImage', 'avatar', 'certificateImage'];
export const collectionNames = ['admissionsList', 'campaigns', 'news', 'newsPage', 'partners', 'programGallery', 'studentStories', 'trendingPrograms'];
export const procedureNames = ['uper_cms_cos_20261105_ref', 'uper_cms_cos_20261105_transform', 'uper_cms_cos_20261105_apply'];
const q = value => `'${String(value).replaceAll("'", "''")}'`;

export function validateManifest(bundle, media) {
  const rows = [...bundle.media].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (rows.length !== 208 || new Set(rows.map(x => x.id)).size !== 208 || rows.reduce((n, x) => n + x.bytes, 0) !== 51352764) throw Error('Unexpected official media manifest');
  for (const row of rows) {
    const bytes = media.get(row.id);
    if (row.url !== cmsMediaUrl(row.id, {}) || row.objectKey !== `cms/${row.id}.webp` || !bytes || bytes.length !== row.bytes || mediaDigest(bytes) !== row.id) throw Error('Media checksum/metadata mismatch');
  }
  return rows;
}

// Executable reference model for traversal tests. SQL itself uses native JSON, never this
// JS roundtrip: MySQL's JSON floating-point representation remains authoritative there.
export function transformItems(items, aliases, present) {
  const result = structuredClone(items);
  let refsChanged = 0, itemsChanged = 0, refsUncovered = 0;
  const scalar = value => {
    if (typeof value !== 'string' || !value) return value;
    const mapped = aliases.get(value);
    if (!mapped) { refsUncovered++; return value; }
    if (!present.has(mapped.id)) throw Error('Known reference has no media row');
    if (value !== mapped.url) refsChanged++;
    return mapped.url;
  };
  const image = value => {
    if (typeof value === 'string') return scalar(value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (typeof value.url === 'string') value.url = scalar(value.url);
      if (value.asset && typeof value.asset.url === 'string') value.asset.url = scalar(value.asset.url);
    }
    return value;
  };
  if (!Array.isArray(result)) throw Error('Items must be an array');
  for (const item of result) {
    if (!item || Array.isArray(item) || typeof item !== 'object' || typeof item._id !== 'string' || !item._id) throw Error('Invalid CMS item identity');
    const before = refsChanged;
    for (const field of imageFields) if (field in item) item[field] = image(item[field]);
    if (Array.isArray(item.images)) item.images = item.images.map(image);
    if (refsChanged !== before) {
      const version = item._cmsVersion ?? 0;
      if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) throw Error('Invalid CMS version');
      item._cmsVersion = version + 1; itemsChanged++;
    }
  }
  return {items: result, refsChanged, itemsChanged, refsUncovered};
}

const requiredColumns = [
  ['trial_schema_versions', 'version', "data_type='int' AND is_nullable='NO'"],
  ['trial_schema_versions', 'state', "data_type='varchar' AND character_maximum_length>=16 AND is_nullable='NO'"],
  ['trial_schema_versions', 'updated_at', "data_type='datetime' AND datetime_precision=6"],
  ['cms_media', 'id', "data_type='char' AND character_maximum_length=64 AND is_nullable='NO'"],
  ['cms_media', 'mime', "data_type='varchar' AND character_maximum_length>=100"],
  ['cms_media', 'content', "data_type='mediumblob'"],
  ['cms_media', 'legacy_name', "data_type='varchar' AND character_maximum_length>=191"],
  ['cms_media', 'uploaded_by', "data_type='varchar' AND character_maximum_length>=191"],
  ['cms_media', 'created_at', "data_type='datetime' AND datetime_precision=6"],
  ['cms_collections', 'name', "data_type='varchar' AND character_maximum_length>=100 AND is_nullable='NO'"],
  ['cms_collections', 'revision', "data_type='bigint' AND column_type LIKE '%unsigned%' AND is_nullable='NO'"],
  ['cms_collections', 'items', "data_type='json' AND is_nullable='NO'"],
  ['cms_collections', 'items_text', "data_type='longtext' AND is_nullable='YES'"],
  ['cms_collections', 'updated_at', "data_type='datetime' AND datetime_precision=6"],
];
const storageColumns = [
  ['storage_type', "data_type='varchar' AND character_maximum_length=16 AND is_nullable='NO' AND column_default='database'"],
  ['cos_url', "data_type='varchar' AND character_maximum_length=1024 AND is_nullable='YES'"],
  ['object_key', "data_type='varchar' AND character_maximum_length=255 AND is_nullable='YES'"],
  ['byte_size', "data_type='bigint' AND column_type LIKE '%unsigned%' AND is_nullable='YES'"],
];
const storageGate = `
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='cms_media' AND (
      ${storageColumns.map(([name, predicate]) => `(column_name=${q(name)} AND ${predicate} AND COALESCE(generation_expression,'')='')`).join(' OR\n      ')}
    ))=4
    AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='cms_media' AND column_name='content' AND data_type='mediumblob' AND is_nullable='YES')=1
    AND (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='cms_media' AND index_name='idx_cms_media_storage')=1
    AND (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='cms_media' AND index_name='idx_cms_media_storage' AND column_name='storage_type' AND seq_in_index=1 AND sub_part IS NULL AND non_unique=1 AND is_visible='YES')=1`;

export function generateSql(rows) {
  const [ref, transform, apply] = procedureNames;
  return `-- Generated by scripts/generate-cms-cos-incremental.mjs; DO NOT EDIT.
-- MySQL 8.x ONLY. Select an EXISTING application database in a fresh connection.
-- Maintenance window required: the named lock only serializes this script.
-- Requires SELECT/UPDATE on cms_media/cms_collections, SELECT/INSERT/UPDATE on
-- trial_schema_versions, ALTER on cms_media, CREATE TEMPORARY TABLES,
-- CREATE ROUTINE/ALTER ROUTINE/EXECUTE. Only abort-on-error batch execution is supported.
-- Use a NEW mysql client process with stdin file redirection, no --force.
-- The client must understand DELIMITER and stop immediately on ANY statement error.
-- Ordinary interactive SOURCE is NOT supported: it may continue after CREATE fails
-- and then CALL/DROP an existing routine. GUI batch execution must enable abort on error.
-- DDL commits independently; DML rollback cannot undo a successful v16 ALTER.
-- On failure disconnect (temporary tables vanish); inspect the error and v16 schema.
-- Failed runs leave only these dedicated routines; inspect ownership/definition,
-- then explicitly DROP the routines created by this run before retrying. Never
-- automatically drop a pre-existing routine. Successful runs drop their routines.
-- 208 SHA-256 objects, 51352764 bytes; no BLOB deletion, no seed/business inserts.
DELIMITER $$
CREATE PROCEDURE ${ref}(INOUT doc JSON, IN p VARCHAR(512), INOUT changed BIGINT, INOUT uncovered BIGINT)
SQL SECURITY INVOKER
BEGIN
  DECLARE old_url LONGTEXT;
  DECLARE new_url VARCHAR(1024);
  DECLARE found_media INT;
  DECLARE hits INT;
  IF JSON_TYPE(JSON_EXTRACT(doc,p))='STRING' THEN
    SET old_url=JSON_UNQUOTE(JSON_EXTRACT(doc,p));
    IF OCTET_LENGTH(old_url)>0 THEN
      SELECT COUNT(*), MAX(m.url), MAX(m.present) INTO hits,new_url,found_media
      FROM tmp_uper_cos_20261105_alias a JOIN tmp_uper_cos_20261105_map m ON m.id=a.id
      WHERE a.url=CAST(old_url AS BINARY);
      IF hits=0 THEN SET uncovered=uncovered+1;
      ELSE
        IF found_media<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Known CMS reference has no target media row'; END IF;
        IF CAST(old_url AS BINARY)<>CAST(new_url AS BINARY) THEN
          SET doc=JSON_SET(doc,p,new_url); SET changed=changed+1;
        END IF;
      END IF;
    END IF;
  END IF;
END$$
CREATE PROCEDURE ${transform}(INOUT doc JSON, OUT item_changes BIGINT, OUT ref_changes BIGINT, OUT uncovered BIGINT)
SQL SECURITY INVOKER
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE j INT;
  DECLARE k INT;
  DECLARE base VARCHAR(512);
  DECLARE p VARCHAR(512);
  DECLARE paths JSON;
  DECLARE old_changes BIGINT;
  DECLARE version_value JSON;
  DECLARE item_version BIGINT UNSIGNED;
  SET item_changes=0; SET ref_changes=0; SET uncovered=0;
  IF JSON_TYPE(doc)<>'ARRAY' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CMS items must be a JSON array'; END IF;
  WHILE i<JSON_LENGTH(doc) DO
    SET base=CONCAT('$[',i,']');
    IF JSON_TYPE(JSON_EXTRACT(doc,base))<>'OBJECT'
      OR COALESCE(JSON_TYPE(JSON_EXTRACT(doc,CONCAT(base,'._id'))),'NULL')<>'STRING'
      OR JSON_UNQUOTE(JSON_EXTRACT(doc,CONCAT(base,'._id')))='' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid CMS item identity';
    END IF;
    SET old_changes=ref_changes;
    SET paths=JSON_ARRAY(${imageFields.map(f => `CONCAT(base,${q('.' + f)})`).join(',')});
    IF JSON_TYPE(JSON_EXTRACT(doc,CONCAT(base,'.images')))='ARRAY' THEN
      SET j=0;
      WHILE j<JSON_LENGTH(JSON_EXTRACT(doc,CONCAT(base,'.images'))) DO
        SET paths=JSON_ARRAY_APPEND(paths,'$',CONCAT(base,'.images[',j,']')); SET j=j+1;
      END WHILE;
    END IF;
    SET k=0;
    WHILE k<JSON_LENGTH(paths) DO
      SET p=JSON_UNQUOTE(JSON_EXTRACT(paths,CONCAT('$[',k,']')));
      CALL ${ref}(doc,p,ref_changes,uncovered);
      CALL ${ref}(doc,CONCAT(p,'.url'),ref_changes,uncovered);
      CALL ${ref}(doc,CONCAT(p,'.asset.url'),ref_changes,uncovered);
      SET k=k+1;
    END WHILE;
    IF ref_changes<>old_changes THEN
      SET version_value=JSON_EXTRACT(doc,CONCAT(base,'._cmsVersion'));
      IF version_value IS NULL OR JSON_TYPE(version_value)='NULL' THEN SET item_version=0;
      ELSE
        IF JSON_TYPE(version_value) NOT IN ('INTEGER','UNSIGNED INTEGER') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid CMS item version'; END IF;
        IF CAST(JSON_UNQUOTE(version_value) AS DECIMAL(65,0))<0 OR CAST(JSON_UNQUOTE(version_value) AS DECIMAL(65,0))>=9007199254740991 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CMS item version out of range'; END IF;
        SET item_version=CAST(JSON_UNQUOTE(version_value) AS UNSIGNED);
      END IF;
      SET doc=JSON_SET(doc,CONCAT(base,'._cmsVersion'),item_version+1);
      SET item_changes=item_changes+1;
    END IF;
    SET i=i+1;
  END WHILE;
END$$
CREATE PROCEDURE ${apply}()
SQL SECURITY INVOKER
BEGIN
  DECLARE lock_name VARCHAR(64);
  DECLARE got_lock INT DEFAULT 0;
  DECLARE in_dml BOOLEAN DEFAULT FALSE;
  DECLARE finished BOOLEAN DEFAULT FALSE;
  DECLARE schema_complete BOOLEAN;
  DECLARE schema_changes INT DEFAULT 0;
  DECLARE version_changes INT DEFAULT 0;
  DECLARE state_value VARCHAR(16);
  DECLARE storage_count INT;
  DECLARE media_id CHAR(64);
  DECLARE legacy VARCHAR(191);
  DECLARE actual_hash CHAR(64);
  DECLARE actual_bytes BIGINT UNSIGNED;
  DECLARE actual_storage VARCHAR(16);
  DECLARE actual_url VARCHAR(1024);
  DECLARE actual_key VARCHAR(255);
  DECLARE actual_size BIGINT UNSIGNED;
  DECLARE wanted_url VARCHAR(1024);
  DECLARE wanted_key VARCHAR(255);
  DECLARE wanted_size BIGINT UNSIGNED;
  DECLARE n INT;
  DECLARE collection_name VARCHAR(100);
  DECLARE raw_text LONGTEXT CHARACTER SET utf8mb4;
  DECLARE doc JSON;
  DECLARE revision_value BIGINT UNSIGNED;
  DECLARE ci BIGINT;
  DECLARE cr BIGINT;
  DECLARE cu BIGINT;
  DECLARE media_changed BIGINT DEFAULT 0;
  DECLARE media_skipped BIGINT DEFAULT 0;
  DECLARE collections_changed BIGINT DEFAULT 0;
  DECLARE items_changed BIGINT DEFAULT 0;
  DECLARE refs_changed BIGINT DEFAULT 0;
  DECLARE refs_uncovered BIGINT DEFAULT 0;
  DECLARE media_cursor CURSOR FOR SELECT id FROM cms_media ORDER BY id FOR UPDATE;
  DECLARE collection_cursor CURSOR FOR SELECT name FROM cms_collections WHERE CAST(name AS BINARY) IN (${collectionNames.map(q).join(',')}) ORDER BY name FOR UPDATE;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished=TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    IF in_dml THEN ROLLBACK; END IF;
    IF got_lock=1 THEN DO RELEASE_LOCK(lock_name); END IF;
    RESIGNAL;
  END;
  IF DATABASE() IS NULL OR LEFT(VERSION(),2)<>'8.' OR VERSION() LIKE '%MariaDB%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select an existing application database on MySQL 8.x'; END IF;
  IF @@session.autocommit<>1 OR (FIND_IN_SET('STRICT_TRANS_TABLES',@@session.sql_mode)=0 AND FIND_IN_SET('STRICT_ALL_TABLES',@@session.sql_mode)=0) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Use a fresh autocommit connection with strict SQL mode'; END IF;
  SET lock_name=CONCAT('uper_cms_cos_',LEFT(SHA2(DATABASE(),256),40));
  SELECT GET_LOCK(lock_name,0) INTO got_lock;
  IF COALESCE(got_lock,0)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CMS COS incremental lock is busy'; END IF;
  IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('cms_media','cms_collections','trial_schema_versions') AND engine='InnoDB' AND table_type='BASE TABLE')<>3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required InnoDB CMS/version tables missing'; END IF;
  IF EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_schema=DATABASE() AND event_object_table IN ('cms_media','cms_collections','trial_schema_versions')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review custom triggers before CMS migration'; END IF;
${requiredColumns.map(([table, name, predicate]) => `  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=${q(table)} AND column_name=${q(name)} AND ${predicate} AND COALESCE(generation_expression,'')='')<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=${q('Required column mismatch: ' + table + '.' + name)}; END IF;`).join('\n')}
${[['cms_media','id'],['cms_collections','name'],['trial_schema_versions','version']].map(([table, col]) => `  IF (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=${q(table)} AND index_name='PRIMARY')<>1 OR (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=${q(table)} AND index_name='PRIMARY' AND column_name=${q(col)} AND sub_part IS NULL)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=${q('Required primary key mismatch: ' + table)}; END IF;`).join('\n')}
  SELECT MAX(state) INTO state_value FROM trial_schema_versions WHERE version=16;
  IF state_value IS NOT NULL AND state_value NOT IN ('ready','applying') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected v16 state'; END IF;
  SET schema_complete=(${storageGate});
  SELECT COUNT(*) INTO storage_count FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='cms_media' AND column_name IN ('storage_type','cos_url','object_key','byte_size');
  IF NOT schema_complete THEN
    IF state_value IS NOT NULL OR storage_count<>0 OR EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='cms_media' AND index_name='idx_cms_media_storage') OR (SELECT is_nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='cms_media' AND column_name='content')<>'NO' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Partial/inconsistent v16 schema; manual review required'; END IF;
    INSERT INTO trial_schema_versions(version,state) VALUES(16,'applying');
    ALTER TABLE cms_media
      MODIFY COLUMN content MEDIUMBLOB NULL,
      ADD COLUMN storage_type VARCHAR(16) NOT NULL DEFAULT 'database',
      ADD COLUMN cos_url VARCHAR(1024) NULL,
      ADD COLUMN object_key VARCHAR(255) NULL,
      ADD COLUMN byte_size BIGINT UNSIGNED NULL,
      ADD INDEX idx_cms_media_storage (storage_type);
    SET schema_changes=1;
    IF NOT (${storageGate}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='v16 post-DDL verification failed'; END IF;
    SET state_value='applying';
  END IF;
  IF state_value IS NULL THEN
    INSERT INTO trial_schema_versions(version,state) VALUES(16,'ready'); SET version_changes=1;
  ELSEIF state_value='applying' THEN
    UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=16; SET version_changes=1;
  END IF;
  CREATE TEMPORARY TABLE tmp_uper_cos_20261105_map (
    id VARBINARY(64) PRIMARY KEY, url VARCHAR(1024) CHARACTER SET utf8mb4 NOT NULL,
    object_key VARCHAR(255) NOT NULL, bytes BIGINT UNSIGNED NOT NULL,
    present TINYINT NOT NULL DEFAULT 0, needs_update TINYINT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB;
  CREATE TEMPORARY TABLE tmp_uper_cos_20261105_alias (url VARBINARY(2048) PRIMARY KEY,id VARBINARY(64) NOT NULL) ENGINE=InnoDB;
  CREATE TEMPORARY TABLE tmp_uper_cos_20261105_collections (name VARBINARY(400) PRIMARY KEY,doc JSON NOT NULL) ENGINE=InnoDB;
  INSERT INTO tmp_uper_cos_20261105_map(id,url,object_key,bytes) VALUES
${rows.map(x => `    (${q(x.id)},${q(x.url)},${q(x.objectKey)},${x.bytes})`).join(',\n')};
  INSERT INTO tmp_uper_cos_20261105_alias(url,id) SELECT CAST(url AS BINARY),id FROM tmp_uper_cos_20261105_map;
  INSERT INTO tmp_uper_cos_20261105_alias(url,id) SELECT CONCAT('/images/uploads/',id,'.webp'),id FROM tmp_uper_cos_20261105_map;
  START TRANSACTION; SET in_dml=TRUE;
  OPEN media_cursor;
  media_loop: LOOP
    FETCH media_cursor INTO media_id;
    IF finished THEN LEAVE media_loop; END IF;
    SELECT COUNT(*) INTO n FROM tmp_uper_cos_20261105_map WHERE id=CAST(media_id AS BINARY);
    IF n=0 THEN SET media_skipped=media_skipped+1;
    ELSE
      SELECT url,object_key,bytes INTO wanted_url,wanted_key,wanted_size FROM tmp_uper_cos_20261105_map WHERE id=CAST(media_id AS BINARY);
      SELECT legacy_name,SHA2(content,256),OCTET_LENGTH(content),storage_type,cos_url,object_key,byte_size
        INTO legacy,actual_hash,actual_bytes,actual_storage,actual_url,actual_key,actual_size
        FROM cms_media WHERE id=media_id FOR UPDATE;
      IF actual_hash IS NOT NULL AND (CAST(actual_hash AS BINARY)<>CAST(media_id AS BINARY) OR actual_bytes<>wanted_size) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Target media BLOB hash/size mismatch'; END IF;
      IF actual_url IS NOT NULL AND actual_url<>'' AND CAST(actual_url AS BINARY)<>CAST(wanted_url AS BINARY) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting target COS URL'; END IF;
      IF actual_key IS NOT NULL AND OCTET_LENGTH(actual_key)>0 AND CAST(actual_key AS BINARY)<>CAST(wanted_key AS BINARY) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting target COS object key'; END IF;
      IF actual_size IS NOT NULL AND actual_size<>wanted_size THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting target COS byte size'; END IF;
      IF actual_hash IS NULL AND NOT (CAST(actual_storage AS BINARY)<=>CAST('cos' AS BINARY) AND CAST(actual_url AS BINARY)<=>CAST(wanted_url AS BINARY) AND CAST(actual_key AS BINARY)<=>CAST(wanted_key AS BINARY) AND actual_size<=>wanted_size) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='NULL BLOB requires matching complete COS metadata'; END IF;
      UPDATE tmp_uper_cos_20261105_map SET present=1,needs_update=NOT (CAST(actual_storage AS BINARY)<=>CAST('cos' AS BINARY) AND CAST(actual_url AS BINARY)<=>CAST(wanted_url AS BINARY) AND CAST(actual_key AS BINARY)<=>CAST(wanted_key AS BINARY) AND actual_size<=>wanted_size) WHERE id=CAST(media_id AS BINARY);
      IF legacy IS NOT NULL AND legacy<>'' THEN
        IF NOT REGEXP_LIKE(legacy,'^[a-zA-Z0-9_.-]{1,191}$','c') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unsupported target legacy media alias'; END IF;
        IF EXISTS(SELECT 1 FROM tmp_uper_cos_20261105_alias WHERE url=CAST(CONCAT('/images/uploads/',legacy) AS BINARY) AND id<>CAST(media_id AS BINARY)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting target legacy media alias'; END IF;
        INSERT INTO tmp_uper_cos_20261105_alias(url,id) VALUES(CAST(CONCAT('/images/uploads/',legacy) AS BINARY),CAST(media_id AS BINARY)) ON DUPLICATE KEY UPDATE id=VALUES(id);
      END IF;
    END IF;
  END LOOP;
  CLOSE media_cursor;
  SET finished=FALSE;
  OPEN collection_cursor;
  collection_loop: LOOP
    FETCH collection_cursor INTO collection_name;
    IF finished THEN LEAVE collection_loop; END IF;
    SELECT COALESCE(items_text,CAST(items AS CHAR CHARACTER SET utf8mb4)),revision INTO raw_text,revision_value FROM cms_collections WHERE name=collection_name FOR UPDATE;
    IF NOT JSON_VALID(raw_text) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid authoritative CMS items_text'; END IF;
    SET doc=CAST(raw_text AS JSON);
    CALL ${transform}(doc,ci,cr,cu);
    SET refs_uncovered=refs_uncovered+cu;
    IF ci>0 THEN
      IF revision_value=18446744073709551615 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CMS collection revision overflow'; END IF;
      INSERT INTO tmp_uper_cos_20261105_collections(name,doc) VALUES(CAST(collection_name AS BINARY),doc);
      SET collections_changed=collections_changed+1; SET items_changed=items_changed+ci; SET refs_changed=refs_changed+cr;
    END IF;
  END LOOP;
  CLOSE collection_cursor;
  -- All validation finished. Only these two persistent business UPDATE statements.
  SELECT COUNT(*) INTO media_changed FROM tmp_uper_cos_20261105_map WHERE present=1 AND needs_update=1;
  UPDATE cms_media m JOIN tmp_uper_cos_20261105_map s ON CAST(m.id AS BINARY)=s.id
    SET m.storage_type='cos',m.cos_url=s.url,m.object_key=s.object_key,m.byte_size=s.bytes
    WHERE s.present=1 AND s.needs_update=1;
  UPDATE cms_collections c JOIN tmp_uper_cos_20261105_collections s ON CAST(c.name AS BINARY)=s.name
    SET c.items=CAST(s.doc AS JSON),c.items_text=CAST(s.doc AS CHAR CHARACTER SET utf8mb4),c.revision=c.revision+1,c.updated_at=CURRENT_TIMESTAMP(6);
  COMMIT; SET in_dml=FALSE;
  SELECT schema_changes AS schema_ddl_changed,version_changes AS schema_version_changed,
    media_changed AS media_changed,media_skipped AS media_skipped_unknown,
    (SELECT COUNT(*) FROM tmp_uper_cos_20261105_map WHERE present=0) AS manifest_media_absent,
    collections_changed AS collections_changed,items_changed AS items_changed,
    refs_changed AS refs_changed,refs_uncovered AS refs_uncovered,0 AS blobs_cleared;
  DROP TEMPORARY TABLE tmp_uper_cos_20261105_collections,tmp_uper_cos_20261105_alias,tmp_uper_cos_20261105_map;
  DO RELEASE_LOCK(lock_name); SET got_lock=0;
END$$
CALL ${apply}()$$
DROP PROCEDURE ${apply}$$
DROP PROCEDURE ${transform}$$
DROP PROCEDURE ${ref}$$
DELIMITER ;
`;
}
