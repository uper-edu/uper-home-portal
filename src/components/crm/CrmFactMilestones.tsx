import { useCrmUiText,useCrmUiLanguage } from "./CrmUiLanguage";
import { useEffect, useState } from "react";
import { groupFactMilestones } from "../../utils/crmFactMilestones";
import {
  formatCrmOperatingTime,
  formatCrmSummaryTime,
  viewerTimeZone,
} from "../../utils/crmOperatingTime";
import { crmAssessmentSummary } from "../../utils/crmAssessment";
import { CrmEvidenceAction } from "./CrmEvidenceAction";
import { CrmOperationLayer } from "./CrmOperationLayer";
import {
  progressSourceText,CrmProgressSourceBody,
  progressSourceTiming,
} from "./CrmSalesProgressHistory";
export function FactMilestoneTime({ event, compact = false }: any) {
  const ui = useCrmUiText();
  const full = event.occurredAt
    ? formatCrmOperatingTime(event.occurredAt, viewerTimeZone())
    : "";
  return (
    <span className="crm-fact-milestone-time">
      {event.occurredAt ? (
        <time
          dateTime={event.occurredAt}
          aria-label={full}
          title={
            full +
            " · " +
            viewerTimeZone() +
            (event.timeBasis === "reported_completion"
              ? " · "+ui("完成时间由设备上报")
              : "")
          }
        >
          {compact ? formatCrmSummaryTime(event.occurredAt,viewerTimeZone()) : full}
        </time>
      ) : (
        <span>{ui("实际发生时间未知")}</span>
      )}
    </span>
  );
}
export function FactMilestoneRows({ groups, onOpen }: any) {
  const ui = useCrmUiText(),lang=useCrmUiLanguage();
  return (
    <div className="crm-fact-milestone-rows">
      {groups.map((g: any) => (
        <article key={g.key} className="crm-fact-milestone-row">
          <div className="crm-fact-milestone-title">
            <strong>
              {ui(
                g.key.startsWith("assessment:")
                  ? g.title.replace(/^完成/, "")
                  : g.title,
              )}
            </strong>
            <button
              type="button"
              className="crm-work-link"
              aria-label={ui("查看")+ui(g.title)+ui("历次记录")+(lang==='zh'?`（${g.count}）`:` (${g.count})`)}
              onClick={() => onOpen(g)}
            >
              {g.key === "enrollment_confirmation"
                ? ui("确认记录")+g.count+ui("条")
                : g.count+ui("次")}
            </button>
          </div>
          <div className="crm-fact-milestone-latest">
            {g.unknownCount > 0 && g.latest.occurredAt && (
              <small>{ui("最近已知时间")} </small>
            )}
            <FactMilestoneTime event={g.latest} compact />
            {g.unknownCount > 0 && g.latest.occurredAt && (
              <small>{ui("另有")}{g.unknownCount}{ui("条时间未知")}</small>
            )}
          </div>
          <div className="crm-fact-milestone-actions">
            <CrmEvidenceAction
              behavior="open"
              description={ui("查看")+ui(g.title)+ui("的原始依据")}
              onClick={() => onOpen(g, g.latest.id)}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
/** Same scoped read endpoint as stage history; no writes, no new decision or completion workflow. */
export function CrmFactMilestones({
  lead,
  lang,
  isLight,
  request = fetch,
}: any) {
  const ui = useCrmUiText(lang);
  const [context, setContext] = useState<any>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [selection, setSelection] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    setError(false);
    request(`/api/crm/leads/${lead.id}/stage-context`, {
      signal: AbortSignal.timeout(10000),
    })
      .then(async (r: any) => {
        const d = await r.json();
        if (!r.ok || d.leadId !== lead.id) throw Error();
        if (alive) setContext(d);
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setContext(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [
    lead.id,
    lead.stageRevision,
    lead.simpleRevision,
    lead.latestAssessment?.attempt?.attemptId,
    retry,
  ]);
  useEffect(() => {
    setSelection(null);
  }, [lead.id]);
  const groups = groupFactMilestones(context?.establishedMilestones),
    group = selection && groups.find((g) => g.key === selection.key);
  const source = (s: any, index: number) => (
    <div
      key={s.type + ":" + s.id + ":" + index}
      className="crm-stage-basis-original"
    >
      <strong>{ui(s.label || "原始依据")}</strong>
      <span>{progressSourceTiming(s, lang)}</span>
      <CrmProgressSourceBody source={s} lang={lang}/>
    </div>
  );
  if (context && !error && !groups.length) return null;
  const entries = group
    ? selection.id
      ? group.records.filter((m: any) => m.id === selection.id)
      : group.records
    : [];
  return (
    <section className="crm-fact-milestones" aria-label={ui("事实里程碑")}>
      <h4>{ui("已完成")}</h4>
      {error ? (
        <p role="alert">
          {ui("事实里程碑暂不可用。")}
          <button
            type="button"
            className="crm-work-link"
            onClick={() => setRetry((v) => v + 1)}
          >
            {ui("重试")}
          </button>
        </p>
      ) : !context ? (
        <p role="status">{ui("正在加载事实里程碑…")}</p>
      ) : !groups.length ? (
        <p className="crm-fact-milestone-empty">{ui("暂无记录")}</p>
      ) : (
        <FactMilestoneRows
          groups={groups}
          onOpen={(g: any, id?: string) => setSelection({ key: g.key, id })}
        />
      )}
      {group && (
        <CrmOperationLayer
          compose
          title={ui(selection.id ? "里程碑依据" : "历次里程碑记录")}
          context={lead.fullName}
          lang={lang}
          isLight={isLight}
          onClose={() => setSelection(null)}
        >
          <div className="crm-editor-compose">
            <div className="crm-editor-scroll crm-fact-milestone-history">
              <div className="crm-fact-milestone-title">
                <h3>{ui(group.title)}</h3>
                <span>{group.key==='enrollment_confirmation'?ui("确认记录")+group.count+ui("条"):group.count+ui("次")}</span>
              </div>
              {group.key === "enrollment_confirmation" && (
                <p className="crm-simple-help">
                  {ui("次数表示报名确认记录，不代表不同课程、订单或付款次数。")}
                </p>
              )}
              {entries.map((m: any) => {
                const summary =
                  m.factType === "assessment"
                    ? crmAssessmentSummary(
                        {
                          latestAssessment: m.data,
                          levelSource: "assessment",
                        } as any,
                        lang,
                      )
                    : null;
                const basis =
                  m.basisSnapshots ||
                  context.sources.filter(
                    (s: any) =>
                      s.type === m.basis?.type && s.id === m.basis?.id,
                  );
                return (
                  <article key={m.id} className="crm-fact-milestone-entry">
                    <FactMilestoneTime event={m} />
                    {m.receivedAt && (
                      <small>
                        {ui("接收：")}
                        {formatCrmOperatingTime(m.receivedAt, viewerTimeZone())}
                      </small>
                    )}
                    {summary ? (
                      <div>
                        <strong>{summary.conclusion}</strong>
                        <p>{summary.detail}</p>
                      </div>
                    ) : (
                      <p>{m.text || ui("销售已明确确认报名成立")}</p>
                    )}
                    <details open={Boolean(selection.id)}>
                      <summary>
                        {ui("原始依据")}{basis.length ? `（${basis.length}）` : ""}
                      </summary>
                      {basis.length ? (
                        basis.map(source)
                      ) : (
                        <p>
                          {ui("该次确认仅填写了事实说明，说明已保留在上方，未补造关联记录。")}
                        </p>
                      )}
                    </details>
                    {m.recordedAt && (
                      <small>
                        {ui("录入：")}
                        {formatCrmOperatingTime(m.recordedAt, viewerTimeZone())}
                      </small>
                    )}
                  </article>
                );
              })}
              {selection.id && group.count > 1 && (
                <button
                  type="button"
                  className="crm-work-link"
                  onClick={() => setSelection({ key: group.key })}
                >
                  {ui("查看全部")}{group.count}{ui("条记录")}
                </button>
              )}
            </div>
            <div className="crm-editor-actions">
              <button
                type="button"
                className="crm-work-button"
                onClick={() => setSelection(null)}
              >
                {ui("关闭")}
              </button>
            </div>
          </div>
        </CrmOperationLayer>
      )}
    </section>
  );
}
