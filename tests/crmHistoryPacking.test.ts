import test from 'node:test';import assert from 'node:assert/strict';import {packHistoryLanes} from '../src/utils/crmHistoryPacking';
const item=(lane:string,height=180,extra={})=>({lane,height,inset:12,dayStart:false,expanded:false,...extra});
function bounds(items:any[]){const result=packHistoryLanes(items);let end=0;const rows=items.map((item,i)=>{const top=end+result.margins[i];end=top+item.height;return {...item,top,bottom:end,cardTop:top+item.inset};});return {result,rows};}
test('alternating collapsed lanes compact vertically while retaining chronological top order and same-lane clearance',()=>{
 const items=[item('staff',180,{dayStart:true,inset:60}),item('staff',210),item('customer',160),item('customer',130),item('staff',140)];const {rows,result}=bounds(items);
 assert.ok(rows[2].top<rows[1].bottom);for(let i=1;i<rows.length;i++)assert.ok(rows[i].cardTop>=rows[i-1].cardTop+32);
 for(const lane of ['staff','customer']){const same=rows.filter(r=>r.lane===lane);for(let i=1;i<same.length;i++)assert.ok(same[i].top>=same[i-1].bottom+12);}
 assert.ok(rows.at(-1)!.bottom+result.bottomSpace<items.reduce((n,i)=>n+i.height,0));
});
test('expanded cards, system events and date boundaries separate both lanes without hiding the longest tail',()=>{
 for(const divider of [item('customer',500,{expanded:true}),item('system',80),item('customer',180,{dayStart:true,inset:60})]){
  const {rows,result}=bounds([item('customer',400),item('staff',100),divider,item('staff',90)]);
  assert.ok(rows[2].top>=Math.max(rows[0].bottom,rows[1].bottom)+12);
  if(divider.expanded||divider.lane==='system')assert.ok(rows[3].top>=rows[2].bottom+12);
  assert.equal(rows.at(-1)!.bottom+result.bottomSpace,Math.max(...rows.map(r=>r.bottom)));
 }
});
test('layout handles empty and unequal-height inputs without mutating input order or dimensions',()=>{
 assert.deepEqual(packHistoryLanes([]),{margins:[],bottomSpace:0});const items=[item('customer',500),item('staff',80)];const before=JSON.stringify(items);const {result}=bounds(items);assert.ok(result.bottomSpace>0);assert.equal(JSON.stringify(items),before);
});
