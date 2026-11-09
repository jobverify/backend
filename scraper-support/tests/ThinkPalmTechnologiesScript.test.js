import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ThinkPalm Careers | Job Openings | Work Culture and Values</title>
  </head>
  <body>
    <h1>We Are A Great Place To Work-Certified Organisation!</h1>
    <h2>Open Positions</h2>
    <article class="job-card">
      <a href="https://thinkpalm.com/company/careers/dotnet-architect/">
        <h3>DotNet Architect - 10+ Years</h3>
      </a>
      <p class="location">Cochin</p>
      <span>Apply</span>
    </article>
    <article class="job-card">
      <a href="https://thinkpalm.com/company/careers/java-tech-lead/">
        <h3>Java Tech Lead - 7+ Years</h3>
      </a>
      <p class="location">Trivandrum</p>
      <span>Apply</span>
    </article>
    <article class="job-card">
      <a href="https://thinkpalm.com/company/careers/lead-cloud-engineer/">
        <h3>Lead Cloud Engineer - 6+ Years</h3>
      </a>
      <p class="location">Trivandrum</p>
      <span>Apply</span>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/thinkpalmtechnologies/script.js')
  } catch {
    assert.fail('Expected ThinkPalm Technologies scraper module at ../../scraper/thinkpalmtechnologies/script.js')
  }
}

test('ThinkPalm Technologies helpers stay pinned to the verified open positions from Saturday, July 18, 2026', async () => {
  const thinkPalm = await loadModule()

  assert.equal(thinkPalm.SOURCE, 'thinkpalmtechnologies')
  assert.equal(thinkPalm.COMPANY, 'ThinkPalm Technologies')
  assert.equal(thinkPalm.CAREERS_URL, 'https://thinkpalm.com/company/careers/')
  assert.equal(thinkPalm.VERIFIED_ON, '2026-07-18')
  assert.equal(thinkPalm.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(thinkPalm.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(thinkPalm.extractJobs(careersHtml), [
    {
      title: 'DotNet Architect',
      company: 'ThinkPalm Technologies',
      department: null,
      location: 'Cochin, Kerala, India',
      city: 'Cochin',
      country: 'India',
      jobId: 'dotnet-architect',
      requisitionId: 'dotnet-architect',
      sourceUrl: 'https://thinkpalm.com/company/careers/dotnet-architect/',
      applyUrl: 'https://thinkpalm.com/company/careers/dotnet-architect/',
      employmentType: null,
      experienceRequired: '10+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Java Tech Lead',
      company: 'ThinkPalm Technologies',
      department: null,
      location: 'Trivandrum, Kerala, India',
      city: 'Trivandrum',
      country: 'India',
      jobId: 'java-tech-lead',
      requisitionId: 'java-tech-lead',
      sourceUrl: 'https://thinkpalm.com/company/careers/java-tech-lead/',
      applyUrl: 'https://thinkpalm.com/company/careers/java-tech-lead/',
      employmentType: null,
      experienceRequired: '7+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Lead Cloud Engineer',
      company: 'ThinkPalm Technologies',
      department: null,
      location: 'Trivandrum, Kerala, India',
      city: 'Trivandrum',
      country: 'India',
      jobId: 'lead-cloud-engineer',
      requisitionId: 'lead-cloud-engineer',
      sourceUrl: 'https://thinkpalm.com/company/careers/lead-cloud-engineer/',
      applyUrl: 'https://thinkpalm.com/company/careers/lead-cloud-engineer/',
      employmentType: null,
      experienceRequired: '6+ Years',
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

test('ThinkPalm Technologies run validates the verified careers page before decorating extracted jobs', async () => {
  const thinkPalm = await loadModule()
  const requestedUrls = []

  const jobs = await thinkPalm.createThinkPalmTechnologiesScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === thinkPalm.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected ThinkPalm URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [thinkPalm.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'thinkpalmtechnologies')
  assert.equal(jobs[0].link, 'https://thinkpalm.com/company/careers/dotnet-architect/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('ThinkPalm Technologies run fails closed when the verified careers surface drifts', async () => {
  const thinkPalm = await loadModule()

  await assert.rejects(
    thinkPalm.createThinkPalmTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified thinkpalm technologies careers surface/i,
  )
})
