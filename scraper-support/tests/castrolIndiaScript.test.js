import assert from 'node:assert/strict'
import test from 'node:test'

const loadCastrolIndiaModule = async () => {
  try {
    return await import('../../scraper/castrolindia/script.js')
  } catch {
    assert.fail('Expected Castrol India scraper module at ../../scraper/castrolindia/script.js')
  }
}

const sitemapHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Sitemap | Castrol India</title>
  </head>
  <body>
    <a href="/en_in/india/home/about-castrol/careers.html">Careers</a>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Careers | Castrol India</title>
    <link rel="canonical" href="https://www.castrol.com/en_in/india/home/about-castrol/careers.html">
  </head>
  <body>
    <main>
      <h1>Find a job at Castrol and build a career with no limit</h1>
      <h2>Be part of our story</h2>
      <p>Working with us offers reward, prestige and the opportunity to do brilliant things.</p>
    </main>
  </body>
</html>
`

const graduateProgrammesHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Graduate programmes | Castrol India</title>
  </head>
  <body>
    <main>
      <h1>Graduate programmes</h1>
      <h2>Development programmes</h2>
      <p>Our graduates are curious, driven and have a thirst for knowledge.</p>
      <p>As a graduate with Castrol, you can expect:</p>
      <a href="https://www.bp.com/en/global/corporate/careers.html">BP Careers</a>
    </main>
  </body>
</html>
`

const blockedBpCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Something went wrong</title>
  </head>
  <body>
    <h1>Something went wrong</h1>
    <p>An unexpected server error has occurred.</p>
    <a href="https://www.linkedin.com/company/bp">LinkedIn</a>
    <a href="https://twitter.com/bp_plc">X</a>
  </body>
</html>
`

const bpSearchPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opportunities at bp | Search open roles</title>
    <script src="https://d37szssm2oooap.cloudfront.net/assets/bp/js/algoliasearch-lite.umd.js"></script>
  </head>
  <body>
    <h1>Search and apply</h1>
    <script>
      window.searchConfig = {
        appId: 'UM59DWRPA1',
        apiKey: '33719eb8d9f28725f375583b7e78dbab',
        indexName: 'production_bp_jobs'
      }
    </script>
  </body>
</html>
`

const bpSearchNoOpenRolesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opportunities at bp | Search open roles</title>
    <script src="https://d37szssm2oooap.cloudfront.net/assets/bp/js/algoliasearch-lite.umd.js"></script>
  </head>
  <body>
    <main>
      <h1>Search and apply</h1>
      <p>There are no open roles</p>
      <p>No matching jobs found.</p>
    </main>
  </body>
</html>
`

const bpAlgoliaPayload = {
  nbHits: 3,
  hits: [
    {
      id: 560746,
      title: 'Supply & DRP Planner',
      external_id: 'RQ113479',
      job_code: ['RQ113479'],
      group: ['Business Support'],
      location: ['India | Pune, India'],
      city: ['Pune'],
      primary_country: ['India'],
      time_type: ['Full time'],
      job_type: ['Professionals'],
      remote_type: ['This position is not available for remote working'],
      job_detail_link: [
        'https://bpinternational.wd3.myworkdayjobs.com/bpCareers/job/India---Pune/Supply---DRP-Planner_RQ113479/apply',
      ],
    },
    {
      id: 560692,
      title: 'Head of India Tax',
      external_id: 'RQ113586',
      job_code: ['RQ113586'],
      group: ['Tax'],
      location: ['India | Mumbai, India'],
      city: ['Mumbai'],
      primary_country: ['India'],
      time_type: ['Full time'],
      job_type: ['Professionals'],
      remote_type: ['This position is not available for remote working'],
      job_detail_link: [
        'https://bpinternational.wd3.myworkdayjobs.com/bpCareers/job/India---Mumbai/Head-of-India-Tax_RQ113586/apply',
      ],
    },
    {
      id: 560745,
      title: 'Area Sales Manager',
      external_id: 'RQ112887',
      location: ['United States of America | Anchorage, United States of America'],
      city: ['Anchorage'],
      primary_country: ['United States of America'],
      job_detail_link: [
        'https://bpinternational.wd3.myworkdayjobs.com/bpCareers/job/US-Non-Office-TX/Area-Sales-Manger_RQ112887/apply',
      ],
    },
  ],
}

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BP careers search and apply</title>
  </head>
  <body>
    <main>
      <h1>Search jobs</h1>
      <p>Job alerts</p>
      <p>Keyword search</p>
      <p>Requisition ID 12345</p>
    </main>
  </body>
</html>
`

test('Castrol India sentinel pins the verified careers sitemap, careers pages, and blocked BP handoff', async () => {
  const castrolIndia = await loadCastrolIndiaModule()

  assert.equal(castrolIndia.SOURCE, 'castrolindia')
  assert.equal(castrolIndia.COMPANY, 'Castrol India')
  assert.equal(castrolIndia.SITEMAP_URL, 'https://www.castrol.com/en_in/india/home/sitemap.html')
  assert.equal(
    castrolIndia.CAREERS_PAGE_URL,
    'https://www.castrol.com/en_in/india/home/about-castrol/careers.html',
  )
  assert.equal(
    castrolIndia.GRADUATE_PROGRAMMES_URL,
    'https://www.castrol.com/en_in/india/home/about-castrol/careers/graduate-programmes.html',
  )
  assert.equal(
    castrolIndia.BP_CAREERS_URL,
    'https://www.bp.com/en/global/corporate/careers.html',
  )
  assert.equal(
    castrolIndia.BP_SEARCH_APPLY_URL,
    'https://www.bp.com/en/global/corporate/careers/search-and-apply.html',
  )
  assert.equal(castrolIndia.BP_ALGOLIA_APP_ID, 'UM59DWRPA1')
  assert.equal(castrolIndia.BP_ALGOLIA_INDEX_NAME, 'production_bp_jobs')
  assert.equal(castrolIndia.hasOfficialSitemapSignal(sitemapHtml), true)
  assert.equal(castrolIndia.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(castrolIndia.hasOfficialGraduateProgrammesSignal(graduateProgrammesHtml), true)
  assert.equal(
    castrolIndia.hasBlockedBpCareersSignal({ status: 403, html: blockedBpCareersHtml }),
    true,
  )
  assert.equal(castrolIndia.hasPublicJobListingsSignal(careersPageHtml), false)
  assert.equal(castrolIndia.hasPublicJobListingsSignal(publicJobsHtml), true)
  assert.equal(castrolIndia.hasOfficialSitemapSignal('<html><body><a>Careers</a></body></html>'), false)
  assert.equal(castrolIndia.hasOfficialCareersPageSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(
    castrolIndia.hasOfficialGraduateProgrammesSignal('<html><body><h1>Graduate programmes</h1></body></html>'),
    false,
  )
})

test('Castrol India maps public BP Algolia India hits to Castrol India jobs', async () => {
  const castrolIndia = await loadCastrolIndiaModule()

  const jobs = castrolIndia.extractBpIndiaJobs(bpAlgoliaPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Supply & DRP Planner',
    company: 'Castrol India',
    department: 'Business Support',
    location: 'India | Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: '560746',
    requisitionId: 'RQ113479',
    sourceUrl: 'https://bpinternational.wd3.myworkdayjobs.com/bpCareers/job/India---Pune/Supply---DRP-Planner_RQ113479/apply',
    applyUrl: 'https://bpinternational.wd3.myworkdayjobs.com/bpCareers/job/India---Pune/Supply---DRP-Planner_RQ113479/apply',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'This position is not available for remote working',
  })
})

test('Castrol India scraper follows the verified Castrol handoff and parses public BP India jobs', async () => {
  const castrolIndia = await loadCastrolIndiaModule()
  const requestedUrls = []
  const algoliaRequests = []

  const jobs = await castrolIndia.createLegacyCastrolIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === castrolIndia.SITEMAP_URL) {
        return { status: 200, url, html: sitemapHtml }
      }

      if (url === castrolIndia.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === castrolIndia.BP_SEARCH_APPLY_URL) {
        return { status: 200, url: 'https://careers.bp.com/listing', html: bpSearchPageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchAlgoliaJobs: async (request) => {
      algoliaRequests.push(request)
      return bpAlgoliaPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    castrolIndia.SITEMAP_URL,
    castrolIndia.CAREERS_PAGE_URL,
    castrolIndia.BP_SEARCH_APPLY_URL,
  ])
  assert.equal(algoliaRequests.length, 1)
  assert.match(algoliaRequests[0].params, /facetFilters=/)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'castrolindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Castrol India returns [] when the verified BP search surface reports no open roles', async () => {
  const castrolIndia = await loadCastrolIndiaModule()
  const requestedUrls = []

  const jobs = await castrolIndia.createLegacyCastrolIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === castrolIndia.SITEMAP_URL) {
        return { status: 200, url, html: sitemapHtml }
      }

      if (url === castrolIndia.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === castrolIndia.BP_SEARCH_APPLY_URL) {
        return { status: 200, url: 'https://careers.bp.com/listing', html: bpSearchNoOpenRolesHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchAlgoliaJobs: async () => {
      throw new Error('Algolia should not be queried when the public BP listing reports no open roles')
    },
  })

  assert.deepEqual(requestedUrls, [
    castrolIndia.SITEMAP_URL,
    castrolIndia.CAREERS_PAGE_URL,
    castrolIndia.BP_SEARCH_APPLY_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Castrol India sentinel fails closed when the careers surface or BP handoff changes', async () => {
  const castrolIndia = await loadCastrolIndiaModule()

  await assert.rejects(
    castrolIndia.createLegacyCastrolIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === castrolIndia.SITEMAP_URL) {
          return { status: 200, url, html: sitemapHtml }
        }

        if (url === castrolIndia.CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h1>Find a job at Castrol and build a career with no limit</h1>
                  <p>Search jobs by keyword and requisition ID.</p>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page no longer matches the verified official surface/i,
  )

  await assert.rejects(
    castrolIndia.createLegacyCastrolIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === castrolIndia.SITEMAP_URL) {
          return { status: 200, url, html: sitemapHtml }
        }

        if (url === castrolIndia.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === castrolIndia.GRADUATE_PROGRAMMES_URL) {
          return { status: 200, url, html: graduateProgrammesHtml }
        }

        if (url === castrolIndia.BP_CAREERS_URL) {
          return { status: 403, url, html: blockedBpCareersHtml }
        }

        if (url === castrolIndia.BP_SEARCH_APPLY_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public BP jobs surface/i,
  )
})
