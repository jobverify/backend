import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../../scraper-support/runner.js'
import { decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
    <link rel="stylesheet" href="/assets/css/styles_v2.css">
  </head>
  <body>
    <div id="root"></div>
    <script src="/main-ABCD1234.js"></script>
  </body>
</html>
`

const LIVE_API_TEXT = JSON.stringify({
  totalRecords: 2,
  response: [
    {
      organizationUnitComplete: 'PeopleStrong>Technology>PG1>Technology>Testing>Payroll Engine',
      jobPostedDate: '2026-07-06',
      locationHierarchyComplete: 'India>North Region>Haryana>Gurgaon>Gurgaon Infocity',
      jobDetailUrl: null,
      jobTitle: 'Quality Analyst Engineer - 2',
      jobCode: 'PST/STE/1766536',
      organizationUnit: 'Technology',
      jobClosureDate: '2026-09-30',
      locationHierarchy: 'India',
      expRange: '3-6 years',
      skills: {
        mustTohave: [],
        goodtohave: ['Manual Testing', ' SQL'],
      },
    },
    {
      organizationUnitComplete: 'PeopleStrong>Technology>PG2>Technology>Development>Jinie',
      jobPostedDate: '2026-07-06',
      locationHierarchyComplete: 'India>North Region>Haryana>Gurgaon>Gurgaon Infocity',
      jobDetailUrl: null,
      jobTitle: 'Software Development Engineer - 2',
      jobCode: 'PST/SDE/1612371',
      organizationUnit: 'Technology',
      jobClosureDate: '2026-09-30',
      locationHierarchy: 'India',
      expRange: '4-8 years',
      skills: {
        mustTohave: [],
        goodtohave: [],
      },
    },
  ],
})

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('PeopleStrong Technologies extracts live jobs from the restored public API contract', async () => {
  const peoplestrong = await loadModule()
  assert.ok(peoplestrong, 'PeopleStrong Technologies scraper module should load')

  assert.equal(peoplestrong.SOURCE, 'peoplestrongtechnologies')
  assert.equal(peoplestrong.COMPANY, 'PeopleStrong Technologies')
  assert.equal(peoplestrong.VERIFIED_ON, '2026-10-03')
  assert.equal(peoplestrong.hasPublicPortalShell(PORTAL_HTML), true)

  const jobs = peoplestrong.extractJobsFromApiResponse(LIVE_API_TEXT)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.city, job.experienceRequired, job.jobId]),
    [
      [
        'Quality Analyst Engineer - 2',
        'Gurgaon Infocity, Gurgaon, Haryana, India',
        'Gurgaon',
        '3-6 years',
        'PST/STE/1766536',
      ],
      [
        'Software Development Engineer - 2',
        'Gurgaon Infocity, Gurgaon, Haryana, India',
        'Gurgaon',
        '4-8 years',
        'PST/SDE/1612371',
      ],
    ],
  )
  assert.equal(jobs[0].applyUrl, 'https://careers.peoplestrong.com/job/detail/PST_STE_1766536')
  assert.deepEqual(jobs[0].requiredSkills, ['Manual Testing', 'SQL'])
})

test('PeopleStrong Technologies run follows the restored API feed and decorates jobs', async () => {
  const peoplestrong = await loadModule()
  assert.ok(peoplestrong, 'PeopleStrong Technologies scraper module should load')

  const jobs = await peoplestrong.createPeopleStrongTechnologiesScraper().run({
    fetchPage: async (url) => {
      if (
        [peoplestrong.HOMEPAGE_URL, peoplestrong.JOB_LIST_URL, peoplestrong.ALTERNATE_JOB_LIST_URL, peoplestrong.SAMPLE_JOB_DETAIL_URL]
          .includes(url)
      ) {
        return {
          status: url === peoplestrong.HOMEPAGE_URL || url === peoplestrong.SAMPLE_JOB_DETAIL_URL ? 200 : 404,
          url,
          html: PORTAL_HTML,
        }
      }

      throw new Error(`Unexpected PeopleStrong URL: ${url}`)
    },
    fetchApiText: async (url) => {
      assert.equal(url, peoplestrong.JOBS_API_URL)
      return {
        status: 200,
        text: LIVE_API_TEXT,
      }
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'PeopleStrong Technologies')
  assert.equal(jobs[0].sourceUrl, 'https://careers.peoplestrong.com/job/detail/PST_STE_1766536')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /Payroll Engine/i)
})

const fetchVerifiedPortal = async url => ({status: /joblist|openings/.test(url) ? 404 : 200, url, html: PORTAL_HTML})

test('PeopleStrong accepts the first-party explicit successful zero-requisition response', async () => {
  const ps = await loadModule()
  const jobs = await ps.run({fetchPage: fetchVerifiedPortal, fetchApiText: async () => ({status: 200,text: JSON.stringify({totalRecords:0,response:null,messageCode:{code:200,messages:'success'},campusHiring:0,solrSearch:true})})})
  assert.deepEqual(jobs, [])
  const decorated = decorateJobsWithProviderMetadata(jobs, ps.PROVIDER_METADATA)
  assert.equal(readInventoryEvidence(decorated)?.reportedTotal, 0)
  assert.equal(resolveZeroJobOutcome({provider:{zeroResultPolicy:'evidence-required'}}, decorated, []), 'verified-empty')
})

test('PeopleStrong rejects failed and contradictory empty API responses', async () => {
  const ps = await loadModule()
  for (const payload of [{}, {totalRecords:2,response:null,messageCode:{code:200}}, {totalRecords:0,response:null,messageCode:{code:500}}]) {
    await assert.rejects(ps.run({fetchPage: fetchVerifiedPortal, fetchApiText: async () => ({status:200,text:JSON.stringify(payload)})}), /payload|requisition/i)
  }
  await assert.rejects(ps.run({fetchPage: fetchVerifiedPortal,fetchApiText:async()=>({status:200,text:'Could not find method getRequisitionListWithPaginationBySolrBundle'})}), /payload|requisition/i)
})

test('PeopleStrong reads subsequent requisition pages before India filtering', async () => {
  const ps = await loadModule()
  const records = JSON.parse(LIVE_API_TEXT).response
  const jobs = await ps.run({fetchPage:fetchVerifiedPortal,fetchApiText:async url => {
    const offset = Number(new URL(url).searchParams.get('offset'))
    return {status:200,text:JSON.stringify({totalRecords:2,response:[records[offset]],messageCode:{code:200,messages:'success'}})}
  }})
  assert.deepEqual(jobs.map(job => job.jobId), ['PST/STE/1766536','PST/SDE/1612371'])
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 2)
})
