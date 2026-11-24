import {Minus,Plus} from 'lucide-react';
import {enrollmentCopy} from '../utils/enrollmentCatalog';
import type {EnrollmentCourseIntroduction,EnrollmentIntroductionLanguage} from '../utils/enrollmentCourseIntroduction';

export function EnrollmentCourseOverview({introduction,language}:{
  introduction:EnrollmentCourseIntroduction;language:EnrollmentIntroductionLanguage;
}) {
  const contentLanguage=introduction[language]?language:'en';
  const content=introduction[contentLanguage];
  if(!content)return null;
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
  const items=(text:string)=>text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  return <div className="enrollment-course-overview">
    {content.audience&&<section>
      <h3>{t('适合谁','Who it’s for','Cocok untuk siapa')}</h3>
      <p lang={contentLanguage}>{content.audience}</p>
    </section>}
    {content.outcomes&&<section>
      <h3>{t('学完能做什么','What you’ll learn to do','Kemampuan yang akan dilatih')}</h3>
      <ul lang={contentLanguage}>{items(content.outcomes).map((line,index)=><li key={index}>{line}</li>)}</ul>
    </section>}
    {([
      ['material',t('课程学什么','What you’ll study','Materi yang dipelajari'),content.topics],
      ['resources',t('怎么学、怎么练','How you’ll practise','Cara belajar dan berlatih'),content.practice],
    ] as const).map(([key,title,value])=>value&&<details key={key} data-enrollment-section={key}>
      <summary>
        <span>{title}</span>
        <Plus size={16} aria-hidden="true"/><Minus size={16} aria-hidden="true"/>
      </summary>
      <ul lang={contentLanguage}>{items(value).map((line,index)=><li key={index}>{line}</li>)}</ul>
    </details>)}
  </div>;
}
