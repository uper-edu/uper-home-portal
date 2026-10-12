# HSK placement assessment P0 repair (2026-10-12)

This repair covers the five P0 findings from the PDF-to-implementation review.
It is local source work; it does not authorize a push or production deployment.

## Confirmed scoring decision

The user selected the question-level star labels over the inconsistent final
count table in the supplied `HSK测评题.pdf`. Keep questions 41–42 at HSK 2.

| Passing level | HSK 1 (15 questions) | HSK 2 (17 questions) | HSK 3 (18 questions) |
| --- | --- | --- | --- |
| HSK 1 | 11 correct (70%, rounded up) | — | — |
| HSK 2 | 12 correct (80%) | 12 correct (70%, rounded up) | — |
| HSK 3 | 12 correct (80%) | 14 correct (80%, rounded up) | 13 correct (70%, rounded up) |

The exact question IDs and integer thresholds are in `src/data/hskScoring.ts`.
Full grading rejects an incomplete, duplicate or reclassified question list;
it must not silently change thresholds if the bank changes. Express rules are
outside this P0 repair and retain their existing behavior.

## Source content and annotations

- Keep the user-approved mobile choice format for character completion.
- Question 45 restores `我不（ ）意思让朋友帮忙。`, prompt `hǎo`, answer `好`.
  The new distractors are `号` and `浩`, with no extra option pinyin to reveal
  the answer by matching `hǎo`; these are digital-choice additions,
  not printed PDF options.
- Prompts and annotated options bind explicit Chinese/pinyin tokens. A blank
  occupies one token and carries a pronunciation only when the PDF supplies it.
- The token coverage test preserves the complete Chinese text and phonetic
  content; it catches omissions and annotation drift for the full bank.
- Selection resets on navigation independently of audio startup, so a playing
  next-question clip cannot retain the previous answer.
- The user also requested removing repeated numbering from the question body.
  The prompt badge is removed; source IDs remain in data for traceability.

## Original PDF image assets

All 21 unique scored images are direct crops of PDF pages 2, 4 and 7.
No generated, redrawn, SVG or cached replacement is used by the assessment.
The source SHA-256 is:

`e80a3cbaabc5e75c186001a54bb98793a29129fb3459e6b75903e69e5c9e4a54`

`src/data/hskPdfImageRegions.json` records the reviewed page rectangles in PDF
points. `src/data/hskPdfImages.json` records each output's page, rectangle,
dimensions and SHA-256. The assets live under
`public/images/hsk/source-e80a3cbaabc5/`, separate from the former drawings.
Missing assets show an error instead of silently introducing a replacement.

To reproduce the images, use Python with `pdfplumber` and its rendering
runtime installed:

```sh
python3 scripts/extract-hsk-pdf-images.py /path/to/HSK测评题.pdf
```

The extractor refuses a different source hash. Review the source and crop
regions before admitting another PDF version. The former PNG drawing generator
is retired and exits with an instruction to use this extractor.

## Validation

`tests/hskAssessment.test.ts` covers Full IDs/levels, scoring boundaries,
malformed Full banks, Q45, all annotated prompts/options and crop hashes.
Browser QA must also verify audio-driven navigation and the actual mobile
geometry; content tests alone do not prove the visible result.

P1/P2 findings remain separate: extra F choices, Express count/calibration,
result claims, persistence, time policy, localization and broader layout work
are not included in this repair.

Completed validation: 20 tests passed, TypeScript passed, production build
passed in `/tmp/uper-hsk-p0/production-build`, and `git diff --check` passed.
All 21 cropped assets were verified in the build by SHA-256. The isolated
browser flow completed 50 questions with all 49 transitions requiring a fresh
selection. Source-aligned text was checked at 320/390px and desktop width.
The preview did not submit any student record. No push or deployment was made.
