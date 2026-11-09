import assert from 'node:assert/strict'
import test from 'node:test'

const loadToshibaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Toshiba scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>We turn on the promise of a new day.</h1>
      <p>Toshiba is not currently accepting applications.</p>
      <a href="https://www.global.toshiba/ww/recruit/corporate/ourteams/jump.html">
        Job Openings &amp; Apply
      </a>
    </main>
  </body>
</html>
`

const currentOfficialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>We turn on the promise of a new day.</h1>
      <a href="/ww/recruit/corporate/worklife.html">Life at Toshiba</a>
      <a href="https://www.global.toshiba/ww/recruit/corporate/ourteams/jump.html">
        Job Openings &amp; Apply
      </a>
    </main>
  </body>
</html>
`

const officialJobsHandoffHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Link to third-party website</h1>
      <p>Please click “View Jobs” to move to HRMOS Recruitment page offered by BizReach, Inc.</p>
      <a href="https://hrmos.co/pages/toshiba/">View Jobs (HRMOS)</a>
    </main>
  </body>
</html>
`

const currentHrmosBoardUrl = 'https://hrmos.co/pages/toshiba/jobs?category=1490198329516470272'

const currentOfficialJobsHandoffHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Link to third-party website</h1>
      <p>Please click “View Jobs” to move to HRMOS Recruitment page offered by BizReach, Inc.</p>
      <a href="${currentHrmosBoardUrl}">View Jobs (HRMOS)</a>
    </main>
  </body>
</html>
`

const hrmosBoardHtml = `
<!doctype html>
<html lang="ja">
  <body>
    <main>
      <h1>株式会社東芝 採用情報</h1>
      <h2>この会社の求人を探す</h2>
      <p>141 件の検索結果を表示する</p>
      <section>
        <h3>勤務地</h3>
        <ul>
          <li>首都圏 (86)</li>
          <li>北海道・東北 (6)</li>
          <li>北信越 (7)</li>
          <li>関西 (8)</li>
          <li>九州 (4)</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`

test('Toshiba scraper validates the verified official careers handoff and current Japan-only public HRMOS board', async () => {
  const toshiba = await loadToshibaModule()

  assert.equal(toshiba.SOURCE, 'toshiba')
  assert.equal(toshiba.COMPANY, 'Toshiba')
  assert.equal(toshiba.CAREERS_URL, 'https://www.global.toshiba/ww/recruit/corporate.html')
  assert.equal(toshiba.JOBS_HANDOFF_URL, 'https://www.global.toshiba/ww/recruit/corporate/ourteams/jump.html')
  assert.equal(toshiba.HRMOS_BOARD_URL, 'https://hrmos.co/pages/toshiba/')
  assert.equal(toshiba.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(toshiba.hasOfficialCareersSignal(currentOfficialCareersHtml), true)
  assert.equal(toshiba.extractHandoffUrl(officialCareersHtml), toshiba.JOBS_HANDOFF_URL)
  assert.equal(toshiba.hasOfficialJobsHandoffSignal(officialJobsHandoffHtml), true)
  assert.equal(toshiba.extractHrmosBoardUrl(officialJobsHandoffHtml), toshiba.HRMOS_BOARD_URL)
  assert.equal(toshiba.extractHrmosBoardUrl(currentOfficialJobsHandoffHtml), currentHrmosBoardUrl)
  assert.equal(toshiba.hasHrmosBoardSignal(hrmosBoardHtml), true)
  assert.equal(toshiba.hasIndiaJobsSignal(hrmosBoardHtml), false)
})

test('Toshiba scraper returns no jobs while the official public board remains Japan-only', async () => {
  const toshiba = await loadToshibaModule()
  const requestedUrls = []

  const jobs = await toshiba.createToshibaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === toshiba.CAREERS_URL) return officialCareersHtml
      if (url === toshiba.JOBS_HANDOFF_URL) return officialJobsHandoffHtml
      if (url === toshiba.HRMOS_BOARD_URL) return hrmosBoardHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    toshiba.CAREERS_URL,
    toshiba.JOBS_HANDOFF_URL,
    toshiba.HRMOS_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Toshiba scraper follows the current Toshiba HRMOS jobs URL when the handoff is category-filtered', async () => {
  const toshiba = await loadToshibaModule()
  const requestedUrls = []

  const jobs = await toshiba.createToshibaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === toshiba.CAREERS_URL) return currentOfficialCareersHtml
      if (url === toshiba.JOBS_HANDOFF_URL) return currentOfficialJobsHandoffHtml
      if (url === currentHrmosBoardUrl) return hrmosBoardHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    toshiba.CAREERS_URL,
    toshiba.JOBS_HANDOFF_URL,
    currentHrmosBoardUrl,
  ])
  assert.deepEqual(jobs, [])
})

test('Toshiba scraper fails closed when the official careers handoff or public board changes', async () => {
  const toshiba = await loadToshibaModule()

  await assert.rejects(
    toshiba.createToshibaScraper().run({
      fetchText: async () => '<main><h1>Toshiba careers</h1></main>',
    }),
    /verified official public careers surface/i,
  )

  await assert.rejects(
    toshiba.createToshibaScraper().run({
      fetchText: async (url) => {
        if (url === toshiba.CAREERS_URL) return officialCareersHtml
        if (url === toshiba.JOBS_HANDOFF_URL) return '<main><h1>Third-party jobs</h1></main>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official jobs handoff/i,
  )

  await assert.rejects(
    toshiba.createToshibaScraper().run({
      fetchText: async (url) => {
        if (url === toshiba.CAREERS_URL) return officialCareersHtml
        if (url === toshiba.JOBS_HANDOFF_URL) return officialJobsHandoffHtml
        if (url === toshiba.HRMOS_BOARD_URL) {
          return `
            ${hrmosBoardHtml}
            <section>
              <h3>勤務地</h3>
              <ul>
                <li>India (3)</li>
              </ul>
            </section>
          `
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs board now exposes india openings or changed shape/i,
  )
})
