export const enrollmentVerificationPath='/finance';
export const enrollmentBankPath='/finance?tab=enrollment-bank';
export const historicalPaymentsPath='/finance?paymentView=historical';

export function financeView(params:URLSearchParams,defaultView:'enrollment'|'historical'='enrollment'){
  if(params.get('tab')==='enrollment-bank')return 'enrollment-bank';
  if(params.has('enrollmentOrder')||params.get('paymentView')==='enrollment')return 'enrollment';
  if(params.get('paymentView')==='historical')return 'historical';
  return defaultView;
}

export function legacyPaymentLocation(params:URLSearchParams,hash=''){
  if(params.get('tab')!=='payments')return;
  const destination=new URLSearchParams(params);
  destination.delete('tab');
  destination.set('paymentView',financeView(destination,'historical')==='enrollment'?'enrollment':'historical');
  return `${enrollmentVerificationPath}?${destination}${hash}`;
}

export function enrollmentPaymentPath(orderId:string,returnParams?:{rosterReturn?:string;opportunityReturn?:string}){
  const params=new URLSearchParams({enrollmentOrder:orderId});
  if(returnParams?.rosterReturn)params.set('rosterReturn',returnParams.rosterReturn);
  if(returnParams?.opportunityReturn)params.set('opportunityReturn',returnParams.opportunityReturn);
  return `${enrollmentVerificationPath}?${params}`;
}
