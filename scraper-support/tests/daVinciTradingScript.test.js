import assert from 'node:assert/strict'
import test from 'node:test'

const loadDaVinciModule = async () => import('../../scraper/davincitrading/script.js')

const careersHtml = `
  <section class="career-listings">
    <a href="/job/experienced-quant-mumbai/">
      <span>Mumbai, Maharashtra, India</span>
      <h3>Experienced Quant</h3>
      <span>Apply</span>
    </a>
    <a href="/job/machine-learning-quant-amsterdam/">
      <span>Amsterdam, North Holland, Netherlands</span>
      <h3>Machine Learning Quant</h3>
      <span>Apply</span>
    </a>
  </section>
`

test('archived Da Vinci pure listing helper retains its original contract', async () => {
  const daVinci = await loadDaVinciModule()

  assert.deepEqual(daVinci.extractCareerJobs(careersHtml), [{
    title: 'Experienced Quant',
    company: 'Da Vinci Trading',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'experienced-quant-mumbai',
    requisitionId: 'experienced-quant-mumbai',
    sourceUrl: 'https://davincitrading.com/job/experienced-quant-mumbai/',
    applyUrl: 'https://davincitrading.com/job/experienced-quant-mumbai/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply through the official Da Vinci Trading careers page.',
  }])
})

test('Da Vinci script exports delegate to the full current native inventory and preserve caller options', async () => {
  const daVinci = await loadDaVinciModule()
  const { daVinciNativeOptions } = await import('./fixtures/daVinciNativeOptions.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const options = daVinciNativeOptions()
  const jobs = await daVinci.run(options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'davincitrading')
  assert.equal(jobs[0].jobId, '4046811101')
  assert.equal(options.calls.length, 36)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 15)
})

test('Da Vinci rejects old listing-only transport overrides before an implicit network request', async () => {
  const daVinci = await loadDaVinciModule()
  await assert.rejects(daVinci.run({ fetchText: async () => careersHtml }), /current native transport requires fetchPage/)
})
