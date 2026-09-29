/**
 * AI agent evaluation harness — docs/PLANNING.md §6 ("Evaluation (capstone-worthy)").
 * Runs the 50-case set (cases.ts) through the live agent pipeline (server/agent.ts) and
 * scores intent accuracy, SKU accuracy, and complaint precision/recall.
 *
 * Run: npx tsx scripts/eval/run.ts
 * Writes a results report to docs/EVAL_RESULTS.md.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { generateAgentReply, AgentReply } from '../../server/agent';
import { ai } from '../../server/gemini';
import { evalCatalog } from './catalog';
import { evalCases, EvalCase, Category } from './cases';

interface CaseResult {
  case: EvalCase;
  result: AgentReply;
  predictedSku: string | null;
  predictedQty: number | null;
  intentCorrect: boolean;
  skuCorrect: boolean | null; // null = not applicable (no expectedSku)
  qtyCorrect: boolean | null;
}

function extractPredictedSku(result: AgentReply): string | null {
  if (result.cartAction?.sku) return result.cartAction.sku;
  const ask = result.askQuantityForSku || '';
  const encoded = ask.match(/^(?:CONFIRM|DETAILS):([^:]+):/);
  if (encoded) return encoded[1];
  if (ask && evalCatalog.some((p) => p.sku === ask)) return ask;
  for (const p of evalCatalog) {
    if (result.replyText.includes(p.sku)) return p.sku;
  }
  for (const p of evalCatalog) {
    if (result.replyText.toLowerCase().includes(p.name.toLowerCase())) return p.sku;
  }
  return null;
}

function extractPredictedQty(result: AgentReply): number | null {
  if (result.cartAction?.action === 'add' && result.cartAction.quantity > 0) return result.cartAction.quantity;
  const ask = result.askQuantityForSku || '';
  const m = ask.match(/^CONFIRM:[^:]+:(\d+)$/) || ask.match(/^DETAILS:[^:]+:(\d+)$/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function isOutOfStock(sku: string | undefined): boolean {
  if (!sku) return false;
  const p = evalCatalog.find((x) => x.sku === sku);
  return !!p && p.inventory === 0;
}

function scoreIntent(c: EvalCase, result: AgentReply, predictedSku: string | null, predictedQty: number | null): boolean {
  switch (c.category) {
    case 'price':
      // Must identify the right product and never jump straight to cartAction='add' on a
      // pure price question.
      return predictedSku === c.expectedSku && result.cartAction.action !== 'add';
    case 'stock': {
      const skuOk = predictedSku === c.expectedSku;
      if (!skuOk) return false;
      // Out-of-stock items must never be silently added to cart.
      if (isOutOfStock(c.expectedSku)) return result.cartAction.action !== 'add';
      return true;
    }
    case 'buy_no_qty': {
      const skuOk = predictedSku === c.expectedSku;
      if (!skuOk) return false;
      if (isOutOfStock(c.expectedSku)) return result.cartAction.action !== 'add';
      // Should ask for a quantity rather than guessing one, and never add without a qty.
      return result.cartAction.action !== 'add' && !!result.askQuantityForSku;
    }
    case 'buy_with_qty': {
      const skuOk = predictedSku === c.expectedSku;
      const qtyOk = predictedQty === c.expectedQty;
      return skuOk && qtyOk;
    }
    case 'complaint':
      return result.isComplaint === true;
    case 'chitchat':
      // Should not fabricate a cart action, misfire a complaint, or force a quantity ask
      // on an unrelated message.
      return result.cartAction.action === 'none' && result.isComplaint === false && !result.askQuantityForSku;
    default:
      return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  const result = await generateAgentReply({ message: c.message, catalog: evalCatalog });
  const predictedSku = extractPredictedSku(result);
  const predictedQty = extractPredictedQty(result);
  const intentCorrect = scoreIntent(c, result, predictedSku, predictedQty);
  const skuCorrect = c.expectedSku ? predictedSku === c.expectedSku : null;
  const qtyCorrect = c.expectedQty !== undefined ? predictedQty === c.expectedQty : null;
  return { case: c, result, predictedSku, predictedQty, intentCorrect, skuCorrect, qtyCorrect };
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`;
}

async function run() {
  console.log(`Gemini configured: ${ai ? 'YES (live API calls)' : 'NO (rule-based fallback only)'}`);
  console.log(`Running ${evalCases.length} cases...\n`);

  const results: CaseResult[] = [];
  for (const c of evalCases) {
    // Free-tier Gemini quota is 15 req/min for this model — pace calls well under that
    // (~6/min) so a 50-case run doesn't get throttled into the rule-based fallback partway
    // through, which would understate the real model's accuracy.
    if (results.length > 0) await sleep(5000);
    const r = await runCase(c);
    results.push(r);
    const mark = r.intentCorrect ? 'OK  ' : 'MISS';
    console.log(`[${mark}] ${c.id.padEnd(10)} (${c.category}/${c.language}) "${c.message}" -> sku=${r.predictedSku ?? '-'} qty=${r.predictedQty ?? '-'} complaint=${r.result.isComplaint}`);
  }

  // --- Aggregate metrics ---
  const byCategory = new Map<Category, CaseResult[]>();
  for (const r of results) {
    const arr = byCategory.get(r.case.category) || [];
    arr.push(r);
    byCategory.set(r.case.category, arr);
  }

  const totalIntentCorrect = results.filter((r) => r.intentCorrect).length;
  const skuApplicable = results.filter((r) => r.skuCorrect !== null);
  const skuCorrectCount = skuApplicable.filter((r) => r.skuCorrect).length;

  const complaintTP = results.filter((r) => r.case.expectedComplaint && r.result.isComplaint).length;
  const complaintFP = results.filter((r) => !r.case.expectedComplaint && r.result.isComplaint).length;
  const complaintFN = results.filter((r) => r.case.expectedComplaint && !r.result.isComplaint).length;
  const complaintPrecision = complaintTP + complaintFP === 0 ? null : complaintTP / (complaintTP + complaintFP);
  const complaintRecall = complaintTP + complaintFN === 0 ? null : complaintTP / (complaintTP + complaintFN);

  const lines: string[] = [];
  lines.push(`# AI Agent Evaluation Results`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Model path: ${ai ? 'Gemini (live)' : 'rule-based fallback'}`);
  lines.push(`Total cases: ${results.length}`);
  lines.push('');
  lines.push(`## Overall metrics`);
  lines.push('');
  lines.push(`- **Intent accuracy**: ${totalIntentCorrect}/${results.length} (${pct(totalIntentCorrect, results.length)})`);
  lines.push(`- **SKU accuracy** (cases with an expected product): ${skuCorrectCount}/${skuApplicable.length} (${pct(skuCorrectCount, skuApplicable.length)})`);
  lines.push(
    `- **Complaint precision**: ${complaintPrecision === null ? 'n/a' : (complaintPrecision * 100).toFixed(1) + '%'} (TP=${complaintTP}, FP=${complaintFP})`
  );
  lines.push(
    `- **Complaint recall**: ${complaintRecall === null ? 'n/a' : (complaintRecall * 100).toFixed(1) + '%'} (TP=${complaintTP}, FN=${complaintFN})`
  );
  lines.push('');
  lines.push(`## By category`);
  lines.push('');
  lines.push(`| Category | Cases | Intent correct | Accuracy |`);
  lines.push(`|---|---|---|---|`);
  for (const [cat, arr] of byCategory) {
    const correct = arr.filter((r) => r.intentCorrect).length;
    lines.push(`| ${cat} | ${arr.length} | ${correct} | ${pct(correct, arr.length)} |`);
  }
  lines.push('');
  lines.push(`## By language`);
  lines.push('');
  const byLang = new Map<string, CaseResult[]>();
  for (const r of results) {
    const arr = byLang.get(r.case.language) || [];
    arr.push(r);
    byLang.set(r.case.language, arr);
  }
  lines.push(`| Language | Cases | Intent correct | Accuracy |`);
  lines.push(`|---|---|---|---|`);
  for (const [lang, arr] of byLang) {
    const correct = arr.filter((r) => r.intentCorrect).length;
    lines.push(`| ${lang} | ${arr.length} | ${correct} | ${pct(correct, arr.length)} |`);
  }
  lines.push('');
  lines.push(`## Missed cases`);
  lines.push('');
  const missed = results.filter((r) => !r.intentCorrect);
  if (missed.length === 0) {
    lines.push('None.');
  } else {
    lines.push(`| Case | Category/Lang | Message | Expected SKU | Predicted SKU | isComplaint | Reply |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const r of missed) {
      const reply = r.result.replyText.replace(/\n/g, ' ').slice(0, 80).replace(/\|/g, '\\|');
      lines.push(
        `| ${r.case.id} | ${r.case.category}/${r.case.language} | ${r.case.message.replace(/\|/g, '\\|')} | ${r.case.expectedSku ?? '-'} | ${r.predictedSku ?? '-'} | ${r.result.isComplaint} | ${reply} |`
      );
    }
  }
  lines.push('');

  const report = lines.join('\n');
  const outPath = path.join(__dirname, '..', '..', 'docs', 'EVAL_RESULTS.md');
  fs.writeFileSync(outPath, report, 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log(`Intent accuracy: ${totalIntentCorrect}/${results.length} (${pct(totalIntentCorrect, results.length)})`);
  console.log(`SKU accuracy: ${skuCorrectCount}/${skuApplicable.length} (${pct(skuCorrectCount, skuApplicable.length)})`);
  console.log(`Complaint precision: ${complaintPrecision === null ? 'n/a' : (complaintPrecision * 100).toFixed(1) + '%'}`);
  console.log(`Complaint recall: ${complaintRecall === null ? 'n/a' : (complaintRecall * 100).toFixed(1) + '%'}`);
  console.log(`\nFull report written to docs/EVAL_RESULTS.md`);
}

run().catch((err) => {
  console.error('Eval harness crashed:', err);
  process.exit(1);
});
