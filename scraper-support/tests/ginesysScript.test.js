import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Ginesys – Join India’s Leading Retail Tech Company</title>
  </head>
  <body>
    <main>
      <h1>Believe in Yourself. We believe in you</h1>
      <h2>Open Positions</h2>
      <a href="/open-positions">Explore</a>
    </main>
  </body>
</html>
`

const openPositionsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="open-position">
      <h1 class="text-align-center">Want to work with us?</h1>
      <script>
        window.khConfig = {
          identifier: '81ab5744-744b-438a-8efe-4fbde810ebaa',
          domain: 'https://ginesysone.keka.com/careers/',
          targetContainer: '#embedjobscontainer'
        }
      </script>
      <script src="https://ginesysone.keka.com/careers/api/embedjobs/js/81ab5744-744b-438a-8efe-4fbde810ebaa" defer></script>
    </div>
  </body>
</html>
`

const portalInfo = {
  name: 'Ginni Systems Ltd.',
  shortName: 'Ginni Systems Ltd.',
  careersPortalDomain: 'ginesysone.keka.com',
}

const activeJobsPayload = [
  {
    id: 143187,
    title: 'Executive - Talent Acquisition',
    description: '<div>Handle end-to-end recruitment for technology positions.</div>',
    departmentName: 'Human Resources',
    experience: '2-4 Years in IT Recruitment / Technical Hiring',
    publishedOn: '2026-06-03T09:42:57.430Z',
    jobType: 2,
    jobLocations: [
      {
        name: 'Gurgaon',
        city: 'Gurgaon',
        state: 'HR',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
  },
  {
    id: 141321,
    title: 'Cloud Architect',
    description: '<div>Lead cloud platform and architecture decisions.</div>',
    departmentName: 'Engineering',
    experience: '8-12 Years',
    publishedOn: '2026-05-20T06:41:04.483Z',
    jobType: 2,
    jobLocations: [
      {
        name: 'Kolkata',
        city: 'Kolkata',
        state: 'WB',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/ginesys/script.js')
  } catch {
    assert.fail('Expected Ginesys scraper module at ../../scraper/ginesys/script.js')
  }
}

test('Ginesys helpers stay pinned to the verified shell, Keka handoff, and active jobs payload', async () => {
  const ginesys = await loadModule()

  assert.equal(ginesys.SOURCE, 'ginesys')
  assert.equal(ginesys.COMPANY, 'Ginesys')
  assert.equal(ginesys.CAREERS_URL, 'https://www.ginesys.in/careers')
  assert.equal(ginesys.OPEN_POSITIONS_URL, 'https://www.ginesys.in/open-positions')
  assert.equal(ginesys.EXTERNAL_HANDOFF_URL, 'https://ginesysone.keka.com/careers/')
  assert.equal(ginesys.VERIFIED_ON, '2026-07-17')
  assert.equal(ginesys.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(ginesys.extractCareerConfig(openPositionsHtml), {
    identifier: '81ab5744-744b-438a-8efe-4fbde810ebaa',
    domain: 'https://ginesysone.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    ginesys.buildCareerPortalInfoUrl(ginesys.extractCareerConfig(openPositionsHtml)),
    'https://ginesysone.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    ginesys.buildActiveJobsUrl(ginesys.extractCareerConfig(openPositionsHtml)),
    'https://ginesysone.keka.com/careers/api/embedjobs/default/active/81ab5744-744b-438a-8efe-4fbde810ebaa',
  )
  assert.equal(ginesys.hasExpectedPortalIdentity(portalInfo), true)
  assert.equal(ginesys.extractIndiaJobs(activeJobsPayload).length, 2)
})

test('Ginesys run validates the first-party shell and returns India jobs from the Keka embed API', async () => {
  const ginesys = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await ginesys.createGinesysScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === ginesys.CAREERS_URL) return careersHtml
      if (url === ginesys.OPEN_POSITIONS_URL) return openPositionsHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://ginesysone.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://ginesysone.keka.com/careers/api/embedjobs/default/active/81ab5744-744b-438a-8efe-4fbde810ebaa') {
        return activeJobsPayload
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    ginesys.CAREERS_URL,
    ginesys.OPEN_POSITIONS_URL,
  ])
  assert.deepEqual(requestedJson, [
    'https://ginesysone.keka.com/careers/api/organization/default/careerportalinfo',
    'https://ginesysone.keka.com/careers/api/embedjobs/default/active/81ab5744-744b-438a-8efe-4fbde810ebaa',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'ginesys')
  assert.equal(jobs[0].companyCareerPage, 'https://www.ginesys.in/careers')
  assert.equal(jobs[0].companyDomain, 'ginesys.in')
  assert.equal(jobs[0].atsPlatform, 'keka-embed-api')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Ginesys fails closed when the first-party shell, Keka config, or portal identity changes', async () => {
  const ginesys = await loadModule()

  await assert.rejects(
    ginesys.createGinesysScraper().run({
      fetchText: async (url) => (url === ginesys.CAREERS_URL ? '<html><body><h1>Careers</h1></body></html>' : openPositionsHtml),
      fetchJson: async () => activeJobsPayload,
    }),
    /verified Ginesys careers shell/i,
  )

  await assert.rejects(
    ginesys.createGinesysScraper().run({
      fetchText: async (url) => {
        if (url === ginesys.CAREERS_URL) return careersHtml
        return openPositionsHtml.replace('81ab5744-744b-438a-8efe-4fbde810ebaa', 'broken-identifier')
      },
      fetchJson: async () => activeJobsPayload,
    }),
    /verified Ginesys keka surface/i,
  )

  await assert.rejects(
    ginesys.createGinesysScraper().run({
      fetchText: async (url) => (url === ginesys.CAREERS_URL ? careersHtml : openPositionsHtml),
      fetchJson: async (url) => {
        if (url.includes('careerportalinfo')) return { ...portalInfo, name: 'Different Company' }
        return activeJobsPayload
      },
    }),
    /exact company identity/i,
  )
})
