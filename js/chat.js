import initSQLite from '../vendor/sqlite/index.mjs';
import { search, structuredAnswer, extractiveAnswer, REFUSAL } from './rag.js';

const launcher = document.querySelector('#chatbot-launcher');
const panel = document.querySelector('#chatbot-panel');
const closeButton = document.querySelector('#chatbot-close');
const messages = document.querySelector('#chatbot-messages');
const form = document.querySelector('#chatbot-form');
const input = document.querySelector('#chatbot-input');
const suggestions = document.querySelector('#chatbot-suggestions');
let databasePromise;
let busy = false;

function openChat() {
  panel.hidden = false;
  launcher.setAttribute('aria-expanded', 'true');
  input.focus();
  loadDatabase().catch(() => {});
}

function closeChat() {
  panel.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
  launcher.focus();
}

function sourceHref(hit) {
  if (/^(?:BAK|CUL)-\d{3}$/.test(hit.doc_id)) return `#course-${hit.doc_id}`;
  if (/^kb\/[a-z0-9/_-]+\.md(?:#[a-z0-9-]+)?$/i.test(hit.url || '')) return hit.url;
  return '#faq';
}

function addMessage(kind, text, hits = []) {
  const item = document.createElement('div');
  item.className = `chatbot-message chatbot-message-${kind}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  item.append(paragraph);

  if (hits.length) {
    const sources = document.createElement('div');
    sources.className = 'chatbot-sources';
    const label = document.createElement('span');
    label.textContent = 'Sources:';
    sources.append(label);
    const list = document.createElement('ol');
    hits.slice(0, 3).forEach(hit => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = sourceHref(hit);
      link.textContent = `${hit.title} — ${hit.section}`;
      if (link.getAttribute('href').startsWith('#course-')) {
        link.addEventListener('click', () => {
          document.querySelector('#course-search').value = '';
          document.querySelector('[data-category="All"]').click();
          closeChat();
        });
      }
      if (!link.hash || !link.href.startsWith(`${location.origin}${location.pathname}#`)) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
      item.append(link);
      list.append(item);
    });
    sources.append(list);
    item.append(sources);
  }
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

async function loadDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const [sqlite3, response] = await Promise.all([
        initSQLite(),
        fetch(new URL('../data/academy.db', import.meta.url))
      ]);
      if (!response.ok) throw new Error(`Database request failed: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
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
    const structured = structuredAnswer(db, trimmed);
    const hits = structured ? structured.hits : search(db, trimmed, 3);
    const answer = structured?.text || extractiveAnswer(hits) || REFUSAL;
    pending.remove();
    addMessage('assistant', answer, hits);
  } catch (error) {
    console.error('Course assistant error:', error);
    pending.remove();
    addMessage('assistant', 'I could not open the course guide right now. Please refresh the page or email enrol@cookbakeacademy.sg.');
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
