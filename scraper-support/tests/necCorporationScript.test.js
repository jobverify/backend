import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>NEC(Global)</title>
  </head>
  <body>
    <h1>Empower Humanity</h1>
    <p>Delivering innovation and peace of mind</p>
    <p>Vision for Creating Social Value</p>
    <a href="/en/about/corporate/nec/vision">About NEC</a>
  </body>
</html>
`

const SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.nec.com/en/global/rd/rd-recruit/index.html</loc></url>
</urlset>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Are you interested in working at our laboratories?: Research &amp; Development | NEC</title>
  </head>
  <body>
    <h1>Are you interested in working at our laboratories?</h1>
    <p>NEC Laboratories are looking for aspiring individuals who want to improve society and make people's lives better.</p>
    <nav>
      <a href="#researchers">Our Researchers</a>
      <a href="#achievements">Achievements</a>
      <a href="#publications">Publications</a>
      <a href="/en/global/rd/rd-jpn/index.html">R&amp;D(Japanese)</a>
    </nav>
    <footer>&copy; NEC Corporation</footer>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>NEC Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://boards.greenhouse.io/nec/jobs/123">Apply now</a>
  </body>
</html>
`

const loadNecCorporationModule = async () => {
  try {
    return await import('../../scraper/neccorporation/script.js')
  } catch {
    assert.fail('Expected NEC Corporation scraper module at ../../scraper/neccorporation/script.js')
  }
}

test('NEC Corporation constants and validators stay pinned to the Monday, August 3, 2026 zero-job recruit surface', async () => {
  const nec = await loadNecCorporationModule()

  assert.equal(nec.SOURCE, 'neccorporation')
  assert.equal(nec.COMPANY, 'NEC Corporation')
  assert.equal(nec.VERIFIED_ON, '2026-08-03')
  assert.equal(nec.HOMEPAGE_URL, 'https://www.nec.com/')
  assert.equal(nec.SITEMAP_URL, 'https://www.nec.com/sitemap.xml')
  assert.equal(nec.CAREERS_URL, 'https://www.nec.com/en/global/rd/rd-recruit/index.html')
  assert.equal(nec.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(nec.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(nec.pageExposesPublicJobListings(CAREERS_HTML), false)
  assert.equal(nec.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.deepEqual(nec.extractCareerSurfaceUrls(SITEMAP_XML), [
    'https://www.nec.com/en/global/rd/rd-recruit/index.html',
  ])
})

test('NEC Corporation returns [] when the homepage, sitemap, and recruit page stay pinned to the zero-job surface', async () => {
  const nec = await loadNecCorporationModule()
  const requestedUrls = []

  const jobs = await nec.createNecCorporationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nec.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === nec.SITEMAP_URL) return SITEMAP_XML
      if (url === nec.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected NEC URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    nec.HOMEPAGE_URL,
    nec.SITEMAP_URL,
    nec.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('NEC Corporation fails closed when the recruit page starts exposing public job listings', async () => {
  const nec = await loadNecCorporationModule()

  await assert.rejects(
    nec.createNecCorporationScraper().run({
      fetchText: async (url) => {
        if (url === nec.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === nec.SITEMAP_URL) return SITEMAP_XML
        if (url === nec.CAREERS_URL) return PUBLIC_JOBS_HTML
        throw new Error(`Unexpected NEC URL: ${url}`)
      },
    }),
    /verified zero-job surface|public job listings/i,
  )
})
