export const normalizePublicWorkArrangement = value => {
  const label = String(value ?? '').trim().toLowerCase();
  if (label === 'remote') return 'Remote';
  if (label === 'hybrid') return 'Hybrid';
  return 'On-site';
};

// Read legacy records consistently before filtering, counting, and pagination.
export const PUBLIC_WORK_ARRANGEMENT_EXPRESSION = { $let: {
  vars: { arrangement: { $toLower: { $trim: { input: { $convert: {
    input: '$workArrangement', to: 'string', onError: '', onNull: '',
  } } } } } },
  in: { $switch: { branches: [
    { case: { $eq: ['$$arrangement', 'remote'] }, then: 'Remote' },
    { case: { $eq: ['$$arrangement', 'hybrid'] }, then: 'Hybrid' },
  ], default: 'On-site' } },
} };
