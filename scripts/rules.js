// SessionStart / SubagentStart: inject rules.md as context. One compact block replaces
// separate style plugins whose skills and per-prompt reminders were re-sent every call.
const fs = require('fs'), path = require('path');

function main(event) {
  const text = fs.readFileSync(path.join(__dirname, '..', 'rules.md'), 'utf8').trim();
  return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
}

module.exports = { main };
if (require.main === module) {
  let out = ''; try { out = main(process.argv[2] || 'SessionStart'); } catch { }
  if (out) process.stdout.write(out);
}
