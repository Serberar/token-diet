// node tests/shrink.test.js  (Windows only)
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-diet-test-'));
const make = (name, w, h) => {
  const p = path.join(dir, name);
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap ${w},${h}; $b.Save('${p}', [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()`]);
  return p;
};
const run = file => execFileSync('node', [path.join(__dirname, '..', 'scripts', 'shrink-image.js')], {
  input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: file, limit: 5 } }),
  env: { ...process.env, CLAUDE_PLUGIN_DATA: path.join(dir, 'cache') }, encoding: 'utf8',
});

const big = make('big.png', 2560, 1440);
const out = JSON.parse(run(big)).hookSpecificOutput;
assert.strictEqual(out.permissionDecision, 'allow');
assert.strictEqual(out.updatedInput.limit, 5, 'other input fields kept');
assert.notStrictEqual(out.updatedInput.file_path, big);
assert.match(out.additionalContext, /2560x1440 -> 1280x720/);
assert.match(JSON.parse(run(big)).hookSpecificOutput.additionalContext, /cached/);

assert.strictEqual(run(make('small.png', 800, 600)), '', 'small image untouched');
assert.strictEqual(run(make('shot.full.png', 2560, 1440)), '', '.full. escape hatch');
assert.strictEqual(run(path.join(dir, 'missing.png')), '', 'missing file falls through');
assert.strictEqual(run(path.join(dir, 'notes.txt')), '', 'non-image untouched');

fs.rmSync(dir, { recursive: true, force: true });
console.log('shrink-image: all checks passed');
