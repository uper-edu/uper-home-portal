import {useEffect,useState} from 'react';
import {enrollmentInstant} from './enrollmentCatalog';
import {nextPaymentClockDelay} from './enrollmentPaymentClock';

export function useEnrollmentOpeningClock(firstLesson?:string,clockOffset=0) {
  const [now,setNow]=useState(Date.now);
  const start=enrollmentInstant(firstLesson)?.valueOf();
  useEffect(()=>{
    if(start===undefined)return;
    let timer:number|undefined;
    const update=()=>{
      window.clearTimeout(timer);
      if(document.hidden)return;
      const current=Date.now();
      setNow(current);
      const delay=nextPaymentClockDelay(current+clockOffset,NaN,start);
      if(delay!==undefined)timer=window.setTimeout(update,delay);
    };
    update();
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    return ()=>{
      window.clearTimeout(timer);
      window.removeEventListener('focus',update);
      document.removeEventListener('visibilitychange',update);
    };
  },[start,clockOffset]);
  return now+clockOffset;
}
