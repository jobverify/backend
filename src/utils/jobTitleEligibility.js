// HR must be a separate word so titles such as Chrome Engineer remain eligible.
const EXCLUDED_JOB_TITLE = /sales|manager|marketing|executive|\bhr\b/i;

export const isJobTitleExcludedFromPublishing = (title = '') => EXCLUDED_JOB_TITLE.test(title || '');

export const buildExcludedJobTitleFilter = () => ({ title: EXCLUDED_JOB_TITLE });
