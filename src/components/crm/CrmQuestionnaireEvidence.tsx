import {CrmSearchHighlight} from './CrmSearchHighlight';
import {questionnaireAnswerText} from '../../utils/crmQuestionnaireSalesContent';
import {
  questionnaireAnswers,
  questionnaireFields,
  questionnaireTimes,
} from "../../utils/crmQuestionnaireEvidence";
import { useCrmUiLanguage, useCrmUiText } from "./CrmUiLanguage";
import {
  formatCrmOperatingTime,
  viewerTimeZone,
} from "../../utils/crmOperatingTime";
export function CrmQuestionnaireEvidence({ source, lang: provided,highlightFields=[],showTimes=true }: any) {
  const lang = useCrmUiLanguage(provided),
    ui = useCrmUiText(provided),
    answers = questionnaireAnswers(source),
    times = questionnaireTimes(source);
  const show = (key:string,value:string)=>questionnaireAnswerText(key,value,lang);
  return (
    <section
      className="crm-questionnaire-evidence"
      aria-label={ui("客户问卷摘要")}
    >
      <dl className="crm-history-details">
        {questionnaireFields
          .filter(
            ([key]) =>
              answers[key] != null &&
              (!Array.isArray(answers[key]) || answers[key].length),
          )
          .map(([key, label]) => (
            <div key={key} className={highlightFields.includes(key)?"crm-history-field-match":undefined}>
              <dt>{ui(label)}</dt>
              <dd>
                {Array.isArray(answers[key]) ? (
                  <ul>
                    {answers[key].map((v: string) => (
                      <li key={v}><CrmSearchHighlight text={show(key, v)}/></li>
                    ))}
                  </ul>
                ) : (
                  <CrmSearchHighlight text={show(key, answers[key])}/>
                )}
              </dd>
            </div>
          ))}
        {!answers.campaignName && (
          <div>
            <dt>{ui("营销活动")}</dt>
            <dd>{ui("原问卷未记录活动名称")}</dd>
          </div>
        )}
        {showTimes && times.submittedAt && (
          <div>
            <dt>{ui("客户提交时间（问卷上报）")}</dt>
            <dd>
              <time dateTime={times.submittedAt}>
                {formatCrmOperatingTime(times.submittedAt, viewerTimeZone())}
              </time>
            </dd>
          </div>
        )}
        {showTimes && times.receivedAt && (
          <div>
            <dt>{ui("系统接收时间")}</dt>
            <dd>
              <time dateTime={times.receivedAt}>
                {formatCrmOperatingTime(times.receivedAt, viewerTimeZone())}
              </time>
            </dd>
          </div>
        )}
        {showTimes && !times.submittedAt && !times.receivedAt && (
          <div>
            <dt>{ui("问卷时间")}</dt>
            <dd>{ui("未记录")}</dd>
          </div>
        )}
      </dl>
      {!Object.keys(answers).some((k) => k !== "buyingSignals") &&
        !answers.buyingSignals?.length && (
          <p>{ui("本条未附可展示的问卷答案")}</p>
        )}
    </section>
  );
}
