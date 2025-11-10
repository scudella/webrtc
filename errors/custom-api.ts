import { StatusCodes } from 'http-status-codes';

export class CustomAPIError extends Error {
  public statusCode: StatusCodes;
  constructor(
    message: string,
    statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR
  ) {
    super(message);

    // Restore prototype chain (required for extending Error in older JS/TS targets)
    Object.setPrototypeOf(this, CustomAPIError.prototype);

    this.statusCode = statusCode;
  }
}
