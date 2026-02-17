import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { jsonErrorHandler, globalErrorHandler } from '../src/middleware/errorHandler';

describe('Error Handlers', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
        mockNext = vi.fn();
    });

    describe('jsonErrorHandler', () => {
        it('should handle JSON syntax errors', () => {
            const syntaxError = new SyntaxError('Unexpected token } in JSON');
            (syntaxError as any).body = '{"invalid": }';

            jsonErrorHandler(
                syntaxError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid JSON',
                message: 'The request body contains malformed JSON.',
                details: 'Unexpected token } in JSON'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should pass non-JSON errors to next middleware', () => {
            const otherError = new Error('Some other error');

            jsonErrorHandler(
                otherError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(otherError);
        });

        it('should pass SyntaxError without body to next middleware', () => {
            const syntaxError = new SyntaxError('Regular syntax error');

            jsonErrorHandler(
                syntaxError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(syntaxError);
        });
    });

    describe('globalErrorHandler', () => {
        const originalEnv = process.env.NODE_ENV;
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        beforeEach(() => {
            consoleErrorSpy.mockClear();
        });

        afterAll(() => {
            process.env.NODE_ENV = originalEnv;
            consoleErrorSpy.mockRestore();
        });

        it('should handle QueryFailedError', () => {
            const dbError = new Error('Duplicate entry');
            dbError.name = 'QueryFailedError';

            globalErrorHandler(
                dbError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Database error',
                message: 'Invalid data provided'
            });
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', dbError);
        });

        it('should handle errors with custom status', () => {
            const customError: any = new Error('Unauthorized');
            customError.status = 401;

            globalErrorHandler(
                customError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Error',
                    message: 'Unauthorized'
                })
            );
        });

        it('should use 500 status for errors without status', () => {
            const genericError = new Error('Something broke');

            globalErrorHandler(
                genericError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        it('should include stack trace in development mode', () => {
            process.env.NODE_ENV = 'development';
            const error = new Error('Dev error');

            globalErrorHandler(
                error,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    stack: expect.any(String)
                })
            );
        });

        it('should not include stack trace in production mode', () => {
            process.env.NODE_ENV = 'production';
            const error = new Error('Prod error');

            globalErrorHandler(
                error,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            const jsonCall = (mockRes.json as any).mock.calls[0][0];
            expect(jsonCall).not.toHaveProperty('stack');
        });

        it('should handle errors without name or message', () => {
            const unknownError = { status: 503 };

            globalErrorHandler(
                unknownError,
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Internal Server Error',
                    message: 'Something went wrong'
                })
            );
        });
    });
});
