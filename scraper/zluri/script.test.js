import assert from 'node:assert/strict'
import test from 'node:test'

const loadZluriModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Zluri scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Zluri</title>
    <link rel="canonical" href="https://www.zluri.com/careers">
  </head>
  <body>
    <a href="#opportunities">Open opportunities</a>
    <section id="opportunities">
      <div id="khembedjobs"></div>
    </section>
    <script src="https://zluri.keka.com/careers/api/embedjobs/js/ed2b6b25-be74-43f1-9a38-c3bf27b9146c"></script>
    <script>
      const config = {
        identifier: 'ed2b6b25-be74-43f1-9a38-c3bf27b9146c',
        domain: 'https://zluri.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
  </body>
</html>
`

const portalInfoPayload = {
  name: 'Zluri',
  shortName: 'Zluri',
  careersPortalDomain: 'zluri.keka.com',
}

const activeJobsPayload = [
  {
    id: '80996',
    title: 'Senior Product Manager',
    departmentName: 'Product & Design',
    jobType: 2,
    experience: '4-7 years',
    publishedOn: '2026-07-21T00:00:00.000Z',
    description: 'Lead product strategy for identity security.',
    jobLocations: [
      {
        city: 'Bangalore',
        state: 'KA',
        countryCode: 'IN',
      },
    ],
  },
  {
    id: '73315',
    title: 'Senior Customer Success Manager',
    departmentName: 'Customer Success',
    jobType: 2,
    experience: '5-8 years',
    publishedOn: '2026-07-18T00:00:00.000Z',
    description: 'Support the US timezone.',
    jobLocations: [
      {
        city: 'San Francisco',
        state: 'CA',
        countryCode: 'US',
      },
    ],
  },
]

test('Zluri accepts the current Keka-embedded official careers page contract', async () => {
  const zluri = await loadZluriModule()

  assert.equal(zluri.SOURCE, 'zluri')
  assert.equal(zluri.VERIFIED_ON, '2026-08-02')
  assert.equal(zluri.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.deepEqual(zluri.extractEmbeddedKekaConfig(officialCareersHtml), {
    identifier: zluri.EXPECTED_KEKA_IDENTIFIER,
    domain: zluri.KEKA_BOARD_URL,
    targetContainer: zluri.EXPECTED_TARGET_CONTAINER,
  })
  assert.equal(zluri.hasExpectedPortalIdentity(portalInfoPayload), true)
})

test('Zluri returns India jobs from the verified public Keka payload', async () => {
  const zluri = await loadZluriModule()
  const requestedUrls = []

  const jobs = await zluri.createZluriScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === zluri.CAREER_PORTAL_INFO_URL) return portalInfoPayload
      if (url === zluri.ACTIVE_JOBS_URL) return activeJobsPayload
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-02T19:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    zluri.CAREERS_URL,
    zluri.CAREER_PORTAL_INFO_URL,
    zluri.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Product Manager')
  assert.equal(jobs[0].location, 'Bangalore, KA, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, 'https://zluri.keka.com/careers/applyjob/80996')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T19:30:00.000Z')
})
