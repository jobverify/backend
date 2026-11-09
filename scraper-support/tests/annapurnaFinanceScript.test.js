import assert from 'node:assert/strict'
import test from 'node:test'
import { currentFixture } from '../../scraper/annapurnafinance/currentFixture.js'

const loadAnnapurnaModule = async () => {
  try {
    return await import('../../scraper/annapurnafinance/script.js')
  } catch {
    assert.fail('Expected Annapurna Finance scraper module at ../../scraper/annapurnafinance/script.js')
  }
}

const homepageHtml = `
  <html>
    <head><title>Annapurna Finance Pvt. Ltd.</title></head>
    <body>
      <h1>Annapurna Finance Pvt. Ltd.</h1>
      <p>Annapurna Finance does not authorize any mobile application or digital platform to represent its loan services except A-Pay.</p>
      <a href="/about-us/our-journey">Our Journey</a>
      <a href="/product-and-services">Product &amp; Services</a>
      <a href="/contact-us">Contact Us</a>
    </body>
  </html>
`

const missingRouteHtml = `
  <html>
    <head><title>404 | Annapurna Finance Pvt. Ltd.</title></head>
    <body>
      <h1>404</h1>
      <p>Annapurna Finance does not authorize any mobile application or digital platform to represent its loan services except A-Pay.</p>
      <a href="/about-us/our-journey">Our Journey</a>
      <a href="/product-and-services">Product &amp; Services</a>
    </body>
  </html>
`

test('Annapurna Finance historical missing-route helpers remain explicitly historical', async () => {
  const annapurna = await loadAnnapurnaModule()

  assert.equal(annapurna.HOMEPAGE_URL, 'https://annapurnafinance.in/')
  assert.deepEqual(annapurna.CAREER_ROUTE_URLS, [
    'https://annapurnafinance.in/career-openings/',
    'https://annapurnafinance.in/careers/',
    'https://annapurnafinance.in/jobs/',
  ])
  assert.equal(annapurna.hasOfficialHomepageSurface(homepageHtml), true)
  assert.equal(annapurna.isMissingCareerRoute({ status: 404, url: annapurna.CAREER_ROUTE_URLS[0], html: missingRouteHtml }), true)
})

test('Annapurna Finance runtime follows the current public native portal instead of missing-route sentinels', async () => {
  const annapurna = await loadAnnapurnaModule()
  const fixture = currentFixture()
  const jobs = await annapurna.createAnnapurnaFinanceScraper().run({ ...fixture, minRequestIntervalMs: 0 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '1947')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].country, null)
  assert.ok(fixture.calls.some(row => row.method === 'POST'))
  assert.ok(fixture.calls.every(row => !annapurna.CAREER_ROUTE_URLS.includes(row.url)))
})

test('Annapurna Finance runtime cannot treat the old missing-route surface as a verified zero', async () => {
  const annapurna = await loadAnnapurnaModule()
  const fixture = currentFixture({ transform: ({ url, response }) => url === annapurna.HOMEPAGE_URL
    ? { ...response, text: async () => homepageHtml } : undefined })
  await assert.rejects(annapurna.run({ ...fixture, minRequestIntervalMs: 0 }), /official homepage\/careers handoff/i)
})
