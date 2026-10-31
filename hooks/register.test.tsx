import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'token-diet', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, rows: 20 } } as const
const seed = (ctx: number, hiddenAt = 0) => ($: any, e: any) =>
  ({ value: { value: e.key === 'ctx' ? ctx : hiddenAt, version: 1 } })

test('small context: no band', async ($, on) => {
  on('state.get', seed(20_000))
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'clear' })).toBeUndefined()
  await ui.unmount()
})

test('big context: Limpiar runs /clear and keeps the draft', async ($, on) => {
  const ran: string[] = []
  let filled = ''
  on('state.get', seed(150_000))
  on('state.set', () => ({ value: { isSet: true } }))
  on('prompt.read', () => ({ value: { text: 'medio escrito', cursor: 0 } }))
  on('command.run', (_, e) => { ran.push(e.command); return {} })
  on('prompt.fill', (_, e) => { filled = e.text; return { isFilled: true } })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /150K/ }))).toBeDefined()
  await ui.press({ key: 'clear' })
  expect(ran).toEqual(['clear'])
  expect(filled).toBe('medio escrito')
  await ui.unmount()
})

test('Limpiar y repetir resends the last typed prompt', async ($, on) => {
  const sent: string[] = []
  on('state.get', seed(150_000))
  on('state.set', () => ({ value: { isSet: true } }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('command.run', () => ({}))
  on('prompt.submit', (_, e) => { sent.push(e.text); return { text: e.text } })

  await $.prompt.submit({ text: 'haz el login nuevo', asUser: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'resend' })
  expect(sent.at(-1)).toBe('haz el login nuevo')
  await ui.unmount()
})

test('Seguir aqui hides until 50K more', async ($, on) => {
  on('state.get', seed(150_000, 120_000))
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'clear' })).toBeUndefined()
  await ui.unmount()
})
