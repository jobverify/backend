import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTelegramMessageBody } from '../src/services/jobAlertService.js';

test('personal Telegram templates control the delivered message', () => {
  const job = { company: 'Example', title: 'Engineer', sourceUrl: 'https://example.com/job' };
  assert.equal(buildTelegramMessageBody([job], '{title} at {company}\n{jobUrl}'),
    'Engineer at Example\nhttps://example.com/job');
  assert.throws(() => buildTelegramMessageBody([job], '{unknown}\n{jobUrl}'), /Unsupported placeholder/);
});

const footer = [
  'Follow Jobverify 📈 channel for more jobs',
  'http://bit.ly/4aATqJE',
  'https://t.me/jobverifychannel',
  '',
  'Join Jobverify 📈 Group for discussion',
  'https://bit.ly/4kI5HAJ',
  'https://t.me/jobverifygroup',
].join('\n');

test('Telegram uses the requested hiring announcement format for one job only', () => {
  const job = { company: 'LSEG', title: 'Associate Software Engineer', eligibleBatches: [2026],
    jobType: 'Full-time Fresher', city: 'Bangalore', experienceYears: [0],
    sourceUrl: 'https://lseg.wd3.myworkdayjobs.com/Careers/job/IND-BLR-Divyasree-Technopolis/Associate-Software-Engineer_R0124079' };
  assert.equal(buildTelegramMessageBody([job, { title: 'Second job', company: 'Other' }]), [
    '📌 LSEG is hiring Associate Software Engineer', '', '🎓 Batch :- 2026',
    '⚙️ Type :- Full time', '📍 Location :- Bangalore', '', '👔 Job link', job.sourceUrl, '', footer,
  ].join('\n'));
});

test('Telegram does not invent batch or location details for missing fields', () => {
  const body = buildTelegramMessageBody([{ company: 'Example', title: 'Intern', jobType: 'Internship',
    eligibleBatches: [2027, 2026, 2026, null, 0], location: 'Pune', sourceUrl: 'https://example.com/job' }]);
  assert.ok(body.includes('🎓 Batch :- 2026, 2027'));
  assert.ok(body.includes('📍 Location :- Pune'));
  const missing = buildTelegramMessageBody([{}]);
  assert.equal(missing.includes('Batch :-'), false);
  assert.equal(missing.includes('Location :-'), false);
  assert.equal(missing.includes('Type :-'), false);
  assert.equal(buildTelegramMessageBody([]), '');
});

test('every alert ends with the exact promotional links and never includes posting information', () => {
  const body = buildTelegramMessageBody([{ title: 'Developer', company: 'Example',
    postedAt: new Date(), datePosted: 'Today', summary: 'Posted today. No experience required.',
    sourceUrl: 'https://example.com/job' }]);
  assert.ok(body.endsWith(footer));
  for (const url of ['http://bit.ly/4aATqJE', 'https://t.me/jobverifychannel',
    'https://bit.ly/4kI5HAJ', 'https://t.me/jobverifygroup']) assert.equal(body.split(url).length - 1, 1);
  assert.doesNotMatch(body, /posted|today|yesterday|No experience required/i);
});
