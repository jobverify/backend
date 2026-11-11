const nativeArrangements = [
  { labels: ['remote'], value: 'Remote' },
  { labels: ['hybrid'], value: 'Hybrid' },
  { labels: ['on-site', 'on site', 'onsite'], value: 'On-site' },
];

// Opted-in native readers deliberately distinguish an unknown arrangement
// from legacy inference. Only their explicit canonical native field can win.
export const explicitNativeWorkArrangement = job => {
  const label = typeof job?.remoteStatus === 'string' ? job.remoteStatus.trim().toLowerCase() : '';
  return nativeArrangements.find(item => item.labels.includes(label))?.value ?? null;
};

export const normalizePublicWorkArrangement = (value, job) => {
  if (job?.sourceRemoteStatusUnresolved === true) return explicitNativeWorkArrangement(job);
  const label = String(value ?? '').trim().toLowerCase();
  if (label === 'remote') return 'Remote';
  if (label === 'hybrid') return 'Hybrid';
  return 'On-site';
};

// Read legacy records consistently before filtering, counting, and pagination.
const legacyExpression = { $let: {
  vars: { arrangement: { $toLower: { $trim: { input: { $convert: {
    input: '$workArrangement', to: 'string', onError: '', onNull: '',
  } } } } } },
  in: { $switch: { branches: [
    { case: { $eq: ['$$arrangement', 'remote'] }, then: 'Remote' },
    { case: { $eq: ['$$arrangement', 'hybrid'] }, then: 'Hybrid' },
  ], default: 'On-site' } },
} };

export const PUBLIC_WORK_ARRANGEMENT_EXPRESSION = { $cond: [
  { $eq: ['$sourceRemoteStatusUnresolved', true] },
  { $let: {
    vars: { native: { $toLower: { $trim: { input: { $convert: {
      input: '$remoteStatus', to: 'string', onError: '', onNull: '',
    } } } } } },
    in: { $switch: { branches: nativeArrangements.map(item => ({
      case: { $in: ['$$native', item.labels] }, then: item.value,
    })), default: null } },
  } },
  legacyExpression,
] };
