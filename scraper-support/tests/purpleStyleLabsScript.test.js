import assert from 'node:assert/strict'
import test from 'node:test'

const LINKEDIN_JOBS_URL = 'https://www.linkedin.com/jobs/search/?currentJobId=3746385482&f_C=10277228&geoId=92000000&origin=COMPANY_PAGE_JOBS_CLUSTER_EXPANSION&originToLandingJobPostings=3746385482%2C3740026849%2C3750818962%2C3750604957%2C3750868095%2C3735648526%2C3743277259%2C3746273670'
const LINKEDIN_JOBS_URL_ESCAPED = 'https://www.linkedin.com/jobs/search/?currentJobId=3746385482&amp;f_C=10277228&amp;geoId=92000000&amp;origin=COMPANY_PAGE_JOBS_CLUSTER_EXPANSION&amp;originToLandingJobPostings=3746385482%2C3740026849%2C3750818962%2C3750604957%2C3750868095%2C3735648526%2C3743277259%2C3746273670'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
  <html lang="en">
  <head>
    <title>Purple Style Labs</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Love the business of Luxury? You’d fit right in at Purple Style Labs!</p>
      <p>Join Us!</p>
      <p>If you identify as an innovative thinker and luxury products get you going, drop us an email at careers@purplestylelabs.com</p>
      <a href="${LINKEDIN_JOBS_URL_ESCAPED}">BROWSE OPPORTUNITIES</a>
      <form>
        <label>Job position that you are looking for.</label>
      </form>
    </main>
  </body>
</html>
`

const OFFICIAL_CAREERS_WITH_VISIBLE_JOBS_HTML = OFFICIAL_CAREERS_HTML.replace(
  '</form>',
  '</form><a href="https://jobs.lever.co/purplestylelabs/senior-frontend-developer">Apply Now</a>',
)

const loadPurpleStyleLabsModule = async () => {
  try {
    return await import('../../scraper/purplestylelabs/script.js')
  } catch {
    assert.fail('Expected Purple Style Labs scraper module at ../../scraper/purplestylelabs/script.js')
  }
}

test('Purple Style Labs helpers pin the official careers page and verified LinkedIn jobs filter contract', async () => {
  const purpleStyleLabs = await loadPurpleStyleLabsModule()

  assert.equal(purpleStyleLabs.SOURCE, 'purplestylelabs')
  assert.equal(purpleStyleLabs.COMPANY, 'Purple Style Labs')
  assert.equal(purpleStyleLabs.HOMEPAGE_URL, 'https://www.purplestylelabs.com/')
  assert.equal(purpleStyleLabs.CAREERS_URL, 'https://www.purplestylelabs.com/careers')
  assert.equal(purpleStyleLabs.CAREERS_EMAIL, 'careers@purplestylelabs.com')
  assert.equal(purpleStyleLabs.LINKEDIN_COMPANY_ID, '10277228')
  assert.equal(purpleStyleLabs.VERIFIED_ON, '2026-08-04')
  assert.equal(purpleStyleLabs.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    purpleStyleLabs.extractLinkedInJobsUrl(OFFICIAL_CAREERS_HTML),
    LINKEDIN_JOBS_URL,
  )
  assert.equal(purpleStyleLabs.isVerifiedLinkedInJobsUrl(LINKEDIN_JOBS_URL), true)
  assert.equal(purpleStyleLabs.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_HTML), false)
  assert.equal(
    purpleStyleLabs.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_WITH_VISIBLE_JOBS_HTML),
    true,
  )
})

test('Purple Style Labs returns [] only while the official careers page still exposes a LinkedIn jobs handoff without a first-party public jobs board', async () => {
  const purpleStyleLabs = await loadPurpleStyleLabsModule()
  const requests = []

  const jobs = await purpleStyleLabs.createPurpleStyleLabsScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === purpleStyleLabs.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      throw new Error(`Unexpected Purple Style Labs URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [purpleStyleLabs.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Purple Style Labs fails closed when the official careers page changes materially or starts exposing a trustworthy public jobs contract', async () => {
  const purpleStyleLabs = await loadPurpleStyleLabsModule()

  await assert.rejects(
    purpleStyleLabs.createPurpleStyleLabsScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    purpleStyleLabs.createPurpleStyleLabsScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_WITH_VISIBLE_JOBS_HTML,
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    purpleStyleLabs.createPurpleStyleLabsScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_HTML.replace('f_C=10277228', 'f_C=99999999'),
    }),
    /linkedin jobs handoff/i,
  )
})
