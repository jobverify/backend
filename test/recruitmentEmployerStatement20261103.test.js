import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const source = { source: 'statement-example', companyName: 'Example Worldwide', companyDomain: 'example.test',
  companyCareerPage: 'https://example.test/careers', requireNativeEmployerName: true, nativeEmployerNames: ['Example'],
  nativeEmployerStatement: { name: 'Example', prefix: 'Example is An Equal Opportunity Employer.' } }
const board = 'https://example.wd1.myworkdayjobs.com/External'
const path = '/job/Bengaluru/Engineer_R1'
const duties = '<p>Build and operate software services, investigate production failures, review API designs and collaborate with the engineering team to improve reliability and performance.</p>'
const statement = '<p><span><i>Example is An Equal Opportunity Employer. All qualified applicants will receive consideration for employment.</i></span></p>'
const run = (description = duties + statement, changes = {}, provider = source) => createVerifiedRecruitmentScraper(provider).run({
  now: () => '2026-11-03T12:00:00Z', fetchPage: async url => ({ status: 200, url, html: `<h1>Example Worldwide Careers</h1><a href="${board}">Jobs</a>` }),
  fetchJson: async url => url.endsWith('/jobs') ? { total: 1, jobPostings: [{ title: 'Software Engineer', externalPath: path, locationsText: 'Bengaluru, India' }] }
    : { hiringOrganization: changes.hiringOrganization || { name: '', url: '' }, jobPostingInfo: { jobReqId: 'R1', title: 'Software Engineer',
      externalUrl: board + path, country: { descriptor: 'India' }, jobDescription: description, ...changes.info } },
})

test('retains an explicit native role employer statement without inventing a structured legal employer', async () => {
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeHiringOrganization.name, 'Example')
  assert.equal(jobs[0].nativeSourceRecord.hiringOrganization.name, '')
  assert.equal(jobs[0].nativeEmployerBinding.legalEmployer, null)
  assert.equal(jobs[0].nativeEmployerBinding.method, 'explicit-native-role-employer-statement')
  assert.equal(jobs[0].nativeEmployerBinding.field, 'jobPostingInfo.jobDescription')
  assert.equal(jobs[0].sourceDescription, duties + statement)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [name, body] of [
  ['an inert statement', '<template>' + statement + '</template>'],
  ['a hidden statement', '<div hidden>' + statement + '</div>'],
  ['a quoted statement', '<blockquote>' + statement + '</blockquote>'],
  ['an inline quotation', '<p><q>Example is An Equal Opportunity Employer.</q></p>'],
  ['a code sample', '<pre>' + statement + '</pre>'],
  ['a comment', '<!-- ' + statement + ' -->'],
  ['a name without an employer declaration', '<p>About Example. Join our team.</p>'],
  ['another employer', statement.replaceAll('Example', 'Other Company')],
]) test('does not derive a native employer from ' + name, async () => {
  const jobs = await run(duties + body)
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-employer-mismatch'))
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('a provided conflicting structured employer overrides an unrelated boilerplate statement', async () => {
  assert.equal((await run(undefined, { hiringOrganization: { name: 'Other Company' } })).length, 0)
})

test('employer statements cannot invent a job country or complete description', async () => {
  assert.equal((await run(undefined, { info: { country: null } })).length, 0)
  assert.equal((await run('<p>Example is An Equal Opportunity Employer.</p>')).length, 0)
})

test('a statement contract cannot waive the configured exact employer scope', async () => {
  const jobs = await run(undefined, {}, { ...source, nativeEmployerNames: [] })
  assert.equal(jobs.length, 0)
})

test('a statement cannot overwrite malformed or partially identified structured employers', async () => {
  for (const hiringOrganization of [{ name: ['Other Company'] }, { name: 123 }, [{ name: 'Other Company' }],
    'Other Company', { name: '', url: 'https://other.test/' }, { name: '', legalName: 'Other Company' }]) {
    assert.equal((await run(undefined, { hiringOrganization })).length, 0)
  }
})
