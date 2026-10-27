import {metricSelectionLabel} from '../../utils/crmLeadAnalytics';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmId } from "../../utils/crmIndonesian";
import {
  defaultLeadFilters,
  dimensions,
  filterDimensions,
  taskOptions,
  type Dimension,
  type LeadFilters,
} from "../../utils/crmLeadFilters";
import {
  clearLeadConditions,
  leadConditionCount,
  advancedLeadDimensions,
} from "../../utils/crmFilterPresentation";
import type { CustomerView } from "../../utils/crmWorkspace";
interface Props {
  compact?: boolean;
  analysis?: boolean;
  value: LeadFilters;
  onChange: (value: LeadFilters) => void;
  lang: "zh" | "en" | "id";
  scope: string;
  isLight?: boolean;
  owners: Array<{ id: string; label: string }>;
  count: number;
  loading: boolean;
  timezone: string;
  viewMode: CustomerView;
  onViewMode: (mode: CustomerView) => void;
}
export function CrmLeadFilters({
  compact = false,
  analysis = false,
  value: f,
  onChange,
  lang,
  scope,
  isLight = true,
  owners,
  count,
  loading,
  timezone,
  viewMode,
  onViewMode,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const filterRoot=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!compact||!expanded)return;
    const dismiss=(event:PointerEvent)=>{
      const target=event.target as Element;
      if(filterRoot.current?.contains(target)||target.closest?.('.crm-detail-choice-popup'))return;
      setExpanded(false);
    };
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[compact,expanded]);
  const [sheetHeight,setSheetHeight]=useState(440);
  useLayoutEffect(()=>{
    if(!compact||!expanded)return;
    const measure=()=>{const top=filterRoot.current?.getBoundingClientRect().top??0;setSheetHeight(Math.min(680,Math.max(120,window.innerHeight-Math.max(12,top)-16)))};
    measure();window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
    return()=>{window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true)};
  },[compact,expanded]);
  const t = (en: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? crmId(en) : en;
  const update = (patch: Partial<LeadFilters>) => onChange({ ...f, ...patch });
  const dimLabel = (k: Dimension) =>
    k === "connect"
      ? t("Latest sales contact result", "最近销售联系结果")
      : k === "situation"
        ? t("Contact overview", "联系概况")
        : t(filterDimensions[k].en, filterDimensions[k].zh);
  const optionLabel = (k: Dimension, v: string) => {
    const o = filterDimensions[k].options.find((o) => o[0] === v);
    return o ? t(o[1], o[2]) : v;
  };
  const ownerValue =
    f.ownership === "person" ? "person:" + f.owner : f.ownership;
  const ownerOptions = [
    { value: "all", label: t("All accessible leads", "全部可见客户") },
    { value: "mine", label: t("Owned by me", "我负责的") },
    { value: "unassigned", label: t("Unassigned", "未分配") },
    ...(scope !== "own"
      ? owners.map((o) => ({ value: "person:" + o.id, label: o.label }))
      : []),
  ];
  const ownerLabel =
    ownerOptions.find((o) => o.value === ownerValue)?.label ||
    t("Unavailable owner", "负责人已不可用");
  const firstOptions = taskOptions.map((o) => ({
    value: o[0],
    label: t(o[1], o[2]),
  }));
  const firstLabel =
    firstOptions.find((o) => o.value === f.task)?.label || f.task;
  const selectDimension = (
    k: Dimension,
    source: LeadFilters,
    change: (patch: Partial<LeadFilters>) => void,
    className = "",
  ) => (
    <CrmSingleSelect
      className={className}
      label={dimLabel(k)}
      value=""
      multiple
      values={source[k]}
      options={filterDimensions[k].options.map((o) => ({
        value: o[0],
        label: optionLabel(k, o[0]),
      }))}
      displayValue={
        dimLabel(k) +
        " · " +
        (source[k].length === 1
          ? optionLabel(k, source[k][0])
          : source[k].length
            ? t(`${source[k].length} selected`, `已选${source[k].length}项`)
            : t("Any", "不限"))
      }
      onChange={() => {}}
      onValuesChange={(values) => change({ [k]: values })}
      lang={lang}
      isLight={isLight}
      footer={(close) => (
        <>
          <button type="button" onClick={() => change({ [k]: [] })}>
            {t("Clear", "清空")}
          </button>
          <button type="button" onClick={close}>
            {t("Done", "完成")}
          </button>
        </>
      )}
    />
  );
  const removeDimension = (k: Dimension, v: string) => {
    update({ [k]: f[k].filter((x) => x !== v) });
  };
  const clear = () => {
    const next = clearLeadConditions(f);
    onChange(next);
  };
  const reset = () => {
    const next = defaultLeadFilters(scope);
    onChange(next);
    setExpanded(false);
  };
  const advancedCount = advancedLeadDimensions.reduce(
    (n, k) => n + f[k].length,
    0,
  );
  const chip = (key: string, label: string, remove: () => void) => (
    <button
      type="button"
      key={key}
      className="crm-filter-chip"
      aria-label={t("Remove ", "移除") + label}
      onClick={remove}
    >
      {label}
      <X size={12} aria-hidden="true" />
    </button>
  );
  const group = (label: string, keys: Dimension[]) => (
    <fieldset className="crm-lead-filter-group">
      <legend>{label}</legend>
      {keys.map((k) => (
        <div key={k}>{selectDimension(k, f, update)}</div>
      ))}
    </fieldset>
  );
  return (
    <div
      className={
        "crm-filter-area crm-lead-filter-v3" +
        (compact ? " crm-filter-sidebar" : "")
      }
      data-theme={isLight ? "light" : "dark"}
      data-expanded={expanded}
      ref={filterRoot}
      onKeyDown={event=>{if(compact&&expanded&&event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();setExpanded(false);filterRoot.current?.querySelector<HTMLButtonElement>('.crm-filter-more')?.focus()}}}
    >
      <div className={compact?'crm-sidebar-filter-sheet':undefined} style={compact&&expanded?{maxHeight:sheetHeight}:undefined}>
      <section
        aria-label={t("Lead filters", "客户筛选")}
        className="crm-filter-panel"
      >
        <div className="crm-filter-main">
          <div className="crm-lead-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              maxLength={200}
              className="crm-filter-search"
              aria-label={t("Search customers", "搜索客户")}
              placeholder={t(
                "Name, phone, email or lead number…",
                "姓名、电话、邮箱或业务编号…",
              )}
              value={f.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </div>
          <CrmSingleSelect
            className="crm-filter-owner"
            label={t("Owner", "负责人")}
            value={ownerValue}
            options={ownerOptions}
            searchable
            displayValue={t("Owner", "负责人") + " · " + ownerLabel}
            onChange={(v) =>
              update(
                v.startsWith("person:")
                  ? { ownership: "person", owner: v.slice(7) }
                  : { ownership: v as LeadFilters["ownership"], owner: "" },
              )
            }
            lang={lang}
            isLight={isLight}
          />
          {selectDimension("stage", f, update, "crm-filter-stage")}
          <div
            className="crm-filter-task"
            title={t("Dates use ", "日期采用 ") + timezone}
          >
            <CrmSingleSelect
              label={t("First contact requirement", "首次联系")}
              value={f.task}
              options={firstOptions}
              displayValue={t("First contact", "首次联系") + " · " + firstLabel}
              onChange={(v) => update({ task: v })}
              lang={lang}
              isLight={isLight}
            />
          </div>
          <button
            type="button"
            className="crm-filter-more"
            aria-expanded={expanded}
            aria-controls="lead-more-filters"
            title={t('Match any selected value within a field, and all fields together.','同一条件多选时符合任一项即可，不同条件之间须同时符合。')}
            onClick={() => {
              setExpanded(!expanded);
            }}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            {compact?t("Filters","筛选"):t("More filters", "更多筛选")}
            {(compact?leadConditionCount(f):advancedCount) ? ` (${compact?leadConditionCount(f):advancedCount})` : ""}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
        {expanded && (
          <div id="lead-more-filters" className="crm-lead-advanced">
            <div className="crm-lead-filter-groups">
              {group(t("Interaction and follow-up", "互动与跟进"), [
                "connect",
                "situation",
              ])}
              {group(t("Sales progress", "销售进展"), ["tier", "signal"])}
              {group(t("Learning needs", "学习需求"), ["mode"])}
            </div>
          </div>
        )}
        {leadConditionCount(f) > 0 && (
          <div
            className="crm-filter-chips"
            aria-label={t("Applied filters", "已选条件")}
          >
            {f.overview?.map(key=>chip("overview:"+key,metricSelectionLabel(key,lang),()=>update({overview:f.overview?.filter(value=>value!==key)})))}
            {f.search.trim() &&
              chip("search", t("Search: ", "搜索：") + f.search, () =>
                update({ search: "" }),
              )}
            {f.ownership !== "all" &&
              chip("owner", t("Owner: ", "负责人：") + ownerLabel, () =>
                update({ ownership: "all", owner: "" }),
              )}
            {f.task !== "all" &&
              chip(
                "task",
                t("First contact: ", "首次联系：") + firstLabel,
                () => update({ task: "all" }),
              )}
            {f.workScope === "action" &&
              chip("scope", t("Needs-handling scope", "需处理范围"), () => {
                update({ workScope: "all" });
              })}
            {dimensions.flatMap((k) =>
              f[k].map((v) =>
                chip(k + v, dimLabel(k) + "：" + optionLabel(k, v), () =>
                  removeDimension(k, v),
                ),
              ),
            )}
            <button type="button" className="crm-lead-clear" onClick={clear}>
              {t("Clear conditions", "清空条件")}
            </button>
          </div>
        )}
      </section>
      <div
        className="crm-filter-results"
        aria-label={analysis ? t("Analysis filters", "分析筛选") : t("Customer list controls", "客户列表工具栏")}
      >
        {!compact&&<>
        <p role="status" aria-live="polite">
          {t(`${count} customers match`, `匹配 ${count} 位客户`)}
          <span className="crm-filter-updating" style={{visibility:loading?'visible':'hidden'}} aria-hidden={!loading}>{t('Updating…','更新中…')}</span>
        </p>
        </>}
        <button type="button" className="crm-lead-defaults" title={t("Restore role defaults and sorting; keep view unchanged","恢复角色默认筛选和排序，视图不变")} onClick={reset}>
          {t("Restore default filters", "恢复默认筛选")}
        </button>
        {!analysis && <CrmSingleSelect
          className="crm-lead-sort"
          label={t("Sort", "排序")}
          value={f.sort}
          options={[
            {
              value: "priority",
              label: t("Processing priority", "处理优先级"),
            },
            { value: "newest", label: t("Newest customer", "最近登记") },
            {
              value: "activity",
              label: t("Latest recorded activity", "最近动态记录"),
            },
            {
              value: "deadline",
              label: t("First contact deadline", "首次联系截止最早"),
            },
          ]}
          displayValue={
            t("Sort", "排序") +
            " · " +
            ({
              priority: t("Processing priority", "处理优先级"),
              newest: t("Newest customer", "最近登记"),
              activity: t("Latest recorded activity", "最近动态记录"),
              deadline: t("First contact deadline", "首次联系截止最早"),
            }[f.sort] || f.sort)
          }
          onChange={(v) => update({ sort: v })}
          lang={lang}
          isLight={isLight}
        />}
        {!compact && !analysis && (
          <CrmSingleSelect
            className="crm-lead-view"
            label={t("View", "视图")}
            value={viewMode}
            options={[
              { value: "worklist", label: t("Worklist", "工作列表") },
              { value: "table", label: t("Data table", "字段表") },
            ]}
            displayValue={
              t("View", "视图") +
              " · " +
              (viewMode === "worklist"
                ? t("Worklist", "工作列表")
                : t("Data table", "字段表"))
            }
            onChange={(v) => onViewMode(v as CustomerView)}
            lang={lang}
            isLight={isLight}
          />
        )}
      </div>
      </div>
    </div>
  );
}
