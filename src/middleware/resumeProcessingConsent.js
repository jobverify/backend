// Keep this version aligned with the disclosure in the web client. Consent is
// required for each AI request, never inferred from upload, login, or cookies.
export const RESUME_PROCESSING_CONSENT_VERSION = '2026-11-14';

export function requireResumeProcessingConsent(req, res, next) {
  const consent = req.body?.processingConsent;
  if (consent?.accepted === true && consent.version === RESUME_PROCESSING_CONSENT_VERSION) return next();
  return res.status(428).json({
    success: false,
    code: 'RESUME_PROCESSING_CONSENT_REQUIRED',
    message: 'Review and agree to AI resume processing before starting this request.',
  });
}
