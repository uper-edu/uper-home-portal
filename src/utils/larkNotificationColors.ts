/** Event classification only; never infer conversion, score quality, urgency or AI adoption. */
export function larkNotificationColor(event:string,failure?:string):{template:'blue'|'orange'|'turquoise'|'red'|'grey';foreground:string;background:string}{
 if(event==='ai.failed'||(event==='notification.failed'&&failure!=='delivery_unknown'))return {template:'red',foreground:'var(--admin-danger)',background:'var(--admin-danger-bg)'};
 if(event==='task.overdue'||(event==='notification.failed'&&failure==='delivery_unknown'))return {template:'orange',foreground:'var(--admin-warning)',background:'var(--admin-warning-bg)'};
 if(event==='assessment.completed')return {template:'turquoise',foreground:'var(--admin-quote)',background:'var(--admin-quote-bg)'};
 if(event==='daily.digest')return {template:'grey',foreground:'var(--admin-muted)',background:'var(--admin-surface)'};
 return {template:'blue',foreground:'var(--admin-info)',background:'var(--admin-info-bg)'};
}
