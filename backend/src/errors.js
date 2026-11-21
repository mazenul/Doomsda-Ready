class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const validation = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
const notFound = (message) => new ApiError(404, 'NOT_FOUND', message);
const conflict = (code, message) => new ApiError(409, code, message);

module.exports = { ApiError, validation, notFound, conflict };
