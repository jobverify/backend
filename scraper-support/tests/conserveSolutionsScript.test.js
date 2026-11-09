import assert from 'node:assert/strict'
import test from 'node:test'

const jobsHtml = `
  <a href="https://www.conservesolution.com/jobs/bim-trainer/" class="awsm-job-item">
    <h2 class="awsm-job-post-title">BIM Trainer</h2>
    <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-term">Electrical</span></div>
    <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">India</span></div>
    <div class="awsm-job-specification-item awsm-job-specification-experience"><span class="awsm-job-specification-term">2+ years</span></div>
  </a>
  <a href="https://www.conservesolution.com/jobs/mechanical-bim-modeler/" class="awsm-job-item">
    <h2 class="awsm-job-post-title">Mechanical BIM Modeler</h2>
    <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Dubai</span></div>
  </a>
`

const loadConserveSolutionsModule = async () => {
  try {
    return await import('../../scraper/conservesolutions/script.js')
  } catch {
    return null
  }
}

test('extractJobCards maps official Conserve Solutions India job cards', async () => {
  const conserveSolutions = await loadConserveSolutionsModule()
  assert.ok(conserveSolutions, 'Conserve Solutions scraper module must exist')

  assert.deepEqual(conserveSolutions.extractJobCards(jobsHtml), [{
    title: 'BIM Trainer',
    company: 'Conserve Solutions',
    department: 'Electrical',
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'bim-trainer',
    requisitionId: 'bim-trainer',
    sourceUrl: 'https://www.conservesolution.com/jobs',
    applyUrl: 'https://www.conservesolution.com/jobs/bim-trainer/',
    employmentType: null,
    experienceRequired: '2+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
    compensation: null,
  }])
})

test('run fetches the official Conserve Solutions jobs page and decorates runner fields', async () => {
  const conserveSolutions = await loadConserveSolutionsModule()
  assert.ok(conserveSolutions, 'Conserve Solutions scraper module must exist')

  const jobs = await conserveSolutions.createConserveSolutionsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, conserveSolutions.CAREERS_URL)
      return jobsHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'conservesolutions')
  assert.equal(jobs[0].link, 'https://www.conservesolution.com/jobs/bim-trainer/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run marks Conserve 5xx responses as upstream soft failures', async () => {
  const conserveSolutions = await loadConserveSolutionsModule()
  assert.ok(conserveSolutions, 'Conserve Solutions scraper module must exist')

  await assert.rejects(
    conserveSolutions.createConserveSolutionsScraper().run({
      fetchText: async (url) => {
        throw new Error(`HTTP 503 for ${url}`)
      },
    }),
    (error) => {
      assert.match(error.message, /HTTP 503/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      return true
    },
  )
})
