import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>DeliverHealth - AI-Powered Healthcare Solutions | Clinical Documentation &amp; Patient Engagement</title>
  </head>
  <body>
    <h1>Improve Patient Care.</h1>
    <h1>Reduce Burdens.</h1>
    <p>We're looking for great people to join our growing team!</p>
    <h2>Open Positions</h2>
    <a href="https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=4228bffd-fe58-4423-b90e-accba06e7569&amp;ccId=19000101_000001&amp;lang=en_US">Browse Open Roles</a>
  </body>
</html>
`

const LEGACY_CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Healthcare Jobs & Careers | Join DeliverHealth</title>
    <script type="module" crossorigin src="/assets/index-BJwQdFGg.js"></script>
  </head>
  <body>
    <a href="https://ai.deliverhealth.com/careers">Careers</a>
  </body>
</html>
`

const BUNDLE_TEXT = `
Open Positions
Browse Open Roles
https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US
`

const ADP_BOARD_HTML = `
<!doctype html>
<html>
  <head><title>Recruitment</title></head>
  <body>
    <div id="recruitment_root"></div>
    <script>const applicationName = 'recruitment'</script>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/deliverhealthsolutions/script.js')
  } catch {
    assert.fail('Expected DeliverHealth Solutions scraper module at ../../scraper/deliverhealthsolutions/script.js')
  }
}

test('DeliverHealth Solutions exports stable ADP helpers and bundle validation', async () => {
  const deliverHealth = await loadScriptModule()

  assert.equal(deliverHealth.SOURCE, 'deliverhealthsolutions')
  assert.equal(deliverHealth.COMPANY, 'DeliverHealth Solutions')
  assert.equal(deliverHealth.OFFICIAL_BRAND_NAME, 'DeliverHealth')
  assert.equal(deliverHealth.CAREERS_PAGE_URL, 'https://ai.deliverhealth.com/careers')
  assert.equal(deliverHealth.hasOfficialCareersPageSignal(CURRENT_CAREERS_PAGE_HTML), true)
  assert.equal(deliverHealth.hasOfficialCareersPageSignal(LEGACY_CAREERS_PAGE_HTML), true)
  assert.equal(
    deliverHealth.extractOfficialAdpBoardUrl(CURRENT_CAREERS_PAGE_HTML),
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US',
  )
  assert.equal(
    deliverHealth.extractClientBundleUrl(LEGACY_CAREERS_PAGE_HTML),
    'https://ai.deliverhealth.com/assets/index-BJwQdFGg.js',
  )
  assert.equal(deliverHealth.hasOfficialAdpHandoffSignal(BUNDLE_TEXT), true)
  assert.equal(deliverHealth.hasOfficialAdpBoardSignal(ADP_BOARD_HTML), true)
  assert.match(deliverHealth.buildJobsApiUrl(), /cid=4228bffd-fe58-4423-b90e-accba06e7569/i)
  assert.match(deliverHealth.buildSearchFiltersApiUrl(), /getSearchFilters/i)
  assert.equal(
    deliverHealth.buildJobDetailUrl('DH-42'),
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US&jobId=DH-42',
  )
})

test('DeliverHealth Solutions run returns [] while the verified public ADP feeds are empty', async () => {
  const deliverHealth = await loadScriptModule()
  const requestedUrls = []

  const jobs = await deliverHealth.createDeliverHealthSolutionsScraper({
    now: () => '2026-07-18T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === deliverHealth.CAREERS_PAGE_URL) return CURRENT_CAREERS_PAGE_HTML
      if (url === deliverHealth.ADP_BOARD_URL) return ADP_BOARD_HTML
      throw new Error(`Unexpected DeliverHealth text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === deliverHealth.buildSearchFiltersApiUrl()) return { data: [], status: 'success' }
      if (url === deliverHealth.buildJobsApiUrl()) return { jobRequisitions: [] }
      throw new Error(`Unexpected DeliverHealth JSON URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    deliverHealth.CAREERS_PAGE_URL,
    deliverHealth.ADP_BOARD_URL,
    deliverHealth.buildSearchFiltersApiUrl(),
    deliverHealth.buildJobsApiUrl(),
  ])
})

test('DeliverHealth Solutions can preserve the empty-board sentinel when the first-party careers page times out but the verified ADP board and feeds still confirm zero jobs', async () => {
  const deliverHealth = await loadScriptModule()
  const requestedUrls = []

  const jobs = await deliverHealth.createDeliverHealthSolutionsScraper({
    now: () => '2026-08-15T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === deliverHealth.CAREERS_PAGE_URL) {
        throw new Error('fetch failed | Connect Timeout Error (attempted address: ai.deliverhealth.com:443, timeout: 10000ms)')
      }
      if (url === deliverHealth.ADP_BOARD_URL) return ADP_BOARD_HTML
      throw new Error(`Unexpected DeliverHealth text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === deliverHealth.buildSearchFiltersApiUrl()) return { data: [], status: 'success' }
      if (url === deliverHealth.buildJobsApiUrl()) return { jobRequisitions: [] }
      throw new Error(`Unexpected DeliverHealth JSON URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    deliverHealth.CAREERS_PAGE_URL,
    deliverHealth.ADP_BOARD_URL,
    deliverHealth.buildSearchFiltersApiUrl(),
    deliverHealth.buildJobsApiUrl(),
  ])
})

test('DeliverHealth Solutions still supports the legacy bundle-based ADP handoff when the direct board link is absent', async () => {
  const deliverHealth = await loadScriptModule()
  const requestedUrls = []

  const jobs = await deliverHealth.createDeliverHealthSolutionsScraper({
    now: () => '2026-08-15T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === deliverHealth.CAREERS_PAGE_URL) return LEGACY_CAREERS_PAGE_HTML
      if (url === 'https://ai.deliverhealth.com/assets/index-BJwQdFGg.js') return BUNDLE_TEXT
      if (url === deliverHealth.ADP_BOARD_URL) return ADP_BOARD_HTML
      throw new Error(`Unexpected DeliverHealth text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === deliverHealth.buildSearchFiltersApiUrl()) return { data: [], status: 'success' }
      if (url === deliverHealth.buildJobsApiUrl()) return { jobRequisitions: [] }
      throw new Error(`Unexpected DeliverHealth JSON URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    deliverHealth.CAREERS_PAGE_URL,
    'https://ai.deliverhealth.com/assets/index-BJwQdFGg.js',
    deliverHealth.ADP_BOARD_URL,
    deliverHealth.buildSearchFiltersApiUrl(),
    deliverHealth.buildJobsApiUrl(),
  ])
})

test('DeliverHealth Solutions fails closed when the careers page drifts away from the verified ADP handoff', async () => {
  const deliverHealth = await loadScriptModule()

  await assert.rejects(
    deliverHealth.createDeliverHealthSolutionsScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchJson: async () => ({ data: [] }),
    }),
    /verified official DeliverHealth careers page/i,
  )
})
