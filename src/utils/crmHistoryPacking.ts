/** Visual packing only. Input/DOM order remains chronological; no records are reordered. */
export function packHistoryLanes(items:{lane:string;height:number;inset:number;dayStart:boolean;expanded:boolean}[]){
 const bottoms:Record<string,number>={customer:0,staff:0,system:0};let end=0,flowEnd=0,previousCardTop=0,barrier=0;
 const margins:number[]=[];
 items.forEach((item,index)=>{
  const full=item.expanded||item.lane==='system';
  const top=index===0?0:item.dayStart||full?end+12:Math.max(barrier,previousCardTop+32-item.inset,(bottoms[item.lane]||0)+12);
  margins.push(top-flowEnd);flowEnd=top+item.height;end=Math.max(end,flowEnd);bottoms[item.lane]=flowEnd;previousCardTop=top+item.inset;
  if(item.dayStart)barrier=Math.max(barrier,top+item.inset);
  if(full)barrier=flowEnd+12;
 });
 return {margins,bottomSpace:Math.max(0,end-flowEnd)};
}
