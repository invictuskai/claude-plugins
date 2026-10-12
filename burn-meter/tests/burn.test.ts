import { describe, expect, test } from 'claude-code/testing'

import { FIRE_ROWS, barText, blocks, bracket, burnt, clockTime, contextLine, crossed, elapsed, fireCells, folderName, gitLabel, heat, lifetimeDelta, lineCount, modelName, modelsLine, money, parseGitStatus, patchLines, pct, resetsIn, resetsShort, spark, styleName, tallyTurn, tokenCount, tokenTotals, tokensShort, tween, windows } from '../hooks/burn'

describe('burn math', () => {
  test('money formats cents and fractions of a cent', async () => {
    expect(money(0)).toBe('$0.00')
    expect(money(12.345)).toBe('$12.35')
    expect(money(0.0042)).toBe('$0.0042')
  })

  test('thresholds fire once each, in order', async () => {
    expect(crossed(0, 0.5, [])).toEqual([])
    expect(crossed(0.5, 1, [])).toEqual([1])
    expect(crossed(0.5, 12, [])).toEqual([1, 5, 10])
    expect(crossed(0.5, 12, [1, 5])).toEqual([10])
    expect(crossed(12, 11, [])).toEqual([])
  })

  test('the fuse burns bracket to bracket', async () => {
    expect(bracket(0.5)).toEqual({ low: 0, high: 1 })
    expect(bracket(7)).toEqual({ low: 5, high: 10 })
    expect(burnt(7.5)).toBe(0.5)
    expect(bracket(60).low).toBe(50)
    expect(bracket(60).high).toBeGreaterThan(60)
    expect(heat(0)).toBe(0)
    expect(heat(99)).toBe(1)
  })

  test('tween eases toward the target and lands exactly', async () => {
    let x = 0
    for (let i = 0; i < 400 && x !== 3; i++) x = tween(x, 3)
    expect(x).toBe(3)
  })

  test('lifetime counts only new spend', async () => {
    expect(lifetimeDelta(null, 's1', 2)).toBe(2)
    expect(lifetimeDelta({ sessionId: 's1', usd: 2 }, 's1', 2.5)).toBe(0.5)
    expect(lifetimeDelta({ sessionId: 's1', usd: 2 }, 's2', 1)).toBe(1)
    expect(lifetimeDelta({ sessionId: 's1', usd: 5 }, 's1', 1)).toBe(1)
  })

  test('fire cells are columns * rows * 3 words of base64', async () => {
    const cells = fireCells(20, 0.5, 0.3, 1.2)
    expect(cells.length).toBe(Math.ceil((20 * FIRE_ROWS * 12) / 3) * 4)
  })

  test('the bar grows with spend', async () => {
    expect(barText(10, heat(0))).toBe('█░░░░░░░░░')
    expect(barText(10, heat(99))).toBe('██████████')
    expect(heat(30)).toBeGreaterThan(heat(5))
  })

  test('subscription windows read out of rateLimits', async () => {
    const w = windows([
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-02T20:00:00Z' },
      { kind: 'seven_day', percentUsed: 41 },
    ])
    expect(w.session).toBe(23.5)
    expect(w.week).toBe(41)
    expect(windows([]).session).toBe(-1)
    expect(pct(-1)).toBe('--')
    expect(pct(23.5)).toBe('24%')
    const now = Date.parse('2026-10-02T17:46:00Z')
    expect(resetsIn('2026-10-02T20:00:00Z', now)).toBe('2小时14分后重置')
    expect(resetsIn('2026-10-05T21:46:00Z', now)).toBe('3天4小时后重置')
    expect(resetsIn('2026-10-02T17:50:00Z', now)).toBe('4分钟后重置')
    expect(resetsIn('2026-10-02T17:00:00Z', now)).toBe('即将重置')
    expect(resetsIn('', now)).toBe('')
  })

  test('model usage tallies per model, busiest first', async () => {
    const turn = (model: string, out: number) => ({
      model,
      input_tokens: 100,
      output_tokens: out,
      cache_read_input_tokens: 50_000,
      cache_creation_input_tokens: 900,
    })
    let m = tallyTurn({}, turn('claude-opus-5-5', 2000))
    m = tallyTurn(m, turn('claude-opus-5-5', 3000))
    m = tallyTurn(m, turn('claude-haiku-4-5-20251001', 500))
    expect(m['claude-opus-5-5']).toEqual({ input: 102_000, output: 5000, turns: 2 })
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelName('claude-opus-5-5[1m]')).toBe('Opus 5.5')
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelName('gpt-x')).toBe('gpt-x')
    expect(modelsLine(m)).toBe('Opus 5.5 输入 102k 输出 5k · Haiku 4.5 输入 51k 输出 500')
    expect(modelsLine(m, 3, 'claude-opus-5-5[1m]')).toBe('输入 102k 输出 5k · Haiku 4.5 输入 51k 输出 500')
    expect(modelsLine(m, 3, 'Opus 5.5')).toBe('输入 102k 输出 5k · Haiku 4.5 输入 51k 输出 500')
    expect(tokenCount(1_200_000)).toBe('1.2M')
  })

  test('the status line figures read the way the status line shows them', async () => {
    expect(tokensShort(86_400)).toBe('86.4k')
    expect(tokensShort(1_000_000)).toBe('1M')
    expect(tokensShort(200_000)).toBe('200k')
    expect(tokensShort(842)).toBe('842')
    expect(contextLine(86_400, 1_000_000)).toBe('8.6% · 86.4k / 1M')
    expect(contextLine(undefined, 200_000)).toBe('-- / 200k')
    expect(elapsed(19 * 60_000 + 32_000)).toBe('19分32秒')
    expect(elapsed(65 * 60_000)).toBe('1小时5分')
    expect(folderName('D:\\github\\claude-code-mods')).toBe('claude-code-mods')
    expect(folderName('/home/me/repo/')).toBe('repo')
    expect(styleName(undefined)).toBe('默认')
    expect(styleName('default')).toBe('默认')
    expect(styleName('Explanatory')).toBe('Explanatory')
  })

  test('git status names the branch and counts changed paths', async () => {
    const clean = '# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +0 -0\n'
    expect(parseGitStatus(clean)).toEqual({ branch: 'main', dirty: 0 })
    const dirty = clean + '1 .M N... 100644 100644 100644 a b hooks/burn.ts\n? notes.txt\n'
    expect(parseGitStatus(dirty)).toEqual({ branch: 'main', dirty: 2 })
    expect(parseGitStatus('# branch.oid abc\r\n# branch.head (detached)\r\n').branch).toBe('游离 HEAD')
    expect(gitLabel('main', 0)).toBe('main ✓')
    expect(gitLabel('main', 3)).toBe('main ●3')
    expect(gitLabel('', 0)).toBe('')
  })

  test('lines added and removed come from the structured patch', async () => {
    const patch = [
      { lines: [' keep', '-old one', '-old two', '+new one'] },
      { lines: ['+added', ' keep'] },
    ]
    expect(patchLines(patch)).toEqual({ added: 2, removed: 2 })
    expect(patchLines([])).toEqual({ added: 0, removed: 0 })
    expect(lineCount('a\nb\nc\n')).toBe(3)
    expect(lineCount('a\nb')).toBe(2)
    expect(lineCount('')).toBe(0)
  })

  test('the band draws compact meters, sparks and times', async () => {
    expect(blocks(0.086)).toBe('▰▱▱▱▱▱▱▱▱▱')
    expect(blocks(0.32)).toBe('▰▰▰▱▱▱▱▱▱▱')
    expect(blocks(0)).toBe('▱▱▱▱▱▱▱▱▱▱')
    expect(blocks(1.4)).toBe('▰▰▰▰▰▰▰▰▰▰')
    expect(spark([0.1, 0.2, 0.4, 0.7, 1])).toBe('▂▂▄▆█')
    expect(spark([])).toBe('')
    expect(spark([0, 0])).toBe('▁▁')
    expect(spark([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 8).length).toBe(8)
    expect(clockTime(19 * 60_000 + 32_000)).toBe('19:32')
    expect(clockTime(3_909_000)).toBe('1:05:09')
    const now = Date.parse('2026-10-02T17:46:00Z')
    expect(resetsShort('2026-10-02T20:00:00Z', now)).toBe('2h14m')
    expect(resetsShort('2026-10-05T21:46:00Z', now)).toBe('3d4h')
    expect(resetsShort('2026-10-02T17:00:00Z', now)).toBe('0m')
    expect(resetsShort('', now)).toBe('')
    const m = { a: { input: 1_000_000, output: 80_000, turns: 3 }, b: { input: 200_000, output: 4_000, turns: 1 } }
    expect(tokenTotals(m)).toEqual({ input: 1_200_000, output: 84_000 })
    expect(tokenCount(86_400)).toBe('86k')
  })
})
