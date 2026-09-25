// Search logic shared by the browser assistant and scripts/eval.mjs.
const STOPWORDS = new Set(`a an and are as at be but by can could did do does for from had has have how i if in is it its me my of on or our please should so than that the their them there these they this to us was we what whats when where which who why will with would you your about any also get got just like know need want am cook bake academy singapore sg class classes course courses tell show give write now tomorrow good many`.split(' '));

const EXPANSIONS = [
  [/how long|duration|how many weeks/i, ['duration', 'weeks']],
  [/\bwhen\b|start|begin|intake|next class|date/i, ['intakes']],
  [/how much|cost|price|fee|expensive|afford/i, ['fee']],
  [/\bwhere\b|address|location|get there|mrt/i, ['address']],
  [/allerg|nut|gluten|dairy|vegan|vegetarian|halal/i, ['allergens', 'ingredients']],
  [/how old|years? old|age|teen|child/i, ['age']],
  [/how many people|class size|number of learners/i, ['class', 'size', 'learners']],
];

// These subjects are outside the academy guide even when a question also
// contains a generic word such as "price", "campus", or "cheapest".
const OFF_TOPIC = /\b(?:weather|forecast|hotels?|flights?|airfare|airlines?|restaurants?|laptops?|smartphones?|bitcoin|cryptocurrenc(?:y|ies)|stocks?|python|javascript|system prompt|hidden instructions|jokes?|home address)\b/i;

export function buildQuery(text) {
  const normalized = String(text ?? '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '');
  const words = (normalized.match(/[a-z0-9]+/g) || [])
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
  for (const [pattern, additions] of EXPANSIONS) {
    if (pattern.test(normalized)) words.push(...additions);
  }
  const terms = [...new Set(words)];
  return terms.length ? terms.map(term => `"${term}"`).join(' OR ') : null;
}

function rows(db, sql, bind = []) {
  const resultRows = [];
  db.exec({ sql, bind, rowMode: 'object', resultRows });
  return resultRows;
}

export function search(db, text, k = 3) {
  if (OFF_TOPIC.test(String(text ?? ''))) return [];
  const query = buildQuery(text);
  if (!query) return [];
  const limit = Math.max(1, Math.min(10, Number.parseInt(k, 10) || 3));
  return rows(db, `SELECT doc_id, title, section, body, url,
      bm25(chunks, 0, 6, 3, 1, 0) AS score
      FROM chunks WHERE chunks MATCH ? ORDER BY score LIMIT ?`, [query, limit]).map(hit => ({
    ...hit,
    source_path: hit.doc_id,
    doc_id: hit.doc_id.replace(/^brochures\/((?:BAK|CUL)-\d{3})\.md$/, '$1').replace(/\.md$/, '')
  }));
}

export function extractiveAnswer(hits) {
  if (!hits?.length) return null;
  const best = hits[0];
  return `${best.title} — ${best.section}\n${best.body.trim()}`;
}

// These comparisons need values from the structured course table, not keyword matches.
export function structuredAnswer(db, text) {
  const question = String(text ?? '').toLowerCase();
  if (OFF_TOPIC.test(question)) return null;
  const under = /(?:under|below|less than)\s*(?:s\s*)?\$?\s*(\d{2,5})/.exec(question);
  let order;
  if (/cheapest|lowest (?:fee|price)|least expensive|most affordable/.test(question)) order = 'fee ASC';
  else if (/most expensive|highest (?:fee|price)|priciest/.test(question)) order = 'fee DESC';
  if (!under && !order) return null;

  const category = /bak(?:e|ing|ery)/.test(question) ? 'Bakery'
    : /cook(?:ing)?\b|cuisine/.test(question) ? 'Cooking' : null;
  const filters = [];
  const bind = [];
  if (category) { filters.push('category = ?'); bind.push(category); }
  if (under) { filters.push('fee < ?'); bind.push(Number(under[1])); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const courses = rows(db, `SELECT code, title, fee, weeks FROM courses ${where} ORDER BY ${order || 'fee ASC'} LIMIT ${under ? 10 : 3}`, bind);
  if (!courses.length) return { text: REFUSAL, hits: [] };
  const hits = courses.map(course => ({
    doc_id: course.code, title: course.title, section: 'Schedule, fee and class size',
    body: `${course.title} (${course.code}) — S$${course.fee.toLocaleString('en-SG')}, ${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}`,
    url: `#course-${course.code}`
  }));
  const intro = under ? `Courses under S$${Number(under[1]).toLocaleString('en-SG')}:`
    : order === 'fee DESC' ? 'The most expensive courses are:' : 'The cheapest courses are:';
  return { text: `${intro}\n${hits.map(hit => hit.body).join('\n')}`, hits };
}

export const REFUSAL = "I can only answer questions about Cook & Bake's courses, schedules, fees, campuses and policies, and I could not find that in our guide. Please email enrol@cookbakeacademy.sg or call +65 6888 1234.";
