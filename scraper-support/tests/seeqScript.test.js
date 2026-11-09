import { emptyNativeOptions } from './fixtures/workableSourceOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers: Join our Team | Seeq</title>
  </head>
  <body>
    <h1>Work with us. Help change manufacturing for the better.</h1>
    <p>We’re a group of talented professionals who are passionate about redefining how process manufacturing organizations do business.</p>
    <a href="https://apply.workable.com/seeq/">See Openings</a>
    <h2>Company culture you’ll want to be a part of.</h2>
    <h3>Some job openings we’re hoping to close.</h3>
    <a href="https://apply.workable.com/seeq/">See Openings</a>
  </body>
</html>
`

const WORKABLE_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Seeq - Current Openings</title>
    <link rel="canonical" href="https://apply.workable.com/seeq/" />
    <meta name="subdomain" content="seeq" />
  </head>
  <body>
    <script>
      window.careers = { account: "seeq" };
    </script>
  </body>
</html>
`

const CURRENT_NON_INDIA_JOBS_MARKDOWN = `# Seeq — All Open Positions

> Last updated: 2026-07-26

| Title | Department | Location | Type | Salary | Posted | Details |
|-------|-----------|----------|------|--------|--------|---------|
| Staff Software Engineer - Platform | Software Engineering | United States (Remote) | Full-time | USD 170,000–170,000 | 2026-06-25 | [View](https://apply.workable.com/seeq/jobs/view/FD4C7FD4F3.md) |
| Principal Customer Success Manager | Customer Success | United Kingdom (Remote) | Full-time | EUR 146,000–146,000 | 2026-04-13 | [View](https://apply.workable.com/seeq/jobs/view/DD468C75CA.md) |

Powered by [Workable](https://www.workable.com)
`

const FUTURE_INDIA_JOBS_MARKDOWN = `# Seeq — All Open Positions

> Last updated: 2026-07-26

| Title | Department | Location | Type | Salary | Posted | Details |
|-------|-----------|----------|------|--------|--------|---------|
| Solutions Engineer | Solutions Engineering | Bengaluru, Karnataka, India | Full-time | INR 3,000,000–3,000,000 | 2026-07-25 | [View](https://apply.workable.com/seeq/jobs/view/ABC123DEF4.md) |

Powered by [Workable](https://www.workable.com)
`

const LEGACY_INDIA_JOBS_MARKDOWN = `# Seeq - Current Openings

1 current opening

- [Solutions Engineer](https://apply.workable.com/seeq/j/LEGACY1234/) - Bengaluru, Karnataka, India

Powered by [Workable](https://www.workable.com)
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/seeq/script.js')
  } catch {
    assert.fail('Expected Seeq scraper module at ../../scraper/seeq/script.js')
  }
}

test('Seeq helper exports stay pinned to the verified careers handoff, Workable board, and India-filtered feed contract', async () => {
  const seeq = await loadScriptModule()

  assert.equal(seeq.SOURCE, 'seeq')
  assert.equal(seeq.COMPANY, 'Seeq')
  assert.equal(seeq.OFFICIAL_BRAND_NAME, 'Seeq')
  assert.equal(seeq.VERIFIED_ON, null)
  assert.equal(seeq.HOMEPAGE_URL, 'https://www.seeq.com/')
  assert.equal(seeq.CAREERS_URL, 'https://www.seeq.com/careers/')
  assert.equal(seeq.WORKABLE_BOARD_URL, 'https://apply.workable.com/seeq/')
  assert.equal(seeq.JOBS_FEED_URL, 'https://apply.workable.com/seeq/jobs.md')
  assert.equal(seeq.hasOfficialCareersPageSignal(CAREERS_PAGE_HTML), true)
  assert.equal(seeq.hasOfficialWorkableBoardSignal(WORKABLE_BOARD_HTML), true)
  assert.equal(seeq.hasOfficialJobsFeedSignal(CURRENT_NON_INDIA_JOBS_MARKDOWN), true)
  assert.deepEqual(seeq.extractJobsFromMarkdown(CURRENT_NON_INDIA_JOBS_MARKDOWN), [])
  assert.deepEqual(seeq.extractJobsFromMarkdown(FUTURE_INDIA_JOBS_MARKDOWN), [
    {
      title: 'Solutions Engineer',
      company: 'Seeq',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'ABC123DEF4',
      requisitionId: 'ABC123DEF4',
      sourceUrl: 'https://apply.workable.com/seeq/j/ABC123DEF4/',
      applyUrl: 'https://apply.workable.com/seeq/j/ABC123DEF4/apply',
      department: 'Solutions Engineering',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-25',
      closingDate: null,
      jobDescription: null,
    },
  ])
  assert.deepEqual(seeq.extractJobsFromMarkdown(LEGACY_INDIA_JOBS_MARKDOWN), [
    {
      title: 'Solutions Engineer',
      company: 'Seeq',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'LEGACY1234',
      requisitionId: 'LEGACY1234',
      sourceUrl: 'https://apply.workable.com/seeq/j/LEGACY1234/',
      applyUrl: 'https://apply.workable.com/seeq/j/LEGACY1234/apply',
      department: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})


test('Seeq registered original reader retains all24 pairs while company links await animation',async()=>{
 const seeq=await loadScriptModule(),{replay}=await import('../native-sources/publicWorkableSources/fixtureReplay.js'),r=replay()
 const jobs=await seeq.createSeeqScraper().run({...r.options,maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(r.audits[0].observations.length,24);assert.equal(r.audits[0].companyDeclaredHandoff,true)
 assert.equal(r.audits[0].employerBindingQualified,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Seeq native account errors hold qualification without losing original declarations',async()=>{
 const seeq=await loadScriptModule(),{replay,editJSON}=await import('../native-sources/publicWorkableSources/fixtureReplay.js')
 const r=replay((url,p)=>url==='https://apply.workable.com/api/v1/accounts/seeq'?editJSON(p,v=>v.uid='foreign'):p)
 assert.equal((await seeq.createSeeqScraper().run(r.options)).length,0)
 assert.equal(r.audits[0].observations.length,24);assert.ok(r.audits[0].issues.some(s=>s.includes('account identity changed')))
})
