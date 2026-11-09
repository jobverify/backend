import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best Job Opportunity for Your Careers Growth | Code Brew Labs</title>
  </head>
  <body>
    <h1>Join Us! Great place!</h1>
    <p>At Code Brew Labs, we're more than a team.</p>
    <p>Contact No: +91-78148 99258 Email Id: hr@code-brew.com</p>
    <h2>Open Positions</h2>
    <section class="job-card">
      <h3>Nodejs Developer Lead</h3>
      <p class="department">Development</p>
      <p class="location">Chandigarh</p>
      <a href="https://www.code-brew.com/jobs/nodejs-developer-lead/">Apply Now</a>
    </section>
    <section class="job-card">
      <h3>Angular Developer Lead</h3>
      <p class="department">Development</p>
      <p class="location">Chandigarh</p>
      <a href="https://www.code-brew.com/jobs/angular-developer-lead/">Apply Now</a>
    </section>
    <section class="job-card">
      <h3>Business Development Manager</h3>
      <p class="department">Management</p>
      <p class="location">Chandigarh</p>
      <a href="https://www.code-brew.com/jobs/business-development-manager/">Apply Now</a>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/codebrewlabs/script.js')
  } catch {
    assert.fail('Expected Code Brew Labs scraper module at ../../scraper/codebrewlabs/script.js')
  }
}

test('Code Brew Labs helpers stay pinned to the verified first-party careers roles from Saturday, July 18, 2026', async () => {
  const codeBrew = await loadModule()

  assert.equal(codeBrew.SOURCE, 'codebrewlabs')
  assert.equal(codeBrew.COMPANY, 'Code Brew Labs')
  assert.equal(codeBrew.CAREERS_URL, 'https://www.code-brew.com/careers/')
  assert.equal(codeBrew.VERIFIED_ON, '2026-07-18')
  assert.equal(codeBrew.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(codeBrew.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(codeBrew.extractJobs(careersHtml), [
    {
      title: 'Nodejs Developer Lead',
      company: 'Code Brew Labs',
      department: 'Development',
      location: 'Chandigarh, India',
      city: 'Chandigarh',
      country: 'India',
      jobId: 'nodejs-developer-lead',
      requisitionId: 'nodejs-developer-lead',
      sourceUrl: 'https://www.code-brew.com/careers/',
      applyUrl: 'https://www.code-brew.com/jobs/nodejs-developer-lead/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Angular Developer Lead',
      company: 'Code Brew Labs',
      department: 'Development',
      location: 'Chandigarh, India',
      city: 'Chandigarh',
      country: 'India',
      jobId: 'angular-developer-lead',
      requisitionId: 'angular-developer-lead',
      sourceUrl: 'https://www.code-brew.com/careers/',
      applyUrl: 'https://www.code-brew.com/jobs/angular-developer-lead/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Business Development Manager',
      company: 'Code Brew Labs',
      department: 'Management',
      location: 'Chandigarh, India',
      city: 'Chandigarh',
      country: 'India',
      jobId: 'business-development-manager',
      requisitionId: 'business-development-manager',
      sourceUrl: 'https://www.code-brew.com/careers/',
      applyUrl: 'https://www.code-brew.com/jobs/business-development-manager/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Code Brew Labs run validates the verified careers page before decorating extracted jobs', async () => {
  const codeBrew = await loadModule()
  const requestedUrls = []

  const jobs = await codeBrew.createCodeBrewLabsScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === codeBrew.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Code Brew Labs URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [codeBrew.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'codebrewlabs')
  assert.equal(jobs[0].link, 'https://www.code-brew.com/jobs/nodejs-developer-lead/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Code Brew Labs run fails closed when the verified careers surface drifts', async () => {
  const codeBrew = await loadModule()

  await assert.rejects(
    codeBrew.createCodeBrewLabsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified code brew labs careers surface/i,
  )
})
