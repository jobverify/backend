import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Our Journey From a Lending App to a Financial Management Partner</h1>
      <a href="https://smartcoin.keka.com/careers">Jobs</a>
      <footer>
        <p>SmartCoin Financials Pvt. Ltd.</p>
        <p>help@smartcoin.co.in</p>
      </footer>
    </main>
  </body>
</html>
`

const EMPTY_KEKA_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body></body>
</html>
`

const BOOTSTRAP_KEKA_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="robots" content="noindex">
    <script>
      window.isCareersPage = true;
    </script>
  </head>
  <body>
    <div id="content-container"></div>
    <script>
      fetch('/ats/documents/a6d6f744-09bc-4a25-8a31-edb4868b09bc/careerportal/50951899fde2472ba9b69ebb60f3938e.html')
    </script>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://smartcoin.keka.com/careers/jobdetails/72002">Legal Associate Collection</a>
    <a href="https://smartcoin.keka.com/careers/applyjob/72002">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/smartcoin/script.js')
  } catch {
    assert.fail('Expected SmartCoin scraper module at ../../scraper/smartcoin/script.js')
  }
}

test('SmartCoin sentinel helpers stay pinned to the verified Olyv page, Keka handoff, and portal identity', async () => {
  const smartcoin = await loadModule()

  assert.equal(smartcoin.SOURCE, 'smartcoin')
  assert.equal(smartcoin.COMPANY, 'SmartCoin')
  assert.equal(smartcoin.OFFICIAL_BRAND_NAME, 'SmartCoin Financials Pvt. Ltd.')
  assert.equal(smartcoin.VERIFIED_ON, '2026-07-17')
  assert.equal(smartcoin.CAREERS_PAGE_URL, 'https://www.olyv.co.in/about-us')
  assert.equal(smartcoin.OFFICIAL_CAREERS_HANDOFF_URL, 'https://smartcoin.keka.com/careers')
  assert.match(smartcoin.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(smartcoin.hasOfficialCareersSignal(OFFICIAL_ABOUT_HTML), true)
  assert.equal(
    smartcoin.extractOfficialKekaHandoffUrl(OFFICIAL_ABOUT_HTML),
    'https://smartcoin.keka.com/careers',
  )
  assert.equal(smartcoin.pageExposesPublicJobListings(OFFICIAL_ABOUT_HTML), false)
  assert.equal(smartcoin.pageExposesPublicJobListings(EMPTY_KEKA_SHELL_HTML), false)
  assert.equal(smartcoin.pageExposesPublicJobListings(BOOTSTRAP_KEKA_SHELL_HTML), false)
  assert.equal(smartcoin.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    smartcoin.matchesVerifiedOpaqueKekaState({
      status: 200,
      url: smartcoin.OFFICIAL_CAREERS_HANDOFF_URL,
      html: EMPTY_KEKA_SHELL_HTML,
    }),
    true,
  )
  assert.equal(
    smartcoin.matchesVerifiedOpaqueKekaState({
      status: 200,
      url: smartcoin.OFFICIAL_CAREERS_HANDOFF_URL,
      html: BOOTSTRAP_KEKA_SHELL_HTML,
    }),
    true,
  )
})

// Olyv now exposes a verifiable native inventory, superseding the opaque-shell sentinel.
test('SmartCoin recovers the November 6 independently proven India roles and retains unknown geography', async () => {
  const smartcoin = await loadModule()
  const { transport } = await import('../../scraper/smartcoin/native.fixture.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const jobs = await smartcoin.createSmartCoinScraper().run({ fetchImpl: transport() })
  assert.equal(jobs.length, 40)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 42)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.deepEqual(jobs[0].sourceCountryCoverageGapIds, ['146578', '143507'])
})
test('SmartCoin rejects legacy page transport instead of silently using the network', async () => {
  const smartcoin = await loadModule()
  await assert.rejects(smartcoin.createSmartCoinScraper().run({ fetchPage: async () => ({status:200,url:smartcoin.CAREERS_PAGE_URL,html:OFFICIAL_ABOUT_HTML}) }), /unsupported legacy transport/)
})
