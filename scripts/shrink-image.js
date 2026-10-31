// PreToolUse(Read): swap large images for a downscaled copy. Image tokens scale with pixels,
// and every image stays in context (re-sent each turn) until the session ends.
// Any failure exits 0 with no output, so the original Read runs unchanged.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const MAX = Number(process.env.TOKEN_DIET_MAX_EDGE ?? 1280);
const EXT = /\.(png|jpe?g|bmp|gif)$/i;

// Pixel size from the header, so small images skip the PowerShell start-up (0.3-1 s).
// Returns null when unknown (PowerShell then decides), 'animated' for animated GIFs.
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('latin1', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('latin1', 0, 3) === 'GIF') {
    // A second graphic control extension means more than one frame; the PNG copy would keep only the first.
    const gce = Buffer.from([0x21, 0xf9, 0x04]);
    if (b.indexOf(gce, b.indexOf(gce) + 1) > 0) return 'animated';
    return [b.readUInt16LE(6), b.readUInt16LE(8)];
  }
  if (b.toString('latin1', 0, 2) === 'BM') return [b.readInt32LE(18), Math.abs(b.readInt32LE(22))];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

function main(raw) {
  const input = JSON.parse(raw);
  const ti = input.tool_input || {};
  const file = ti.file_path;
  // shortcut: System.Drawing is Windows-only; other OSes keep full-size images.
  if (process.platform !== 'win32' || !MAX || !file || !EXT.test(file) || /\.full\./i.test(file)) return;
  const st = fs.statSync(file);
  const dims = imageSize(file);
  if (dims === 'animated' || dims && Math.max(...dims) <= MAX) return;

  const dir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'token-diet');
  fs.mkdirSync(dir, { recursive: true });
  const key = crypto.createHash('sha1').update(`${path.resolve(file)}|${st.mtimeMs}|${st.size}|${MAX}`).digest('hex');
  const out = path.join(dir, `${key}.png`);
  let note;
  if (fs.existsSync(out)) note = 'copia en cache';
  else {
    const res = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, 'resize.ps1'), '-In', file, '-Out', out, '-Max', String(MAX)],
      { encoding: 'utf8', timeout: 25000, windowsHide: true }).trim().split(/\s+/);
    if (res[0] !== 'OK') return;
    note = `${res[1]}x${res[2]} -> ${res[3]}x${res[4]}`;
  }
  // The swapped path is in the temp/plugin dir, so normal Read rules would not match the original.
  // Auto-approve only images inside the project; anywhere else the user is asked.
  const rel = input.cwd && path.relative(path.resolve(input.cwd), path.resolve(file));
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: inside ? 'allow' : 'ask',
      permissionDecisionReason: `token-diet: imagen reducida (${note}). Original: ${file}`,
      updatedInput: { ...ti, file_path: out },
      additionalContext: `token-diet: imagen reducida (${note}). Para resolucion completa, copiala a un nombre con ".full." y lee esa.`,
    },
  }));
}

let raw = '';
process.stdin.on('data', d => raw += d).on('end', () => { try { main(raw); } catch { } process.exit(0); });
