// Score the chatbot's retrieval against eval/golden-questions.csv.
//
// A question passes when:
//   * expected_source is REFUSE  → nothing is retrieved (the bot declines)
//   * otherwise                  → the top 3 results include an expected
//     source ('*' = any, 'A|B' = either) AND contain must_contain.
// Exit code 1 if anything fails — so /goal and CI can use it as a gate.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { readFileSync } from 'node:fs';
import { search, structuredAnswer } from '../js/rag.js';

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c =>
      c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    rows.push({ id: cells[0], question: cells[1], expected: cells[2], must: cells[3] });
  }
  return rows;
}

const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
const bytes = new Uint8Array(readFileSync('data/academy.db'));
const p = sqlite3.wasm.allocFromTypedArray(bytes);
const db = new sqlite3.oo1.DB();
db.checkRc(sqlite3.capi.sqlite3_deserialize(db.pointer, 'main', p, bytes.length, bytes.length,
  sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE));

const golden = parseCsv(readFileSync('eval/golden-questions.csv', 'utf8'));
let pass = 0;
const t0 = performance.now();
for (const g of golden) {
  const structured = structuredAnswer(db, g.question);
  const hits = structured ? structured.hits : search(db, g.question, 3);
  let ok;
  if (g.expected === 'REFUSE') {
    ok = hits.length === 0;
  } else {
    const allowed = g.expected.split('|');
    const sourceOk = g.expected === '*' || hits.some(h => allowed.includes(h.doc_id));
    const text = (structured ? structured.text + ' ' : '') +
                 hits.map(h => `${h.title} ${h.section} ${h.body}`).join(' ');
    ok = sourceOk && text.toLowerCase().includes(g.must.toLowerCase());
  }
  if (ok) pass++;
  const got = hits.map(h => h.doc_id).join(', ') || '(refused)';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${g.id}  ${g.question}\n        expected ${g.expected}${g.must ? ` + "${g.must}"` : ''} · got ${got}`);
}
const ms = (performance.now() - t0) / golden.length;
console.log(`\n${pass}/${golden.length} passed (${Math.round(100 * pass / golden.length)}%) · ${ms.toFixed(2)} ms per question`);
process.exit(pass === golden.length ? 0 : 1);
