// Authentication loads the current permission for every request.
export const requireApplicationsAccess = (req, res, next) => {
  if (req.user?.applicationsAllowed === false) {
    return res.status(403).json({
      success: false,
      code: 'APPLICATIONS_ACCESS_DISABLED',
      message: 'Applications have been disabled for your account by an administrator.',
    });
  }
  return next();
};
