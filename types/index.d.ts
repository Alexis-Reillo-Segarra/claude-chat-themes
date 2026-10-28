export type ThemeId = string

declare module 'claude-code' {
  interface PluginState {
    'chat-themes': { theme: ThemeId }
  }
}
