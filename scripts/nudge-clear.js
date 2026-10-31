// UserPromptSubmit: after a long idle gap in a big session the prompt cache has expired, so the
// next call rewrites the whole context. Block once and suggest /clear; resending the same prompt passes.
// Task switches in active sessions are left to the band (hooks/register.tsx), which costs no tokens.
// Any failure exits 0 with no output, so the prompt goes through.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

const MIN_CTX = Number(process.env.TOKEN_DIET_NUDGE_CTX ?? 80000);
const IDLE_MIN = Number(process.env.TOKEN_DIET_NUDGE_IDLE_MIN ?? 60);
const TAIL = 4 * 1024 * 1024;

function lastUsage(file) {
  const size = fs.statSync(file).size, len = Math.min(size, TAIL), b = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, b, 0, len, size - len); } finally { fs.closeSync(fd); }
  const lines = b.toString('utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    let j; try { j = JSON.parse(lines[i]); } catch { continue; }
    const u = j.type === 'assistant' && !j.isSidechain && j.message && j.message.usage;
    if (u) return { ctx: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), at: Date.parse(j.timestamp) };
  }
  return null;
}

function main(raw, now = Date.now()) {
  const input = JSON.parse(raw);
  const prompt = String(input.prompt || '').trim();
  if (!input.transcript_path || !prompt || prompt.startsWith('/')) return '';
  const last = lastUsage(input.transcript_path);
  if (!last) return '';
  if (!MIN_CTX || last.ctx < MIN_CTX || !(now - last.at >= IDLE_MIN * 60000)) return '';

  const dir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'token-diet');
  fs.mkdirSync(dir, { recursive: true });
  const state = path.join(dir, `nudge-${String(input.session_id).replace(/[^\w-]/g, '')}.txt`);
  const hash = crypto.createHash('sha1').update(prompt).digest('hex');
  if (fs.existsSync(state) && fs.readFileSync(state, 'utf8') === hash) { fs.rmSync(state); return ''; }
  fs.writeFileSync(state, hash);
  const mins = Math.round((now - last.at) / 60000), k = Math.round(last.ctx / 1000);
  return JSON.stringify({
    decision: 'block',
    reason: `token-diet: ${mins} min parado con ${k}K de contexto. La cache caduco: seguir aqui reescribe los ${k}K.\n` +
      `Tarea nueva? Escribe:  /clear  y despues pega tu mensaje otra vez.\n` +
      `Misma tarea? Reenvia el mismo mensaje y pasara.`,
  });
}

module.exports = { main };
if (require.main === module) {
  let raw = '';
  process.stdin.on('data', d => raw += d).on('end', () => {
    let out = ''; try { out = main(raw); } catch { }
    if (out) process.stdout.write(out);
    process.exit(0);
  });
}
