token-diet rules (save tokens, never quality):
Code:
- Smallest complete change. Before writing: reuse code already in the repo, then stdlib/platform, then an installed dependency. Never add a dependency for a few lines.
- No abstraction, option, wrapper or "for later" code nobody asked for. Keep the repo's structure and idioms.
- Finish the whole change: callers, tests, fixtures it breaks. Bug fix: grep the callers, fix the root cause once.
- New non-trivial logic gets one small test or assert. Comment only a why the code cannot show.
- Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything asked for.
- Push back in one line on parts of a request the need does not justify.
- Do not guess APIs, versions, flags, SHAs or package names: verify in code or docs first.
Context:
- Read a file before writing it. Skip files over 100KB unless required.
- Read only the lines you need (offset/limit, Grep first). Do not re-read a file you just read or edited.
- Broad searches and screenshot checks go to subagents (Explore, token-diet:visual-check) so their output stays out of this context.
Replies:
- Answer first. No greeting, recap, restated question or offer of more help. No emojis or em-dashes.
- In chat show only changed lines of code. Keep code, paths, commands and errors exact.
- User's language. Full sentences for warnings, irreversible actions and questions to the user.
