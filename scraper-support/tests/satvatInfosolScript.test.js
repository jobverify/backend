import assert from 'node:assert/strict'
import test from 'node:test'

const loadSatvatModule = async () => {
  try {
    return await import('../../scraper/satvatinfosol/script.js')
  } catch {
    assert.fail('Expected Satvat Infosol scraper module at ../../scraper/satvatinfosol/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life @ Satvat Infosol | Job Openings Satvat Infosol</title>
  </head>
  <body>
    <h1>Life @ Satvat Infosol | Job Openings Satvat Infosol</h1>
    <div class="brows-job-list">
      <h3>Software Programmer/Developer</h3>
      <p><i class="flaticon-pin"></i> Ahmedabad - India</p>
      <p class="tooltiptext">Build secure custom software for enterprise clients.</p>
      <a href="jobs/software-programmer-developer.php" class="btn btn-default">Apply Now</a>
    </div>
    <div class="brows-job-list">
      <h3>Business Development Manager</h3>
      <p><i class="flaticon-pin"></i> Mumbai - India</p>
      <a href="jobs/business-development-manager.php" class="btn btn-default">Apply Now</a>
    </div>
  </body>
</html>
`

test('Satvat Infosol validates the verified careers page and marks public descriptions as checked', async () => {
  const satvat = await loadSatvatModule()

  assert.equal(satvat.SOURCE, 'satvatinfosol')
  assert.equal(satvat.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = satvat.extractJobs(officialCareersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Software Programmer/Developer',
    company: satvat.COMPANY,
    department: null,
    location: 'Ahmedabad, India',
    city: 'Ahmedabad',
    country: 'India',
    jobId: 'software-programmer-developer',
    requisitionId: 'software-programmer-developer',
    sourceUrl: new URL('jobs/software-programmer-developer.php', satvat.CAREERS_URL).toString(),
    applyUrl: new URL('jobs/software-programmer-developer.php', satvat.CAREERS_URL).toString(),
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build secure custom software for enterprise clients.',
    publicExperienceChecked: true,
  })
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
  assert.equal(jobs[1].jobDescription, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('Satvat Infosol run decorates verified public jobs with shared metadata', async () => {
  const satvat = await loadSatvatModule()
  const requestedUrls = []

  const jobs = await satvat.createSatvatInfosolScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === satvat.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Satvat Infosol URL: ${url}`)
    },
    now: () => '2026-08-06T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [satvat.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, satvat.SOURCE)
  assert.equal(jobs[0].companyCareerPage, satvat.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-08-06T12:00:00.000Z')
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})
