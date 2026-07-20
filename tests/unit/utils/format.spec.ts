import { describe, expect, it } from 'vitest'
import { formatScore, formatDelta, formatTurnResult } from '~/utils/format'
import { FARKLE_PENALTY } from '~/constants/game'

describe('formatScore', () => {
  it('separates thousands', () => {
    expect(formatScore(12350)).toBe('12,350')
  })

  it('leaves small and negative numbers readable', () => {
    expect(formatScore(0)).toBe('0')
    expect(formatScore(350)).toBe('350')
    expect(formatScore(-1000)).toBe('-1,000')
  })
})

describe('formatDelta', () => {
  it('signs gains explicitly', () => {
    expect(formatDelta(400)).toBe('+400')
    expect(formatDelta(12000)).toBe('+12,000')
  })

  it('does not add a redundant sign to zero or losses', () => {
    expect(formatDelta(0)).toBe('0')
    expect(formatDelta(-1000)).toBe('-1,000')
  })
})

describe('formatTurnResult', () => {
  it('shows banked points as a gain', () => {
    expect(formatTurnResult({ farkled: false, penalty: 0, pointsBanked: 400 })).toBe('+400')
  })

  it('shows a bare farkle when no penalty applied', () => {
    expect(formatTurnResult({ farkled: true, penalty: 0, pointsBanked: 0 })).toBe('FARKLE')
  })

  it('shows the penalty on the third farkle', () => {
    expect(formatTurnResult({ farkled: true, penalty: FARKLE_PENALTY, pointsBanked: 0 }))
      .toBe('FARKLE (-1,000)')
  })

  it('ignores stray points on a farkled turn', () => {
    expect(formatTurnResult({ farkled: true, penalty: 0, pointsBanked: 999 })).toBe('FARKLE')
  })
})
