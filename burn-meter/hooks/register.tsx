import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Burn, ModelTally, Status } from '../types'
import type { Hourly } from './burn'
import { addToHour, barText, blocks, clockTime, contextLine, crossed, elapsed, fireCells, folderName, gitLabel, heat, lifetimeDelta, lastHours, lineCount, modelName, modelsLine, money, parseGitStatus, patchLines, pct, resetsIn, resetsShort, HOURS, spark, styleName, tallyTurn, tokenCount, tokenTotals, tokensShort, tween, windows } from './burn'

const burn = atom({ plugin: 'burn-meter', key: 'burn' } as const, {
  shown: 0,
  target: 0,
  isDemo: false,
  lifetime: 0,
  session: -1,
  week: -1,
  sessionResets: '',
  weekResets: '',
} as Burn)
const isHidden = atom({ plugin: 'burn-meter', key: 'isHidden' } as const, false)
const fired = atom({ plugin: 'burn-meter', key: 'fired' } as const, [] as number[])
const models = atom({ plugin: 'burn-meter', key: 'models' } as const, {} as Record<string, ModelTally>)
const turns = atom({ plugin: 'burn-meter', key: 'turns' } as const, [] as number[])
const turnStart = atom({ plugin: 'burn-meter', key: 'turnStart' } as const, 0)
const status = atom({ plugin: 'burn-meter', key: 'status' } as const, {
  branch: '',
  dirty: 0,
  style: '默认',
  added: 0,
  removed: 0,
} as Status)
const hourly = atom({ plugin: 'burn-meter', key: 'hourly' } as const, [] as number[])

// Theme keys, so every color follows the person's theme (Ayu Dark here) as Claude Code's own text does.
const ACCENT = 'claude'
const TEXT = 'text'
const BAD = 'error'
const WARN = 'warning'
const GOOD = 'success'

const DEMO_MS = 20_000
const DEMO_TOP = 30.5
const DEMO_HOLD_MS = 6_000

let tweenTimer: { cancel: () => void } | null = null
let demoStartedAt = 0
let demoFired: number[] = []
let paneTimer: { cancel: () => void } | null = null
let paneSize = ''

const PANE = 'burn'
const PANE_FIRE_ROWS = 8
const TURNS_KEPT = 12
/** The pane's label column: four Chinese characters and a gap. */
const LABEL_COLUMNS = 10
/** The band's right-aligned column: tokens and session time, then the lifetime total. */
const RIGHT_COLUMNS = 22

/** Animates the pane's tall fire while the pane is mounted; stops once a blit is refused. */
const startPaneFire = ($: EngineInterface, columns: number) => {
  const size = `${columns}x${PANE_FIRE_ROWS}`
  if (paneTimer && paneSize === size) return
  paneTimer?.cancel()
  paneSize = size
  const timer = $.clock.every(70, () => {
    void Promise.all([read($, burn), $.clock.now()]).then(([b, now]) =>
      $.ui
        .blit({
          requestId: PANE,
          key: 'bigfire',
          cells: fireCells(columns, fill(b), fill(b), now / 1000, PANE_FIRE_ROWS),
        })
        .then(r => {
          if (r.deny && paneTimer === timer) {
            timer.cancel()
            paneTimer = null
          }
        }),
    )
  })
  paneTimer = timer
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: '燃烧计', focus: true })

type Reading = { sessionId: string; usd: number }

/** Folds a real cost reading into the lifetime total and the target. */
const readCost = async ($: EngineInterface) => {
  const usage = await $.session.usage()
  const usd = usage.cost?.usd ?? 0
  const sub = windows(usage.rateLimits)
  const sessionId = await $.session.id()
  const lastKey = `last:${sessionId}`
  const last = ((await $.store.get(lastKey)) ?? null) as Reading | null
  const delta = lifetimeDelta(last, sessionId, usd)
  const stored = Number((await $.store.get('lifetime')) ?? 0)
  const lifetime = stored + delta
  // Every session adds its new spend to the shared hours, so the sparkline counts them all.
  let hours = ((await $.store.get('hours')) ?? {}) as Hourly
  if (delta !== 0 || !last || last.sessionId !== sessionId) {
    await $.store.set('lifetime', lifetime)
    await $.store.set(lastKey, { sessionId, usd })
    if (delta > 0) {
      hours = addToHour(hours, delta, Date.now())
      await $.store.set('hours', hours)
    }
  }
  const recent = lastHours(hours, Date.now())
  if ((await read($, hourly)).join() !== recent.join()) await update($, hourly, () => recent)
  const now = await read($, burn)
  if (
    now.session !== sub.session ||
    now.week !== sub.week ||
    now.sessionResets !== sub.sessionResets ||
    now.weekResets !== sub.weekResets
  ) {
    await update($, burn, b => ({ ...b, ...sub }))
  }
  if (now.isDemo) {
    if (now.lifetime !== lifetime) await update($, burn, b => ({ ...b, lifetime }))
    return
  }
  if (now.target !== usd || now.lifetime !== lifetime) {
    await alarm($, now.target, usd, false)
    await update($, burn, b => ({ ...b, target: usd, lifetime }))
  }
  startTween($)
}

/** Toasts each threshold the spend just crossed, once per session (or per demo). */
const alarm = async ($: EngineInterface, from: number, to: number, isDemo: boolean) => {
  const already = isDemo ? demoFired : await read($, fired)
  const hits = crossed(from, to, already)
  if (hits.length === 0) return
  const top = hits[hits.length - 1]!
  $.ui.toast(`本次会话已烧掉 ${money(top)}`, { timeoutMs: 6000 })
  if (isDemo) demoFired = [...demoFired, ...hits]
  else await update($, fired, list => [...list, ...hits])
}

/** Eases the odometer toward its target, 20 frames a second, and stops once it lands. */
const startTween = ($: EngineInterface) => {
  if (tweenTimer) return
  const timer = $.clock.every(50, () => {
    void read($, burn).then(async b => {
      if (b.shown === b.target) {
        timer.cancel()
        if (tweenTimer === timer) tweenTimer = null
        return
      }
      await update($, burn, x => ({ ...x, shown: tween(x.shown, x.target) }))
    })
  })
  tweenTimer = timer
}

/** The bar's fill: the 5-hour window on a subscription, else the spend's heat. */
const fill = (b: Burn) => (b.isDemo || b.session < 0 ? heat(b.shown) : Math.max(0.02, Math.min(1, b.session / 100)))

/** Refreshes the branch, its changed paths and the output style; the tool hooks tally the lines. */
const readStatus = async ($: EngineInterface) => {
  const ran = await $.process
    .run(['git', '--no-optional-locks', 'status', '--porcelain=v2', '--branch'], { timeoutMs: 5000 })
    .catch(() => null)
  const git = ran && ran.exitCode === 0 ? parseGitStatus(ran.stdout) : { branch: '', dirty: 0 }
  const style = styleName((await $.settings.read()).outputStyle)
  const now = await read($, status)
  if (now.branch !== git.branch || now.dirty !== git.dirty || now.style !== style) {
    await update($, status, s => ({ ...s, ...git, style }))
  }
}

const tallyLines = async ($: EngineInterface, lines: { added: number; removed: number }) => {
  if (lines.added === 0 && lines.removed === 0) return
  await update($, status, s => ({ ...s, added: s.added + lines.added, removed: s.removed + lines.removed }))
}

/** The status line's figures, read fresh for each drawing. */
const readInfo = async ($: EngineInterface) => {
  const [model, cwd, usage, now, s] = await Promise.all([
    $.session.model(),
    $.session.cwd(),
    $.session.usage(),
    $.clock.now(),
    read($, status),
  ])
  const { tokens, window } = usage.context
  return {
    model: modelName(model),
    folder: folderName(cwd),
    git: gitLabel(s.branch, s.dirty),
    dirty: s.dirty,
    context: contextLine(tokens, window),
    contextTokens: tokens,
    contextWindow: window,
    contextPct: tokens === undefined || window <= 0 ? 0 : (tokens / window) * 100,
    duration: elapsed(now - usage.startedAt),
    clock: clockTime(now - usage.startedAt),
    added: s.added,
    removed: s.removed,
    style: s.style,
  }
}

type Info = Awaited<ReturnType<typeof readInfo>>

const contextColor = (info: Info) => (info.contextPct > 80 ? BAD : info.contextPct > 50 ? WARN : ACCENT)

/** A plan limit by how much is used: green, then amber past half, red past three quarters. */
const limitColor = (percent: number) => (percent > 75 ? BAD : percent > 50 ? WARN : GOOD)

const runDemo = async ($: EngineInterface) => {
  demoStartedAt = await $.clock.now()
  demoFired = []
  await update($, isHidden, () => false)
  await update($, burn, b => ({ ...b, shown: 0, target: 0, isDemo: true }))
  const ramp = $.clock.every(100, () => {
    void $.clock.now().then(async now => {
      const t = Math.min(1, (now - demoStartedAt) / DEMO_MS)
      // Slow start, steep finish: how a long agent session actually feels.
      const target = DEMO_TOP * t * t * (0.35 + 0.65 * t)
      const before = (await read($, burn)).target
      await alarm($, before, target, true)
      await update($, burn, b => ({ ...b, target }))
      startTween($)
      if (t >= 1) {
        ramp.cancel()
        $.clock.after(DEMO_HOLD_MS, () => {
          void update($, burn, b => ({ ...b, isDemo: false, shown: 0, target: 0 })).then(() => readCost($))
        })
      }
    })
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'burn',
      description: '燃烧计：/burn 打开面板；参数 [panel|show|hide|demo|lifetime]',
    })
    void readCost($).catch(() => undefined)
    void readStatus($).catch(() => undefined)
    $.clock.every(1000, () => void readCost($).catch(() => undefined))
    // Commits and edits made outside a turn still reach the branch label.
    $.clock.every(30_000, () => void readStatus($).catch(() => undefined))
    // The session clock in the status row ticks every second.
    $.clock.every(1000, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  // The line counters only watch: if one fails, `next` replays the tool's own result untouched.
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const done = await next(e)
    if (done.deny === undefined && !done.isError) {
      await tallyLines($, patchLines(done.result.structuredPatch)).catch(() => undefined)
    }
    return done
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const done = await next(e)
    if (done.deny === undefined && !done.isError) {
      const r = done.result
      // A new file has no previous content to diff: every line is added.
      const lines = r.type === 'create' && r.structuredPatch.length === 0 ? { added: lineCount(r.content), removed: 0 } : patchLines(r.structuredPatch)
      await tallyLines($, lines).catch(() => undefined)
    }
    return done
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const usd = (await $.session.usage()).cost?.usd ?? 0
    await update($, turnStart, () => usd)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const usage = done.usage
    if (usage) await update($, models, m => tallyTurn(m, usage))
    await readCost($).catch(() => undefined)
    void readStatus($).catch(() => undefined)
    const usd = (await $.session.usage()).cost?.usd ?? 0
    const spent = Math.max(0, usd - (await read($, turnStart)))
    await update($, turns, list => [...list, spent].slice(-TURNS_KEPT))
    await update($, turnStart, () => usd)
    return done
  })

  on('command.run', { command: 'burn' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'demo') {
      void openPane($)
      await runDemo($)
      return { text: '燃烧演示：20 秒内从 $0 涨到 $30。' }
    }
    if (arg === 'hide') {
      await update($, isHidden, () => true)
      return { text: '燃烧计已隐藏，输入 /burn show 重新显示。' }
    }
    const b = await read($, burn)
    if (arg === 'lifetime') {
      return { text: `累计花费：${money(b.lifetime)}。` }
    }
    await update($, isHidden, () => false)
    if (arg === '' || arg === 'panel') void openPane($)
    const used = modelsLine(await read($, models), 6)
    const info = await readInfo($)
    const limits = `5小时额度 ${pct(b.session)}，本周 ${pct(b.week)}`
    const session = [info.model, info.folder, info.git, `上下文 ${info.context}`, `用时 ${info.duration}`, `+${info.added} -${info.removed}`, `风格 ${info.style}`]
    return {
      text:
        `本次会话：${money(b.target)}。${limits}。累计：${money(b.lifetime)}。` +
        `\n${session.filter(Boolean).join(' · ')}` +
        (used ? `\n模型用量：${used}` : ''),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const [b, info, hours, used] = await Promise.all([read($, burn), readInfo($), read($, hourly), read($, models)])

    const { Box, Text } = $.ui.resolve(e)
    const now = Date.now()
    const level = fill(b)
    const color = level > 0.75 ? BAD : level > 0.45 ? WARN : ACCENT
    const isRolling = b.shown !== b.target
    const tokens = tokenTotals(used)
    const hasContext = info.contextTokens !== undefined
    const contextSize = `${hasContext ? tokenCount(info.contextTokens!) : '--'}/${tokensShort(info.contextWindow)}`
    const sessionReset = resetsShort(b.sessionResets, now)
    const weekReset = resetsShort(b.weekResets, now)
    // Fixed widths line the two meter rows up; a Chinese character takes two cells.
    const cell = (key: string, width: number, child: RenderChildren) => (
      <Box key={key} width={width}>
        {child}
      </Box>
    )
    const right = (key: string, child: RenderChildren) => (
      <Box key={key} width={RIGHT_COLUMNS} justifyContent="flex-end">
        {child}
      </Box>
    )

    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text>
          <Text color={ACCENT} bold>{info.model}</Text>
          <Text dimColor>{'  ·  '}</Text>
          <Text color={TEXT} bold>{info.folder}</Text>
          {info.git ? <Text dimColor>{'  ·  '}</Text> : null}
          {info.git ? <Text color={info.dirty > 0 ? WARN : GOOD}>{info.git}</Text> : null}
          <Text color={GOOD}>{` +${info.added}`}</Text>
          <Text color={BAD}>{` −${info.removed}`}</Text>
        </Text>
        <Box>
          {cell('label', 7, <Text dimColor>上下文</Text>)}
          {cell('bar', 12, <Text color={contextColor(info)}>{blocks(info.contextPct / 100)}</Text>)}
          {cell(
            'figure',
            14,
            <Text>
              <Text color={contextColor(info)} bold>{hasContext ? `${info.contextPct.toFixed(1)}%` : '--'}</Text>
              <Text color={TEXT}>{`  ${contextSize}`}</Text>
            </Text>,
          )}
          {cell(
            'spend',
            18,
            <Text>
              {/* Spend is the band's headline: amber at rest, the heat's color while it climbs. */}
              <Text color={isRolling ? color : WARN} bold>{`${b.isDemo ? '演示 ' : ''}${money(b.shown)}`}</Text>
              <Text color={WARN}>{` ${spark(hours, HOURS)}`}</Text>
            </Text>,
          )}
          {right(
            'tokens',
            <Text>
              <Text color={ACCENT}>↑</Text>
              <Text color={TEXT}>{`${tokenCount(tokens.input)} `}</Text>
              <Text color={GOOD}>↓</Text>
              <Text color={TEXT}>{`${tokenCount(tokens.output)}   `}</Text>
              <Text dimColor>{'⏱ '}</Text>
              <Text color={TEXT}>{info.clock}</Text>
            </Text>,
          )}
        </Box>
        <Box>
          {cell('label', 7, <Text dimColor>5小时</Text>)}
          {cell(
            'bar',
            12,
            b.session < 0 ? <Text dimColor>{blocks(0)}</Text> : <Text color={limitColor(b.session)}>{blocks(b.session / 100)}</Text>,
          )}
          {cell(
            'figure',
            14,
            <Text>
              {b.session < 0 ? <Text dimColor>--</Text> : <Text color={limitColor(b.session)} bold>{pct(b.session)}</Text>}
              <Text dimColor>{sessionReset ? `   ↻ ${sessionReset}` : ' '}</Text>
            </Text>,
          )}
          {cell(
            'week',
            18,
            <Text>
              <Text dimColor>{'本周 '}</Text>
              {b.week < 0 ? <Text dimColor>--</Text> : <Text color={limitColor(b.week)} bold>{pct(b.week)}</Text>}
              <Text dimColor>{weekReset ? `  ↻ ${weekReset}` : ' '}</Text>
            </Text>,
          )}
          {right(
            'lifetime',
            <Text>
              <Text dimColor>{'累计 '}</Text>
              <Text color={TEXT} bold>{money(b.lifetime)}</Text>
            </Text>,
          )}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const Raster = 'Raster' in elements ? elements.Raster : null
    const hasFire = Raster !== null && e.surface === 'terminal'
    const b = await read($, burn)
    const history = await read($, turns)
    const info = await readInfo($)
    const now = await $.clock.now()
    const cols = Math.max(40, e.props.bodyColumns || e.viewport?.columns || 80)
    const width = cols - 2
    const level = fill(b)
    const color = level > 0.75 ? BAD : level > 0.45 ? WARN : ACCENT
    const isRolling = b.shown !== b.target
    const meter = Math.max(10, Math.min(40, width - 30))
    const windowBar = (n: number) => (n < 0 ? '' : barText(meter, Math.max(0, Math.min(1, n / 100))))
    const top = Math.max(0.01, ...history)
    const turnBar = Math.max(8, Math.min(36, width - 22))
    // Labels are padded by display width: each Chinese character takes two columns.
    const row = (key: string, label: string, value: RenderChildren) => (
      <Box key={key}>
        <Box width={LABEL_COLUMNS}>
          <Text dimColor>{label}</Text>
        </Box>
        {value}
      </Box>
    )

    if (hasFire) startPaneFire($, width)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text color={color} bold>{b.isDemo ? '演示' : '本次会话花费'}</Text>
          <Text dimColor>{`累计 ${money(b.lifetime)}`}</Text>
        </Box>
        <Text color={isRolling ? color : TEXT} bold>{money(b.shown)}</Text>
        <Box marginY={1}>
          {hasFire ? (
            <Raster key="bigfire" columns={width} rows={PANE_FIRE_ROWS} cells={fireCells(width, level, level, now / 1000, PANE_FIRE_ROWS)} />
          ) : (
            <Text color={color}>{barText(width, level)}</Text>
          )}
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={TEXT}>会话</Text>
          {row('model', '模型', <Text color={ACCENT} bold>{info.model}</Text>)}
          {row('folder', '目录', <Text>{info.folder}</Text>)}
          {info.git &&
            row(
              'git',
              '分支',
              <Text color={info.dirty > 0 ? WARN : GOOD}>
                {info.dirty > 0 ? `${info.git}  ${info.dirty} 个文件有改动` : `${info.git}  没有改动`}
              </Text>,
            )}
          {row(
            'context',
            '上下文',
            <Text>
              <Text color={contextColor(info)}>{barText(meter, Math.max(0, Math.min(1, info.contextPct / 100)))}</Text>
              <Text>{` ${info.context}`}</Text>
            </Text>,
          )}
          {row('time', '用时', <Text>{info.duration}</Text>)}
          {row(
            'lines',
            '代码行',
            <Text>
              <Text color={GOOD}>{`+${info.added}`}</Text>
              <Text>{' '}</Text>
              <Text color={BAD}>{`-${info.removed}`}</Text>
            </Text>,
          )}
          {row('style', '输出风格', <Text>{info.style}</Text>)}
        </Box>

        {(b.session >= 0 || b.week >= 0) && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={TEXT}>额度</Text>
            {b.session >= 0 &&
              row(
                'five-hour',
                '5 小时',
                <Text>
                  <Text color={limitColor(b.session)}>{windowBar(b.session)}</Text>
                  <Text>{` ${pct(b.session)} `}</Text>
                  <Text dimColor>{resetsIn(b.sessionResets, Date.now())}</Text>
                </Text>,
              )}
            {b.week >= 0 &&
              row(
                'week',
                '每周',
                <Text>
                  <Text color={limitColor(b.week)}>{windowBar(b.week)}</Text>
                  <Text>{` ${pct(b.week)} `}</Text>
                  <Text dimColor>{resetsIn(b.weekResets, Date.now())}</Text>
                </Text>,
              )}
          </Box>
        )}

        <Box flexDirection="column">
          <Text bold color={TEXT}>每轮花费</Text>
          {history.length === 0 && <Text dimColor>还没有完成的回合。</Text>}
          {history.map((usd, i) => (
            <Text key={`turn-${i}`}>
              <Text dimColor>{`#${String(i + 1).padStart(2, ' ')}  `}</Text>
              <Text color={usd === top && history.length > 1 ? WARN : ACCENT}>{barText(turnBar, usd / top)}</Text>
              <Text>{` ${money(usd)}`}</Text>
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
