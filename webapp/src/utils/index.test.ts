import { describe, it, expect } from 'vitest'
import { cn, formatTime, isValidEmail, validatePassword, generateId } from './index'

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
    expect(result.message).toBe('Password must be at least 8 characters')
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
