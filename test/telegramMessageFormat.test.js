import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const previousOrigin = process.env.FRONTEND_ORIGIN;
process.env.FRONTEND_ORIGIN = 'https://www.jobverify.in';
after(() => {
  if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
  else process.env.FRONTEND_ORIGIN = previousOrigin;
});
import { buildTelegramMessageBody, telegramJobLink } from '../src/services/jobAlertService.js';

test('Telegram links to the Jobverify job page even when employer links exist', () => {
  const job = { _id: '507f1f77bcf86cd799439011', title: 'Engineer', company: 'Example',
    jobUrl: 'https://employer.example/job', applicationUrl: 'https://employer.example/apply',
    applyUrl: 'https://employer.example/apply', sourceUrl: 'https://employer.example/source', link: 'https://employer.example/link' };
  const expected = 'https://www.jobverify.in/jobs/507f1f77bcf86cd799439011';
  assert.equal(telegramJobLink(job), expected);
  assert.equal(buildTelegramMessageBody([job], '{jobUrl}'), expected);
  assert.ok(buildTelegramMessageBody([job]).includes(expected));
  assert.doesNotMatch(buildTelegramMessageBody([job]), /employer\.example/);
  assert.equal(telegramJobLink({}), 'https://www.jobverify.in/jobs');
});

test('personal Telegram templates control the delivered message', () => {
  const job = { company: 'Example', title: 'Engineer', sourceUrl: 'https://example.com/job' };
  assert.equal(buildTelegramMessageBody([job], '{title} at {company}\n{jobUrl}'),
    'Engineer at Example\nhttps://www.jobverify.in/jobs');
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
    '⚙️ Type :- Full time', '📍 Location :- Bangalore', '', '👔 Job link', 'https://www.jobverify.in/jobs', '', footer,
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
