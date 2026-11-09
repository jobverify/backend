import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Travel Technology Company | Online Travel Solutions</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h2>Current Openings</h2>
    <div class="box-new-career">
      <a href="https://www.trawex.com/senior-angular-developer.php">
        <h4>Senior Angular Developer</h4>
      </a>
      <p>Bangalore, Karnataka, India</p>
    </div>
    <div class="box-new-career">
      <a href="https://www.trawex.com/business-development-manager.php">
        <h4>Business Development Manager</h4>
      </a>
      <p>Bangalore, Karnataka, India</p>
    </div>
    <div class="box-new-career">
      <a href="https://www.trawex.com/us-sales-manager.php">
        <h4>US Sales Manager</h4>
      </a>
      <p>Dallas, Texas, United States</p>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/trawextechnologies/script.js')
  } catch {
    assert.fail('Expected Trawex Technologies scraper module at ../../scraper/trawextechnologies/script.js')
  }
}

test('Trawex Technologies helpers stay pinned to the verified same-domain careers cards from Friday, July 17, 2026', async () => {
  const trawex = await loadModule()

  assert.equal(trawex.SOURCE, 'trawextechnologies')
  assert.equal(trawex.COMPANY, 'Trawex Technologies')
  assert.equal(trawex.CAREERS_URL, 'https://www.trawex.com/careers.php')
  assert.equal(trawex.VERIFIED_ON, '2026-07-17')
  assert.equal(trawex.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(trawex.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(trawex.extractJobs(verifiedCareersHtml), [
    {
      title: 'Senior Angular Developer',
      company: 'Trawex Technologies',
      department: null,
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'senior-angular-developer',
      requisitionId: 'senior-angular-developer',
      sourceUrl: 'https://www.trawex.com/senior-angular-developer.php',
      applyUrl: 'https://www.trawex.com/senior-angular-developer.php',
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
      company: 'Trawex Technologies',
      department: null,
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'business-development-manager',
      requisitionId: 'business-development-manager',
      sourceUrl: 'https://www.trawex.com/business-development-manager.php',
      applyUrl: 'https://www.trawex.com/business-development-manager.php',
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

test('Trawex Technologies run validates the verified careers page before decorating extracted jobs', async () => {
  const trawex = await loadModule()
  const requestedUrls = []

  const jobs = await trawex.createTrawexTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === trawex.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected Trawex URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [trawex.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'trawextechnologies')
  assert.equal(jobs[0].link, 'https://www.trawex.com/senior-angular-developer.php')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Trawex Technologies run fails closed when the verified careers surface drifts', async () => {
  const trawex = await loadModule()

  await assert.rejects(
    trawex.createTrawexTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Trawex Technologies careers surface/i,
  )
})
