class AppError extends Error {
  constructor(message, status = 500, meta = {}) {
    super(message);
    this.status = status;
    this.meta = meta;
  }
}

const createError = (status, message, meta) => new AppError(message, status, meta);

module.exports = { AppError, createError };
