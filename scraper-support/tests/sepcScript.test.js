import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html class="no-js">
  <head>
    <title>Shriram EPC | Careers</title>
  </head>
  <body>
    <div class="siteheading">CURRENT OPENINGS</div>
    <div class="Ocontent">
      <ul class="FYpdf"></ul>
    </div>
    <div class="footer_menu_bottom">
      <a>COPYRIGHT © SEPC LTD - ALL RIGHTS RESERVED | CIN: L74210TN2000PLC045167</a>
    </div>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html class="no-js">
  <head>
    <title>Shriram EPC | Careers</title>
  </head>
  <body>
    <div class="siteheading">CURRENT OPENINGS</div>
    <div class="Ocontent">
      <ul class="FYpdf">
        <li><a href="pdf/senior-engineer.pdf">Senior Engineer</a></li>
      </ul>
    </div>
    <div class="footer_menu_bottom">
      <a>COPYRIGHT © SEPC LTD - ALL RIGHTS RESERVED | CIN: L74210TN2000PLC045167</a>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sepc/script.js')
  } catch {
    assert.fail('Expected SEPC scraper module at ../../scraper/sepc/script.js')
  }
}

test('SEPC sentinel helpers stay pinned to the verified empty current-openings shell', async () => {
  const sepc = await loadModule()

  assert.equal(sepc.SOURCE, 'sepc')
  assert.equal(sepc.COMPANY, 'SEPC')
  assert.equal(sepc.OFFICIAL_BRAND_NAME, 'SEPC Limited')
  assert.equal(sepc.VERIFIED_ON, '2026-07-17')
  assert.equal(sepc.HOMEPAGE_URL, 'https://www.sepc.in/')
  assert.equal(sepc.CAREERS_PAGE_URL, 'https://www.sepc.in/careers.aspx')
  assert.equal(sepc.hasVerifiedEmptyCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(sepc.hasPublicJobsSignal(VERIFIED_CAREERS_HTML), false)
  assert.equal(sepc.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('SEPC returns [] only while the verified official careers page remains an empty current-openings shell', async () => {
  const sepc = await loadModule()
  const requestedUrls = []

  const jobs = await sepc.createSepcScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sepc.CAREERS_PAGE_URL) {
        return VERIFIED_CAREERS_HTML
      }

      throw new Error(`Unexpected SEPC URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [sepc.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('SEPC fails closed when the verified careers shell drifts or starts publishing jobs', async () => {
  const sepc = await loadModule()

  await assert.rejects(
    sepc.createSepcScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified sepc careers page/i,
  )

  await assert.rejects(
    sepc.createSepcScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /now appears to expose public jobs/i,
  )
})
