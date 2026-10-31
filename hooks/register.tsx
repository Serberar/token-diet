import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Show the band once the last call carried this much context; hiding it waits for STEP more.
// The band is UI only and costs no tokens, so it shows early.
const MIN_CTX = 50_000
const STEP = 50_000
// Compacting keeps the thread, so it is offered once the context is worth shrinking.
const COMPACT_CTX = 100_000
const KEEP = 'Conserva rutas de archivo, decisiones tomadas, errores encontrados y pasos pendientes.'
// Meter scale: the auto-compact window if set, else 200K.
const WINDOW = Number(globalThis.process?.env?.CLAUDE_CODE_AUTO_COMPACT_WINDOW) || 200_000
const BAR = 8

const ctx = atom({ plugin: 'token-diet', key: 'ctx' } as const, 0)
const hiddenAt = atom({ plugin: 'token-diet', key: 'hiddenUntil' } as const, 0)

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      const tokens = (await $.session.usage()).context.tokens ?? 0
      await update($, ctx, () => tokens)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const tokens = await read($, ctx)
    if (e.props.hasSurvey || e.props.isWorking || tokens < MIN_CTX || tokens < (await read($, hiddenAt)) + STEP) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const clear = async () => {
      const draft = (await $.prompt.read()).text
      await $.command.run({ command: 'clear' })
      await update($, ctx, () => 0)
      await update($, hiddenAt, () => 0)
      if (draft) await $.prompt.fill({ text: draft })
    }

    // Queued by the engine until the session is idle, so it never cuts a running turn.
    const compact = async () => {
      await $.command.run({ command: 'compact', args: KEEP })
      await update($, ctx, () => 0)
      await update($, hiddenAt, () => 0)
    }

    const fill = Math.min(1, tokens / WINDOW)
    const tone = fill >= 0.85 ? 'error' : fill >= 0.6 ? 'warning' : 'suggestion'
    const cells = Math.round(fill * BAR)

    return (
      <Box gap={1}>
        <Text color={tone}>{'▰'.repeat(cells)}<Text dimColor>{'▱'.repeat(BAR - cells)}</Text></Text>
        <Text color={tone} bold tabular>{Math.round(tokens / 1000)}K</Text>
        <Text dimColor>tarea nueva?</Text>
        <Button key="clear" label="limpiar" hotkey="1" plain dimColor onPress={clear} />
        {tokens >= COMPACT_CTX && <Button key="compact" label="compactar" hotkey="2" plain dimColor onPress={compact} />}
        <Button key="hide" label="ocultar" hotkey="3" plain dimColor role="dismiss" onPress={() => update($, hiddenAt, () => tokens)} />
      </Box>
    )
  })
}
