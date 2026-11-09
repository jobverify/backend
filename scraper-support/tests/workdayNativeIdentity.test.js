import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runWorkdayScraper } from '../myworkday/engine.js'

// Identity fields observed on the first-party CXS endpoints on 2026-10-28.
// Board casing, blank requisitions and underscores are native API contracts.
const cases = [
  ['shell', 'shell.wd3', 'shellcareers', 'ShellCareers', 'Senior-Specialist---Market-Risk_R211581', 'R211581'],
  ['equifax', 'equifax.wd5', 'External', 'External', 'Software-Engineer---Career_J00170267', ''],
  ['elemica', 'elemica.wd501', 'Elemica_Careers', 'Elemica_Careers', 'Senior-Software-Engineer---Front-End--Angular-TypeScript-_', ''],
  ['redhat', 'redhat.wd5', 'jobs', 'Jobs', 'Senior-Technical-Account-Manager_R-059815', 'R-059815'],
  ['resmed', 'resmed.wd3', 'Resmed_External_Careers', 'ResMed_External_Careers', 'Market-Research---Intelligence-Manager---APAC_JR_054935', 'JR_054935'],
  ['visa', 'visa.wd5', 'Visa', 'Visa', 'Data-Scientist---Visa-Consulting---Analytics_REF081808W', ''],
  ['salesforce', 'salesforce.wd12', 'external_career_site', 'External_Career_Site', 'Software-Engineering-LMTS_JR338174', 'JR338174'],
  ['transunioncibil', 'transunion.wd5', 'transunion', 'TransUnion', 'AE-I_19042559', '19042559'],
  ['siliconlabsindia', 'silabs.wd1', 'SiliconlabsCareers', 'SiliconLabsCareers', 'Lead-Engineer---SW-Design---RAIL_20834-2', '20834'],
]

const replay = (t, row, mutate = () => {}) => {
  const [source, host, board, nativeBoard, posting, jobReqId] = row
  const baseUrl = `https://${host}.myworkdayjobs.com/en-US/${board}`
  const path = '/job/Bangalore-India/' + posting
  const info = {
    title: 'Engineer', jobReqId, jobPostingId: posting, jobPostingSiteId: nativeBoard,
    externalUrl: `https://${host}.myworkdayjobs.com/${nativeBoard}${path}`,
    location: 'Bangalore, India', country: { alpha2Code: 'IN' },
    jobDescription: '<p>Build reliable software for enterprise customers.</p>', startDate: '2026-10-21',
  }
  mutate(info)
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return Response.json({ total: 1, jobPostings: [{
      title: 'Engineer', externalPath: path, locationsText: 'Bangalore, India', postedOn: 'Posted 30+ Days Ago',
    }] })
    if (String(url).includes('/job/')) {
      assert.ok(String(url).includes('/wday/cxs/'), 'A verified native description must not fall back to HTML')
      return Response.json({ jobPostingInfo: info })
    }
    return new Response('<html>Workday careers</html>')
  })
  return runWorkdayScraper({ source, company: source, baseUrl,
    scraperDir: fileURLToPath(new URL('../myworkday', import.meta.url)),
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} }, retryBaseDelayMs: 0,
  })
}

for (const row of cases) {
  test(`${row[0]} native identity retains a verified description and publication date`, async t => {
    const [job] = await replay(t, row)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.postedAt.toISOString(), '2026-10-21T00:00:00.000Z')
    assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
    assert.match(job.sourceDescription, /Build reliable software/)
    if (row[5]) assert.equal(job.requisitionId, row[5])
  })
}

for (const [name, mutate] of [
  ['missing posting ID', info => { delete info.jobPostingId }],
  ['another posting ID', info => { info.jobPostingId = 'Other_J00170267' }],
  ['another board', info => { info.externalUrl = info.externalUrl.replace('/External/', '/Other/') }],
  ['changed role path case', info => { info.externalUrl = info.externalUrl.replace('/Software-', '/software-') }],
]) {
  test(`blank native requisitions reject ${name}`, async t => {
    await assert.rejects(replay(t, cases[1], mutate), { code: 'WORKDAY_NATIVE_ROLE_MISMATCH' })
  })
}

test('underscore requisitions still reject a different native requisition', async t => {
  await assert.rejects(replay(t, cases[4], info => { info.jobReqId = 'JR_054936' }), {
    code: 'WORKDAY_NATIVE_ROLE_MISMATCH',
  })
})
