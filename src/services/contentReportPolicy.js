export const REPORT_CATEGORIES = ['illegal_content', 'copyright', 'nonconsensual_intimate_imagery', 'child_safety', 'unsafe_ai', 'appeal', 'other'];
export const REPORT_STATUSES = ['received', 'reviewing', 'action_taken', 'rejected'];
export const contentReportError = message => Object.assign(new Error(message), { statusCode: 400 });
const fail = message => { throw contentReportError(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, label, max, required = false) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`${label} is missing or too long.`);
  const result = value.trim();
  if (required && !result) fail(`Provide ${label.toLowerCase()}.`);
  return result;
};
const keysOnly = (value, keys) => {
  if (!plain(value) || Object.keys(value).some(key => !keys.includes(key))) fail('The request contains unsupported fields.');
};

export function normalizeContentReport(body) {
  keysOnly(body, ['category', 'contentUrl', 'explanation', 'email', 'signature', 'authority', 'nonConsent', 'goodFaith', 'relatedReference']);
  if (!REPORT_CATEGORIES.includes(body.category)) fail('Choose a report category.');
  const category = body.category;
  const explanation = text(body.explanation, 'Explanation', 5000, true);
  const urgent = ['child_safety', 'nonconsensual_intimate_imagery'].includes(category);
  const email = text(body.email, 'Contact email', 254, !urgent);
  if (email && !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/u.test(email)) fail('Provide a valid contact email.');
  const location = text(body.contentUrl, 'Content URL', 2048, true);
  let url;
  try { url = new URL(location, 'https://www.jobverify.in'); } catch { fail('Provide a valid content URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !/^(?:https?:\/\/|\/(?!\/))/i.test(location)) fail('Provide an HTTP or HTTPS content link without a username or password.');
  if (body.goodFaith !== true) fail('Confirm that your report is accurate and made in good faith.');
  const signature = text(body.signature, 'Electronic signature', 200);
  const authority = text(body.authority, 'Relationship', 80);
  if (authority && !['depicted_person', 'authorized_representative'].includes(authority)) fail('Choose a valid relationship or leave it blank.');
  if (body.nonConsent !== undefined && typeof body.nonConsent !== 'boolean') fail('The non-consent declaration must be a checkbox value.');
  const relatedReference = text(body.relatedReference, 'Previous report reference', 80, category === 'appeal');
  if (relatedReference && !/^[a-f0-9-]{36}$/i.test(relatedReference)) fail('Provide the previous report reference.');
  return { category, contentUrl: url.href, explanation, email, signature, relatedReference,
    goodFaith: true, nonConsent: category === 'nonconsensual_intimate_imagery' && body.nonConsent === true,
    authority: category === 'nonconsensual_intimate_imagery' ? authority : '' };
}

export const reportDeadline = receivedAt => new Date(new Date(receivedAt).getTime() + 2 * 60 * 60 * 1000);

export function reportListQuery(query) {
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) fail('Invalid queue pagination.');
    return Number(value);
  };
  const status = query.status ?? 'open';
  if (typeof status !== 'string' || !['open', 'all', ...REPORT_STATUSES].includes(status)) fail('Invalid report status.');
  return { page: number(query.page, 1, 10000), limit: number(query.limit, 20, 50), status };
}

export function normalizeReportReview(body, category) {
  keysOnly(body, ['status', 'notes', 'expectedRevision', 'copiesChecked']);
  if (!['reviewing', 'action_taken', 'rejected'].includes(body.status)) fail('Choose a valid review status.');
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) fail('Reload the report before reviewing it.');
  const notes = text(body.notes, 'Review notes', 3000, true);
  if (category === 'nonconsensual_intimate_imagery' && body.status === 'action_taken' && body.copiesChecked !== true) fail('Confirm that known identical copies have been checked and removed.');
  return { status: body.status, notes, expectedRevision: body.expectedRevision, copiesChecked: body.copiesChecked === true };
}
