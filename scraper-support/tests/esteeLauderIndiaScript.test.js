import assert from 'node:assert/strict'
import test from 'node:test'

const careersHubHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Careers - The Estee Lauder Companies Inc.</title>
  <meta
    name="description"
    content="At The Estee Lauder Companies there are exciting opportunities to play a role in our global success. Browse open jobs by career area, brand or location."
  />
  <link rel="canonical" href="https://www.elcompanies.com/en/careers" />
</head>
<body id="ip3-careers">
  <div class="hide jobValues">
    <div id="JobCountry">India</div>
    <div id="JobCity">Chennai</div>
  </div>
  <a href="/en/careers/brand-jobs">Brands</a>
  <a href="/en/careers/corporate-jobs">Corporate</a>
  <a href="/en/careers/retail-jobs">Retail</a>
  <a href="/en/careers/technology-jobs">Technology</a>
  <p class="jobAvailability hide">No jobs available.</p>
  <p class="jobsBtnExternalText hide">See all</p>
  <p class="jobsRoles hide">Latest Roles</p>
  <div class="container-fluid search-with-eightfold">
    <h2>Search all jobs:</h2>
    <input autocomplete="off" type="text" class="jobTitle form-control" id="job-search" placeholder="Search all Jobs and all Brands">
    <input autocomplete="off" type="text" class="form-control" id="location-search" placeholder="Location">
    <a href="#" class="btn btn-primary submit-link show-non-us" id="search-button">Search</a>
  </div>
</body>
</html>
`

const brandJobsHtml = careersHubHtml.replace(
  '<title>Careers - The Estee Lauder Companies Inc.</title>',
  '<title>Brands - The Estee Lauder Companies Inc.</title>',
)

const corporateJobsHtml = careersHubHtml.replace(
  '<title>Careers - The Estee Lauder Companies Inc.</title>',
  '<title>Corporate - The Estee Lauder Companies Inc.</title>',
)

const retailJobsHtml = careersHubHtml.replace(
  '<title>Careers - The Estee Lauder Companies Inc.</title>',
  '<title>Retail - The Estee Lauder Companies Inc.</title>',
)

const technologyJobsHtml = careersHubHtml.replace(
  '<title>Careers - The Estee Lauder Companies Inc.</title>',
  '<title>Technology - The Estee Lauder Companies Inc.</title>',
)

const pageNotFoundHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Page Not Found - The Estee Lauder Companies Inc.</title>
  <link rel="canonical" href="https://www.elcompanies.com/en/careers/search-jobs" />
</head>
<body id="ip3-404-error">
  <h1>Page Not Found</h1>
  <p>Page not found</p>
</body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Careers - The Estee Lauder Companies Inc.</title>
</head>
<body>
  <div id="JobCountry">India</div>
  <div id="JobCity">Chennai</div>
  <h2>Search all jobs:</h2>
  <a href="https://www.elcompanies.com/en/careers/job/12345">Apply now</a>
</body>
</html>
`

const loadEsteeLauderIndiaModule = async () => {
  try {
    return await import('../../scraper/esteelauderindia/script.js')
  } catch {
    assert.fail('Expected Estee Lauder India scraper module at ../../scraper/esteelauderindia/script.js')
  }
}

test('Estee Lauder India scraper helpers stay pinned to the verified empty first-party careers shell', async () => {
  const esteeLauderIndia = await loadEsteeLauderIndiaModule()

  assert.equal(esteeLauderIndia.SOURCE, 'esteelauderindia')
  assert.equal(esteeLauderIndia.COMPANY, 'Estee Lauder India')
  assert.equal(esteeLauderIndia.OFFICIAL_BRAND_NAME, 'The Estee Lauder Companies')
  assert.equal(esteeLauderIndia.VERIFIED_ON, '2026-07-15')
  assert.equal(esteeLauderIndia.CAREERS_URL, 'https://www.elcompanies.com/en/careers')
  assert.equal(esteeLauderIndia.SEARCH_JOBS_URL, 'https://www.elcompanies.com/en/careers/search-jobs')
  assert.deepEqual(esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS, [
    {
      label: 'brand jobs',
      url: 'https://www.elcompanies.com/en/careers/brand-jobs',
      expectedTitle: 'Brands',
    },
    {
      label: 'corporate jobs',
      url: 'https://www.elcompanies.com/en/careers/corporate-jobs',
      expectedTitle: 'Corporate',
    },
    {
      label: 'retail jobs',
      url: 'https://www.elcompanies.com/en/careers/retail-jobs',
      expectedTitle: 'Retail',
    },
    {
      label: 'technology jobs',
      url: 'https://www.elcompanies.com/en/careers/technology-jobs',
      expectedTitle: 'Technology',
    },
  ])
  assert.deepEqual(esteeLauderIndia.extractLocationConfig(careersHubHtml), {
    country: 'India',
    city: 'Chennai',
  })
  assert.equal(esteeLauderIndia.hasVerifiedCareersHubSignal(careersHubHtml), true)
  assert.equal(
    esteeLauderIndia.hasVerifiedCareersHubSignal(careersHubHtml.replace('Chennai', 'Kallakurichi')),
    true,
  )
  assert.equal(esteeLauderIndia.hasVerifiedEmptyCategoryPageSignal(brandJobsHtml, 'Brands'), true)
  assert.equal(esteeLauderIndia.hasVerifiedEmptyCategoryPageSignal(corporateJobsHtml, 'Corporate'), true)
  assert.equal(esteeLauderIndia.hasVerifiedEmptyCategoryPageSignal(retailJobsHtml, 'Retail'), true)
  assert.equal(esteeLauderIndia.hasVerifiedEmptyCategoryPageSignal(technologyJobsHtml, 'Technology'), true)
  assert.equal(esteeLauderIndia.hasVerifiedMissingSearchRouteSignal(pageNotFoundHtml), true)
  assert.equal(esteeLauderIndia.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Estee Lauder India returns [] only while the verified first-party careers pages stay empty', async () => {
  const esteeLauderIndia = await loadEsteeLauderIndiaModule()
  const requestedUrls = []

  const jobs = await esteeLauderIndia.createEsteeLauderIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === esteeLauderIndia.CAREERS_URL) {
        return { status: 200, url, html: careersHubHtml }
      }

      if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[0].url) {
        return { status: 200, url, html: brandJobsHtml }
      }

      if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[1].url) {
        return { status: 200, url, html: corporateJobsHtml }
      }

      if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[2].url) {
        return { status: 200, url, html: retailJobsHtml }
      }

      if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[3].url) {
        return { status: 200, url, html: technologyJobsHtml }
      }

      if (url === esteeLauderIndia.SEARCH_JOBS_URL) {
        return { status: 200, url, html: pageNotFoundHtml }
      }

      throw new Error(`Unexpected Estee Lauder India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    esteeLauderIndia.CAREERS_URL,
    ...esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS.map((route) => route.url),
    esteeLauderIndia.SEARCH_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Estee Lauder India fails closed when the verified careers shell, empty category pages, or missing search route drift', async () => {
  const esteeLauderIndia = await loadEsteeLauderIndiaModule()

  await assert.rejects(
    esteeLauderIndia.createEsteeLauderIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === esteeLauderIndia.CAREERS_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Estee Lauder India URL: ${url}`)
      },
    }),
    /official careers hub/i,
  )

  await assert.rejects(
    esteeLauderIndia.createEsteeLauderIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === esteeLauderIndia.CAREERS_URL) {
          return { status: 200, url, html: careersHubHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[0].url) {
          return { status: 200, url, html: publicJobsHtml.replace('Careers', 'Brands') }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[1].url) {
          return { status: 200, url, html: corporateJobsHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[2].url) {
          return { status: 200, url, html: retailJobsHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[3].url) {
          return { status: 200, url, html: technologyJobsHtml }
        }

        if (url === esteeLauderIndia.SEARCH_JOBS_URL) {
          return { status: 200, url, html: pageNotFoundHtml }
        }

        throw new Error(`Unexpected Estee Lauder India URL: ${url}`)
      },
    }),
    /verified empty careers page changed/i,
  )

  await assert.rejects(
    esteeLauderIndia.createEsteeLauderIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === esteeLauderIndia.CAREERS_URL) {
          return { status: 200, url, html: careersHubHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[0].url) {
          return { status: 200, url, html: brandJobsHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[1].url) {
          return { status: 200, url, html: corporateJobsHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[2].url) {
          return { status: 200, url, html: retailJobsHtml }
        }

        if (url === esteeLauderIndia.EMPTY_CAREERS_ROUTE_DEFINITIONS[3].url) {
          return { status: 200, url, html: technologyJobsHtml }
        }

        if (url === esteeLauderIndia.SEARCH_JOBS_URL) {
          return { status: 200, url, html: careersHubHtml }
        }

        throw new Error(`Unexpected Estee Lauder India URL: ${url}`)
      },
    }),
    /verified missing search-jobs route changed/i,
  )
})
