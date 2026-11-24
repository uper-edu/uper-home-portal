import {Minus,Plus} from 'lucide-react';
import {enrollmentCopy} from '../utils/enrollmentCatalog';
import {enrollmentIntroductionStages,type EnrollmentCourseIntroduction,type EnrollmentIntroductionContent,type EnrollmentIntroductionLanguage} from '../utils/enrollmentCourseIntroduction';

export function EnrollmentCourseOverview({introduction,language}:{
  introduction:EnrollmentCourseIntroduction;language:EnrollmentIntroductionLanguage;
}) {
  const contentLanguage=introduction[language]?language:'en';
  const content=introduction[contentLanguage];
  if(!content)return null;
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
  const items=(text:string)=>text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const renderContent=(part:EnrollmentIntroductionContent,Heading:'h3'|'h4')=><div className="enrollment-course-overview" lang={contentLanguage}>
    {part.audience&&<section>
      <Heading>{t('适合谁','Who it’s for','Cocok untuk siapa')}</Heading>
      <p>{part.audience}</p>
    </section>}
    {part.outcomes&&<section>
      <Heading>{t('学完能做什么','What you’ll learn to do','Kemampuan yang akan dilatih')}</Heading>
      <ul lang={contentLanguage}>{items(part.outcomes).map((line,index)=><li key={index}>{line}</li>)}</ul>
    </section>}
    {([
      ['material',t('课程学什么','What you’ll study','Materi yang dipelajari'),part.topics],
      ['resources',t('怎么学、怎么练','How you’ll practise','Cara belajar dan berlatih'),part.practice],
    ] as const).map(([key,title,value])=>value&&<details key={key} data-enrollment-section={key}>
      <summary>
        <span>{title}</span>
        <Plus size={16} aria-hidden="true"/><Minus size={16} aria-hidden="true"/>
      </summary>
      <ul lang={contentLanguage}>{items(value).map((line,index)=><li key={index}>{line}</li>)}</ul>
    </details>)}
  </div>;
  if(!content.stages)return renderContent(content,'h3');
  return <>
    {(content.audience||content.outcomes||content.topics||content.practice)&&renderContent(content,'h3')}
    {enrollmentIntroductionStages.map(stage=>{
      const part=content.stages?.[stage];
      return part&&<details key={stage} data-enrollment-stage={stage}>
        <summary>
          <span>HSK {stage}</span>
          <Plus size={16} aria-hidden="true"/><Minus size={16} aria-hidden="true"/>
        </summary>
        {renderContent(part,'h4')}
      </details>;
    })}
  </>;
}
