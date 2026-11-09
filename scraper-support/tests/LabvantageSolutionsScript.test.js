import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Lab Software Careers</h1>
      <h2>Join a technology leader serving lab-centered organizations worldwide</h2>
      <h2>Work on the cutting edge of science and technology</h2>
      <h3>India</h3>
      <p>If you are interested in any job postings in India, please send your resume to teamhr@labvantage.com.</p>
      <ul>
        <li>Product Marketing Manager / Lead – Product Marketing</li>
        <li>Senior Software Engineer – Development</li>
        <li>Technical Project Manager</li>
        <li>Product Manager</li>
        <li>Finance Controller</li>
        <li>Finance & Planning Analyst</li>
        <li>Software Engineer – DevOps</li>
        <li>DocuSign Technical Analyst</li>
      </ul>
      <h3>North America & Canada</h3>
    </main>
  </body>
</html>
`

const emptyIndiaHtml = careersHtml.replace(
  '<li>Product Marketing Manager / Lead – Product Marketing</li>\n        <li>Senior Software Engineer – Development</li>\n        <li>Technical Project Manager</li>\n        <li>Product Manager</li>\n        <li>Finance Controller</li>\n        <li>Finance & Planning Analyst</li>\n        <li>Software Engineer – DevOps</li>\n        <li>DocuSign Technical Analyst</li>',
  '',
)

const loadModule = async () => {
  try {
    return await import('../../scraper/labvantage/script.js')
  } catch {
    assert.fail('Expected Labvantage Solutions scraper module at ../../scraper/labvantage/script.js')
  }
}

test('LabVantage title listings preserve missing source descriptions through classification input', async () => {
  const labvantage = await loadModule()
  const jobs = await labvantage.createLabvantageSolutionsScraper().run({ fetchText: async () => careersHtml })
  assert.ok(jobs.length > 0)
  for (const job of jobs) {
    assert.equal(job.jobDescription, null)
    assert.equal(job.preserveExistingSourceContent, true)
    assert.equal(job.publicExperienceChecked, true)
    const normalized = normalizeScrapedJob(job)
    assert.equal(normalized.sourceDescription, '')
    assert.equal(normalized.jobDescription, null)
    assert.equal(normalized.experienceRequired, null)
    const input = postScrapeInput(normalized)
    assert.equal(input.body, '')
    assert.equal(input.incomplete, true)
  }
})

test('Labvantage Solutions helpers stay pinned to the verified India openings section from Friday, July 17, 2026', async () => {
  const labvantage = await loadModule()

  assert.equal(labvantage.SOURCE, 'labvantage')
  assert.equal(labvantage.COMPANY, 'Labvantage Solutions')
  assert.equal(labvantage.OFFICIAL_BRAND_NAME, 'LabVantage Solutions')
  assert.equal(labvantage.VERIFIED_ON, '2026-07-17')
  assert.equal(labvantage.HOMEPAGE_URL, 'https://www.labvantage.com/')
  assert.equal(labvantage.CAREERS_URL, 'https://www.labvantage.com/who-we-are/careers/')
  assert.equal(labvantage.APPLICATION_EMAIL, 'teamhr@labvantage.com')
  assert.equal(labvantage.APPLICATION_URL, 'mailto:teamhr@labvantage.com')
  assert.equal(labvantage.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(labvantage.extractIndiaJobTitles(careersHtml), [
    'Product Marketing Manager / Lead – Product Marketing',
    'Senior Software Engineer – Development',
    'Technical Project Manager',
    'Product Manager',
    'Finance Controller',
    'Finance & Planning Analyst',
    'Software Engineer – DevOps',
    'DocuSign Technical Analyst',
  ])
})

test('Labvantage Solutions run validates the verified careers page and maps the India openings list', async () => {
  const labvantage = await loadModule()
  const requestedUrls = []

  const jobs = await labvantage.createLabvantageSolutionsScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [labvantage.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Product Marketing Manager / Lead – Product Marketing',
    company: 'Labvantage Solutions',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    link: 'mailto:teamhr@labvantage.com',
    applyUrl: 'mailto:teamhr@labvantage.com',
    sourceUrl: 'https://www.labvantage.com/who-we-are/careers/',
    source: 'labvantage',
    jobId: null,
    requisitionId: null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    preserveExistingSourceContent: true,
    publicExperienceChecked: true,
    remoteStatus: null,
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(jobs[1].title, 'Senior Software Engineer – Development')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Labvantage Solutions fails closed when the verified careers page drifts or the India openings disappear', async () => {
  const labvantage = await loadModule()

  await assert.rejects(
    labvantage.createLabvantageSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /careers page/i,
  )

  await assert.rejects(
    labvantage.createLabvantageSolutionsScraper().run({
      fetchText: async () => emptyIndiaHtml,
    }),
    /India openings/i,
  )
})
