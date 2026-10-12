import { OFFICIAL_HSK_EXAM } from './src/data/hskQuizQuestions';

console.log('Total questions:', OFFICIAL_HSK_EXAM.length);
OFFICIAL_HSK_EXAM.forEach(q => {
  console.log(`Q${q.id} | Level: ${q.level} | Section: ${q.section} | Format: ${q.format} | Prompt: ${q.promptText?.substring(0, 30)} | Options: ${q.options?.length} | WordBank: ${q.wordBank?.length}`);
});
