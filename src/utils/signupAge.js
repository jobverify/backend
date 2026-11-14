export const MIN_SIGNUP_AGE = 18;
export const AGE_POLICY_VERSION = '2026-11-14';

export class SignupAgeError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'SignupAgeError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const indiaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function createAdultEligibility(dateOfBirth, now = new Date()) {
  if (dateOfBirth === undefined) {
    throw new SignupAgeError('Enter your date of birth on Create account to confirm you are 18 or older.', 428, 'AGE_ELIGIBILITY_REQUIRED');
  }
  const birth = typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
    ? new Date(`${dateOfBirth}T00:00:00.000Z`) : null;
  const today = indiaDate.format(now);
  if (!birth || !Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth
    || dateOfBirth < '0001-01-01' || dateOfBirth > today) {
    throw new SignupAgeError('Enter a valid date of birth.', 400, 'INVALID_BIRTH_DATE');
  }
  const [year, month, day] = today.split('-');
  const cutoff = `${Number(year) - MIN_SIGNUP_AGE}-${month}-${day}`;
  // A February 29 birthday reaches the threshold on March 1 in a non-leap year.
  if (dateOfBirth > cutoff) {
    throw new SignupAgeError('You must be 18 or older to create a Jobverify account.', 422, 'AGE_NOT_ELIGIBLE');
  }
  return { minimumAge: MIN_SIGNUP_AGE, policyVersion: AGE_POLICY_VERSION, checkedAt: new Date(now) };
}

export function resolveAdultEligibility(stored, dateOfBirth, now = new Date()) {
  const checkedAt = stored?.checkedAt ? new Date(stored.checkedAt) : null;
  if (stored?.minimumAge === MIN_SIGNUP_AGE && stored.policyVersion === AGE_POLICY_VERSION
    && checkedAt && Number.isFinite(checkedAt.getTime()) && checkedAt <= now) {
    return { minimumAge: MIN_SIGNUP_AGE, policyVersion: AGE_POLICY_VERSION, checkedAt };
  }
  return createAdultEligibility(dateOfBirth, now);
}

export function replySignupAgeError(res, error) {
  return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
}
