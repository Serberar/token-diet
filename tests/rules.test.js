// node tests/rules.test.js
const assert = require('assert');
const { main } = require('../scripts/rules.js');
const out = JSON.parse(main('SubagentStart')).hookSpecificOutput;
assert.strictEqual(out.hookEventName, 'SubagentStart');
assert.match(out.additionalContext, /Smallest complete change/);
assert.ok(out.additionalContext.length < 2500, 'rules stay compact');
console.log('rules: all checks passed');
