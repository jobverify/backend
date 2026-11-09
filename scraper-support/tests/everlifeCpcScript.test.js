import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h3>Work With Everlife CPC</h3>
    <p>Interested in working with Everlife CPC? Kindly mail your resume to hiring@cpcdiagnostics.in</p>

    <h5>Area Manager</h5>
    <p>Location: Mumbai</p>
    <a href="https://everlife.darwinbox.in/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fjob-mumbai___apply%3D1___private%3D1___id%3Darea-manager-mumbai">Apply Now</a>

    <h5>Scientific Businees Officer</h5>
    <p>Location: Chennai</p>
    <a href="https://everlife.darwinbox.in/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fjob-chennai___apply%3D1___private%3D1___id%3Dscientific-business-officer-chennai">Apply Now</a>
  </body>
</html>
`

const loadEverlifeCpcModule = async () => {
  try {
    return await import('../../scraper/everlifecpc/script.js')
  } catch {
    assert.fail('Expected Everlife CPC scraper module at ../../scraper/everlifecpc/script.js')
  }
}

test('Everlife CPC handoff cards preserve missing source descriptions through classification input', async () => {
  const everlifeCpc = await loadEverlifeCpcModule()
  const jobs = await everlifeCpc.createEverlifeCpcScraper().run({ fetchRenderedHtml: async () => CAREERS_HTML })
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

test('extractJobs maps the official Everlife CPC openings and Darwinbox apply links', async () => {
  const everlifeCpc = await loadEverlifeCpcModule()

  assert.equal(everlifeCpc.CAREERS_URL, 'https://cpcdiagnostics.in/career')
  assert.deepEqual(everlifeCpc.extractJobs(CAREERS_HTML), [{
    title: 'Area Manager',
    company: 'Everlife CPC',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'everlifecpc-area-manager-mumbai',
    requisitionId: 'everlifecpc-area-manager-mumbai',
    sourceUrl: 'https://cpcdiagnostics.in/career',
    applyUrl: 'https://everlife.darwinbox.in/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fjob-mumbai___apply%3D1___private%3D1___id%3Darea-manager-mumbai',
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
    remoteStatus: 'On-site',
  }, {
    title: 'Scientific Businees Officer',
    company: 'Everlife CPC',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'everlifecpc-scientific-businees-officer-chennai',
    requisitionId: 'everlifecpc-scientific-businees-officer-chennai',
    sourceUrl: 'https://cpcdiagnostics.in/career',
    applyUrl: 'https://everlife.darwinbox.in/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fjob-chennai___apply%3D1___private%3D1___id%3Dscientific-business-officer-chennai',
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
    remoteStatus: 'On-site',
  }])
})

test('run uses the rendered official Everlife CPC careers page and decorates runner fields', async () => {
  const everlifeCpc = await loadEverlifeCpcModule()
  const requestedUrls = []

  const jobs = await everlifeCpc.createEverlifeCpcScraper().run({
    fetchRenderedHtml: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://cpcdiagnostics.in/career'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'everlifecpc')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
})
