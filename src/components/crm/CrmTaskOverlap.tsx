import {taskOverlapCandidates,taskOverlapBasis} from '../../utils/crmTaskGuidance';
import {presentFollowUpTask,type TaskPresentationInput} from '../../utils/crmTaskPresentation';
import type {CrmLanguage} from '../../utils/crmLanguage';
export function CrmTaskOverlap({tasks,lang,timezone,focusId}:{tasks:TaskPresentationInput[];lang:CrmLanguage;timezone:string;focusId?:string}){
 const hints=taskOverlapCandidates(tasks,focusId);if(!hints.length)return null;
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const task=(v:TaskPresentationInput)=>{const p=presentFollowUpTask(v,lang,timezone);return <span>{p.action} · {p.formatTime(p.task.scheduledAt||p.task.dueAt||null)}</span>;};
 return <details className="crm-task-overlap"><summary>{t('Check work that may overlap','Periksa pekerjaan yang mungkin beririsan','核对可能重叠的工作')} ({hints.length})</summary>
  <p>{t('This is a review prompt, not a duplicate-task decision. Check the original requests and actual results. Complete tasks one at a time; no other task is merged or closed automatically.','Ini pengingat untuk meninjau, bukan keputusan bahwa tugas duplikat. Periksa permintaan asli dan hasil nyata. Selesaikan tugas satu per satu; tugas lain tidak digabung atau ditutup otomatis.','这里只提示核对，不代表重复任务。请对照原请求和实际结果逐项处理；不会自动合并或结束其他任务。')}</p>
  <ul>{hints.map(h=><li key={h.left.id+':'+h.right.id}><div>{task(h.left)}<span aria-hidden="true"> ↔ </span>{task(h.right)}</div><p>{taskOverlapBasis(h.basis,lang)}</p></li>)}</ul>
 </details>;
}
