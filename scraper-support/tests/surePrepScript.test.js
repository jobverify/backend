import assert from 'node:assert/strict'
import test from 'node:test'

const publicHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SurePrep 1040 tax workflow automation solutions | Thomson Reuters</title>
  </head>
  <body>
    <main>
      <h1>1040 tax technology solutions</h1>
      <h2>Simplify tax workflows and expedite 1040 preparation with SurePrep</h2>
      <p>
        Ease the 1040 tax process from start to finish with this powerful platform, now part of the
        Thomson Reuters suite of comprehensive products
      </p>
      <section>
        <h3>TaxCaddy</h3>
        <h3>SPbinder</h3>
        <h3>1040SCAN</h3>
      </section>
      <a href="https://www.thomsonreuters.com/en/careers">Careers</a>
      <a href="/contact-sales">Contact sales</a>
    </main>
  </body>
</html>
`

const loginHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SurePrep FileRoom Login</title>
  </head>
  <body>
    <h1>Welcome</h1>
    <button>Sign in with Thomson Reuters Account</button>
    <footer>Copyright 2026 SurePrep, LLC</footer>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sureprep/script.js')
  } catch {
    assert.fail('Expected SurePrep scraper module at ../../scraper/sureprep/script.js')
  }
}

test('SurePrep scraper stays pinned to the verified exact-name login-only surface', async () => {
  const surePrep = await loadScriptModule()

  assert.equal(surePrep.SOURCE, 'sureprep')
  assert.equal(surePrep.COMPANY, 'SurePrep')
  assert.equal(surePrep.VERIFIED_ON, '2026-08-05')
  assert.equal(surePrep.COMPANY_CAREER_PAGE, 'https://sureprep.com/')
  assert.equal(surePrep.HOMEPAGE_URL, 'https://tax.thomsonreuters.com/en/sureprep')
  assert.equal(surePrep.LOGIN_URL, 'https://production.sureprep.com/')
  assert.equal(surePrep.PARENT_CAREERS_URL, 'https://www.thomsonreuters.com/en/careers')
  assert.equal(
    surePrep.OFFICIAL_PRODUCT_TITLE,
    'SurePrep 1040 tax workflow automation solutions | Thomson Reuters',
  )
  assert.equal(surePrep.OFFICIAL_LOGIN_TITLE, 'SurePrep FileRoom Login')
  assert.equal(surePrep.OFFICIAL_LOGIN_PROVIDER, 'Thomson Reuters Account')
  assert.equal(surePrep.hasOfficialPublicSurfaceSignal(publicHtml), true)
  assert.equal(surePrep.hasOfficialLoginSignal(loginHtml), true)
  assert.equal(surePrep.detectPublicJobsSurface(publicHtml, surePrep.HOMEPAGE_URL), null)
  assert.equal(surePrep.detectPublicJobsSurface(loginHtml, surePrep.LOGIN_URL), null)
  assert.equal(surePrep.hasPublicJobsSignal(publicHtml, surePrep.HOMEPAGE_URL), false)
})

test('SurePrep scraper returns [] while the verified Thomson Reuters product and login surfaces remain unchanged', async () => {
  const surePrep = await loadScriptModule()
  const requestedUrls = []

  const jobs = await surePrep.createSurePrepScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === surePrep.COMPANY_CAREER_PAGE) {
        return { status: 200, url: surePrep.HOMEPAGE_URL, html: publicHtml }
      }

      if (url === surePrep.LOGIN_URL) {
        return { status: 200, url, html: loginHtml }
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls.sort(),
    [surePrep.COMPANY_CAREER_PAGE, surePrep.LOGIN_URL].sort(),
  )
  assert.deepEqual(jobs, [])
})

test('SurePrep scraper fails closed when the verified product or login contracts drift', async () => {
  const surePrep = await loadScriptModule()

  await assert.rejects(
    surePrep.createSurePrepScraper().run({
      fetchPage: async (url) => (
        url === surePrep.COMPANY_CAREER_PAGE
          ? { status: 200, url: surePrep.HOMEPAGE_URL, html: '<title>Unexpected</title>' }
          : { status: 200, url: surePrep.LOGIN_URL, html: loginHtml }
      ),
    }),
    /trusted thomson reuters product contract/i,
  )

  await assert.rejects(
    surePrep.createSurePrepScraper().run({
      fetchPage: async (url) => (
        url === surePrep.COMPANY_CAREER_PAGE
          ? {
            status: 200,
            url: surePrep.HOMEPAGE_URL,
            html: `${publicHtml}<a href="https://jobs.lever.co/sureprep">View open roles</a>`,
          }
          : { status: 200, url: surePrep.LOGIN_URL, html: loginHtml }
      ),
    }),
    /needs a real scraper/i,
  )

  await assert.rejects(
    surePrep.createSurePrepScraper().run({
      fetchPage: async (url) => (
        url === surePrep.COMPANY_CAREER_PAGE
          ? { status: 200, url: surePrep.HOMEPAGE_URL, html: publicHtml }
          : { status: 200, url: surePrep.LOGIN_URL, html: '<title>Unexpected</title>' }
      ),
    }),
    /trusted thomson reuters sign-in contract/i,
  )
})
