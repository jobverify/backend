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
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Index - Company Bootstrap Template</title>
    </head>
    <body class="index-page">
      <header>
        <a href="index.html" class="logo">
          <h1 class="sitename">TalentServe</h1><span>.</span>
        </a>
      </header>
      <main>
        <section id="hero">
          <h2>Get Placed Upto 25LPA</h2>
          <p>Learn from the experts from top companies</p>
          <a href="#courses">Book Our Free Demo Class</a>
        </section>
        <section id="about">
          <h3>Our Mission</h3>
          <p>TalentServe's Job Guarantee Program has helped achieve placement upto 25LPA.</p>
          <p>Join our growing community of aspirants and transform your career with industry-relevant skills and expert guidance.</p>
        </section>
      </main>
      <footer>
        <ul>
          <li><a href="about.html">About Us</a></li>
          <li><a href="careers.html">Careers</a></li>
          <li><a href="contact.html">Contact Us</a></li>
        </ul>
        <p>Designed by <a href="https://bootstrapmade.com/">BootstrapMade</a></p>
      </footer>
    </body>
  </html>
`

const missingCareersHtml = `
  <!DOCTYPE html>
  <html style="height:100%">
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <div>
        <h1>404</h1>
        <h2>Not Found</h2>
        <p>The resource requested could not be found on this server!</p>
      </div>
      <div>
        <p>Proudly powered by LiteSpeed Web Server</p>
      </div>
    </body>
  </html>
`

test('TalentServe sentinel pins the verified homepage placeholder and linked careers 404 surface', async () => {
  const scraperModule = await loadModule()
  assert.ok(scraperModule, 'TalentServe scraper module should load')

  assert.equal(scraperModule.SOURCE, 'talentserve')
  assert.equal(scraperModule.COMPANY, 'TalentServe')
  assert.equal(scraperModule.HOMEPAGE_URL, 'https://www.talentserve.org/')
  assert.equal(scraperModule.CAREERS_URL, 'https://www.talentserve.org/careers.html')
  assert.deepEqual(scraperModule.OFFICIAL_SURFACE_URLS, [
    'https://www.talentserve.org/',
    'https://www.talentserve.org/careers.html',
  ])
  assert.equal(scraperModule.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(scraperModule.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    scraperModule.isVerifiedMissingCareersRoute({
      status: 404,
      url: scraperModule.CAREERS_URL,
      html: missingCareersHtml,
    }),
    true,
  )
  assert.deepEqual(scraperModule.getRunnerMetadata(), {
    name: 'talentserve',
    dryRunFile: 'jobs.json',
    provider: {
      source: 'talentserve',
      companyName: 'TalentServe',
      companyCareerPage: 'https://www.talentserve.org/',
      alternateCareerPages: ['https://www.talentserve.org/careers.html'],
      adapter: 'script',
      atsPlatform: 'official-company-site-no-public-careers',
      countryFilter: 'India',
      parser: 'custom-script',
      paginationStrategy: 'homepage-plus-linked-careers-route-validation',
      extractionStrategy: 'verified-placeholder-homepage-plus-linked-litespeed-404-careers-route-return-empty',
      normalizationProfile: 'engineering-default',
      companyDomain: 'talentserve.org',
    },
  })
})

test('TalentServe sentinel returns no jobs only while the verified first-party homepage and linked careers route stay unchanged', async () => {
  const scraperModule = await loadModule()
  assert.ok(scraperModule, 'TalentServe scraper module should load')

  const requestedUrls = []
  const jobs = await scraperModule.createTalentServeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraperModule.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === scraperModule.CAREERS_URL) {
        return { status: 404, url, html: missingCareersHtml }
      }

      throw new Error(`Unexpected TalentServe URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.talentserve.org/',
    'https://www.talentserve.org/careers.html',
  ])
  assert.deepEqual(jobs, [])
})

test('TalentServe sentinel fails closed when the homepage or linked careers route drifts into a different surface', async () => {
  const scraperModule = await loadModule()
  assert.ok(scraperModule, 'TalentServe scraper module should load')

  await assert.rejects(
    scraperModule.createTalentServeScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }

        return { status: 404, url, html: missingCareersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    scraperModule.createTalentServeScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://jobs.example.com/talentserve">Current openings</a>`,
          }
        }

        return { status: 404, url, html: missingCareersHtml }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    scraperModule.createTalentServeScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Careers</h1><a href="/roles/frontend-trainer">Apply now</a></body></html>',
        }
      },
    }),
    /linked careers route changed materially or now exposes public jobs/i,
  )
})
