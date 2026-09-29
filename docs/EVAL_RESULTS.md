# AI Agent Evaluation Results

Generated: 2026-09-29 (manual write-up from a completed live run — see note below)
Model path: Gemini (live), `gemini-3.5-flash-lite`
Total cases: 50

> Note: this run completed all 50 live Gemini calls successfully, but `scripts/eval/run.ts`
> crashed on the final report-writing step (`__dirname` used in this project's ESM context —
> now fixed). This file was written up by hand from that run's real, unedited output rather
> than re-running the 50 live calls a second time. Running `npx tsx scripts/eval/run.ts` again
> will now regenerate this file directly.

## Overall metrics

- **Intent accuracy**: 48/50 (96.0%)
- **SKU accuracy** (cases with an expected product, n=34): 34/34 (100.0%)
- **Complaint precision**: 100.0% (TP=7, FP=0)
- **Complaint recall**: 87.5% (TP=7, FN=1)

## By category

| Category | Cases | Intent correct | Accuracy |
|---|---|---|---|
| price | 10 | 10 | 100.0% |
| stock | 8 | 8 | 100.0% |
| buy_no_qty | 8 | 8 | 100.0% |
| buy_with_qty | 8 | 7 | 87.5% |
| complaint | 8 | 7 | 87.5% |
| chitchat | 8 | 8 | 100.0% |

## By language

| Language | Cases | Intent correct | Accuracy |
|---|---|---|---|
| en | 24 | 24 | 100.0% |
| bn (Bangla script) | 10 | 10 | 100.0% |
| banglish | 16 | 14 | 87.5% |

Both misses fell in the **banglish** (romanized code-mixed) column, not Bangla script or
English — consistent with the harder-to-classify case for code-mixed text noted in
`docs/PLANNING.md` §6 and CO2 §3.3 (SentMix-3L finding, CO1 Reference 6).

## Missed cases

| Case | Category/Lang | Message | Expected SKU | Predicted SKU | isComplaint | Reply |
|---|---|---|---|---|---|---|
| buyw-07 | buy_with_qty/banglish | ami 1ta bluetooth speaker kinbo | SPKR-01 | SPKR-01 | false | (model re-asked quantity instead of encoding qty=1 from "1ta") |
| comp-03 | complaint/banglish | Amar order ta onek deri hoyeche, ami hotasho | - | - | false | (model treated a delayed-order complaint as a normal order-status question, did not flag isComplaint) |

### What these two misses actually mean

- **buyw-07**: the SKU was still identified correctly — the miss is narrower than a category
  failure. The model failed to parse the Banglish quantity marker `"1ta"` (one) in
  `"ami 1ta bluetooth speaker kinbo"` and re-asked for quantity instead of proceeding to the
  confirm step. Every other `-ta` quantity phrasing in the set (`2ta`, `3ta` region) was parsed
  correctly elsewhere, so this looks like an isolated parse miss rather than a systematic gap.
- **comp-03**: a genuine complaint-detection gap — delayed-delivery frustration in Banglish
  ("my order is very late, I'm disappointed") wasn't recognized as a complaint. All 4
  English-language complaint cases (broken/scam/fake/refund keywords) and both other
  Banglish/Bangla complaint cases (which used more explicit "defect"/"fake"/"cheated" language)
  were caught correctly — the miss suggests the complaint classifier leans on stronger negative
  keywords and under-weights softer frustration language ("deri hoyeche", "hotasho") in
  Banglish specifically. Given CO2 §6.2 explicitly lowers the complaint threshold below 0.5
  *because* missing a real complaint is costlier than a false positive, this is worth a
  targeted prompt addition (explicit Banglish delay/frustration examples) rather than a
  structural fix.

## Zero false positives

No non-complaint case (42 of 50) was ever misclassified as a complaint, and no case ever
produced the wrong SKU when a SKU was expected. The model's failures in this run were both
under-triggers (missing a signal), never over-triggers (inventing one) — a meaningfully safer
failure mode for a sales agent than the reverse.
