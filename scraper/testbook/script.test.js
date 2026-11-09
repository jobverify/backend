import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers - A Lifetime Opportunity to Shape Your Career | Testbook</h1>
    <section>
      <h2>Explore Open Positions</h2>
      <a href="https://jobs.plutuseducation.com/">Legacy jobs</a>
      <a href="https://testbook.hire.trakstar.com/?q=&sort_by=most_recent&limit=25">View open positions</a>
    </section>
  </body>
</html>
`

const legacyJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Site Not Found | Framer</title>
  </head>
  <body>
    <h1>Site Not Found</h1>
    <p>There is no site configured at this address.</p>
  </body>
</html>
`

const trakstarHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Unverified account.</h1>
    <p>This employer is no longer using Trakstar Hire to collect applications.</p>
    <p>Please contact the employer directly for information on how to apply.</p>
  </body>
</html>
`

test('Testbook recognizes the current careers page and verified zero-job downstream handoffs', async () => {
  const testbook = await loadModule()

  assert.equal(testbook.SOURCE, 'testbook')
  assert.equal(testbook.COMPANY, 'Testbook')
  assert.equal(testbook.CAREERS_PAGE_URL, 'https://testbook.com/careers')
  assert.equal(testbook.LEGACY_JOBS_URL, 'https://jobs.plutuseducation.com/')
  assert.equal(testbook.TRAKSTAR_BOARD_URL, 'https://testbook.hire.trakstar.com/?q=&sort_by=most_recent&limit=25')
  assert.equal(testbook.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(testbook.hasLegacyJobsSiteNotFoundSignal(legacyJobsHtml), true)
  assert.equal(testbook.hasTrakstarUnverifiedSignal(trakstarHtml), true)
})

test('Testbook run returns no jobs while the verified public zero-job contract holds', async () => {
  const testbook = await loadModule()

  const requestedUrls = []
  const jobs = await testbook.createTestbookScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === testbook.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }
      if (url === testbook.LEGACY_JOBS_URL) {
        return { status: 404, url, html: legacyJobsHtml }
      }
      if (url === testbook.TRAKSTAR_BOARD_URL) {
        return { status: 404, url, html: trakstarHtml }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    testbook.CAREERS_PAGE_URL,
    testbook.LEGACY_JOBS_URL,
    testbook.TRAKSTAR_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})
