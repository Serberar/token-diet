declare module 'claude-code' {
  interface PluginState {
    'token-diet': { ctx: number; hiddenUntil: number }
  }
}
