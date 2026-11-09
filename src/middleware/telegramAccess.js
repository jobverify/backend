// protect loads the current database user on every request, so an existing
// session cannot bypass an administrator disabling Telegram access.
export const requireTelegramAccess = (req, res, next) => {
  if (req.user?.telegramAlertsAllowed === false) {
    return res.status(403).json({
      success: false,
      code: 'TELEGRAM_ACCESS_DISABLED',
      message: 'Telegram alerts have been disabled for your account by an administrator.',
    });
  }
  return next();
};
