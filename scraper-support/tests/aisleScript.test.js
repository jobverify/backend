import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="culture.html">Culture</a>
      <a href="/purchase">Purchase</a>
    </nav>
    <main>
      <h1>Nothing casual about this dating app.</h1>
      <h2>Meet Our Crew</h2>
      <h3>Want to join our team?</h3>
      <a href="https://aisle.freshteam.com/jobs">Check Openings</a>
    </main>
    <footer>© Aisle Network Private Limited</footer>
  </body>
</html>
`

const emptyBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aisle Careers</title>
  </head>
  <body>
    <h4>Aisle Careers</h4>
    <h3>Open Positions</h3>
    <div>Remote Only</div>
    <div>No jobs found</div>
    <div>Oops, you have no jobs that match the filter conditions.</div>
    <div>Try refining your search.</div>
  </body>
</html>
`

const listingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aisle Careers</title>
  </head>
  <body>
    <h4>Aisle Careers</h4>
    <h3>Open Positions</h3>
    <div class="job-role-list" data-portal-id="job-role-list">
      <ul>
        <li data-portal-role="_role_1001">
          <div class="role-title">
            <h5>
              Product &amp; Design
              <span class="mobile-role-count">- 2 Open Roles</span>
            </h5>
          </div>
          <div>
            <div class="job-list">
              <a href="/jobs/AbCd1234/product-manager" class="heading" data-portal-title="productmanager" data-portal-location="Bengaluru, India" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Product Manager</div>
                    <div class="job-desc text">Own the roadmap for Aisle's high-intent dating journeys.</div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      Bengaluru, Karnataka
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
              <a href="/jobs/UsRole987/staff-product-manager" class="heading" data-portal-title="staffproductmanager" data-portal-location="San Francisco, United States" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Staff Product Manager</div>
                    <div class="job-desc text">Lead monetization experiments for a global market.</div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      San Francisco, California
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const productManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="job-details">
      <div class="job-details-header">
        <div class="content">
          <a class="link-back" id="job-details-back-btn">
            <i class="icon-arrow-left"></i>Product &amp; Design
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">Product Manager</h1>
              <div class="stick-hide-in-mobile text-color">
                Bengaluru, Karnataka
                <div>
                  Work Type:
                  Full Time
                </div>
              </div>
            </div>
            <div class="col-xs-4 pull-xs-right text-right">
              <a href="#applicant-form" class="btn btn-custom">Apply Now</a>
            </div>
          </div>
        </div>
      </div>
      <div class="job-details-content content">
        <div>
          <p>Own the roadmap for Aisle's high-intent dating journeys.</p>
          <ul>
            <li>Partner with design, growth, and engineering on product strategy.</li>
            <li>Minimum 4+ years of product management experience in consumer apps.</li>
          </ul>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/aisle/script.js')
  } catch {
    assert.fail('Expected Aisle scraper module at ../../scraper/aisle/script.js')
  }
}

test('Aisle constants stay pinned to the verified homepage handoff and public Freshteam board', async () => {
  const aisle = await loadModule()

  assert.equal(aisle.COMPANY_NAME, 'Aisle')
  assert.equal(aisle.SOURCE, 'aisle')
  assert.equal(aisle.COUNTRY_FILTER, 'India')
  assert.equal(aisle.OFFICIAL_HOMEPAGE_URL, 'https://www.aisle.co/')
  assert.equal(aisle.LISTING_URL, 'https://aisle.freshteam.com/jobs')
  assert.equal(
    aisle.DETAIL_URL_PATTERN,
    'https://aisle.freshteam.com/jobs/{opaque_id}/{slug}',
  )
  assert.equal(
    aisle.isExpectedVerifiedBoardOutage(new Error(`HTTP 500 for ${aisle.LISTING_URL}`)),
    true,
  )
  assert.equal(aisle.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(
    aisle.extractFreshteamJobsUrl(officialHomepageHtml),
    'https://aisle.freshteam.com/jobs',
  )
  assert.equal(aisle.hasOfficialJobsBoardSignal(emptyBoardHtml), true)
  assert.equal(aisle.hasEmptyJobsStateSignal(emptyBoardHtml), true)
  assert.equal(
    aisle.buildDetailUrl('AbCd1234', 'product-manager'),
    'https://aisle.freshteam.com/jobs/AbCd1234/product-manager',
  )
})

test('extractSearchResults parses Aisle Freshteam listings and keeps only India roles', async () => {
  const aisle = await loadModule()

  const listingJobs = aisle.extractListingJobs(listingHtml)
  assert.equal(listingJobs.length, 2)
  assert.equal(listingJobs[0].title, 'Product Manager')
  assert.equal(listingJobs[0].department, 'Product & Design')
  assert.equal(listingJobs[0].employmentType, 'Full Time')
  assert.equal(listingJobs[1].locationText, 'San Francisco, California')

  const jobs = aisle.extractSearchResults({
    listingJobs,
    detailHtmlByUrl: {
      'https://aisle.freshteam.com/jobs/AbCd1234/product-manager': productManagerDetailHtml,
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Product Manager',
      company: 'Aisle',
      department: 'Product & Design',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'AbCd1234',
      requisitionId: 'AbCd1234',
      sourceUrl: 'https://aisle.freshteam.com/jobs/AbCd1234/product-manager',
      applyUrl: 'https://aisle.freshteam.com/jobs/AbCd1234/product-manager',
      employmentType: 'Full-time',
      experienceRequired: '4+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        "Own the roadmap for Aisle's high-intent dating journeys.",
        'Partner with design, growth, and engineering on product strategy.',
        'Minimum 4+ years of product management experience in consumer apps.',
      ].join(' '),
      remoteStatus: 'On-site',
    },
  ])
})

test('run returns [] when the verified Aisle Freshteam board is public but currently empty', async () => {
  const aisle = await loadModule()
  const requestedUrls = []

  const jobs = await aisle.createAisleScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aisle.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
      if (url === aisle.LISTING_URL) return emptyBoardHtml

      throw new Error(`Unexpected Aisle fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    aisle.OFFICIAL_HOMEPAGE_URL,
    aisle.LISTING_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run validates the homepage handoff, filters to India roles, and decorates Aisle jobs when openings exist', async () => {
  const aisle = await loadModule()
  const requestedUrls = []

  const jobs = await aisle.createAisleScraper({ maxJobs: 5 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aisle.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
      if (url === aisle.LISTING_URL) return listingHtml
      if (url === 'https://aisle.freshteam.com/jobs/AbCd1234/product-manager') {
        return productManagerDetailHtml
      }

      throw new Error(`Unexpected Aisle fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    aisle.OFFICIAL_HOMEPAGE_URL,
    aisle.LISTING_URL,
    'https://aisle.freshteam.com/jobs/AbCd1234/product-manager',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aisle')
  assert.equal(jobs[0].company, 'Aisle')
  assert.equal(jobs[0].link, 'https://aisle.freshteam.com/jobs/AbCd1234/product-manager')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Aisle scraper fails closed when the verified homepage handoff or Freshteam board signature drifts', async () => {
  const aisle = await loadModule()

  await assert.rejects(
    aisle.createAisleScraper().run({
      fetchText: async (url) => {
        if (url === aisle.OFFICIAL_HOMEPAGE_URL) {
          return officialHomepageHtml.replace(
            'https://aisle.freshteam.com/jobs',
            'https://jobs.example.com/aisle',
          )
        }

        throw new Error(`Unexpected Aisle fixture URL: ${url}`)
      },
    }),
    /verified official homepage handoff/i,
  )

  await assert.rejects(
    aisle.createAisleScraper().run({
      fetchText: async (url) => {
        if (url === aisle.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
        if (url === aisle.LISTING_URL) {
          return '<html><body><h1>Different Careers</h1><p>Apply somewhere else</p></body></html>'
        }

        throw new Error(`Unexpected Aisle fixture URL: ${url}`)
      },
    }),
    /verified public freshteam board/i,
  )
})

test('Aisle scraper stays fail-closed when the verified public Freshteam board returns the known generic 500 outage', async () => {
  const aisle = await loadModule()

  const jobs = await aisle.createAisleScraper().run({
    fetchText: async (url) => {
      if (url === aisle.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
      if (url === aisle.LISTING_URL) {
        throw new Error(`HTTP 500 for ${aisle.LISTING_URL}`)
      }

      throw new Error(`Unexpected Aisle fixture URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Aisle scraper still marks downstream Freshteam detail 5xx responses as upstream soft failures', async () => {
  const aisle = await loadModule()

  await assert.rejects(
    aisle.createAisleScraper({ maxJobs: 5 }).run({
      fetchText: async (url) => {
        if (url === aisle.OFFICIAL_HOMEPAGE_URL) return officialHomepageHtml
        if (url === aisle.LISTING_URL) return listingHtml
        if (url === 'https://aisle.freshteam.com/jobs/AbCd1234/product-manager') {
          throw new Error('HTTP 500 for https://aisle.freshteam.com/jobs/AbCd1234/product-manager')
        }

        throw new Error(`Unexpected Aisle fixture URL: ${url}`)
      },
    }),
    (error) => {
      assert.match(error.message, /HTTP 500/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      return true
    },
  )
})
