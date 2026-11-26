import assert from 'node:assert/strict';
import {test} from 'node:test';
import {withUtcMysqlSessions} from '../cloud/mysql/database.mjs';

const setUtc="SET time_zone='+00:00'";

test('pooled leases, queries and prepared statements all set UTC before using MySQL',async()=>{
  const calls=[];
  const result=[[{id:'mock-row'}],[]];
  const connection={
    async query(...args){calls.push(args);return result;},
    async execute(...args){calls.push(args);return result;},
    release(){calls.push('release');},
  };
  const pool=withUtcMysqlSessions({getConnection:async()=>connection,end:async()=>calls.push('end')});
  assert.equal(await pool.query('SELECT ?', [1]),result);
  assert.equal(await pool.execute('SELECT ?', [2]),result);
  const lease=await pool.getConnection();
  assert.equal(lease,connection);
  lease.release();
  await pool.end();
  assert.deepEqual(calls,[
    [setUtc],['SELECT ?',[1]],'release',
    [setUtc],['SELECT ?',[2]],'release',
    [setUtc],'release','end',
  ]);
});

test('a MySQL session setup failure discards the checked-out connection',async()=>{
  const failure=new Error('setting session time zone failed');
  let discarded=0;
  const pool=withUtcMysqlSessions({
    getConnection:async()=>({
      query:async(sql)=>{
        assert.equal(sql,setUtc);
        throw failure;
      },
      execute:()=>assert.fail('Business SQL reached an uninitialized session'),
      destroy:()=>{discarded++;},
      release:()=>assert.fail('Uninitialized session returned to pool'),
    }),
  });
  for(const borrow of [()=>pool.getConnection(),()=>pool.query('SELECT 1'),()=>pool.execute('SELECT 1')]){
    await assert.rejects(borrow(),error=>error===failure);
  }
  assert.equal(discarded,3);
});

test('a business statement failure returns the initialized connection to the pool',async()=>{
  const calls=[];
  const failure=new Error('statement failed');
  const pool=withUtcMysqlSessions({getConnection:async()=>({
    query:async(sql)=>{calls.push(sql);if(sql!==setUtc)throw failure;},
    release:()=>calls.push('release'),
  })});
  await assert.rejects(pool.query('SELECT 1'),error=>error===failure);
  assert.deepEqual(calls,[setUtc,'SELECT 1','release']);
});
