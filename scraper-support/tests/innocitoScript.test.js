import assert from 'node:assert/strict'
import test from 'node:test'

const loadInnocitoModule = async () => {
  try {
    return await import('../../scraper/innocito/script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Join Our Team of Digital Engineers | Innocito</title>
    <link rel="canonical" href="https://innocito.com/careers">
  </head>
  <body>
    <main>
      <a href="/">Innocito</a>
      <nav>
        <a href="/about-us">About Us</a>
        <a href="/careers">Careers</a>
        <a href="/contact-us">Contact Us</a>
      </nav>
      <h2>United States</h2>
      <p>Innocito Technologies llc, 511 E John Carpenter Fwy, Suite 500, Irving, TX 75062, USA.</p>
      <h2>India</h2>
      <p>Visakhapatnam Innocito Private Limited, Tech Mahindra Campus, Vizag City Center.</p>
      <p>Hyderabad Innocito Private Limited, 3rd Floor, The Business Park by Pranava Group.</p>
      <footer>© 2026 Innocito Technologies LLC. All rights reserved.</footer>
    </main>
  </body>
</html>
`

test('Innocito validates the verified official careers shell and detects public job signals', async () => {
  const innocito = await loadInnocitoModule()
  assert.ok(innocito, 'Expected Innocito scraper module at ../../scraper/innocito/script.js')

  assert.equal(innocito.SOURCE, 'innocito')
  assert.equal(innocito.COMPANY, 'Innocito')
  assert.equal(innocito.CAREERS_URL, 'https://innocito.com/careers')
  assert.equal(innocito.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(innocito.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(innocito.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(
    innocito.hasPublicJobBoardSignal('<html><head><meta name="description" content="Explore open positions."></head></html>'),
    false,
  )
  assert.equal(
    innocito.hasPublicJobBoardSignal('<html><body><a href="/careers/platform-engineer">Platform Engineer</a></body></html>'),
    true,
  )
  assert.equal(
    innocito.hasPublicJobBoardSignal('<html><body><a href="/careers/platform-engineer">Apply now</a></body></html>'),
    true,
  )
})

test('Innocito returns no jobs for the verified official careers shell without public listings', async () => {
  const innocito = await loadInnocitoModule()
  assert.ok(innocito, 'Expected Innocito scraper module at ../../scraper/innocito/script.js')

  const requestedUrls = []
  const jobs = await innocito.createInnocitoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://innocito.com/careers'])
  assert.deepEqual(jobs, [])
})

test('Innocito fails closed when the verified careers shell changes or exposes jobs', async () => {
  const innocito = await loadInnocitoModule()
  assert.ok(innocito, 'Expected Innocito scraper module at ../../scraper/innocito/script.js')

  await assert.rejects(
    innocito.createInnocitoScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>',
    }),
    /Innocito official careers page changed/i,
  )

  await assert.rejects(
    innocito.createInnocitoScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Careers - Join Our Team of Digital Engineers | Innocito</title>
            <link rel="canonical" href="https://innocito.com/careers">
          </head>
          <body>
            <main>
              <a href="/">Innocito</a>
              <p>Innocito Technologies LLC, 511 E John Carpenter Fwy, Suite 500, Irving, TX 75062, USA.</p>
              <p>Innocito Private Limited, Tech Mahindra Campus, Vizag City Center.</p>
              <p>3rd Floor, The Business Park by Pranava Group.</p>
              <footer>© 2026 Innocito Technologies LLC. All rights reserved.</footer>
              <a href="/careers/platform-engineer">Apply now</a>
            </main>
          </body>
        </html>
      `,
    }),
    /Innocito careers page now appears to expose public job listings/i,
  )
})
