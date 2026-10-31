// Token audit over ~/.claude/projects/**/*.jsonl. Usage: node audit.js [days]
const fs = require('fs'), path = require('path'), os = require('os');

const days = Number(process.argv[2]) || 0;
const since = days ? Date.now() - days * 864e5 : 0;
const root = path.join(os.homedir(), '.claude', 'projects');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.jsonl') && fs.statSync(p).mtimeMs >= since) files.push(p);
  }
})(root);

const tot = { in: 0, cw: 0, cr: 0, out: 0, calls: 0 };
const tools = {}, sessions = [];
let imageReads = 0;
for (const f of files) {
  const seen = new Set(), names = {};
  const s = { name: path.basename(path.dirname(f)).replace(/^[cC]--Users-[^-]+-?/, '') || '~', calls: 0, sum: 0, max: 0, cr: 0 };
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    let j; try { j = JSON.parse(line); } catch { continue; }
    const m = j.message;
    if (!m || !Array.isArray(m.content) && !m.usage) continue;
    if (j.type === 'assistant') {
      if (m.usage && !seen.has(m.id)) {
        seen.add(m.id);
        const u = m.usage, ctx = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        tot.in += u.input_tokens || 0; tot.cw += u.cache_creation_input_tokens || 0;
        tot.cr += u.cache_read_input_tokens || 0; tot.out += u.output_tokens || 0; tot.calls++;
        s.calls++; s.sum += ctx; s.max = Math.max(s.max, ctx); s.cr += u.cache_read_input_tokens || 0;
      }
      for (const c of m.content || []) if (c.type === 'tool_use') names[c.id] = c.name;
    } else if (j.type === 'user') {
      for (const c of m.content || []) {
        if (c.type !== 'tool_result') continue;
        const body = JSON.stringify(c.content || '');
        const isImg = /"type":"(image|document)"/.test(body);
        const key = (names[c.tool_use_id] || '?') + (isImg ? ' (image/pdf)' : '');
        if (isImg) imageReads++;
        // Text: ~4 chars/token. Images/PDFs: base64 size, not tokens; shown only to rank.
        tools[key] = (tools[key] || 0) + body.length;
      }
    }
  }
  if (s.calls) sessions.push(s);
}

const k = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
// Relative weights vs uncached input: cache write 1.25x, cache read 0.1x, output 5x.
const w = { 'lectura de cache': tot.cr * 0.1, 'escritura de cache': tot.cw * 1.25, salida: tot.out * 5, 'entrada sin cache': tot.in };
const W = Object.values(w).reduce((a, b) => a + b, 0) || 1;

console.log(`Sesiones ${sessions.length}, llamadas al modelo ${tot.calls}${days ? `, ultimos ${days} dias` : ''}`);
console.log(`Contexto medio por llamada ${k(Math.round((tot.in + tot.cw + tot.cr) / (tot.calls || 1)))}`);
console.log('\nReparto del coste (ponderado):');
for (const [n, v] of Object.entries(w).sort((a, b) => b[1] - a[1])) console.log(`  ${n.padEnd(19)} ${(100 * v / W).toFixed(1)}%`);
console.log('\nSesiones con mas lectura de cache (contexto reenviado en cada llamada):');
sessions.sort((a, b) => b.cr - a.cr).slice(0, 8).forEach(s =>
  console.log(`  ${s.name.slice(0, 40).padEnd(40)} llamadas ${String(s.calls).padStart(5)}  media ${k(Math.round(s.sum / s.calls)).padStart(5)}  max ${k(s.max).padStart(5)}`));
const T = Object.values(tools).reduce((a, b) => a + b, 0) || 1;
console.log(`\nResultados de herramientas por tamano (${imageReads} de imagen/pdf):`);
Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([n, v]) =>
  console.log(`  ${n.padEnd(22)} ${k(v).padStart(6)} caracteres  ${(100 * v / T).toFixed(1)}%`));
