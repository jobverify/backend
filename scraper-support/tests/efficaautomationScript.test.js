import assert from 'node:assert/strict'
import test from 'node:test'

const loadEfficaModule = async () => {
  try {
    return await import('../../scraper/efficaautomation/script.js')
  } catch {
    assert.fail('Expected Effica Automation scraper module at ../../scraper/efficaautomation/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Effica Automation Limited</h1>
    <p>Coimbatore, India</p>
    <a href="/careers.html">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>People at Effica</h1>
    <p>Life at Effica</p>
    <p>Jobs at Effica</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Business Enquiry Form</h1>
    <form action="contact.php"></form>
    <a href="mailto:hr@effica.in">hr@effica.in</a>
  </body>
</html>
`

const unauthorizedPage = (url) => ({
  status: 401,
  url,
  headers: {
    server: 'Apache',
  },
  html: `
    <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
    <html>
      <head><title>401 Unauthorized</title></head>
      <body>
        <h1>Unauthorized</h1>
        <p>This server could not verify that you are authorized to access the document requested.</p>
      </body>
    </html>
  `,
})

test('Effica Automation recognizes both the legacy application-only contract and the current blocked 401 contract', async () => {
  const effica = await loadEfficaModule()

  assert.equal(effica.SOURCE, 'efficaautomation')
  assert.equal(effica.COMPANY, 'Effica Automation')
  assert.equal(effica.VERIFIED_ON, '2026-08-15')
  assert.deepEqual(effica.VERIFIED_ROUTE_URLS, [
    'https://www.effica.in/',
    'https://www.effica.in/careers.html',
    'https://www.effica.in/contact-us.html',
  ])
  assert.equal(effica.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(effica.hasApplicationOnlyCareersSignal(careersHtml), true)
  assert.equal(effica.hasHiringContactSignal(contactHtml), true)
  assert.equal(effica.hasVerifiedUnauthorizedSignal(unauthorizedPage(effica.HOMEPAGE_URL)), true)
})

test('Effica Automation returns [] while the older verified application-only surface remains reachable', async () => {
  const effica = await loadEfficaModule()
  const requestedUrls = []

  const jobs = await effica.createEfficaAutomationScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === effica.HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
      if (url === effica.CAREERS_URL) return { status: 200, url, headers: {}, html: careersHtml }
      if (url === effica.CONTACT_URL) return { status: 200, url, headers: {}, html: contactHtml }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, effica.VERIFIED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Effica Automation also returns [] while the verified first-party routes all remain on the 401 unauthorized shell', async () => {
  const effica = await loadEfficaModule()
  const requestedUrls = []

  const jobs = await effica.createEfficaAutomationScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return unauthorizedPage(url)
    },
  })

  assert.deepEqual(requestedUrls, effica.VERIFIED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Effica Automation returns an empty result when the verified first-party route set is temporarily timeout-blocked', async () => {
  const effica = await loadEfficaModule()

  const jobs = await effica.createEfficaAutomationScraper().run({
    fetchPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted address: www.effica.in:443, timeout: 10000ms)',
      )
    },
  })

  assert.deepEqual(jobs, [])
})

test('Effica Automation fails closed when the verified blocked or accessible first-party surfaces drift', async () => {
  const effica = await loadEfficaModule()

  await assert.rejects(
    effica.createEfficaAutomationScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        headers: {},
        html: '<html><title>Unexpected</title></html>',
      }),
    }),
    /homepage/i,
  )

  await assert.rejects(
    effica.createEfficaAutomationScraper().run({
      fetchPage: async (url) => {
        if (url === effica.HOMEPAGE_URL) {
          return unauthorizedPage(url)
        }

        return {
          status: 200,
          url,
          headers: {},
          html: '<html><body><h1>Reachable again</h1></body></html>',
        }
      },
    }),
    /verified 401 unauthorized state/i,
  )
})
