import test from 'node:test';
import assert from 'node:assert/strict';
import {urlFor} from '../src/cmsClient.ts';
import {readFileSync} from 'node:fs';
import {cmsText} from '../src/utils/cmsLanguage.ts';
import {internalMysqlDirect} from '../cloud/mysql/transport.mjs';

test('COS-23: upload guidance describes COS and URL-only storage in all dictionaries',()=>{
 const en='PNG, JPEG or WebP up to 2 MB; uploaded to COS, only the URL is stored in the database';
 const zh='PNG、JPEG 或 WebP，最大 2 MB；上传到 COS，数据库仅保存资源地址';
 const id='PNG, JPEG, atau WebP hingga 2 MB; diunggah ke COS, hanya URL yang disimpan di basis data';
 assert.equal(cmsText(en,zh,'zh'),zh);
 assert.equal(cmsText(en,zh,'en'),en);
 assert.equal(cmsText(en,zh,'id'),id);
 const presentation=JSON.parse(readFileSync(new URL('../src/utils/crm-ui-presentation.json',import.meta.url),'utf8'));
 assert.deepEqual(presentation[zh],[en,id]);
 const panel=readFileSync(new URL('../src/components/crm/ContentManagementPanel.tsx',import.meta.url),'utf8');
 assert.ok(panel.includes(en)&&panel.includes(zh));
 assert.ok(!panel.includes('PNG, JPEG or WebP up to 2 MB; stored in MySQL'));
});

const base='https://uper-portal-public-20261104191752-1433456541.cos.ap-jakarta.myqcloud.com/cms/';
const url=base+'a'.repeat(64)+'.webp';
const dev={PORTAL_ENV:'dev',PORTAL_DEPLOYMENT:'remote-dev',PORTAL_REMOTE_DEV_APPROVED:'true',TRIAL_DATASET:'synthetic',MYSQL_TLS_MODE:'disabled',MYSQL_TRIAL_URL:'mysql://test:placeholder@cn60.monite.cn:3306/uper_trial_home'};

test('COS-01: COS image builders preserve the permanent resource URL',()=>{
 assert.equal(urlFor({url}).width(400).height(300).quality(80).auto().url(),url);
 assert.match(urlFor('https://cdn.sanity.io/images/project/data/image.webp').width(400).url(),/w=400/);
});

test('COS-02: direct remote development requires the exact approved target',()=>{
 assert.equal(internalMysqlDirect(dev),true);
 for(const patch of [
  {PORTAL_ENV:'prod'},{PORTAL_REMOTE_DEV_APPROVED:'false'},
  {MYSQL_TRIAL_URL:'mysql://test:placeholder@other.example:3306/uper_trial_home'},
  {MYSQL_TRIAL_URL:'mysql://test:placeholder@cn60.monite.cn:3306/another_database'},
  {MYSQL_TRIAL_URL:'mysql://test:placeholder@cn60.monite.cn:3307/uper_trial_home'},
  {MYSQL_TRIAL_SOCKET:'/tmp/mysql.sock'},
 ])assert.throws(()=>internalMysqlDirect({...dev,...patch}));
});
