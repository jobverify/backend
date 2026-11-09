import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../src/models/User.js';
import { deriveLegacyProfilePreferences, normalizeProfilePreferenceFilters } from '../src/utils/profilePreferenceFilters.js';

test('saving an explicit unknown public filter validates without adding an unsupported onboarding preference', () => {
  for (const [jobTypes, expectedPreferences] of [
    [['Unspecified'], []],
    [['Unspecified', 'Full-time Fresher'], ['Full-time Fresher']],
    [['Internship', 'Contract'], ['Intern', 'Contract']],
  ]) {
    const filters = normalizeProfilePreferenceFilters({ jobType: jobTypes, location: ['Bangalore'] });
    const legacy = deriveLegacyProfilePreferences(filters);
    const user = new User({ email: 'unknown-filter@example.test', password: 'validation-only-password',
      profile: { ...legacy, profilePreferenceFilters: filters } });
    assert.equal(user.validateSync(), undefined);
    assert.deepEqual([...user.profile.profilePreferenceFilters.jobType], jobTypes);
    assert.deepEqual([...user.profile.preferredJobTypes], expectedPreferences);
  }
});
