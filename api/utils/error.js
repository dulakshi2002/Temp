// Simple helper to create an Error object with a statusCode and message.
// Use like: return next(errorHandler(404, "User not found"));
export const errorHandler = (statusCode, message) => {
  const error = new Error();
  error.statusCode = statusCode;
  error.message = message;
  return error;
};
