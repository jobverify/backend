import { RESUME_PROCESSING_CONSENT_VERSION } from '../middleware/resumeProcessingConsent.js';

export function acceptedResumeProcessingConsent(consent, prefix = '') {
  if (consent?.accepted !== true || consent.version !== RESUME_PROCESSING_CONSENT_VERSION) {
    const error = new Error('Review and agree to AI resume processing before starting this request.');
    error.statusCode = 428;
    error.code = 'RESUME_PROCESSING_CONSENT_REQUIRED';
    throw error;
  }
  return { [`${prefix}processingConsentVersion`]: RESUME_PROCESSING_CONSENT_VERSION,
    [`${prefix}processingConsentAcceptedAt`]: new Date() };
}

export function resumeProcessingConsentFilter(prefix = '') {
  return { [`${prefix}processingConsentVersion`]: RESUME_PROCESSING_CONSENT_VERSION,
    [`${prefix}processingConsentAcceptedAt`]: { $type: 'date' } };
}
