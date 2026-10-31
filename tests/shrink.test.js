// node tests/shrink.test.js  (Windows only)
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-diet-test-'));
const make = (name, w, h, fmt = 'Png') => {
  const p = path.join(dir, name);
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap ${w},${h}; $b.Save('${p}', [System.Drawing.Imaging.ImageFormat]::${fmt}); $b.Dispose()`]);
  return p;
};
const run = (file, cwd = dir) => execFileSync('node', [path.join(__dirname, '..', 'scripts', 'shrink-image.js')], {
  input: JSON.stringify({ tool_name: 'Read', cwd, tool_input: { file_path: file, limit: 5 } }),
  env: { ...process.env, CLAUDE_PLUGIN_DATA: path.join(dir, 'cache') }, encoding: 'utf8',
});

const big = make('big.png', 2560, 1440);
const out = JSON.parse(run(big)).hookSpecificOutput;
assert.strictEqual(out.permissionDecision, 'allow');
assert.strictEqual(out.updatedInput.limit, 5, 'other input fields kept');
assert.notStrictEqual(out.updatedInput.file_path, big);
assert.match(out.additionalContext, /2560x1440 -> 1280x720/);
assert.match(JSON.parse(run(big)).hookSpecificOutput.additionalContext, /copia en cache/);
assert.strictEqual(JSON.parse(run(big, path.join(dir, 'otro'))).hookSpecificOutput.permissionDecision, 'ask', 'outside the project: ask');

assert.strictEqual(run(make('small.png', 800, 600)), '', 'small image untouched');
assert.match(JSON.parse(run(make('big.jpg', 2000, 1000, 'Jpeg'))).hookSpecificOutput.additionalContext, /2000x1000 -> 1280x640/);
for (const [n, f] of [['small.jpg', 'Jpeg'], ['small.gif', 'Gif'], ['small.bmp', 'Bmp']]) {
  const p = make(n, 800, 600, f), t = Date.now();
  assert.strictEqual(run(p), '', `${n} untouched`);
  assert.ok(Date.now() - t < 300, `${n} sized without PowerShell`);
}
const anim = path.join(dir, 'anim.gif');
const gce = Buffer.from([0x21, 0xf9, 0x04, 0, 0, 0, 0, 0]);
fs.writeFileSync(anim, Buffer.concat([Buffer.from('GIF89a'), Buffer.from([0xd0, 0x07, 0xe8, 0x03, 0, 0, 0]), gce, gce, Buffer.from([0x3b])]));
assert.strictEqual(run(anim), '', 'animated GIF untouched');
assert.strictEqual(run(make('shot.full.png', 2560, 1440)), '', '.full. escape hatch');
assert.strictEqual(run(path.join(dir, 'missing.png')), '', 'missing file falls through');
assert.strictEqual(run(path.join(dir, 'notes.txt')), '', 'non-image untouched');

fs.rmSync(dir, { recursive: true, force: true });
console.log('shrink-image: all checks passed');
