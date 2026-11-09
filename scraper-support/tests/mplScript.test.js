import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Play Games on MPL</title>
  </head>
  <body>
    <section>
      <p>Deposits are no longer available on the MPL app.</p>
      <p>In compliance with law, no cash games are available on MPL.</p>
      <a href="/help">Help</a>
    </section>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>MPL Careers</title>
  </head>
  <body>
    <h1>Careers at MPL</h1>
    <a href="/jobs/senior-backend-engineer">Apply now</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Senior Backend Engineer" }
    </script>
  </body>
</html>
`

const loadMplModule = async () => {
  try {
    return await import('../../scraper/mpl/script.js')
  } catch {
    assert.fail('Expected MPL scraper module at ../../scraper/mpl/script.js')
  }
}

test('MPL sentinel helpers stay pinned to the verified exact-name homepage contract', async () => {
  const mpl = await loadMplModule()

  assert.equal(mpl.SOURCE, 'mpl')
  assert.equal(mpl.COMPANY, 'MPL')
  assert.equal(mpl.OFFICIAL_BRAND_NAME, 'Mobile Premier League (MPL)')
  assert.equal(mpl.HOMEPAGE_URL, 'https://www.mpl.live/')
  assert.equal(mpl.CAREERS_URL, 'https://www.mpl.live/')
  assert.equal(mpl.COMPANY_DOMAIN, 'mpl.live')
  assert.equal(mpl.VERIFIED_ON, '2026-07-16')
  assert.equal(mpl.hasVerifiedMplHomepageSignal(VERIFIED_HOMEPAGE_HTML), true)
  assert.equal(mpl.hasPublicMplJobSignals(VERIFIED_HOMEPAGE_HTML), false)
  assert.equal(mpl.hasPublicMplJobSignals(PUBLIC_JOBS_HTML), true)
})

test('MPL returns [] only while the exact-name first-party homepage exposes no public jobs surface', async () => {
  const mpl = await loadMplModule()
  const requestedUrls = []

  const jobs = await mpl.createMplScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mpl.CAREERS_URL) return VERIFIED_HOMEPAGE_HTML
      throw new Error(`Unexpected MPL URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [mpl.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('MPL fails closed when the exact-name first-party surface starts exposing public job signals', async () => {
  const mpl = await loadMplModule()

  await assert.rejects(
    mpl.createMplScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /public jobs surface/i,
  )
})

test('MPL fails closed when the verified homepage signal drifts away from the known exact-name surface', async () => {
  const mpl = await loadMplModule()

  await assert.rejects(
    mpl.createMplScraper().run({
      fetchText: async () => '<html><head><title>Unexpected Page</title></head><body>Something else</body></html>',
    }),
    /no longer matches the verified homepage surface/i,
  )
})
