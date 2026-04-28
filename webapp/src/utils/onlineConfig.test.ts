import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadOnlineConfig, DEFAULT_ONLINE_CONFIG } from './onlineConfig'

// Storage key matches the one written by useGameConfigController:
// `yovi_config_${variant}_pvp-online`. Tests cover the default ('y') variant.
const KEY = 'yovi_config_y_pvp-online'

function store(value: object) {
  sessionStorage.setItem(KEY, JSON.stringify(value))
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

describe('loadOnlineConfig', () => {
  it('returns defaults stamped with the requested variant when sessionStorage is empty', () => {
    expect(loadOnlineConfig()).toEqual({ ...DEFAULT_ONLINE_CONFIG, variant: 'y' })
  })

  it('returns defaults stamped with the variant when stored JSON is invalid', () => {
    sessionStorage.setItem(KEY, 'not-json')
    expect(loadOnlineConfig()).toEqual({ ...DEFAULT_ONLINE_CONFIG, variant: 'y' })
  })

  it('reads variant-specific config — different variants are isolated', () => {
    sessionStorage.setItem(
      'yovi_config_why-not_pvp-online',
      JSON.stringify({ boardSizeInput: '7', timerInput: '5', timerEnabled: true }),
    )
    const cfg = loadOnlineConfig('why-not')
    expect(cfg.variant).toBe('why-not')
    expect(cfg.boardSize).toBe(7)
    // The y-variant queue stays on its own defaults
    expect(loadOnlineConfig('y').boardSize).toBe(11)
  })

  it('parses boardSize from boardSizeInput', () => {
    store({ boardSizeInput: '13', timerInput: '10', timerEnabled: true })
    expect(loadOnlineConfig().boardSize).toBe(13)
  })

  it('clamps boardSize to 11 when below minimum', () => {
    store({ boardSizeInput: '2' })
    expect(loadOnlineConfig().boardSize).toBe(11)
  })

  it('clamps boardSize to 11 when above maximum', () => {
    store({ boardSizeInput: '20' })
    expect(loadOnlineConfig().boardSize).toBe(11)
  })

  it('parses timerSeconds from timerInput in minutes', () => {
    store({ boardSizeInput: '11', timerInput: '5', timerEnabled: true })
    expect(loadOnlineConfig().timerSeconds).toBe(300)
  })

  it('clamps timerSeconds to 600 when timerMinutes is out of range', () => {
    store({ boardSizeInput: '11', timerInput: '999', timerEnabled: true })
    expect(loadOnlineConfig().timerSeconds).toBe(600)
  })

  it('sets timerSeconds to undefined when timerEnabled is false', () => {
    store({ boardSizeInput: '11', timerInput: '10', timerEnabled: false })
    const cfg = loadOnlineConfig()
    expect(cfg.timerEnabled).toBe(false)
    expect(cfg.timerSeconds).toBeUndefined()
  })

  it('preserves pieRule from storage', () => {
    store({ boardSizeInput: '11', timerInput: '10', timerEnabled: true, pieRule: true })
    expect(loadOnlineConfig().pieRule).toBe(true)
  })

  it('defaults pieRule to false when absent', () => {
    store({ boardSizeInput: '11', timerInput: '10', timerEnabled: true })
    expect(loadOnlineConfig().pieRule).toBe(false)
  })

  it('preserves playerColor from storage', () => {
    store({ boardSizeInput: '11', timerInput: '10', timerEnabled: true, playerColor: 'player2' })
    expect(loadOnlineConfig().playerColor).toBe('player2')
  })

  it('defaults playerColor to player1 when absent', () => {
    store({ boardSizeInput: '11', timerInput: '10', timerEnabled: true })
    expect(loadOnlineConfig().playerColor).toBe('player1')
  })

  it('defaults timerEnabled to true when absent', () => {
    store({ boardSizeInput: '11', timerInput: '10' })
    expect(loadOnlineConfig().timerEnabled).toBe(true)
  })
})
