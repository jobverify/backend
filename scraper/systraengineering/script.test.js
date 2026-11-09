import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Systra Engineering scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Group SYSTRA</title>
    </head>
    <body>
      <header>
        <p>Confidence moves the world</p>
        <a href="https://www.systra.com/en/join-us/">Join us!</a>
      </header>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <div class="intro_job-list">
        <p>
          Already applied? Access
          <a href="https://careers-systra.icims.com/jobs/login?loginOnly=1&amp;redirect=&amp;in_iframe=1&amp;hashed=-625886743">
            your candidate portal here
          </a>.
        </p>
      </div>
      <form id="jobs-filter" action="https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing">
        <select id="country" name="country">
          <option value="">Country</option>
          <option value="india_en">India</option>
        </select>
        <input type="hidden" id="job-page" name="page" value="1">
      </form>
      <script>
        var SYSTRA = {
          "jobs_listing_endpoint":"https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing",
          "jobs_listing_nonce":"test-nonce-123",
          "lang":"en",
          "one_result":"1 result",
          "no_result":"0 result",
          "previous":"Previous",
          "next":"Next"
        };
      </script>
    </body>
  </html>
`

const jobCardOne = `
  <a href="https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/" class="job">
    <div class="tag">
      <span class="contract">Permanent</span>
      <span class="field">Project Management</span>
      <span class="location">New Delhi, India</span>
    </div>
    <div class="content">
      <p>Sr. Planning &amp; Monitoring Expert (K2) &#8211; Mumbai</p>
    </div>
    <div class="more">
      <p>Read more</p>
    </div>
  </a>
`

const jobCardTwo = `
  <a href="https://www.systra.com/en/job-offers/senior-contract-management-specialist_bid-position-en-9896/" class="job">
    <div class="tag">
      <span class="contract">Fixed-term contract</span>
      <span class="field">Project Management</span>
      <span class="location">Ahmedabad, India</span>
    </div>
    <div class="content">
      <p>Senior Contract Management Specialist_BID Position</p>
    </div>
    <div class="more">
      <p>Read more</p>
    </div>
  </a>
`

const listingPayloadCombined = {
  jobs: `${jobCardOne}${jobCardTwo}`,
  search: '',
  params: {
    systra_job_country: 'india_en',
    systra_job_domain: '',
    systra_job_contract: '',
    systra_job_experience: '',
  },
  stats: {
    c: 2,
    l: 10,
    cp: 1,
    mp: 1,
  },
  debug: {},
}

const listingPayloadPageOne = {
  ...listingPayloadCombined,
  jobs: jobCardOne,
  stats: {
    c: 2,
    l: 10,
    cp: 1,
    mp: 2,
  },
}

const listingPayloadPageTwo = {
  ...listingPayloadCombined,
  jobs: jobCardTwo,
  stats: {
    c: 2,
    l: 10,
    cp: 2,
    mp: 2,
  },
}

const detailHtmlOne = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Sr. Planning &amp; Monitoring Expert (K2) - Mumbai - Group</title>
      <script type="application/ld+json">
        {"datePublished":"2026-07-10T03:54:00+00:00"}
      </script>
    </head>
    <body>
      <div id="main">
        <div class="entry-content job">
          <section class="job-content">
            <div>
              <h1>Sr. Planning &amp; Monitoring Expert (K2) &#8211; Mumbai</h1>
              <p>SYSTRA India overview.</p>
              <h2>Context</h2>
              <p>In India, SYSTRA is an international consulting and engineering company.</p>
              <h2>Missions/Main Duties</h2>
              <ul>
                <li>Years of experience - 15+ Years</li>
                <li>Use Primavera P6</li>
              </ul>
              <h2>Profile/Skills</h2>
              <ul>
                <li>Excellent written and oral English communication skills.</li>
                <li>Ability to problem solve.</li>
              </ul>
            </div>
            <section class="marque_employeur"></section>
          </section>
          <aside class="job-sidebar">
            <div class="job-sidebar_detail_list">
              <p><span>Country/Region :</span><span>India</span></p>
              <p><span>Location :</span><span>New Delhi</span></p>
              <p><span>Field :</span><span>Project Management</span></p>
              <p><span>Level of experience :</span><span>15+</span></p>
            </div>
          </aside>
        </div>
        <a href="https://careers-systra.icims.com/jobs/9757/sr.-planning-%26-monitoring-expert-%28k2%29---mumbai/job?mode=apply" class="postuler">
          Apply for the offer
        </a>
      </div>
    </body>
  </html>
`

const detailHtmlTwo = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Senior Contract Management Specialist_BID Position - Group</title>
      <script type="application/ld+json">
        {"datePublished":"2026-07-08T08:00:00+00:00"}
      </script>
    </head>
    <body>
      <div id="main">
        <div class="entry-content job">
          <section class="job-content">
            <div>
              <h1>Senior Contract Management Specialist_BID Position</h1>
              <p>Support bid-stage contract strategy for infrastructure projects.</p>
              <h2>Profile/Skills</h2>
              <ul>
                <li>FIDIC contract administration</li>
                <li>Commercial risk review</li>
              </ul>
            </div>
            <section class="marque_employeur"></section>
          </section>
          <aside class="job-sidebar">
            <div class="job-sidebar_detail_list">
              <p><span>Country/Region :</span><span>India</span></p>
              <p><span>Location :</span><span>Ahmedabad</span></p>
              <p><span>Field :</span><span>Project Management</span></p>
              <p><span>Level of experience :</span><span>10-15 years</span></p>
            </div>
          </aside>
        </div>
        <a href="https://careers-systra.icims.com/jobs/9896/senior-contract-management-specialist_bid-position/job?mode=apply" class="postuler">
          Apply for the offer
        </a>
      </div>
    </body>
  </html>
`

test('Systra Engineering constants stay pinned to the verified official homepage, careers page, and first-party jobs config', async () => {
  const systra = await loadModule()

  assert.equal(systra.SOURCE, 'systraengineering')
  assert.equal(systra.COMPANY, 'Systra Engineering')
  assert.equal(systra.HOMEPAGE_URL, 'https://www.systra.com/en/')
  assert.equal(systra.CAREERS_URL, 'https://www.systra.com/en/join-us/')
  assert.equal(systra.JOBS_LISTING_ENDPOINT, 'https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing')
  assert.equal(systra.INDIA_COUNTRY_FILTER, 'india_en')
  assert.equal(systra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(systra.extractCareersUrl(homepageHtml), systra.CAREERS_URL)
  assert.equal(systra.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(systra.extractCareersConfig(careersHtml), {
    jobsListingEndpoint: 'https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing',
    jobsListingNonce: 'test-nonce-123',
    lang: 'en',
  })
  assert.equal(systra.hasListingsPayload(listingPayloadCombined), true)
})

test('extractJobCards and extractJobDetail normalize the verified first-party India jobs surface', async () => {
  const systra = await loadModule()

  const listings = systra.extractJobCards(listingPayloadCombined.jobs)

  assert.deepEqual(listings, [
    {
      title: 'Sr. Planning & Monitoring Expert (K2) - Mumbai',
      company: 'Systra Engineering',
      department: 'Project Management',
      location: 'New Delhi, India',
      city: 'New Delhi',
      country: 'India',
      jobId: '9757',
      requisitionId: '9757',
      sourceUrl: 'https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/',
      applyUrl: 'https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Senior Contract Management Specialist_BID Position',
      company: 'Systra Engineering',
      department: 'Project Management',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: '9896',
      requisitionId: '9896',
      sourceUrl: 'https://www.systra.com/en/job-offers/senior-contract-management-specialist_bid-position-en-9896/',
      applyUrl: 'https://www.systra.com/en/job-offers/senior-contract-management-specialist_bid-position-en-9896/',
      employmentType: 'Fixed-term contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])

  assert.deepEqual(systra.extractJobDetail(detailHtmlOne, listings[0]), {
    title: 'Sr. Planning & Monitoring Expert (K2) - Mumbai',
    company: 'Systra Engineering',
    department: 'Project Management',
    location: 'New Delhi, India',
    city: 'New Delhi',
    country: 'India',
    jobId: '9757',
    requisitionId: '9757',
    sourceUrl: 'https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/',
    applyUrl: 'https://careers-systra.icims.com/jobs/9757/sr.-planning-%26-monitoring-expert-%28k2%29---mumbai/job?mode=apply',
    employmentType: 'Permanent',
    experienceRequired: '15+',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Excellent written and oral English communication skills.',
      'Ability to problem solve.',
    ],
    postingDate: '2026-07-10T03:54:00+00:00',
    closingDate: null,
    jobDescription: 'SYSTRA India overview. Context In India, SYSTRA is an international consulting and engineering company. Missions/Main Duties Years of experience - 15+ Years Use Primavera P6 Profile/Skills Excellent written and oral English communication skills. Ability to problem solve.',
  })
})

test('run verifies the official SYSTRA surfaces, posts the first-party India filter, paginates, and decorates jobs', async () => {
  const systra = await loadModule()
  const requestedTextUrls = []
  const requestedJsonCalls = []

  const jobs = await systra.createSystraEngineeringScraper({ maxPages: 5 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === systra.HOMEPAGE_URL) return homepageHtml
      if (url === systra.CAREERS_URL) return careersHtml
      if (url === 'https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/') {
        return detailHtmlOne
      }
      if (url === 'https://www.systra.com/en/job-offers/senior-contract-management-specialist_bid-position-en-9896/') {
        return detailHtmlTwo
      }

      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJsonCalls.push({
        url,
        nonce: options.headers?.['X-WP-Nonce'],
        body: options.body?.toString(),
      })

      if (options.body?.toString() === 'page=1&country=india_en&lang=en') {
        return listingPayloadPageOne
      }

      if (options.body?.toString() === 'page=2&country=india_en&lang=en') {
        return listingPayloadPageTwo
      }

      throw new Error(`Unexpected JSON request: ${url} ${options.body?.toString()}`)
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    'https://www.systra.com/en/',
    'https://www.systra.com/en/join-us/',
    'https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/',
    'https://www.systra.com/en/job-offers/senior-contract-management-specialist_bid-position-en-9896/',
  ])
  assert.deepEqual(requestedJsonCalls, [
    {
      url: 'https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing',
      nonce: 'test-nonce-123',
      body: 'page=1&country=india_en&lang=en',
    },
    {
      url: 'https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing',
      nonce: 'test-nonce-123',
      body: 'page=2&country=india_en&lang=en',
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'systraengineering')
  assert.equal(
    jobs[0].link,
    'https://careers-systra.icims.com/jobs/9757/sr.-planning-%26-monitoring-expert-%28k2%29---mumbai/job?mode=apply',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')
  assert.equal(jobs[1].jobId, '9896')
})

test('run overlaps SYSTRA detail page fetches so large India batches do not time out sequentially', async () => {
  const systra = await loadModule()
  let activeDetails = 0
  let maxActiveDetails = 0

  const jobs = await systra.createSystraEngineeringScraper({ maxPages: 2 }).run({
    fetchText: async (url) => {
      if (url === systra.HOMEPAGE_URL) return homepageHtml
      if (url === systra.CAREERS_URL) return careersHtml
      if (
        url === 'https://www.systra.com/en/job-offers/sr-planning-monitoring-expert-k2-mumbai-en-9757/'
        || url === 'https://www.systra.com/en/job-offers/senior-contract-management-specialist_bid-position-en-9896/'
      ) {
        activeDetails += 1
        maxActiveDetails = Math.max(maxActiveDetails, activeDetails)
        await new Promise((resolve) => setTimeout(resolve, 20))
        activeDetails -= 1
        return url.includes('9757') ? detailHtmlOne : detailHtmlTwo
      }

      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async () => listingPayloadCombined,
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.ok(maxActiveDetails > 1, `expected overlapping detail fetches, saw max concurrency ${maxActiveDetails}`)
})

test('run fails closed when the verified official SYSTRA careers page loses the first-party jobs config', async () => {
  const systra = await loadModule()

  await assert.rejects(
    systra.createSystraEngineeringScraper().run({
      fetchText: async (url) => {
        if (url === systra.HOMEPAGE_URL) return homepageHtml
        if (url === systra.CAREERS_URL) {
          return '<html><body><h1>Join us</h1><p>No verified jobs filter or config.</p></body></html>'
        }
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => listingPayloadCombined,
    }),
    /verified official careers page/i,
  )
})
