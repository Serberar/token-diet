// node tests/nudge.test.js
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-diet-nudge-'));
process.env.CLAUDE_PLUGIN_DATA = dir;
const { main } = require('../scripts/nudge-clear.js');

const at = Date.parse('2026-10-31T10:00:00Z');
const transcript = (ctx, extra = '') => {
  const p = path.join(dir, `t${ctx}.jsonl`);
  fs.writeFileSync(p, JSON.stringify({ type: 'assistant', timestamp: new Date(at).toISOString(),
    message: { usage: { input_tokens: 5, cache_creation_input_tokens: 1000, cache_read_input_tokens: ctx } } }) + '\n' + extra);
  return p;
};
const call = (p, prompt, mins) => main(JSON.stringify({ session_id: 's1', transcript_path: p, prompt }), at + mins * 60000);

const big = transcript(200000);
const first = JSON.parse(call(big, 'arregla el login', 90));
assert.strictEqual(first.decision, 'block');
assert.match(first.reason, /90 min parado con 201K/);
assert.strictEqual(call(big, 'arregla el login', 91), '', 'same prompt resent passes');
assert.match(JSON.parse(call(big, 'otra cosa', 30)).hookSpecificOutput.additionalContext, /201K/, 'active big session: task-switch hint');
assert.strictEqual(call(transcript(90000), 'otra cosa', 30), '', 'active, below task threshold');
assert.strictEqual(call(transcript(20000), 'hola', 120), '', 'small context passes');
assert.strictEqual(call(big, '/clear', 120), '', 'slash commands pass');
const side = JSON.stringify({ type: 'assistant', isSidechain: true, timestamp: new Date(at + 7200000).toISOString(), message: { usage: { cache_read_input_tokens: 9 } } });
assert.strictEqual(JSON.parse(call(transcript(150000, side + '\n'), 'x', 90)).decision, 'block', 'subagent entries ignored');
assert.throws(() => call(path.join(dir, 'missing.jsonl'), 'x', 90), 'missing transcript throws; CLI wrapper swallows it');

fs.rmSync(dir, { recursive: true, force: true });
console.log('nudge-clear: all checks passed');
