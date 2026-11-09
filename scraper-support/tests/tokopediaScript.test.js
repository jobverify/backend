import assert from 'node:assert/strict'
import test from 'node:test'

const GOTO_CAREERS_HTML = `
<!doctype html>
<html lang="id">
  <body>
    <main>
      <h1>Temukan Peluang Karier Anda Telusuri Beragam Pilihan Karier di GoTo</h1>
      <p>0 pekerjaan tersedia di semua departemen dan di semua lokasi</p>
      <p>Temukan pekerjaan di ekosistem kami</p>
      <h2>Karier di Gojek</h2>
      <h2>Karier di GoTo Financial</h2>
    </main>
  </body>
</html>
`

const TOKOPEDIA_REFERENCE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>CAUTION: GoTo Group | Fake Job listings - What you should be aware of</h1>
      <p>All authentic job postings from any of GoTo's operating companies would be listed on the respective company's official websites or their official LinkedIn pages.</p>
      <h2>Career Sites</h2>
      <a href="https://career.gojek.com">Gojek Career</a>
      <a href="https://tokopedia.darwinbox.com/ms/candidate/careers">Tokopedia Career</a>
      <a href="https://gotofinancial.com">GoTo Financial Services Careers</a>
    </main>
  </body>
</html>
`

const OPAQUE_DARWINBOX_SHELL = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title></title>
    <base href="/ms/candidate/">
  </head>
  <body>
    <noscript>Please enable Javascript!</noscript>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <h2>Software Engineer</h2>
    <a href="https://tokopedia.darwinbox.com/ms/candidate/careers/software-engineer">View job</a>
    <a href="https://tokopedia.darwinbox.com/ms/candidate/careers/software-engineer/apply">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tokopedia/script.js')
  } catch {
    assert.fail('Expected Tokopedia scraper module at ../../scraper/tokopedia/script.js')
  }
}

test('Tokopedia sentinel helpers stay pinned to the verified GoTo reference and opaque Darwinbox shell', async () => {
  const tokopedia = await loadModule()

  assert.equal(tokopedia.SOURCE, 'tokopedia')
  assert.equal(tokopedia.COMPANY, 'Tokopedia')
  assert.equal(tokopedia.OFFICIAL_BRAND_NAME, 'Tokopedia')
  assert.equal(tokopedia.VERIFIED_ON, '2026-08-06')
  assert.equal(tokopedia.GOTO_CAREERS_URL, 'https://www.gotocompany.com/careers')
  assert.equal(
    tokopedia.TOKOPEDIA_REFERENCE_URL,
    'https://www.gotocompany.com/en/news/press/goto-group-fake-job-listings',
  )
  assert.equal(
    tokopedia.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://tokopedia.darwinbox.com/ms/candidate/careers',
  )
  assert.match(tokopedia.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(tokopedia.hasOfficialGroupCareersSignal(GOTO_CAREERS_HTML), true)
  assert.equal(tokopedia.hasOfficialGroupCareersSignal(TOKOPEDIA_REFERENCE_HTML), false)
  assert.equal(
    tokopedia.extractTokopediaDarwinboxUrl(TOKOPEDIA_REFERENCE_HTML),
    'https://tokopedia.darwinbox.com/ms/candidate/careers',
  )
  assert.equal(tokopedia.hasAuthorizedTokopediaReferenceSignal(TOKOPEDIA_REFERENCE_HTML), true)
  assert.equal(tokopedia.hasOpaqueTokopediaDarwinboxShellSignal(OPAQUE_DARWINBOX_SHELL), true)
  assert.equal(tokopedia.pageExposesPublicJobListings(OPAQUE_DARWINBOX_SHELL), false)
  assert.equal(tokopedia.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    tokopedia.matchesVerifiedOpaqueDarwinboxState({
      status: 200,
      url: tokopedia.OFFICIAL_CAREERS_HANDOFF_URL,
      html: OPAQUE_DARWINBOX_SHELL,
    }),
    true,
  )
})

test('Tokopedia returns [] only while the verified GoTo reference and Darwinbox shell remain unchanged', async () => {
  const tokopedia = await loadModule()
  const requestedUrls = []

  const jobs = await tokopedia.createTokopediaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === tokopedia.GOTO_CAREERS_URL) {
        return { status: 200, url, html: GOTO_CAREERS_HTML }
      }

      if (url === tokopedia.TOKOPEDIA_REFERENCE_URL) {
        return { status: 200, url, html: TOKOPEDIA_REFERENCE_HTML }
      }

      if (url === tokopedia.OFFICIAL_CAREERS_HANDOFF_URL) {
        return { status: 200, url, html: OPAQUE_DARWINBOX_SHELL }
      }

      throw new Error(`Unexpected Tokopedia URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tokopedia.GOTO_CAREERS_URL,
    tokopedia.TOKOPEDIA_REFERENCE_URL,
    tokopedia.OFFICIAL_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Tokopedia fails closed when the verified reference or Darwinbox shell drifts into a public jobs surface', async () => {
  const tokopedia = await loadModule()

  await assert.rejects(
    tokopedia.createTokopediaScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified GoTo careers page|authorized Tokopedia handoff|opaque Darwinbox shell/i,
  )

  await assert.rejects(
    tokopedia.createTokopediaScraper().run({
      fetchPage: async (url) => {
        if (url === tokopedia.GOTO_CAREERS_URL) {
          return { status: 200, url, html: GOTO_CAREERS_HTML }
        }

        if (url === tokopedia.TOKOPEDIA_REFERENCE_URL) {
          return { status: 200, url, html: TOKOPEDIA_REFERENCE_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
    }),
    /opaque Darwinbox shell|appears to expose public jobs/i,
  )
})
