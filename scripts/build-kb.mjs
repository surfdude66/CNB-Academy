import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kbDir = path.join(root, 'kb');
const output = path.join(root, 'data', 'academy.db');

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolute);
    return entry.isFile() && /\.md$/i.test(entry.name) ? [absolute] : [];
  }));
  return files.flat().sort();
}

function slug(heading) {
  return heading.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim().replace(/\s+/g, '-');
}

function chunksFromMarkdown(source, docId) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const title = lines.find((line) => /^# (?!#)\S/.test(line))?.replace(/^# /, '').trim();
  if (!title) throw new Error(`${docId}: expected a "# " document title`);

  const chunks = [];
  let section;
  let body = [];
  const flush = () => {
    if (section) {
      chunks.push({ docId, title, section, body: body.join('\n').trim(),
        url: `kb/${docId.split('/').map(encodeURIComponent).join('/')}#${slug(section)}` });
    }
  };
  for (const line of lines) {
    const heading = /^## (?!#)(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      section = heading[1].trim();
      body = [];
    } else if (section) {
      body.push(line);
    }
  }
  flush();
  if (chunks.length === 0) throw new Error(`${docId}: expected at least one "## " section`);
  return chunks;
}

const files = await markdownFiles(kbDir);
if (files.length === 0) throw new Error('kb/ must contain at least one Markdown file');
const courses = JSON.parse(await readFile(path.join(root, 'data', 'courses.json'), 'utf8'));
if (!Array.isArray(courses)) throw new Error('data/courses.json must be an array');

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.DB(':memory:', 'c');
try {
  db.exec(`
    CREATE VIRTUAL TABLE chunks USING fts5(
      doc_id UNINDEXED, title, section, body, url UNINDEXED,
      tokenize='porter unicode61'
    );
    CREATE TABLE courses (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      level TEXT NOT NULL,
      weeks INTEGER NOT NULL,
      fee INTEGER NOT NULL,
      campus TEXT NOT NULL,
      schedule TEXT NOT NULL,
      summary TEXT NOT NULL,
      allergens TEXT NOT NULL,
      bring TEXT NOT NULL,
      class_size INTEGER NOT NULL
    );
    CREATE TABLE course_intakes (
      course_code TEXT NOT NULL REFERENCES courses(code),
      intake_date TEXT NOT NULL,
      PRIMARY KEY (course_code, intake_date)
    );
    CREATE INDEX course_intakes_date ON course_intakes(intake_date);
  `);

  db.exec('BEGIN');
  try {
    for (const file of files) {
      const docId = path.relative(kbDir, file).split(path.sep).join('/');
      for (const chunk of chunksFromMarkdown(await readFile(file, 'utf8'), docId)) {
        db.exec({ sql: 'INSERT INTO chunks(doc_id,title,section,body,url) VALUES(?,?,?,?,?)',
          bind: [chunk.docId, chunk.title, chunk.section, chunk.body, chunk.url] });
      }
    }
    for (const course of courses) {
      db.exec({ sql: `INSERT INTO courses
        (code,title,category,level,weeks,fee,campus,schedule,summary,allergens,bring,class_size)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        bind: [course.code, course.title, course.cat, course.level, course.weeks,
          course.fee, course.campus, course.when, course.summary, course.allergens,
          course.bring, course.class_size] });
      for (const intake of course.intakes) {
        db.exec({ sql: 'INSERT INTO course_intakes(course_code,intake_date) VALUES(?,?)',
          bind: [course.code, intake] });
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const hits = [];
  for (const query of ['refunds', 'nut allergy macaron', 'Bukit Timah parking']) {
    const rows = [];
    db.exec({ sql: `SELECT title, section, url FROM chunks
      WHERE chunks MATCH ? ORDER BY bm25(chunks) LIMIT 1`,
      bind: [query], rowMode: 'object', resultRows: rows });
    if (!rows.length) throw new Error(`No knowledge-base hit for: ${query}`);
    hits.push({ query, ...rows[0] });
  }

  const bytes = sqlite3.capi.sqlite3_js_db_export(db);
  for (const destination of [output, path.join(root, 'dist', 'data', 'academy.db')]) {
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  for (const file of files) {
    const destination = path.join(root, 'dist', 'kb', path.relative(kbDir, file));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(file));
  }
  const sqliteDist = path.join(root, 'node_modules', '@sqlite.org', 'sqlite-wasm', 'dist');
  for (const filename of ['index.mjs', 'sqlite3.wasm']) {
    const content = await readFile(path.join(sqliteDist, filename));
    for (const directory of [path.join(root, 'vendor', 'sqlite'), path.join(root, 'dist', 'vendor', 'sqlite')]) {
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), content);
    }
  }
  console.log(`Built ${path.relative(root, output)}: ${files.length} Markdown files, ` +
    `${db.selectValue('SELECT count(*) FROM chunks')} chunks, ${courses.length} courses, ` +
    `${db.selectValue('SELECT count(*) FROM course_intakes')} intake dates`);
  for (const hit of hits) {
    console.log(`${hit.query} → ${hit.title} / ${hit.section} (${hit.url})`);
  }
} finally {
  db.close();
}
