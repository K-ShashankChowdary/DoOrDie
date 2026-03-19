// wraps async route handlers so thrown errors are caught and forwarded to Express error handling
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => {
      if (typeof next === 'function') {
        next(err);
      } else {
        console.error("Critical: 'next' is not a function. Check route definitions.", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });
  };
};

export { asyncHandler };