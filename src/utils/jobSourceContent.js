/** Immutable employer content; classification chooses its display/source input separately. */
export const getSourceDescription = (job = {}) => job.sourceDescription !== undefined
  ? String(job.sourceDescription ?? '')
  : String(job.jobDescription || job.description || '');

// Share the same empty-content definition with Mongo queries. Markup, comments,
// scripts and spacing entities alone do not constitute an employer description.
const EMPTY_DESCRIPTION_TOKEN = String.raw`[\s\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u3000\ufeff]+|<!--[\s\S]*?-->|<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>|<(?!!--|(?:script|style)\b)[^>]*>|&(?:nbsp|ensp|emsp|thinsp|ZeroWidthSpace);|&#(?:0*(?:9|10|13|32|160|8203|8204|8205|65279));|&#x0*(?:9|a|d|20|a0|200b|200c|200d|feff);`;
// A lookahead/backreference makes each token atomic in JavaScript. Mongo PCRE's
// possessive repeat supplies the same behavior without recursive match frames.
// This keeps large whitespace/script/tag prefixes from causing backtracking or
// Mongo's matching-depth limit when real source text follows them.
const MISSING_DESCRIPTION_TOKEN = String.raw`${EMPTY_DESCRIPTION_TOKEN}|enter\s+(?:the\s+)?job\s+description\b[.!…]*`;
const EMPTY_DESCRIPTION = new RegExp(String.raw`^(?:(?=(${MISSING_DESCRIPTION_TOKEN}))\1)*$`, 'i');
// MongoDB PCRE accepts literal Unicode characters, not JavaScript \u escapes.
const MONGO_EMPTY_DESCRIPTION = String.raw`^(?:${MISSING_DESCRIPTION_TOKEN})*+$`.replace(/\\u([a-f\d]{4})/gi,
  (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

export const hasSourceDescription = (job = {}) => !EMPTY_DESCRIPTION.test(getSourceDescription(job));

export const buildMissingSourceDescriptionFilter = () => ({
  $expr: {
    $regexMatch: {
      input: { $convert: {
        input: { $cond: [
          { $ne: [{ $type: '$sourceDescription' }, 'missing'] },
          '$sourceDescription',
          { $cond: [
            { $ne: [{ $ifNull: ['$jobDescription', ''] }, ''] },
            '$jobDescription', { $ifNull: ['$description', ''] },
          ] },
        ] },
        to: 'string', onError: '', onNull: '',
      } },
      regex: MONGO_EMPTY_DESCRIPTION,
      options: 'i',
    },
  },
});

export const withSourceDescription = (job = {}) => {
  const description = getSourceDescription(job);
  const fields = typeof job.toObject === 'function' ? job.toObject() : job;
  return { ...fields, description, jobDescription: description };
};
