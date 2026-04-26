/**
 * i18n/translations.test.ts
 *
 * Verifica que:
 * 1. `es` tiene exactamente las mismas claves que `en` (ninguna falta, ninguna sobra).
 * 2. Ningún valor es cadena vacía.
 * 3. Las cadenas con interpolación `{{var}}` usan los mismos marcadores en ambos idiomas.
 * 4. Las constantes de metadatos son correctas.
 */

import { describe, it, expect } from 'vitest'
import en from '../i18n/en'
import es from '../i18n/es'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Aplana un objeto anidado a rutas con punto: { a: { b: 'x' } } → { 'a.b': 'x' } */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = String(value)
    }
  }
  return result
}

/** Extrae los marcadores {{...}} de una cadena */
function extractPlaceholders(str: string): string[] {
  return (str.match(/\{\{[^}]+\}\}/g) ?? []).sort()
}

const flatEn = flattenObject(en as unknown as Record<string, unknown>)
const flatEs = flattenObject(es as unknown as Record<string, unknown>)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Translation files — structural completeness', () => {
  it('es has all keys that en has', () => {
    const missingInEs = Object.keys(flatEn).filter((k) => !(k in flatEs))
    expect(missingInEs, `Missing keys in es: ${missingInEs.join(', ')}`).toHaveLength(0)
  })

  it('es has no extra keys that en does not have', () => {
    const extraInEs = Object.keys(flatEs).filter((k) => !(k in flatEn))
    expect(extraInEs, `Extra keys in es: ${extraInEs.join(', ')}`).toHaveLength(0)
  })

  it('en has no empty string values', () => {
    const empty = Object.entries(flatEn).filter(([, v]) => v.trim() === '')
    expect(empty.map(([k]) => k), 'Empty strings in en').toHaveLength(0)
  })

  it('es has no empty string values', () => {
    const empty = Object.entries(flatEs).filter(([, v]) => v.trim() === '')
    expect(empty.map(([k]) => k), 'Empty strings in es').toHaveLength(0)
  })
})

describe('Translation files — interpolation consistency', () => {
  it('every key with {{placeholders}} in en has the same placeholders in es', () => {
    const mismatches: string[] = []
    for (const [key, enVal] of Object.entries(flatEn)) {
      const enPlaceholders = extractPlaceholders(enVal)
      if (enPlaceholders.length === 0) continue
      const esPlaceholders = extractPlaceholders(flatEs[key] ?? '')
      if (JSON.stringify(enPlaceholders) !== JSON.stringify(esPlaceholders)) {
        mismatches.push(
          `${key}: en=${enPlaceholders.join(',')} es=${esPlaceholders.join(',')}`
        )
      }
    }
    expect(mismatches, `Placeholder mismatches:\n${mismatches.join('\n')}`).toHaveLength(0)
  })
})

describe('English translation values — spot checks', () => {
  it('app.name is YOVI', () => expect(en.app.name).toBe('YOVI'))
  it('app.loading contains YOVI', () => expect(en.app.loading).toContain('YOVI'))
  it('auth.signIn is "Sign In"', () => expect(en.auth.signIn).toBe('Sign In'))
  it('auth.emailRequired is non-empty', () => expect(en.auth.emailRequired.length).toBeGreaterThan(0))
  it('game.turn contains {{name}}', () => expect(en.game.turn).toContain('{{name}}'))
  it('game.moves contains {{count}}', () => expect(en.game.moves).toContain('{{count}}'))
  it('gameConfig.boardSizeError contains {{min}} and {{max}}', () => {
    expect(en.gameConfig.boardSizeError).toContain('{{min}}')
    expect(en.gameConfig.boardSizeError).toContain('{{max}}')
  })
  it('stats.pageOf contains {{page}} and {{total}}', () => {
    expect(en.stats.pageOf).toContain('{{page}}')
    expect(en.stats.pageOf).toContain('{{total}}')
  })
  it('overlay.winsLocal contains {{name}}', () => expect(en.overlay.winsLocal).toContain('{{name}}'))
  it('ranking.top5 contains {{mode}}', () => expect(en.ranking.top5).toContain('{{mode}}'))
  it('language.switchTo is "Español" (points to the other language)', () => {
    expect(en.language.switchTo).toBe('Español')
  })
})

describe('Spanish translation values — spot checks', () => {
  it('app.name is YOVI (brand name unchanged)', () => expect(es.app.name).toBe('YOVI'))
  it('auth.signIn is not the same as English', () => expect(es.auth.signIn).not.toBe(en.auth.signIn))
  it('game.turn contains {{name}}', () => expect(es.game.turn).toContain('{{name}}'))
  it('overlay.victory is not "VICTORY"', () => expect(es.overlay.victory).not.toBe('VICTORY'))
  it('language.switchTo is "English" (points to the other language)', () => {
    expect(es.language.switchTo).toBe('English')
  })
  it('common.back is "Volver"', () => expect(es.common.back).toBe('Volver'))
  it('gameModes bot difficulty keys are translated', () => {
    expect(es.gameConfig.botLevels.easy).not.toBe(en.gameConfig.botLevels.easy)
    expect(es.gameConfig.botLevels.medium).not.toBe(en.gameConfig.botLevels.medium)
    expect(es.gameConfig.botLevels.hard).not.toBe(en.gameConfig.botLevels.hard)
  })
})

describe('Translation files — no key is identical to its dot-path (sanity)', () => {
  // Ensures values are real strings and not accidentally left as key names
  it('en values are not equal to their key paths', () => {
    const suspicious = Object.entries(flatEn).filter(([k, v]) => k === v)
    expect(suspicious.map(([k]) => k)).toHaveLength(0)
  })
})