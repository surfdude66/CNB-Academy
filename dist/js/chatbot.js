const launcher = document.querySelector('#chatbot-launcher');
const panel = document.querySelector('#chatbot-panel');
const closeButton = document.querySelector('#chatbot-close');
const messages = document.querySelector('#chatbot-messages');
const form = document.querySelector('#chatbot-form');
const input = document.querySelector('#chatbot-input');
const suggestions = document.querySelector('#chatbot-suggestions');
const money = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
let databasePromise;
let busy = false;

function openChat() {
  panel.hidden = false;
  launcher.setAttribute('aria-expanded', 'true');
  input.focus();
}

function closeChat() {
  panel.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
  launcher.focus();
}

function addMessage(kind, text, source) {
  const item = document.createElement('div');
  item.className = `chatbot-message chatbot-message-${kind}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  item.append(paragraph);
  if (source) {
    const link = document.createElement('a');
    link.href = new URL(source, document.baseURI).href;
    link.textContent = 'Read source ↗';
    link.target = '_blank';
    link.rel = 'noopener';
    item.append(link);
  }
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

async function loadDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const [{ default: initSQLite }, response] = await Promise.all([
        import('../vendor/sqlite/index.mjs'),
        fetch(new URL('../data/academy.db', import.meta.url))
      ]);
      if (!response.ok) throw new Error(`Database request failed: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const sqlite3 = await initSQLite();
      const db = new sqlite3.oo1.DB(':memory:', 'c');
      const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
      db.onclose = { after: () => sqlite3.wasm.dealloc(pointer) };
      try {
        db.checkRc(sqlite3.capi.sqlite3_deserialize(
          db.pointer, 'main', pointer, bytes.length, bytes.length,
          sqlite3.capi.SQLITE_DESERIALIZE_READONLY
        ));
        return db;
      } catch (error) {
        db.close();
        throw error;
      }
    })().catch(error => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

function rows(db, sql, bind = []) {
  const resultRows = [];
  db.exec({ sql, bind, rowMode: 'object', resultRows });
  return resultRows;
}

function normalize(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonical(word) {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function findCourse(db, question) {
  const all = rows(db, 'SELECT code, title, category, fee, campus, weeks, schedule, summary, allergens FROM courses');
  const normalized = normalize(question);
  const code = /\b(?:BAK-\d{3}|CUL-\d{3})\b/i.exec(question)?.[0].toUpperCase();
  if (code) return all.find(course => course.code === code);
  const exact = all.find(course => normalized.includes(normalize(course.title)));
  if (exact) return exact;
  const words = new Set(normalized.split(' ').filter(word => word.length > 3 && ![
    'course', 'class', 'classes', 'fee', 'price', 'cost', 'date', 'when', 'next',
    'intake', 'start', 'schedule', 'allergy', 'allergens', 'where', 'much', 'what'
  ].includes(word)).map(canonical));
  const scored = all.map(course => ({ course, score: normalize(course.title).split(' ')
    .filter(word => words.has(canonical(word))).length })).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 && scored[0].score > (scored[1]?.score || 0) ? scored[0].course : undefined;
}

function formatDate(date) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

function searchTerms(question) {
  const stop = new Set(['what', 'which', 'where', 'when', 'how', 'can', 'could', 'would',
    'should', 'does', 'have', 'has', 'are', 'the', 'there', 'this', 'that', 'with',
    'about', 'from', 'your', 'their', 'please', 'tell', 'show', 'more', 'course',
    'courses', 'class', 'classes', 'cook', 'bake', 'academy', 'for', 'and', 'you',
    'our', 'any', 'take', 'taking', 'want', 'is', 'in', 'on', 'at', 'to', 'of', 'do', 'i', 'a', 'an', 'me']);
  return [...new Set(normalize(question).split(' ').filter(word => word.length > 1 && !stop.has(word)))];
}

function plainText(markdown) {
  return markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '').replace(/^\s*[-*]\s+/gm, '• ').trim();
}

function answer(db, question) {
  const course = findCourse(db, question);
  const feeQuestion = /\b(fee|fees|price|cost|how much)\b/i.test(question);
  const dateQuestion = /\b(intake|intakes|start|starts|date|dates|schedule|when)\b/i.test(question);
  const allergyQuestion = /\b(allerg|allergen|nuts?|almonds?|peanuts?)\w*/i.test(question);

  if (course && feeQuestion) {
    return { text: `The full fee for ${course.title} (${course.code}) is ${money.format(course.fee)}.`,
      source: `kb/brochures/${course.code}.md#schedule-fee-and-class-size` };
  }
  if (course && dateQuestion) {
    const intakes = rows(db, 'SELECT intake_date FROM course_intakes WHERE course_code = ? ORDER BY intake_date', [course.code]);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const upcoming = intakes.filter(item => item.intake_date >= today);
    return { text: upcoming.length
      ? `${course.title} (${course.code}) has ${upcoming.length === 1 ? 'one listed upcoming intake' : 'listed upcoming intakes'}: ${upcoming.map(item => formatDate(item.intake_date)).join(' and ')}. Classes meet ${course.schedule}.`
      : `There are no upcoming intake dates listed for ${course.title} (${course.code}).`,
    source: `kb/brochures/${course.code}.md#schedule-fee-and-class-size` };
  }
  if (course && allergyQuestion) {
    return { text: `${course.title} (${course.code}) lists these allergens: ${course.allergens}. Tell the academy about any allergy before signing up.`,
      source: `kb/brochures/${course.code}.md#allergens-and-what-to-bring` };
  }
  if (course && /\b(where|location|campus)\b/i.test(question)) {
    return { text: `${course.title} (${course.code}) is taught at the ${course.campus} campus.`,
      source: `kb/brochures/${course.code}.md#where` };
  }
  if (course && /\b(tell|about|overview|describe)\b/i.test(question)) {
    return { text: `${course.title} (${course.code}): ${course.summary} The full fee is ${money.format(course.fee)}.`,
      source: `kb/brochures/${course.code}.md#overview` };
  }
  if (feeQuestion && !course) {
    return { text: 'Which course fee would you like? Ask with a course name or code, such as “Macaron Masterclass” or “BAK-104”.' };
  }

  const terms = searchTerms(question);
  if (!terms.length) return { text: 'Try asking about a course, fee, intake date, allergy, campus, or academy policy.' };
  const matches = rows(db, `SELECT title, section, body, url FROM chunks
    WHERE chunks MATCH ? ORDER BY bm25(chunks) LIMIT 1`, [terms.map(term => `"${term}"`).join(' AND ')]);
  if (!matches.length) return { text: 'I could not find that in the academy guide. Try a course name or a shorter question.' };
  const hit = matches[0];
  return { text: `${hit.title} · ${hit.section}\n${plainText(hit.body)}`, source: hit.url };
}

async function ask(question) {
  const trimmed = question.trim();
  if (!trimmed || busy) return;
  busy = true;
  input.value = '';
  input.disabled = true;
  form.querySelector('button').disabled = true;
  suggestions.hidden = true;
  addMessage('user', trimmed);
  const pending = addMessage('assistant', 'Looking that up…');
  try {
    const db = await loadDatabase();
    const response = answer(db, trimmed);
    pending.remove();
    addMessage('assistant', response.text, response.source);
  } catch (error) {
    console.error('Course assistant error:', error);
    pending.remove();
    addMessage('assistant', 'I could not open the course guide right now. Please refresh the page and try again.');
  } finally {
    busy = false;
    input.disabled = false;
    form.querySelector('button').disabled = false;
    input.focus();
  }
}

launcher.addEventListener('click', () => panel.hidden ? openChat() : closeChat());
closeButton.addEventListener('click', closeChat);
document.querySelector('[data-open-assistant]').addEventListener('click', openChat);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.hidden) closeChat();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  ask(input.value);
});
suggestions.addEventListener('click', event => {
  const button = event.target.closest('[data-chat-prompt]');
  if (button) ask(button.dataset.chatPrompt);
});
