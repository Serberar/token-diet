import { expect, test } from 'claude-code/testing'

test('band buttons draw on every surface', async ($, on) => {
  on('state.get', (_: any, e: any) => ({ value: { value: e.key === 'ctx' ? 150_000 : 0, version: 1 } }))
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'token-diet', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, rows: 20 }, surface })
    expect(await ui.find({ key: 'clear' })).toBeDefined()
    await ui.unmount()
  }
})
