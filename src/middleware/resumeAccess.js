// Authentication loads the current permission for every request.
export const requireResumeAccess = (req, res, next) => {
  if (req.user?.resumeFeaturesAllowed === false) {
    return res.status(403).json({
      success: false,
      code: 'RESUME_ACCESS_DISABLED',
      message: 'Resume features have been disabled for your account by an administrator.',
    });
  }
  return next();
};
