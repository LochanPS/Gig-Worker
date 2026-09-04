// Typed API error. Serialized as {error:{code,message}} with an HTTP status.
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new ApiError(400, code, message);
  }
  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
    return new ApiError(401, code, message);
  }
  static forbidden(message = "Forbidden", code = "FORBIDDEN") {
    return new ApiError(403, code, message);
  }
  static notFound(message = "Not found", code = "NOT_FOUND") {
    return new ApiError(404, code, message);
  }
  static conflict(message: string, code = "CONFLICT") {
    return new ApiError(409, code, message);
  }
  static unprocessable(message: string, code = "UNPROCESSABLE") {
    return new ApiError(422, code, message);
  }
}
