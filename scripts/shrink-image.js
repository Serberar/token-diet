// PreToolUse(Read): swap large images for a downscaled copy. Image tokens scale with pixels,
// and every image stays in context (re-sent each turn) until the session ends.
// Any failure exits 0 with no output, so the original Read runs unchanged.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const MAX = Number(process.env.TOKEN_DIET_MAX_EDGE ?? 1280);
const EXT = /\.(png|jpe?g|bmp|gif)$/i;

function pngSize(file) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, b, 0, 24, 0); } finally { fs.closeSync(fd); }
  if (b.toString('latin1', 1, 4) !== 'PNG') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function main(raw) {
  const input = JSON.parse(raw);
  const ti = input.tool_input || {};
  const file = ti.file_path;
  // shortcut: System.Drawing is Windows-only; other OSes keep full-size images.
  if (process.platform !== 'win32' || !MAX || !file || !EXT.test(file) || /\.full\./i.test(file)) return;
  const st = fs.statSync(file);
  const dims = /\.png$/i.test(file) ? pngSize(file) : null;
  if (dims && Math.max(...dims) <= MAX) return;

  const dir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'token-diet');
  fs.mkdirSync(dir, { recursive: true });
  const key = crypto.createHash('sha1').update(`${path.resolve(file)}|${st.mtimeMs}|${st.size}|${MAX}`).digest('hex');
  const out = path.join(dir, `${key}.png`);
  let note;
  if (fs.existsSync(out)) note = 'cached';
  else {
    const res = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, 'resize.ps1'), '-In', file, '-Out', out, '-Max', String(MAX)],
      { encoding: 'utf8', timeout: 25000, windowsHide: true }).trim().split(/\s+/);
    if (res[0] !== 'OK') return;
    note = `${res[1]}x${res[2]} -> ${res[3]}x${res[4]}`;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { ...ti, file_path: out },
      additionalContext: `token-diet: image downscaled (${note}). Need full resolution? Copy it to a name containing ".full." and Read that.`,
    },
  }));
}

let raw = '';
process.stdin.on('data', d => raw += d).on('end', () => { try { main(raw); } catch { } process.exit(0); });
