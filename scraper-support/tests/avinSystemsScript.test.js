import assert from 'node:assert/strict'
import test from 'node:test'

const loadAvinSystemsModule = async () => {
  try {
    return await import('../../scraper/avinsystems/script.js')
  } catch {
    assert.fail('Expected AVIN Systems scraper module at ../../scraper/scraper/avinsystems/script.js')
  }
}

const careersHtml = `
<html>
  <body>
    <div class="jobs-listing">
      <div class="job-card">
        <div class="card-info">
          <div class="job-header">
            <span class="job-title">Senior Software Engineer</span>
          </div>
          <div class="job-meta">
            <div class="meta-info">
              <span class="job-skill">Automotive</span>
            </div>
            <div class="meta-info">
              <span class="job-experience">3-5 Years</span>
            </div>
            <div class="meta-info">
              <span class="job-location">Pune / Bangalore</span>
            </div>
          </div>
        </div>
        <a href="https://www.avinsystems.com/job/chief-engineer/"></a>
      </div>
      <div class="job-card">
        <div class="card-info">
          <div class="job-header">
            <span class="job-title">Architect</span>
          </div>
          <div class="job-meta">
            <div class="meta-info">
              <span class="job-skill">Automotive</span>
            </div>
            <div class="meta-info">
              <span class="job-experience">8-12 Years</span>
            </div>
            <div class="meta-info">
              <span class="job-location">Bangalore</span>
            </div>
          </div>
        </div>
        <a href="https://www.avinsystems.com/job/technical-project-manager/"></a>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<html>
  <head>
    <title>Senior Software Engineer - AVIN Systems</title>
  </head>
  <body>
    <main>
      Job Description Apply Senior Software Engineer Job Location: Pune / Bangalore Primary Skills: Automotive Experience: 3-5 Years Job Description: ADAS framework experience. Python knowledge to review software changes. Key Responsibilities: Automate event allocation and analyze on-road failures. Skills Required: Knowledge of sensor technologies, ADAS fundamentals, Python
    </main>
  </body>
</html>
`

test('extractJobCards maps AVIN Systems public careers cards into shared scraper fields', async () => {
  const avinSystems = await loadAvinSystemsModule()
  const jobs = avinSystems.extractJobCards(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    skill: 'Automotive',
    experienceRequired: '3-5 Years',
    location: 'Pune / Bangalore, India',
    city: 'Pune',
    sourceUrl: 'https://www.avinsystems.com/job/chief-engineer/',
    applyUrl: 'https://www.avinsystems.com/job/chief-engineer/',
    jobId: 'chief-engineer',
    requisitionId: 'chief-engineer',
  })
})

test('extractJobDetail reads AVIN Systems public job page fields from repeated labels', async () => {
  const avinSystems = await loadAvinSystemsModule()
  const detail = avinSystems.extractJobDetail(detailHtml)

  assert.equal(detail.title, 'Senior Software Engineer')
  assert.equal(detail.location, 'Pune / Bangalore, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.primarySkills, 'Automotive')
  assert.equal(detail.experienceRequired, '3-5 Years')
  assert.match(detail.jobDescription, /ADAS framework experience/i)
  assert.match(detail.keyResponsibilities, /analyze on-road failures/i)
  assert.deepEqual(detail.requiredSkills, [
    'Knowledge of sensor technologies',
    'ADAS fundamentals',
    'Python',
  ])
})

test('run fetches the AVIN Systems careers page and detail pages and decorates jobs', async () => {
  const avinSystems = await loadAvinSystemsModule()
  const requestedUrls = []
  const scraper = avinSystems.createAvinSystemsScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === avinSystems.CAREERS_PAGE_URL) return careersHtml
      if (url === 'https://www.avinsystems.com/job/chief-engineer/') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    avinSystems.CAREERS_PAGE_URL,
    'https://www.avinsystems.com/job/chief-engineer/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'avinsystems')
  assert.equal(jobs[0].company, 'AVIN Systems')
  assert.equal(jobs[0].department, 'Automotive')
  assert.equal(jobs[0].link, 'https://www.avinsystems.com/job/chief-engineer/')
  assert.equal(jobs[0].experienceRequired, '3-5 Years')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
