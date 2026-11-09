import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Agnikul Cosmos | Careers in Space Technology &amp; Innovation</title>
    <meta property="og:url" content="https://www.agnikul.in/careers/">
    <meta property="og:site_name" content="Agnikul">
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>At Agnikul, our culture is all about hard work and determination to push the boundaries of innovation.</p>

      <h2>Job Openings</h2>
      <p>Would you like to be part of the team?</p>

      <div class="job-card">
        <h2 class="elementor-heading-title elementor-size-default">Power electronics Engineer</h2>
        <h3 class="elementor-icon-box-title"><span>Chennai, India</span></h3>
        <h3 class="elementor-icon-box-title"><span>Full Time</span></h3>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:humancapital@agnikul.in">
          <span class="elementor-button-text">humancapital@agnikul.in</span>
        </a>
      </div>

      <div class="job-card">
        <h2 class="elementor-heading-title elementor-size-default">Mission Design Software Developer</h2>
        <h3 class="elementor-icon-box-title"><span>Chennai, India</span></h3>
        <h3 class="elementor-icon-box-title"><span>Full Time</span></h3>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:humancapital@agnikul.in">
          <span class="elementor-button-text">humancapital@agnikul.in</span>
        </a>
      </div>

      <div class="job-card">
        <h2 class="elementor-heading-title elementor-size-default">Launch Vehicle Operations Strategist</h2>
        <h3 class="elementor-icon-box-title"><span>Chennai, India</span></h3>
        <h3 class="elementor-icon-box-title"><span>Full Time</span></h3>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:humancapital@agnikul.in">
          <span class="elementor-button-text">humancapital@agnikul.in</span>
        </a>
      </div>

      <div class="job-card">
        <h2 class="elementor-heading-title elementor-size-default">ERPNext Developer</h2>
        <h3 class="elementor-icon-box-title"><span>Chennai, India</span></h3>
        <h3 class="elementor-icon-box-title"><span>Full Time</span></h3>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:humancapital@agnikul.in">
          <span class="elementor-button-text">humancapital@agnikul.in</span>
        </a>
      </div>

      <p>To apply, send a mail to <a href="mailto:humancapital@agnikul.in">humancapital@agnikul.in</a> with your resume.</p>

      <h2>This is #lifeatAgnikul</h2>
    </main>
  </body>
</html>
`

const loadAgnikulCosmosModule = async () => {
  try {
    return await import('../../scraper/agnikulcosmos/script.js')
  } catch {
    assert.fail('Expected Agnikul Cosmos scraper module at ../../scraper/agnikulcosmos/script.js')
  }
}

test('Agnikul Cosmos constants stay pinned to the verified first-party careers-card surface', async () => {
  const agnikulCosmos = await loadAgnikulCosmosModule()

  assert.equal(agnikulCosmos.SOURCE, 'agnikulcosmos')
  assert.equal(agnikulCosmos.COMPANY, 'Agnikul Cosmos')
  assert.equal(agnikulCosmos.OFFICIAL_BRAND_NAME, 'Agnikul Cosmos')
  assert.equal(agnikulCosmos.VERIFIED_ON, '2026-07-14')
  assert.equal(agnikulCosmos.HOMEPAGE_URL, 'https://www.agnikul.in/')
  assert.equal(agnikulCosmos.CAREERS_URL, 'https://www.agnikul.in/careers/')
  assert.equal(agnikulCosmos.APPLICATION_EMAIL, 'humancapital@agnikul.in')
  assert.equal(agnikulCosmos.APPLICATION_URL, 'mailto:humancapital@agnikul.in')
  assert.match(agnikulCosmos.VERIFIED_SURFACE_SUMMARY, /Launch Vehicle Operations Strategist/i)
  assert.equal(agnikulCosmos.hasOfficialCareersSurface(careersHtml), true)
})

test('extractOpenPositions maps Agnikul Cosmos public inline role cards', async () => {
  const agnikulCosmos = await loadAgnikulCosmosModule()
  const jobs = agnikulCosmos.extractOpenPositions(careersHtml)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'Power electronics Engineer',
    company: 'Agnikul Cosmos',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    state: null,
    country: 'India',
    jobId: 'agnikulcosmos-power-electronics-engineer-chennai-india',
    requisitionId: 'agnikulcosmos-power-electronics-engineer-chennai-india',
    sourceUrl: 'https://www.agnikul.in/careers/',
    applyUrl: 'mailto:humancapital@agnikul.in',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Power electronics Engineer',
      'Mission Design Software Developer',
      'Launch Vehicle Operations Strategist',
      'ERPNext Developer',
    ],
  )
})

test('run fetches the Agnikul Cosmos careers page and decorates runner metadata', async () => {
  const agnikulCosmos = await loadAgnikulCosmosModule()
  const requestedUrls = []

  const jobs = await agnikulCosmos.createAgnikulCosmosScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.agnikul.in/careers/'])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'agnikulcosmos')
  assert.equal(jobs[0].link, 'mailto:humancapital@agnikul.in')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the verified Agnikul Cosmos careers surface changes', async () => {
  const agnikulCosmos = await loadAgnikulCosmosModule()

  await assert.rejects(
    agnikulCosmos.createAgnikulCosmosScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>No public jobs here</p></body></html>',
    }),
    /verified Agnikul Cosmos careers surface/i,
  )
})
