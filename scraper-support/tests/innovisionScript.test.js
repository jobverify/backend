import assert from 'node:assert/strict'
import test from 'node:test'

import { enrichJobsWithPublicExperience } from '../utils/publicExperienceEnrichment.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'

const careersPage = {
  status: 200,
  url: 'https://www.innovision.co.in/careers/',
  html: `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Innovision Security | Innovision Limited</title>
  </head>
  <body>
    <h1>Build Your Future</h1>
    <h2>Careers at Innovision</h2>
    <h3>Current Openings</h3>
    <div class="opening-card">
      <h4>Security Supervisor</h4>
      <p>Mumbai, Delhi, Bangalore</p>
      <p>Full-time</p>
      <p>Operations</p>
      <button type="button">Apply Now</button>
    </div>
    <div class="opening-card">
      <h4>Facility Manager</h4>
      <p>Pan India</p>
      <p>Full-time</p>
      <p>Facility Management</p>
      <button type="button">Apply Now</button>
    </div>
    <div class="opening-card">
      <h4>HR Operations Executive</h4>
      <p>Gurgaon</p>
      <p>Full-time</p>
      <p>Human Resources</p>
      <button type="button">Apply Now</button>
    </div>
    <div class="opening-card">
      <h4>Toll Operations Manager</h4>
      <p>Multiple Locations</p>
      <p>Full-time</p>
      <p>Toll Management</p>
      <button type="button">Apply Now</button>
    </div>
    <div class="opening-card">
      <h4>Training &amp; Development Officer</h4>
      <p>Delhi NCR</p>
      <p>Full-time</p>
      <p>Training</p>
      <button type="button">Apply Now</button>
    </div>
    <p>Don't see a suitable position? Send us your resume at <a href="mailto:careers@innovision.co.in">careers@innovision.co.in</a></p>
  </body>
</html>
`,
}

const loadInnovisionModule = async () => {
  try {
    return await import('../../scraper/innovision/script.js')
  } catch {
    assert.fail('Expected Innovision scraper module at ../../scraper/innovision/script.js')
  }
}

test('Innovision verifies the first-party inline openings surface and shared application email', async () => {
  const innovision = await loadInnovisionModule()

  assert.equal(innovision.CAREERS_PAGE_URL, 'https://www.innovision.co.in/careers/')
  assert.equal(innovision.APPLICATION_URL, 'mailto:careers@innovision.co.in')
  assert.equal(innovision.hasOfficialCareersSignal(careersPage), true)
  assert.equal(innovision.extractApplyEmail(careersPage.html), innovision.APPLICATION_URL)
})

test('Innovision extracts the visible first-party openings and maps them to the shared email apply surface', async () => {
  const innovision = await loadInnovisionModule()

  const jobs = innovision.extractOpenings(careersPage.html)

  assert.deepEqual(jobs, [
    {
      title: 'Facility Manager',
      company: 'Innovision',
      department: 'Facility Management',
      location: 'Pan India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'facility-manager',
      requisitionId: null,
      sourceUrl: 'https://www.innovision.co.in/careers/',
      applyUrl: 'mailto:careers@innovision.co.in',
      employmentType: 'Full-time',
      sourceEmploymentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    },
    {
      title: 'HR Operations Executive',
      company: 'Innovision',
      department: 'Human Resources',
      location: 'Gurgaon',
      city: 'Gurgaon',
      state: null,
      country: null,
      jobId: 'hr-operations-executive',
      requisitionId: null,
      sourceUrl: 'https://www.innovision.co.in/careers/',
      applyUrl: 'mailto:careers@innovision.co.in',
      employmentType: 'Full-time',
      sourceEmploymentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    },
    {
      title: 'Security Supervisor',
      company: 'Innovision',
      department: 'Operations',
      location: 'Mumbai, Delhi, Bangalore',
      city: null,
      state: null,
      country: null,
      jobId: 'security-supervisor',
      requisitionId: null,
      sourceUrl: 'https://www.innovision.co.in/careers/',
      applyUrl: 'mailto:careers@innovision.co.in',
      employmentType: 'Full-time',
      sourceEmploymentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    },
    {
      title: 'Toll Operations Manager',
      company: 'Innovision',
      department: 'Toll Management',
      location: 'Multiple Locations',
      city: null,
      state: null,
      country: null,
      jobId: 'toll-operations-manager',
      requisitionId: null,
      sourceUrl: 'https://www.innovision.co.in/careers/',
      applyUrl: 'mailto:careers@innovision.co.in',
      employmentType: 'Full-time',
      sourceEmploymentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    },
    {
      title: 'Training & Development Officer',
      company: 'Innovision',
      department: 'Training',
      location: 'Delhi NCR',
      city: null,
      state: null,
      country: null,
      jobId: 'training-and-development-officer',
      requisitionId: null,
      sourceUrl: 'https://www.innovision.co.in/careers/',
      applyUrl: 'mailto:careers@innovision.co.in',
      employmentType: 'Full-time',
      sourceEmploymentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    },
  ])
})

test('Innovision run verifies the trusted careers page before returning the visible openings', async () => {
  const innovision = await loadInnovisionModule()
  const requested = []

  const jobs = await innovision.createInnovisionScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url === innovision.CAREERS_PAGE_URL) return careersPage
      throw new Error(`Unexpected Innovision page URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [innovision.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].source, 'innovision')
  assert.equal(jobs[0].link, 'mailto:careers@innovision.co.in')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('Innovision fails closed when the verified careers page drifts materially', async () => {
  const innovision = await loadInnovisionModule()

  await assert.rejects(
    innovision.createInnovisionScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: innovision.CAREERS_PAGE_URL,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified Innovision careers page/i,
  )
})

test('Innovision enrichment keeps shared company history and neighboring cards out of all five jobs', async () => {
  const innovision = await loadInnovisionModule()
  const html = careersPage.html.replace('<h1>Build Your Future</h1>',
    '<p>19+ years of excellence in integrated security services, facility management, and infrastructure solutions. 15,000+ workforce, 1000+ clients across India.</p><nav>service verticals</nav><h1>Build Your Future</h1>')
  const jobs = await innovision.createInnovisionScraper().run({
    fetchPage: async () => ({ ...careersPage, html }),
    now: () => '2026-11-07T12:00:00.000Z',
  })
  const before = structuredClone(jobs)
  let rawFetches = 0
  let browserFetches = 0
  const enriched = await enrichJobsWithPublicExperience(jobs, {
    fetchText: async () => { rawFetches += 1; return html },
    fetchBrowserText: async () => { browserFetches += 1; return html },
  })
  assert.equal(rawFetches, 0)
  assert.equal(browserFetches, 0)
  assert.deepEqual(jobs, before)
  assert.deepEqual(enriched, before)
  assert.equal(enriched.length, 5)
  for (const job of enriched) {
    const normalized = normalizeScrapedJob(job, innovision.PROVIDER_METADATA)
    assert.equal(normalized.jobDescription, null)
    assert.equal(normalized.sourceExperienceRequired, null)
    assert.equal(normalized.experienceRequired, null)
    assert.equal(normalized.sourceEmploymentType, 'Full-time')
    assert.equal(job.remoteStatus, null)
    const input = postScrapeInput(normalized, { now: new Date('2026-11-07T12:00:00.000Z') })
    assert.equal(input.sourceFields.description, '')
    assert.doesNotMatch(input.body, /19\+ years|service verticals/)
  }
})
