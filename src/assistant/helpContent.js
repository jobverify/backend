// Approved product facts. Update these alongside the corresponding public flow.
// The model sees the topic index, never private profile/resume/account records.
export const HELP_CONTENT_VERSION = '2026-11-20';
const entry = (topic, label, reply, href) => ({ topic, label, reply, href });
const entries = [
  entry('sign-in', 'Signing in and registering', 'Use your Jobverify account to sign in. New accounts must verify their email before using member tools. Use the sign-in screen if your session has expired.', '/login'),
  entry('password-reset', 'Resetting a forgotten password', 'Choose Forgot password on the sign-in screen and enter your account email. Follow the reset link in the email, choose a new password, and sign in again. Check your spam folder if the email is missing.', '/forgot-password'),
  entry('email-verification', 'Verifying your account email', 'Open the verification link sent to your account email. To resend it, return to the registration screen showing Check your email and choose Resend verification email after its cooldown. Check your spam folder. Contact support if that pending registration is no longer available.', '/register'),
  entry('profile', 'Updating your profile and preferences', 'Open Profile to update your account details, education and job preferences. Save your changes there; a chat message does not change your profile.', '/profile'),
  entry('saved-jobs', 'Saving and finding bookmarked jobs', 'Use the bookmark on a job to save it, then open Saved jobs to find your bookmarks. Saving a job does not apply for it. A listing may become unavailable after the employer closes it.', '/saved-jobs'),
  entry('applications', 'Applying and tracking My applications', 'Open a job and follow its Apply link to the employer site. Complete the application there, then confirm that you applied in Jobverify. My applications tracks your confirmations and stages; opening an employer page alone does not confirm submission.', '/my-applications'),
  entry('resume-upload', 'Uploading, replacing and removing a resume', 'Open Profile and use Your resume to upload or replace a PDF, Word (.doc or .docx), or LaTeX (.tex) file up to 500 KiB. You can download or remove it there. Resume actions are separate from saving profile details.', '/profile'),
  entry('resume-generation', 'Preparing and tailoring a resume', 'Resume preparation and tailoring run as background tasks. Follow their progress in the resume or application flow and review the resulting document before using it. Generated content does not guarantee an interview or employment.', '/my-applications'),
  entry('alerts', 'Managing job and Telegram alerts', 'Open Alerts to manage job alert preferences and available Telegram settings. Delivery depends on your account access and linked Telegram account. Review the current controls there for availability.', '/alerts'),
  entry('billing', 'Premium plans, pricing and filter access', '', '/jobs?plans=1'),
  entry('verification', 'Checking whether a job is real or suspicious', '', '/report-content'),
  entry('report-content', 'Reporting suspicious listings, content or appeals', 'Use Report content to submit the exact listing link and explain the problem. The form also accepts removal requests and appeals. Avoid including passwords, identity documents or full resumes.', '/report-content'),
  entry('suggest-company', 'Suggesting a missing company or improvement', 'Open Contact and choose Send us a note to suggest a company or an improvement. Sign in before submitting a suggestion.', '/contact'),
  entry('contact', 'Contacting human support', 'Email jobverify.in@gmail.com with the relevant page link and a brief description of the issue. Use Report content for listing complaints or appeals. Do not include passwords or sensitive documents.', '/contact'),
  entry('job-sources', 'Job collection, accuracy and employer availability', 'Jobverify organizes listings collected from employer career pages. Employers control hiring and availability. Review the original employer page before applying; a listing on Jobverify is not a guarantee that a vacancy or recruiter is genuine.', '/about-us'),
  entry('privacy', 'Privacy and deleting account data', 'Use Profile to manage your resume and account controls. For privacy requests or deletion help, contact jobverify.in@gmail.com. The Privacy Policy explains processing and retention.', '/privacy-policy'),
];
export const HELP_TOPICS = Object.freeze(entries.map(({ topic, label }) => ({ topic, label })));
const content = new Map(entries.map(value => [value.topic, value]));

export function lookupHelp(topic, { siteSettings, verificationEnabled, user } = {}) {
  const item = content.get(topic);
  if (!item) return null;
  let { reply, href, label } = item;
  let actions = [];
  if (topic === 'billing') {
    const available = siteSettings?.billingEnabled === true;
    reply = available
      ? 'Premium filters follow your current account access. Open Plans to see current prices and available plans; prices and purchase options can change.'
      : 'Billing and paid Premium plans are currently disabled. The job board uses the current site access settings. You do not need to purchase a plan while billing is disabled.';
    href = available ? '/jobs?plans=1' : '/jobs';
    label = available ? 'Current plans' : 'Job board';
    actions = [{ label: available ? 'View plans' : 'Browse jobs', href }];
  }
  if (topic === 'verification') {
    reply = verificationEnabled
      ? 'Open Verify a job to check a public job URL and review the cited evidence. Checks use your account limits. A chat answer alone cannot establish whether a job is genuine.'
      : 'Job verification is not currently available. The assistant cannot determine whether a vacancy or recruiter is genuine. Review the employer source and report suspicious listings for review.';
    href = verificationEnabled ? '/verify-job' : '/report-content';
    label = verificationEnabled ? 'Verify a job' : 'Report content';
    actions = [{ label, href }];
  }
  if (topic.startsWith('resume-') && user?.resumeFeaturesAllowed === false) {
    reply = 'Resume tools are not currently available for your account. Contact support if you need help with access.';
    href = '/contact';
    label = 'Contact support';
  }
  return { reply, jobs: [], sources: [{ label, href }], actions };
}
