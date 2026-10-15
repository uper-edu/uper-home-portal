import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { openTrialDatabase, withLock } from './database.mjs';

export async function migrate(pool, name, {allowOfflineCopy=false,allowRestoreGuard=false}={}) {
  return withLock(pool, 'schema:' + name, async connection => {
    const [guards]=await connection.execute("SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name LIKE 'access_restore_guard_%'",[name]);
    if(guards.length&&!allowRestoreGuard)throw Error('Interrupted restore: security review barrier not finalized');
    const [version] = await connection.query('SELECT VERSION() AS version');
    if (!/^8\./.test(version[0].version) || /MariaDB/i.test(version[0].version)) {
      throw Error('This schema requires standard MySQL 8; validate the company version before continuing');
    }
    // DDL commits implicitly in MySQL. A dirty marker exposes partial migrations.
    await connection.query('CREATE TABLE IF NOT EXISTS trial_schema_versions (version INT PRIMARY KEY,state VARCHAR(16) NOT NULL,updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB');
    const [offline]=await connection.query("SELECT state FROM trial_schema_versions WHERE version=0");
    if(offline[0]?.state==='offline_copy'&&!allowOfflineCopy)throw Error('Offline migration copy cannot start application or worker');
    const [versions] = await connection.query('SELECT * FROM trial_schema_versions WHERE version=1');
    if (versions[0]?.state === 'ready') return applyContentMigration(connection);
    if (versions.length) throw Error('Incomplete schema migration: inspect the trial database before retrying');
    const [tables] = await connection.execute("SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name<>'trial_schema_versions'", [name]);
    if (tables.length) throw Error('Initial migration requires an empty trial database');
    await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(1,'applying')");
    const statements = (await readFile(new URL('./schema.sql', import.meta.url), 'utf8')).split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) await connection.query(statement.replace(/ENGINE=InnoDB$/,'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin'));
    await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=1");
    return applyContentMigration(connection);
  });
}

async function applyContentMigration(connection){
  const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=2');
  if(versions[0]?.state==='ready')return applyMediaAliasMigration(connection);
  if(versions.length)throw Error('Incomplete CMS migration: inspect the trial database before retrying');
  await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(2,'applying')");
  const statements=(await readFile(new URL('./schema-v2.sql',import.meta.url),'utf8')).split(';').map(s=>s.trim()).filter(Boolean);
  for(const statement of statements)await connection.query(statement.replace(/ENGINE=InnoDB$/,'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin'));
  await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=2");
  return applyMediaAliasMigration(connection);
}

async function applyMediaAliasMigration(connection){
  const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=3');
  if(versions[0]?.state==='ready')return applyExactContentMigration(connection);
  if(versions.length)throw Error('Incomplete media migration; inspect before retrying');
  await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(3,'applying')");
  await connection.query('ALTER TABLE cms_media ADD COLUMN legacy_name VARCHAR(191) NULL UNIQUE');
  await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=3");
  return applyExactContentMigration(connection);
}

async function applyExactContentMigration(connection){
  const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=4');
  if(versions[0]?.state==='ready')return applyCutoverHoldMigration(connection);
  if(versions.length)throw Error('Incomplete exact-content migration; inspect before retrying');
  await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(4,'applying')");
  await connection.query('ALTER TABLE cms_collections ADD COLUMN items_text LONGTEXT NULL');
  await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=4");
  return applyCutoverHoldMigration(connection);
}

async function applyCutoverHoldMigration(connection){
  const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=5');
  if(versions[0]?.state==='ready')return applyAccessMigration(connection);
  if(versions.length)throw Error('Incomplete cutover hold migration');
  await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(5,'applying')");
  await connection.query("CREATE TABLE notification_migration_holds(kind VARCHAR(16) NOT NULL,id VARCHAR(191) NOT NULL,held_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),reason VARCHAR(100) NOT NULL,PRIMARY KEY(kind,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin");
  await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=5");
  return applyAccessMigration(connection);
}

async function applyAccessMigration(connection){
 const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=6');
 if(versions[0]?.state==='ready')return applyStaffEmailMigration(connection);
 if(versions.length)throw Error('Incomplete access migration; inspect before retrying');
 await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(6,'applying')");
 await connection.query("CREATE TABLE access_roles(id VARCHAR(80) PRIMARY KEY, config JSON NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,revision BIGINT NOT NULL DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin");
 await connection.query("CREATE TABLE access_state(id VARCHAR(32) PRIMARY KEY,value JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin");
 await connection.query('ALTER TABLE crm_users ADD COLUMN access_revision BIGINT NOT NULL DEFAULT 1');
 await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=6");
 return applyStaffEmailMigration(connection);
}

async function applyStaffEmailMigration(connection){
 const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=7');
 if(versions[0]?.state==='ready')return applyAccessReliabilityMigration(connection);
 if(versions.length)throw Error('Incomplete staff email migration; inspect before retrying');
 await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(7,'applying')");
 await connection.query("ALTER TABLE crm_users ADD COLUMN email VARCHAR(254) NULL, ADD COLUMN email_key VARCHAR(254) GENERATED ALWAYS AS (NULLIF(LOWER(TRIM(email)),'')) STORED UNIQUE");
 await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=7");
 return applyAccessReliabilityMigration(connection);
}

async function applyAccessReliabilityMigration(connection){
 const [versions]=await connection.query('SELECT * FROM trial_schema_versions WHERE version=8');
 if(versions[0]?.state==='ready')return {version:8,state:'ready',alreadyApplied:true};
 if(versions.length)throw Error('Incomplete access reliability migration');
 await connection.query("INSERT INTO trial_schema_versions(version,state) VALUES(8,'applying')");
 await connection.query("CREATE TABLE access_operations(actor_id VARCHAR(191) NOT NULL,operation_id VARCHAR(100) NOT NULL,action VARCHAR(100) NOT NULL,fingerprint CHAR(64) NOT NULL,result JSON NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),PRIMARY KEY(actor_id,operation_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin");
 await connection.query("CREATE TABLE access_handovers(id CHAR(36) PRIMARY KEY,user_id VARCHAR(191) NOT NULL,revision BIGINT NOT NULL DEFAULT 1,state VARCHAR(24) NOT NULL DEFAULT 'pending',causes JSON NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),INDEX handover_user(user_id,state)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin");
 await connection.query("UPDATE trial_schema_versions SET state='ready',updated_at=CURRENT_TIMESTAMP(6) WHERE version=8");
 return {version:8,state:'ready'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = await openTrialDatabase(process.env);
  try { console.log(await migrate(pool, new URL(process.env.MYSQL_TRIAL_URL).pathname.slice(1))); }
  finally { await pool.end(); }
}
