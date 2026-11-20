import assert from 'node:assert/strict';
import { createAssistantService } from '../src/assistant/service.js';
import { ASSISTANT_MODEL } from '../src/assistant/contract.js';
import { lookupHelp } from '../src/assistant/helpContent.js';
import { readToolCall } from '../src/assistant/tools.js';
import { PremiumJobFiltersError } from '../src/services/jobSearchService.js';
import { buildJobSearchRequest } from '../src/services/jobSearchContract.js';

// Synthetic inputs only. No production database, member session or transcript.
// This is an explicit, bounded offline evaluation, never a serving fallback.
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for the live Workers AI evaluation.');
const endpoint = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId);
async function cloudflare(path, options = {}) {
  const response = await fetch(endpoint + path, {
    ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    signal: options.signal ?? AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error('Cloudflare request failed: HTTP ' + response.status + ', codes ' + (body.errors ?? []).map(item => item.code).join(','));
  return body.result;
}
const subscriptions = await cloudflare('/subscriptions');
assert.ok(!subscriptions.some(item => /workers|developer/i.test(JSON.stringify(item.rate_plan)) && Number(item.price ?? item.rate_plan?.price ?? 0) > 0),
  'Evaluation requires Workers Free; do not run on a paid Workers subscription.');

const fixtures = [
  { _id: '507f1f77bcf86cd799439011', title: 'Python Engineer', company: 'Example Corp', location: 'Bengaluru', jobType: 'Full-time Fresher', workArrangement: 'Remote' },
  { _id: '507f1f77bcf86cd799439012', title: 'Software Intern', company: 'Sample Labs', location: 'Hyderabad', jobType: 'Intern', workArrangement: 'Remote' },
  { _id: '507f1f77bcf86cd799439013', title: 'Graduate Engineer', company: 'Example Corp', location: 'Hyderabad', jobType: 'Full-time Fresher', workArrangement: 'On-site' },
];
const help = (id, message, topic) => ({ id, message, operation: { name: 'lookup_help', args: { topic } } });
const find = (id, message, args, ids, extra = {}) => ({ id, message, operation: { name: 'search_jobs', args }, ids, ...extra });
const cases = [
  help('password', 'I forgot my password. How do I reset it?', 'password-reset'),
  help('resume', 'Where can I upload or replace my resume, and what files are accepted?', 'resume-upload'),
  help('applications', 'Does clicking Apply submit my application? How do I track it?', 'applications'),
  help('alerts', 'How do I manage Telegram job alerts?', 'alerts'),
  help('billing', 'Can I buy Premium, and where are current prices?', 'billing'),
  help('contact', 'How can I contact human support?', 'contact'),
  help('verification', 'Is this recruiter and job genuine? https://example.com/vacancy', 'verification'),
  help('privacy', 'Where can I read the privacy policy or ask for deletion help?', 'privacy'),
  find('role-location', 'Find Python jobs in Bengaluru.', { query: 'Python', location: ['Bengaluru'] }, [fixtures[0]._id]),
  find('remote-intern', 'Show remote internships.', { jobType: ['Intern'], workArrangement: ['Remote'] }, [fixtures[1]._id]),
  find('fresher', 'Find Full-time Fresher jobs in Hyderabad.', { jobType: ['Full-time Fresher'], location: ['Hyderabad'] }, [fixtures[2]._id]),
  find('company', 'Find jobs where the company is "Example Corp".', { company: ['Example Corp'] }, [fixtures[0]._id, fixtures[2]._id]),
  find('follow-up', 'Only remote please.', { query: 'Python', location: ['Bengaluru'], workArrangement: ['Remote'] }, [fixtures[0]._id], {
    history: [{ role: 'user', content: 'Find Python jobs in Bengaluru.' }, { role: 'assistant', content: 'Here is 1 matching job. Python Engineer at Example Corp in Bengaluru.' }],
  }),
  find('premium', 'Find jobs where the company is "Example Corp".', { company: ['Example Corp'] }, [], { premiumDenied: true }),
  find('empty', 'Find Elixir jobs in Pune.', { query: 'Elixir', location: ['Pune'] }, []),
];
const settings = { billingEnabled: false, experiencedJobsEnabled: true };
function comparableOperation(operation) {
  if (operation?.name !== 'search_jobs') return operation;
  const request = buildJobSearchRequest(operation.args);
  return { name: operation.name, filters: request.filters, sort: request.sort };
}
let totalCalls = 0;
let inputTokens = 0;
let outputTokens = 0;
let passed = 0;
for (const item of cases) {
  let calls = 0;
  let operation;
  const service = createAssistantService({ enabled: () => true, verificationEnabled: () => false,
    model: async ({ messages, tools, maxTokens, signal }) => {
      calls++;
      totalCalls++;
      const output = await cloudflare('/ai/run/' + ASSISTANT_MODEL, {
        method: 'POST', signal, body: JSON.stringify({ messages, tools, max_tokens: maxTokens, temperature: 0, stream: false }),
      });
      inputTokens += output.usage?.prompt_tokens ?? 0;
      outputTokens += output.usage?.completion_tokens ?? 0;
      operation = readToolCall(output);
      return output;
    },
    search: async input => {
      assert.equal(input.limit, 5);
      if (item.premiumDenied) throw new PremiumJobFiltersError();
      return { data: fixtures.filter(job => {
        if (input.query && !job.title.toLowerCase().includes(input.query.toLowerCase())) return false;
        return ['company', 'location', 'jobType', 'workArrangement'].every(key => !input[key]?.length || input[key].includes(job[key]));
      }) };
    },
  });
  try {
    const result = await service.ask({ message: item.message, history: item.history ?? [] }, {
      siteSettings: { ...settings, billingEnabled: Boolean(item.premiumDenied) },
      user: { accessRole: item.premiumDenied ? 'free_user' : 'admin' },
    });
    assert.equal(calls, 1, 'Exactly one inference per turn');
    // Compare executed semantics: empty filters and an explicit default sort
    // are equivalent, while extra requested filters still fail the case.
    assert.deepEqual(comparableOperation(operation), comparableOperation(item.operation), 'Expected operation and filters');
    if (item.operation.name === 'lookup_help') {
      assert.deepEqual(result, lookupHelp(item.operation.args.topic, { siteSettings: settings, verificationEnabled: false }));
    } else if (item.premiumDenied) {
      assert.match(result.reply, /require Premium/);
      assert.deepEqual(result.actions, [{ label: 'View plans', href: '/jobs?plans=1' }]);
    } else {
      assert.deepEqual(result.jobs.map(job => job.id), item.ids);
      if (!item.ids.length) assert.match(result.reply, /No current jobs/);
    }
    for (const card of result.jobs) {
      const source = fixtures.find(job => job._id === card.id);
      assert.ok(source);
      assert.equal(card.title, source.title);
      assert.equal(card.company, source.company);
      assert.equal(card.href, '/jobs/' + source._id);
    }
    for (const link of [...result.sources, ...result.actions]) {
      assert.match(link.href, /^\/(?:jobs(?:\?plans=1)?|forgot-password|profile|my-applications|alerts|contact|report-content|privacy-policy)$/);
    }
    passed++;
    console.log('PASS ' + item.id);
  } catch (error) {
    console.error('FAIL ' + item.id + ': ' + error.message);
    console.error('Validated operation: ' + JSON.stringify(operation));
  }
}
console.log(JSON.stringify({ passed, total: cases.length, inferenceCalls: totalCalls, inputTokens, outputTokens, model: ASSISTANT_MODEL }));
if (passed !== cases.length) process.exitCode = 1;
