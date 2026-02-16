import { Request, Response, NextFunction } from 'express';

export const jsonErrorHandler = (
  err: any,
  _: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'The request body contains malformed JSON.',
      details: err.message
    });
  }

  next(err);
};

export const globalErrorHandler = (
  err: any,
  _: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err.name === 'QueryFailedError') {
    return res.status(400).json({
      error: 'Database error',
      message: 'Invalid data provided'
    });
  }

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
