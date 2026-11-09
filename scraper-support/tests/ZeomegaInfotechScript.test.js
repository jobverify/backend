import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers (India)</h1>
      <p>Push the boundaries holding healthcare back and experience what it's like to create real change.</p>
      <a
        href="https://career10.successfactors.com/career?company=zeomegainf&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH"
      >
        Available Careers
      </a>
      <h2>Working at ZeOmega</h2>
      <h3>Employee Benefits</h3>
      <a
        href="https://career10.successfactors.com/career?company=zeomegainf&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH"
      >
        Take The Next Step
      </a>
    </main>
  </body>
</html>
`

const boardErrorHtml = `
<html>
  <body>
    <div class="sysmsg error">
      <strong>An error occurred while processing your request. Please go back to your original page and check the URL. Then try your request again.</strong>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/zeomegainfotech/script.js')
  } catch {
    assert.fail('Expected Zeomega Infotech scraper module at ../../scraper/zeomegainfotech/script.js')
  }
}

test('Zeomega Infotech helpers stay pinned to the verified India careers handoff and blocked board from Saturday, July 18, 2026', async () => {
  const zeomega = await loadModule()

  assert.equal(zeomega.SOURCE, 'zeomegainfotech')
  assert.equal(zeomega.COMPANY, 'Zeomega Infotech')
  assert.equal(zeomega.CAREERS_URL, 'https://www.zeomega.com/company/careers-india')
  assert.match(zeomega.BOARD_URL, /^https:\/\/career10\.successfactors\.com\/career\?company=zeomegainf/i)
  assert.equal(zeomega.VERIFIED_ON, '2026-07-18')
  assert.equal(zeomega.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(zeomega.hasBlockedBoardSignal(boardErrorHtml), true)
})

test('Zeomega Infotech returns [] while the first-party board stays blocked behind an error page', async () => {
  const zeomega = await loadModule()
  const requestedUrls = []

  const jobs = await zeomega.createZeomegaInfotechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === zeomega.CAREERS_URL) return careersPageHtml
      if (url === zeomega.BOARD_URL) return boardErrorHtml
      throw new Error(`Unexpected Zeomega Infotech URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [zeomega.CAREERS_URL, zeomega.BOARD_URL])
  assert.deepEqual(jobs, [])
})

test('Zeomega Infotech fails closed when the handoff page or blocked board signature drift', async () => {
  const zeomega = await loadModule()

  await assert.rejects(
    zeomega.createZeomegaInfotechScraper().run({
      fetchText: async (url) => (url === zeomega.CAREERS_URL ? '<html><body>Careers</body></html>' : boardErrorHtml),
    }),
    /verified ZeOmega India careers surface/i,
  )

  await assert.rejects(
    zeomega.createZeomegaInfotechScraper().run({
      fetchText: async (url) => (url === zeomega.CAREERS_URL ? careersPageHtml : '<html><body><h1>Open Jobs</h1></body></html>'),
    }),
    /blocked SuccessFactors/i,
  )
})
