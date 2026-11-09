import assert from 'node:assert/strict'
import test from 'node:test'

const loadTrainzDigitalModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Trainz Digital scraper module at ./script.js')
  }
}

const verifiedShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>PLACE MANTRA</title>
    <meta name="robots" content="noindex, nofollow">
  </head>
  <body>
    <img src="assets/img/logo.svg" alt="logo">
    <h1>Level Up Your Skills for Any Industry.</h1>
    <p>At Place Mantra, we believe you don't need to master the entire syllabus to land your dream job.</p>
    <section>Domains Categories</section>
    <section>Popular Courses</section>
    <section>We Boost Your Learning Potential</section>
    <footer>
      <p>PLACE MANTRA PRIVATE LIMITED</p>
      <a href="https://www.linkedin.com/company/hexabells/">LinkedIn</a>
      <p>Subscribe to our Newsletter</p>
    </footer>
  </body>
</html>
`

test('Trainz Digital pins the verified first-party shell on intrainz.com', async () => {
  const trainzDigital = await loadTrainzDigitalModule()

  assert.equal(trainzDigital.SOURCE, 'trainzdigital')
  assert.equal(trainzDigital.COMPANY, 'Trainz Digital')
  assert.equal(trainzDigital.HOMEPAGE_URL, 'https://www.intrainz.com/')
  assert.deepEqual(trainzDigital.CHECKED_ROUTE_URLS, [
    'https://www.intrainz.com/careers',
    'https://www.intrainz.com/careers/',
    'https://www.intrainz.com/career',
    'https://www.intrainz.com/jobs',
    'https://www.intrainz.com/jobs/',
    'https://www.intrainz.com/join-us',
    'https://www.intrainz.com/join-us/',
  ])
  assert.equal(trainzDigital.ROBOTS_URL, 'https://www.intrainz.com/robots.txt')
  assert.equal(trainzDigital.SITEMAP_URL, 'https://www.intrainz.com/sitemap.xml')
  assert.equal(trainzDigital.hasVerifiedShellSignal(verifiedShellHtml), true)
  assert.equal(trainzDigital.hasVerifiedShellSignal('<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'), false)
  assert.equal(trainzDigital.hasPublicJobSignal(verifiedShellHtml), false)
  assert.equal(
    trainzDigital.hasPublicJobSignal('<html><body><section><h2>Current Openings</h2><a href="/jobs/data-engineer">Apply now</a></section></body></html>'),
    true,
  )
})

test('Trainz Digital returns no jobs only while the verified first-party shell stays unchanged across homepage and common careers routes', async () => {
  const trainzDigital = await loadTrainzDigitalModule()
  const requestedUrls = []

  const jobs = await trainzDigital.createTrainzDigitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: verifiedShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    trainzDigital.HOMEPAGE_URL,
    ...trainzDigital.CHECKED_ROUTE_URLS,
    trainzDigital.ROBOTS_URL,
    trainzDigital.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Trainz Digital fails closed when a verified route starts exposing public job signals', async () => {
  const trainzDigital = await loadTrainzDigitalModule()

  await assert.rejects(
    trainzDigital.createTrainzDigitalScraper().run({
       fetchPage: async (url) => ({
         status: 200,
         url,
         html: url === trainzDigital.CHECKED_ROUTE_URLS[0]
          ? `${verifiedShellHtml}<section><h2>Current Openings</h2><a href="/jobs/sdet">Apply now</a></section>`
          : verifiedShellHtml,
       }),
     }),
    /public job signals/i,
  )
})

test('Trainz Digital fails closed when the verified first-party shell changes materially', async () => {
  const trainzDigital = await loadTrainzDigitalModule()

  await assert.rejects(
    trainzDigital.createTrainzDigitalScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === trainzDigital.SITEMAP_URL
          ? '<xml><loc>https://www.intrainz.com/jobs/platform-engineer</loc></xml>'
          : verifiedShellHtml,
      }),
    }),
    /verified first-party shell/i,
  )
})
