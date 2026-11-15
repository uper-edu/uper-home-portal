export function enrollmentRefundEstimate({ price, received, refunded, transferred, sessions, delivered }: {
  price: number; received: number; refunded: number; transferred: number; sessions: number; delivered: number;
}) {
  if (![price,received,refunded,transferred,sessions,delivered].every(Number.isSafeInteger) ||
      price<0 || received<0 || refunded<0 || transferred<0 || sessions<1 || delivered<0 || delivered>sessions) {
    throw Error('enrollment_invalid_refund_inputs');
  }
  const available=Math.max(0,received-refunded-transferred);
  if (delivered===0) return available;
  const remaining=Math.floor(price*(sessions-delivered)/sessions)-refunded-transferred;
  return Math.max(0,Math.min(available,remaining));
}

export function canSelectTransfer(order: {state:string;received:string|number;price:number}, sourceClass: {state:string}) {
  return sourceClass.state==='cancelled' && ['paid','recovered'].includes(order.state) && Number(order.received)>=order.price;
}
