function apiError(code, message, status, details = []) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function errorResponse(error, correlationId) {
  return {
    code: error.code || 'SYSTEM_ERROR',
    message: error.message || 'Unexpected error',
    details: error.details || [],
    correlationId
  };
}

module.exports = {
  apiError,
  errorResponse
};
