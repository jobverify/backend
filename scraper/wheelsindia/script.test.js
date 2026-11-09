import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Wheels India Limited</title>
  </head>
  <body>
    <main>
      <h1>Wheels India Limited</h1>
      <footer>Wheels India Limited</footer>
      <a href="https://wheelsindia.com/careers/">Careers</a>
    </main>
  </body>
</html>
`

const careersHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Wheels India</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <a href="https://wheelsindia.com/career-opportunities/">Career Opportunities</a>
    </main>
  </body>
</html>
`

const openingsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities | Wheels India</title>
  </head>
  <body>
    <main>
      <h1>Career Opportunities</h1>
      <p>Location</p>
      <div class="dealers">
        <span class="elementor-button-text">Chennai</span>
        <span data-toggle="premium-modal" data-target="#premium-modal-101" class="premium-modal-trigger-text">
          <h6 class="job-title">Design Engineer</h6>
        </span>
        <p class="job-exp"><b>4 to 6 years</b><br>Posted on July 10, 2026</p>
      </div>

      <div id="premium-modal-101">
        <p class="job-heading"><b>Job Description</b></p>
        <p>Design and development of wheel systems for automotive programs.</p>
        <div class="applynow"><a href="mailto:careers.wheelsindia.com">Apply Now</a></div>
      </div>

      <div class="dealers">
        <span class="elementor-button-text">Sriperumbudur, Tamil Nadu</span>
        <span data-toggle="premium-modal" data-target="#premium-modal-102" class="premium-modal-trigger-text">
          <h6 class="job-title">Quality Engineer</h6>
        </span>
        <p class="job-exp"><b>3 to 5 years</b><br>Posted on July 8, 2026</p>
      </div>

      <div id="premium-modal-102">
        <p class="job-heading"><b>Job Description</b></p>
        <p>Drive plant quality systems, audits, and customer complaint resolution.</p>
        <div class="applynow"><a href="mailto:careers.wheelsindia.com">Apply Now</a></div>
      </div>
    </main>
  </body>
</html>
`

test('Wheels India validates the verified homepage, careers hub, and openings page', async () => {
  const wheelsIndia = await loadModule()
  assert.ok(wheelsIndia, 'Wheels India scraper module should load')

  assert.equal(wheelsIndia.SOURCE, 'wheelsindia')
  assert.equal(wheelsIndia.COMPANY, 'Wheels India Limited')
  assert.equal(wheelsIndia.HOMEPAGE_URL, 'https://wheelsindia.com/')
  assert.equal(wheelsIndia.CAREERS_HUB_URL, 'https://wheelsindia.com/careers/')
  assert.equal(wheelsIndia.OPENINGS_URL, 'https://wheelsindia.com/career-opportunities/')
  assert.equal(wheelsIndia.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(wheelsIndia.hasCareersHubSignal(careersHubHtml), true)
  assert.equal(wheelsIndia.hasOpeningsPageSignal(openingsHtml), true)
  assert.deepEqual(
    wheelsIndia.extractOpenings(openingsHtml).map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      applyUrl: job.applyUrl,
      postingDate: job.postingDate,
    })),
    [
      {
        title: 'Design Engineer',
        location: 'Chennai, India',
        city: 'Chennai',
        applyUrl: 'mailto:careers.wheelsindia.com',
        postingDate: 'July 10, 2026',
      },
      {
        title: 'Quality Engineer',
        location: 'Sriperumbudur, Tamil Nadu, India',
        city: 'Sriperumbudur',
        applyUrl: 'mailto:careers.wheelsindia.com',
        postingDate: 'July 8, 2026',
      },
    ],
  )
})

test('Wheels India run decorates the verified first-party openings without guessing a corrected apply target', async () => {
  const wheelsIndia = await loadModule()
  assert.ok(wheelsIndia, 'Wheels India scraper module should load')

  const requestedUrls = []
  const jobs = await wheelsIndia.createWheelsIndiaScraper({
    now: () => '2026-07-12T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === wheelsIndia.HOMEPAGE_URL) return homepageHtml
      if (url === wheelsIndia.CAREERS_HUB_URL) return careersHubHtml
      if (url === wheelsIndia.OPENINGS_URL) return openingsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    wheelsIndia.HOMEPAGE_URL,
    wheelsIndia.CAREERS_HUB_URL,
    wheelsIndia.OPENINGS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'wheelsindia')
  assert.equal(jobs[0].link, 'mailto:careers.wheelsindia.com')
  assert.equal(jobs[0].applyUrl, 'mailto:careers.wheelsindia.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T12:00:00.000Z')
})

test('Wheels India fails closed when the homepage, careers hub, or openings contract changes', async () => {
  const wheelsIndia = await loadModule()
  assert.ok(wheelsIndia, 'Wheels India scraper module should load')

  await assert.rejects(
    wheelsIndia.createWheelsIndiaScraper().run({
      fetchText: async (url) => {
        if (url === wheelsIndia.HOMEPAGE_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        if (url === wheelsIndia.CAREERS_HUB_URL) return careersHubHtml
        if (url === wheelsIndia.OPENINGS_URL) return openingsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    wheelsIndia.createWheelsIndiaScraper().run({
      fetchText: async (url) => {
        if (url === wheelsIndia.HOMEPAGE_URL) return homepageHtml
        if (url === wheelsIndia.CAREERS_HUB_URL) return '<html><body><h1>Careers</h1></body></html>'
        if (url === wheelsIndia.OPENINGS_URL) return openingsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers hub/i,
  )

  await assert.rejects(
    wheelsIndia.createWheelsIndiaScraper().run({
      fetchText: async (url) => {
        if (url === wheelsIndia.HOMEPAGE_URL) return homepageHtml
        if (url === wheelsIndia.CAREERS_HUB_URL) return careersHubHtml
        if (url === wheelsIndia.OPENINGS_URL) {
          return openingsHtml.replace('mailto:careers.wheelsindia.com', '#apply')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /openings page/i,
  )
})
