import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createPrivateFile} from '../server/privateFile.mjs';
import {readEnvironment} from '../server/environment.mjs';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {collectInitialBusinessDefaults,containsCredential} from '../cloud/mysql/initial-business-defaults.mjs';
import {promotionIndexEntries} from '../cloud/mysql/promotion-index.mjs';
import {facultyFileLimits} from '../src/utils/crmFaculty.ts';
import {matchesEnrollmentProofSignature} from '../src/utils/enrollmentProofFile.ts';
import analytics from '../src/data/analyticsEnvironments.json' with {type:'json'};

const outputTables = {
  courses:['crm_courses','id,revision,value'],
  classes:['enrollment_classes','id,course_id,revision,state,first_lesson_at,enrollment_closes_at,data,updated_at'],
  settings:['portal_settings','id,value'],
  cms:['cms_collections','name,revision,items,updated_at,items_text'],
  media:['cms_media','id,mime,content,uploaded_by,created_at,legacy_name,storage_type,cos_url,object_key,byte_size'],
  campaigns:['trial_campaigns','id,code,config,created_at'],
  promotion:['campaign_promotion_index','p,campaign_id'],
  rules:['notification_rules','id,version,config,enabled,effective_at'],
  channels:['notification_channels','id,config'],
  mail:['enrollment_mail_configuration','environment,revision,config'],
} as const;

type Row = Record<string, any>;
type Connection = Pick<Awaited<ReturnType<Awaited<ReturnType<typeof openTrialDatabase>>['getConnection']>>, 'query' | 'execute'>;

function validateAttachments(settings: Row[]) {
  const byId = new Map(settings.map(({id,value}) => [id,value]));
  const digests = new Map<string,string>();
  for (const {id,value} of settings) {
    const match = /^faculty:(photo|cv):(.+)$/.exec(id);
    if (!match) continue;
    const kind = match[1] as keyof typeof facultyFileLimits;
    const meta = byId.get('faculty:profile:'+match[2])?.files?.[kind];
    const bytes = Buffer.from(value.data,'base64');
    const types = kind==='photo' ? ['image/jpeg','image/png'] : ['image/jpeg','image/png','application/pdf'];
    if (!meta || typeof value.name!=='string' || meta.name!==value.name || meta.type!==value.type ||
        meta.size!==value.size || value.size!==bytes.length || bytes.length<16 || bytes.length>facultyFileLimits[kind] ||
        !types.includes(value.type) || bytes.toString('base64')!==value.data || !matchesEnrollmentProofSignature(bytes,value.type)) {
      throw Error('Teacher attachment does not match the archived file and profile');
    }
    digests.set(id,createHash('sha256').update(bytes).digest('hex'));
  }
  return digests;
}

export async function collectTestBusinessSeed(connection: Connection) {
  const bundle = await collectInitialBusinessDefaults(connection,{manualTest:true});
  const settings = bundle.settings;
  const counts = new Map<string,number>();
  for (const {data} of bundle.classes) {
    if (!data.batchNumber) continue;
    const key = 'enrollment_batch:'+createHash('sha256').update(JSON.stringify([data.templateId,data.period])).digest('hex');
    counts.set(key,Math.max(data.batchNumber,counts.get(key)??0));
  }
  settings.push(...Array.from(counts,([id,last])=>({id,value:{last}})));
  const attachments = validateAttachments(settings);
  const [configRows] = await connection.query("SELECT id,value FROM portal_settings WHERE id IN ('ai_service','ga_settings:dev','crm_policy') OR id LIKE 'dashboard_monthly_kpi_v1:dev:%' ORDER BY id");
  for (const {id,value} of configRows as Row[]) {
    if (id==='ai_service') {
      settings.push({id,value:{revision:value.revision,current:value.current,previous:null,checks:[],history:[],
        suppliers:Object.fromEntries(Object.entries(value.suppliers??{}).map(([key,raw])=>{
          const {id,name,models,enabled}=raw as Row;
          return [key,{id,name,models,enabled}];
        }))}});
    } else if (id==='ga_settings:dev') {
      settings.push({id:'ga_settings:test',value:{measurementId:analytics.environments.test.measurementId,
        revision:value.revision,dispatchEnabled:value.dispatchEnabled}});
    } else if (id==='crm_policy') {
      settings.push({id,value});
    } else {
      const {version,month,targets,revision,approvedAt,milestones}=value;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || id!=='dashboard_monthly_kpi_v1:dev:'+month) throw Error('Invalid monthly KPI key');
      settings.push({id:'dashboard_monthly_kpi_v1:test:'+month,value:{version,month,targets,revision,approvedAt,milestones,environment:'test'}});
    }
  }
  const mail = bundle.mail;
  const rows:Record<keyof typeof outputTables,Row[]> = {
    courses:bundle.courses, classes:bundle.classes, settings, cms:bundle.cms, media:bundle.media,
    campaigns:bundle.campaigns,
    promotion:Array.from(promotionIndexEntries(bundle.campaigns),([p,campaign_id])=>({p,campaign_id})),
    rules:bundle.rules,channels:bundle.channels,
    mail:mail ? [{environment:'test', ...mail}] : [],
  };
  if (containsCredential(rows)) throw Error('The company-test initial values contain an unexpected credential field');
  return {rows,attachments};
}

function encode(value:unknown) {
  if (value===null) return 'NULL';
  if (typeof value==='number' && Number.isFinite(value)) return String(value);
  if (typeof value==='boolean') return value ? '1' : '0';
  const data = typeof value==='string' ? value : JSON.stringify(value);
  if (data===undefined) throw Error('Missing business seed field');
  if (!data) return "''";
  const hex = Buffer.from(data,'utf8').toString('hex');
  return `CONVERT(0x${hex} USING utf8mb4)`;
}

export function buildTestBusinessSql(rows: Awaited<ReturnType<typeof collectTestBusinessSeed>>['rows'], database: string) {
  if (!/^uper_trial_[a-z0-9_]+$/.test(database)) throw Error('Specify the approved empty company-test database name');
  const statements = [
    'DO CASE WHEN BINARY DATABASE() = BINARY '+encode(database)+ ' AND BINARY @uper_expected_database = BINARY DATABASE()',
    "  AND BINARY @uper_environment = 'test' THEN 0 ELSE JSON_EXTRACT('Incorrect target for private business defaults', '$') END;",
  ];
  for (const [section, [table, columns]] of Object.entries(outputTables)) {
    const name='uper_seed_'+table;
    const fields=columns.split(',');
    statements.push(`CREATE TEMPORARY TABLE ${name} LIKE ${table};`);
    for (const row of rows[section as keyof typeof rows]) {
      statements.push(`INSERT INTO ${name}(${columns}) VALUES(${fields.map(key=>encode(row[key])).join(',')});`);
    }
  }
  const digest=createHash('sha256').update(statements.join('\n')).digest('hex');
  statements.push(`SET @uper_business_digest='${digest}';\n`);
  return {sql:statements.join('\n'),digest};
}

async function main() {
  const [database,output,...extra]=process.argv.slice(2);
  if (!database || !output || extra.length) throw Error('Usage: node --import tsx scripts/prepare-empty-portal-business.mts TARGET_TEST_DB NEW_PRIVATE_BUSINESS.sql');
  const env=readEnvironment('dev').values;
  if (env.PORTAL_ENV!=='dev' || env.TRIAL_DATASET!=='local-crm' || env.PORTAL_LOCAL_CUTOVER!=='true' ||
      new URL(env.MYSQL_TRIAL_URL).pathname!=='/uper_local_crm') throw Error('The source must be the local 3000 CRM database');
  const pool=await openTrialDatabase(env);
  try {
    const connection=await pool.getConnection();
    try {
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
      const {rows,attachments}=await collectTestBusinessSeed(connection);
      await connection.commit();
      const {sql,digest}=buildTestBusinessSql(rows,database);
      createPrivateFile(resolve(output),sql);
      console.log(JSON.stringify({digest,...Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value.length])),attachments:attachments.size}));
    } finally { connection.release(); }
  } finally { await pool.end(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error=>{console.error(error.code??error.message);process.exitCode=1;});
}
