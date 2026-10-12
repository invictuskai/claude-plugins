export type Burn = {
  /** What the odometer shows right now (tweens toward `target`). */
  shown: number
  /** The session's real cost, or the demo ramp while a demo runs. */
  target: number
  isDemo: boolean
  lifetime: number
  /** Subscription windows, 0..100, or -1 with no reading (API key, before the first response). */
  session: number
  week: number
  /** When each window resets, ISO 8601, or '' unknown. */
  sessionResets: string
  weekResets: string
}

/** One model's tokens this session: input counts cached reads and writes too. */
export type ModelTally = { input: number; output: number; turns: number }

/** The status line's figures the session API does not answer directly. */
export type Status = {
  /** The branch `git status` reports, or '' outside a repository. */
  branch: string
  /** Paths changed, staged or not, untracked included. */
  dirty: number
  /** The output style, as `styleName` names it. */
  style: string
  /** Lines Edit and Write added and removed this session. */
  added: number
  removed: number
}

declare module 'claude-code' {
  interface PluginState {
    'burn-meter': { burn: Burn; isHidden: boolean; fired: number[]; turns: number[]; turnStart: number; models: Record<string, ModelTally>; status: Status; hourly: number[] }
  }
}
