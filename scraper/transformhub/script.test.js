import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career with TransformHub | Award Winning Digital Solutions Company</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>If You Can Understand Accountability , Join Us!</p>
    <h2>Transforming Careers</h2>
    <p>
      If you are a curious, creative, and solution-driven individual, look through our
      current hiring positions that best match your skills and interest.
    </p>
    <h2>Current Openings</h2>
    <div>DEVSECOPS - SENIOR ENGINEER</div>
    <div>Vietnam &amp; Pan India</div>
    <div>Responsibilities</div>
    <div>Implementation of Endpoint security Best Practices as per ISO27001.</div>
    <div>Skills</div>
    <div>5 + years of previous experience as DevOps/ Dev SecOps.</div>
    <div>DATA ANALYST</div>
    <div>Vietnam</div>
    <div>Responsibilities</div>
    <div>Strong proficiency in SQL and Python.</div>
    <div>ZOHO DEVELOPER</div>
    <div>Navi Mumbai</div>
    <div>Responsibilities</div>
    <div>0 - 3 years of experience in Zoho CRM development.</div>
    <div>Benefits of Working at TransformHub</div>
  </body>
</html>
`

test('TransformHub recognizes the current careers page shell and extracts inline India jobs from the updated layout', async () => {
  const transformhub = await loadModule()

  assert.equal(transformhub.hasOfficialCareersPageSignal(careersHtml), true)

  const jobs = transformhub.extractInlineJobs(careersHtml, {
    scrapedAt: '2026-08-06T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'DEVSECOPS - SENIOR ENGINEER',
    company: 'TransformHub',
    department: null,
    location: 'Vietnam & Pan India',
    city: 'Pan India',
    country: 'India',
    link: 'https://www.transformhub.com/career',
    applyUrl: 'https://www.transformhub.com/career',
    sourceUrl: 'https://www.transformhub.com/career',
    source: 'transformhub',
    jobId: 'devsecops-senior-engineer-vietnam-pan-india',
    requisitionId: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription:
      'Implementation of Endpoint security Best Practices as per ISO27001. 5 + years of previous experience as DevOps/ Dev SecOps.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    remoteStatus: null,
    scrapedAt: '2026-08-06T00:00:00.000Z',
  })
  assert.equal(jobs[1].title, 'ZOHO DEVELOPER')
  assert.equal(jobs[1].location, 'Navi Mumbai, India')
  assert.equal(jobs[1].city, 'Navi Mumbai')
})

test('TransformHub returns only the current India-relevant inline jobs from the first-party careers page', async () => {
  const transformhub = await loadModule()

  const jobs = await transformhub.createTransformHubScraper({
    now: () => '2026-08-06T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, transformhub.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].companyCareerPage, 'https://www.transformhub.com/career')
  assert.equal(jobs[0].companyDomain, 'transformhub.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[1].title, 'ZOHO DEVELOPER')
})
