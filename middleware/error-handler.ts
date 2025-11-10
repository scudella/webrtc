import { StatusCodes } from 'http-status-codes';
import { Request, Response, NextFunction } from 'express';

interface AdditionalErrorProps {
  statusCode?: number;
  code?: number;
  errors?: Record<string, { message: string }>; // For Mongoose Validation
  keyValue?: Record<string, unknown>; // For MongoDB Duplicate Key
  value?: unknown; // For Mongoose CastError
}

type FallbackError = Error & AdditionalErrorProps;

const errorHandlerMiddleware = (
  err: unknown,
  _: Request,
  res: Response,
  __: NextFunction
) => {
  const typedErr = err as FallbackError;

  let customError = {
    // set default
    statusCode: typedErr.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: typedErr.message || 'Something went wrong try again later',
  };

  if (typedErr.name === 'ValidationError' && typedErr.errors) {
    customError.msg = Object.values(typedErr.errors)
      .map((item) => item.message)
      .join(',');
    customError.statusCode = 400;
    if (customError.msg.includes('the minimum allowed length')) {
      customError.msg = 'Password minimum length is 8';
    }
  }

  if (typedErr.code && typedErr.code === 11000 && typedErr.keyValue) {
    customError.msg = `Duplicate value entered for ${Object.keys(
      typedErr.keyValue
    )} field, please choose another value`;
    customError.statusCode = 400;
  }

  if (typedErr.name === 'CastError' && typedErr.value !== undefined) {
    customError.msg = `No item found with id : ${typedErr.value}`;
    customError.statusCode = 404;
  }

  return res.status(customError.statusCode).json({ msg: customError.msg });
};

export default errorHandlerMiddleware;
