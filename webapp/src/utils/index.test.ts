import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatTime, formatDate, delay, isValidEmail, validatePassword, generateId, storage } from './index'

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
    expect(cn('foo', false && 'bar')).toBe('foo')
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })

  it('handles Tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})

describe('formatTime', () => {
  it('formats milliseconds to MM:SS', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(1000)).toBe('00:01')
    expect(formatTime(60000)).toBe('01:00')
    expect(formatTime(125000)).toBe('02:05')
    expect(formatTime(600000)).toBe('10:00')
  })

  it('handles negative values', () => {
    expect(formatTime(-1000)).toBe('00:00')
  })
})

describe('isValidEmail', () => {
  it('validates correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('user+tag@example.org')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('password123').valid).toBe(true)
    expect(validatePassword('longenoughpassword').valid).toBe(true)
  })

  it('rejects short passwords', () => {
    const result = validatePassword('short')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('Password must be at least 6 characters')
  })
})

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
  })
})

describe('formatDate', () => {
  it('formats a valid ISO date string to a readable format', () => {
    const result = formatDate('2024-06-15T10:30:00.000Z')
    // The output is locale-dependent, but it must contain the year and day
    expect(result).toContain('2024')
    expect(result).toMatch(/15|Jun/)
  })

  it('returns a non-empty string for any valid date', () => {
    const result = formatDate('2000-01-01T00:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('delay', () => {
  it('resolves after the specified number of milliseconds', async () => {
    vi.useFakeTimers()
    const promise = delay(500)
    vi.advanceTimersByTime(500)
    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  it('does not resolve before the time has elapsed', async () => {
    vi.useFakeTimers()
    let resolved = false
    delay(1000).then(() => { resolved = true })
    vi.advanceTimersByTime(999)
    await Promise.resolve() // flush microtasks
    expect(resolved).toBe(false)
    vi.advanceTimersByTime(1)
    await Promise.resolve()
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })
})

describe('storage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  describe('set and get', () => {
    it('stores and retrieves a string value', () => {
      storage.set('key', 'hello')
      expect(storage.get<string>('key')).toBe('hello')
    })

    it('stores and retrieves an object value', () => {
      const user = { id: '1', username: 'alice' }
      storage.set('user', user)
      expect(storage.get<typeof user>('user')).toEqual(user)
    })

    it('returns null for a key that does not exist', () => {
      expect(storage.get('nonexistent')).toBeNull()
    })

    it('returns null when stored value is not valid JSON', () => {
      localStorage.setItem('bad', 'not-json{{{')
      expect(storage.get('bad')).toBeNull()
    })
  })

  describe('remove', () => {
    it('removes a stored value', () => {
      storage.set('key', 'value')
      storage.remove('key')
      expect(storage.get('key')).toBeNull()
    })

    it('does not throw when removing a key that does not exist', () => {
      expect(() => storage.remove('nonexistent')).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('set does not throw when localStorage.setItem fails', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => storage.set('key', 'value')).not.toThrow()
    })

    it('remove does not throw when localStorage.removeItem fails', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('SecurityError')
      })
      expect(() => storage.remove('key')).not.toThrow()
    })
  })
})
