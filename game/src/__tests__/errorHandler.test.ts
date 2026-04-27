import { describe, it, expect, vi } from 'vitest'
import { jsonErrorHandler, globalErrorHandler } from '../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

describe('jsonErrorHandler', () => {
  it('returns 400 for SyntaxError with body', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { body: true })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    jsonErrorHandler(err, {} as Request, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid JSON' }))
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next for non-syntax errors', () => {
    const err = new Error('generic')
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    jsonErrorHandler(err, {} as Request, res, next)
    expect(next).toHaveBeenCalledWith(err)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('calls next for SyntaxError without body property', () => {
    const err = new SyntaxError('plain syntax error')
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    jsonErrorHandler(err, {} as Request, res, next)
    expect(next).toHaveBeenCalledWith(err)
  })
})

describe('globalErrorHandler', () => {
  it('returns 400 for QueryFailedError', () => {
    const err = { name: 'QueryFailedError', message: 'dup entry' }
    const res = makeRes()
    globalErrorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Database error' }))
  })

  it('returns 500 for unknown errors', () => {
    const err = { name: 'Error', message: 'something went wrong' }
    const res = makeRes()
    globalErrorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('uses err.status when provided', () => {
    const err = { name: 'CustomError', message: 'bad request', status: 422 }
    const res = makeRes()
    globalErrorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction)
    expect(res.status).toHaveBeenCalledWith(422)
  })

  it('includes stack trace in development', () => {
    const original = process.env.APP_ENV
    process.env.APP_ENV = 'development'
    const err = { name: 'Error', message: 'oops', stack: 'Error: oops\n  at ...' }
    const res = makeRes()
    globalErrorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ stack: err.stack }))
    process.env.APP_ENV = original
  })
})
