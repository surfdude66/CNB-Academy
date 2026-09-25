import { spawnSync } from 'node:child_process';

const checks = [
  ['app.js syntax', process.execPath, ['--check', 'js/app.js']],
  ['chat.js syntax', process.execPath, ['--check', 'js/chat.js']],
  ['chatgpt.js syntax', process.execPath, ['--check', 'js/chatgpt.js']],
  ['rag.js syntax', process.execPath, ['--check', 'js/rag.js']],
  ['course assistant evaluation', process.execPath, ['scripts/eval.mjs']],
  ['ChatGPT request tests', process.execPath, ['scripts/test-chatgpt.mjs']],
  ['secret scan', 'python', ['scripts/check_secrets.py']],
  ['diff whitespace', 'git', ['diff', '--check']]
];

for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    console.error(`FAIL: ${name}`);
    if (result.stdout) console.error(result.stdout.trimEnd());
    if (result.stderr) console.error(result.stderr.trimEnd());
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
  console.log(`PASS: ${name}`);
}
