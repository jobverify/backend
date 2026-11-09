import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - A Lifetime Opportunity to Shape Your Career | Testbook</title>
    <link rel="canonical" href="https://testbook.com/careers" />
  </head>
  <body>
    <!-- Good to see you here, we are hiring! http://testbook.com/careers -->
    <h1>Careers</h1>
    <div class="heading">
      <a href="https://testbook.hire.trakstar.com/?q=&sort_by=most_recent&limit=25" target="_self">Explore Open Positions</a>
    </div>
    <div class="each-oppor">
      <a href="https://testbook.hire.trakstar.com/?team_id=419&q=&sort_by=most_recent&limit=25" target="_self">
        <h3>Content</h3>
        <span>View open positions</span>
      </a>
    </div>
    <a href="https://jobs.plutuseducation.com" class="btn js-header-link" target="_self">Jobs</a>
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

const loadTestbookModule = async () => {
  try {
    return await import('../../scraper/testbook/script.js')
  } catch {
    assert.fail('Expected Testbook scraper module at ../../scraper/testbook/script.js')
  }
}

test('Testbook pins the verified first-party careers page and current dead hiring handoffs', async () => {
  const testbook = await loadTestbookModule()

  assert.equal(testbook.SOURCE, 'testbook')
  assert.equal(testbook.COMPANY, 'Testbook')
  assert.equal(testbook.VERIFIED_ON, '2026-07-25')
  assert.equal(testbook.OFFICIAL_SITE_URL, 'https://testbook.com/')
  assert.equal(testbook.CAREERS_PAGE_URL, 'https://testbook.com/careers')
  assert.equal(testbook.LEGACY_JOBS_URL, 'https://jobs.plutuseducation.com/')
  assert.equal(
    testbook.TRAKSTAR_BOARD_URL,
    'https://testbook.hire.trakstar.com/?q=&sort_by=most_recent&limit=25',
  )
  assert.equal(testbook.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(testbook.hasLegacyJobsSiteNotFoundSignal(legacyJobsHtml), true)
  assert.equal(testbook.hasTrakstarUnverifiedSignal(trakstarHtml), true)
})

test('Testbook returns [] only while both public hiring handoffs stay dead', async () => {
  const testbook = await loadTestbookModule()
  const requestedUrls = []

  const jobs = await testbook.createTestbookScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === testbook.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersHtml }
      }
      if (url === testbook.LEGACY_JOBS_URL) {
        return { status: 404, url, html: legacyJobsHtml }
      }
      if (url === testbook.TRAKSTAR_BOARD_URL) {
        return { status: 404, url, html: trakstarHtml }
      }

      throw new Error(`Unexpected Testbook URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    testbook.CAREERS_PAGE_URL,
    testbook.LEGACY_JOBS_URL,
    testbook.TRAKSTAR_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Testbook fails closed when the official page drifts or a dead hiring handoff becomes live', async () => {
  const testbook = await loadTestbookModule()

  await assert.rejects(
    testbook.createTestbookScraper().run({
      fetchPage: async () => ({ status: 200, url: testbook.CAREERS_PAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    testbook.createTestbookScraper().run({
      fetchPage: async (url) => {
        if (url === testbook.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }
        if (url === testbook.LEGACY_JOBS_URL) {
          return { status: 200, url, html: '<html><body>Now live</body></html>' }
        }
        return { status: 404, url, html: trakstarHtml }
      },
    }),
    /legacy jobs host changed materially/i,
  )

  await assert.rejects(
    testbook.createTestbookScraper().run({
      fetchPage: async (url) => {
        if (url === testbook.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }
        if (url === testbook.LEGACY_JOBS_URL) {
          return { status: 404, url, html: legacyJobsHtml }
        }
        return { status: 200, url, html: '<html><body>Open positions</body></html>' }
      },
    }),
    /trakstar board changed materially/i,
  )
})
