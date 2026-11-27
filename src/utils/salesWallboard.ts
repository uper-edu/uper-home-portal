import type {EnrollmentClassSummary} from './crmEnrollmentManagement.ts';
import type {DashboardAdSpend,DashboardAdSpendRow,DashboardEnrollmentFunnel,DashboardSnapshot,DashboardWallboard} from './crmOperationsDashboard.ts';

export const salesWallboardPath='/sales';
export const salesWallboardApi='/api/sales/wallboard';

export type WallboardClass=Pick<EnrollmentClassSummary,'id'|'level'|'format'|'period'|'batchNumber'|'firstLessonAt'|
  'capacity'|'minimumPaid'|'status'|'accepting'|'occupied'|'available'>&{
  counts:Pick<EnrollmentClassSummary['counts'],'paid'|'waiting'>;
};
type WallboardFunnel=Pick<DashboardEnrollmentFunnel,'lastCovered'|'coveredDays'|'expectedDays'|'channels'>;
type WallboardSpend=Pick<DashboardAdSpend,'currencies'>&{campaigns:(Pick<DashboardAdSpendRow,'currency'|'amount'|'channel'>&{mapping:unknown})[]};
type Snapshot=DashboardSnapshot;
export type SalesWallboardSnapshot=Pick<Snapshot,'asOf'|'period'|'traffic'|'current'|'compare'|'today'|'sources'|
  'compareSources'|'latestEntries'|'contributions'|'cash'|'demand'|'followup'>&{
  upcoming:WallboardClass[];
  queue:Pick<NonNullable<Snapshot['queue']>,'pending'|'refunds'|'refundOutstanding'|'receivable'|'reviewAges'|'pendingByClass'>&{oldest?:string|null}|null;
  wallboard?:Omit<DashboardWallboard,'enrollmentFunnel'>&{enrollmentFunnel?:WallboardFunnel|null};
  adSpend?:WallboardSpend|null;
  reservationOutcomes:Pick<Snapshot['reservationOutcomes'],'entries'>;
};

/** Public test charts use a fixed projection instead of sending the full signed-in CRM report. */
export function salesWallboardSnapshot(data:DashboardSnapshot):SalesWallboardSnapshot{
  const {asOf,period,traffic,current,compare,today,sources,compareSources,latestEntries,contributions,
    cash,demand,followup,queue,wallboard,adSpend}=data;
  const funnel=wallboard?.enrollmentFunnel;
  return {asOf,period,traffic,current,compare,today,sources,compareSources,latestEntries,contributions,cash,demand,followup,
    reservationOutcomes:{entries:data.reservationOutcomes.entries},
    upcoming:data.upcoming.map(({id,level,format,period,batchNumber,firstLessonAt,capacity,minimumPaid,status,accepting,occupied,available,counts})=>
      ({id,level,format,period,batchNumber,firstLessonAt,capacity,minimumPaid,status,accepting,occupied,available,
        counts:{paid:counts.paid,waiting:counts.waiting}})),
    wallboard:wallboard&&{
      priorDay:wallboard.priorDay,dailyPaid:wallboard.dailyPaid,traffic:wallboard.traffic,channels:wallboard.channels,kpiPlan:wallboard.kpiPlan,
      enrollmentFunnel:funnel&&{lastCovered:funnel.lastCovered,coveredDays:funnel.coveredDays,expectedDays:funnel.expectedDays,channels:funnel.channels},
    },
    queue:queue&&{pending:queue.pending,refunds:queue.refunds,refundOutstanding:queue.refundOutstanding,receivable:queue.receivable,
      reviewAges:queue.reviewAges,pendingByClass:queue.pendingByClass},
    adSpend:adSpend&&{currencies:adSpend.currencies,campaigns:adSpend.campaigns.filter(row=>row.mapping&&row.channel)
      .map(({currency,amount,channel})=>({currency,amount,channel,mapping:true}))},
  };
}
