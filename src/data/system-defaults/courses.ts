import hsk1Introduction from './hsk1-course-introduction.json' with {type:'json'};
import {defaultEnrollmentCourseName,type EnrollmentTeaching} from '../../utils/enrollmentTemplates.ts';

const terms = {
  // Newly seeded courses are available in the published CRM catalog.
  "active": true,
  // Basis points: 100 means 1%. Zero grants no percentage discount.
  "maxDiscountBps": 0,
  // Optional absolute cap in IDR. Null adds no absolute cap; the percentage limit still applies.
  "maxDiscountAmount": null
};

// Stable IDs match the enrollment catalog. Amounts are totals in IDR.
const definitions = [
  {id:'4b7a59a2-cea5-4bf3-b8e4-102dd9bc4803',level:'HSK 1',sessions:23,price:1_150_000},
  {id:'5cd7f25c-c2ed-4e67-b797-940c3fbb784a',level:'HSK 2',sessions:24,price:2_880_000},
  {id:'74516bc0-f265-4225-8698-7133a95059e6',level:'HSK 3',sessions:42,price:5_040_000},
  {id:'3abe725a-d334-4b3c-8c49-12b679fe09b6',level:'HSK 4',sessions:84,price:10_080_000},
] as const;

export const enrollmentCoursePresets = definitions.map(({id,level,sessions,price})=>{
  const teaching:EnrollmentTeaching={
    level, material:'New Concept Chinese', minutes:45,
    knowledge:'', learningOutcomes:'', resources:'',
    ...(level==='HSK 1'?{introduction:hsk1Introduction}:{}),
  };
  return {id,config:{name:defaultEnrollmentCourseName(teaching,sessions),sessions,price,...terms,teaching}};
});

export default terms;
