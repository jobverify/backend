import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const officialHomepageHtml = `
  <html>
    <head><title>Sipal</title></head>
    <body>
      <h1>Progettiamo il futuro della sicurezza</h1>
      <p>We protect what truly matters</p>
      <p>SIPAL integra engineering, manufacturing avanzato e tecnologie proprietarie</p>
      <p>Il nostro network globale</p>
    </body>
  </html>
`

const englishCareersHtml = `
  <html>
    <head><title>Careers - Sipal</title></head>
    <body>
      <h1>Careers</h1>
      <p>Available job opportunities</p>
      <article class="elementor-post elementor-grid-item post-256212 job_offer type-job_offer status-publish hentry" role="listitem">
        <div class="elementor-post__card">
          <div class="elementor-post__text">
            <h3 class="elementor-post__title">
              <a href="https://sipal.it/en/job_offer/bim-coordinator/">BIM Coordinator</a>
            </h3>
            <div class="elementor-post__excerpt">
              <ul>
                <li><b>Degree:</b> Master's degree in civil engineering</li>
                <li><b>Contract type:</b> Permanent</li>
              </ul>
            </div>
          </div>
        </div>
      </article>
      <article class="elementor-post elementor-grid-item post-256214 job_offer type-job_offer status-publish hentry category-naples category-turin" role="listitem">
        <div class="elementor-post__card">
          <div class="elementor-post__text">
            <h3 class="elementor-post__title">
              <a href="https://sipal.it/en/job_offer/assistant-to-the-safety-coordinator-in-the-design-and-execution-phase/">
                Assistant to the Safety Coordinator in the Design and Execution Phase
              </a>
            </h3>
            <div class="elementor-post__excerpt">
              <ul>
                <li><b>Educational qualification:</b> Master's Degree in Engineering</li>
                <li><b>Contract type:</b> Permanent</li>
              </ul>
            </div>
          </div>
        </div>
      </article>
      <article class="elementor-post elementor-grid-item post-256214 job_offer type-job_offer status-publish hentry category-naples category-turin" role="listitem">
        <div class="elementor-post__card">
          <div class="elementor-post__text">
            <h3 class="elementor-post__title">
              <a href="https://sipal.it/en/job_offer/assistant-to-the-safety-coordinator-in-the-design-and-execution-phase/">
                Assistant to the Safety Coordinator in the Design and Execution Phase
              </a>
            </h3>
            <div class="elementor-post__excerpt">
              <ul>
                <li><b>Educational qualification:</b> Master's Degree in Engineering</li>
                <li><b>Contract type:</b> Permanent</li>
              </ul>
            </div>
          </div>
        </div>
      </article>
    </body>
  </html>
`

const italianCareersHtml = englishCareersHtml
  .replace('<title>Careers - Sipal</title>', '<title>Lavora con noi - Sipal</title>')
  .replace('Available job opportunities', 'Offerte lavorative disponibili')

const bimCoordinatorDetailHtml = `
  <html>
    <head><title>BIM Coordinator - Sipal</title></head>
    <body>
      <article class="single-job_offer category-holder category-turin category-title">
        <h1>BIM Coordinator</h1>
        <h4>Work location</h4>
        <p>Turin</p>
      </article>
    </body>
  </html>
`

test('SIPAL careers scraper constants stay pinned to the verified public careers surface', async () => {
  const sipal = await loadModule()

  assert.equal(sipal.SOURCE, 'sipaltechnologiesindiaprivatelimited')
  assert.equal(sipal.COMPANY, 'SIPAL Technologies India Private Limited')
  assert.equal(sipal.COMPANY_DOMAIN, 'sipal.it')
  assert.equal(sipal.ATS_PLATFORM, 'official-company-careers')
  assert.equal(sipal.HOMEPAGE_URL, 'https://sipal.it/')
  assert.equal(sipal.CAREERS_URL, 'https://sipal.it/en/careers/')
  assert.deepEqual(sipal.FALLBACK_CAREERS_URLS, [
    'https://sipal.it/lavora-con-noi/',
    'https://sipal.it/careers/',
  ])
  assert.deepEqual(sipal.LEGACY_ROUTE_URLS, [
    'https://sipal.it/sipal-india-en/',
    'https://sipal.it/sipal-india/',
    'https://sipal.it/jobs/',
    'https://sipal.it/candidature/',
  ])
  assert.equal(sipal.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(sipal.hasOfficialCareersPageSignal(englishCareersHtml), true)
  assert.equal(sipal.hasOfficialCareersPageSignal(italianCareersHtml), true)
  assert.equal(sipal.pageShowsPublicJobs(englishCareersHtml), true)
  assert.equal(sipal.pageShowsPublicJobs('<html><title>Different</title></html>'), false)
})

test('extractJobsFromCareersHtml dedupes public cards and fills missing locations from detail pages', async () => {
  const sipal = await loadModule()
  const detailRequests = []

  const jobs = await sipal.extractJobsFromCareersHtml(englishCareersHtml, {
    pageUrl: sipal.CAREERS_URL,
    fetchPage: async (url) => {
      detailRequests.push(url)

      if (url === 'https://sipal.it/en/job_offer/bim-coordinator/') {
        return { status: 200, url, html: bimCoordinatorDetailHtml }
      }

      throw new Error(`Unexpected detail URL: ${url}`)
    },
  })

  assert.deepEqual(detailRequests, ['https://sipal.it/en/job_offer/bim-coordinator/'])
  assert.equal(jobs.length, 2)

  const bimCoordinator = jobs.find((job) => job.title === 'BIM Coordinator')
  assert.ok(bimCoordinator)
  assert.equal(bimCoordinator.sourceUrl, 'https://sipal.it/en/job_offer/bim-coordinator/')
  assert.equal(bimCoordinator.applyUrl, 'https://sipal.it/en/job_offer/bim-coordinator/')
  assert.equal(bimCoordinator.companyCareerPage, sipal.CAREERS_URL)
  assert.equal(bimCoordinator.companyDomain, 'sipal.it')
  assert.equal(bimCoordinator.atsPlatform, 'official-company-careers')
  assert.equal(bimCoordinator.location, 'Turin, Italy')
  assert.deepEqual(bimCoordinator.locations, ['Turin, Italy'])
  assert.equal(bimCoordinator.city, 'Turin')
  assert.equal(bimCoordinator.country, 'Italy')
  assert.match(bimCoordinator.jobDescription, /Contract type:\s*Permanent/i)

  const assistant = jobs.find((job) => job.title.includes('Assistant to the Safety Coordinator'))
  assert.ok(assistant)
  assert.deepEqual(assistant.locations, ['Naples, Italy', 'Turin, Italy'])
  assert.equal(assistant.city, null)
  assert.equal(assistant.country, 'Italy')
})

test('run returns public jobs from the verified English careers page', async () => {
  const sipal = await loadModule()
  const requestedUrls = []

  const jobs = await sipal.createSipalTechnologiesIndiaPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sipal.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === sipal.CAREERS_URL) {
        return { status: 200, url, html: englishCareersHtml }
      }

      if (url === 'https://sipal.it/en/job_offer/bim-coordinator/') {
        return { status: 200, url, html: bimCoordinatorDetailHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sipal.HOMEPAGE_URL,
    sipal.CAREERS_URL,
    'https://sipal.it/en/job_offer/bim-coordinator/',
  ])
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'BIM Coordinator',
      'Assistant to the Safety Coordinator in the Design and Execution Phase',
    ],
  )
})

test('run falls back to the Italian careers route when the English page is unavailable', async () => {
  const sipal = await loadModule()
  const requestedUrls = []

  const jobs = await sipal.createSipalTechnologiesIndiaPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sipal.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === sipal.CAREERS_URL) {
        return { status: 404, url, html: '<html><title>Missing</title></html>' }
      }

      if (url === 'https://sipal.it/lavora-con-noi/') {
        return { status: 200, url, html: italianCareersHtml }
      }

      if (url === 'https://sipal.it/en/job_offer/bim-coordinator/') {
        return { status: 200, url, html: bimCoordinatorDetailHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sipal.HOMEPAGE_URL,
    sipal.CAREERS_URL,
    'https://sipal.it/lavora-con-noi/',
    'https://sipal.it/en/job_offer/bim-coordinator/',
  ])
  assert.equal(jobs.length, 2)
})

test('run fails closed when the official homepage drifts away from the verified SIPAL surface', async () => {
  const sipal = await loadModule()

  await assert.rejects(
    sipal.createSipalTechnologiesIndiaPrivateLimitedScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: '<html><title>Different</title></html>' }),
    }),
    /official homepage/i,
  )
})
