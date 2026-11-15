// Published advisory rates supplied for HSK 1–4. These rates do not create a payable order.
export const oneToOneRates = {
  '1': { lessonPrice:160_000, referenceLessons:23 },
  '2': { lessonPrice:160_000, referenceLessons:24 },
  '3': { lessonPrice:600_000, referenceLessons:42 },
  '4': { lessonPrice:600_000, referenceLessons:84 },
};

export function oneToOneRate(level:string) {
  return Object.hasOwn(oneToOneRates,level) ? oneToOneRates[level as keyof typeof oneToOneRates] : undefined;
}
