import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
  <html>
    <head>
      <title>Search our Job Opportunities at Ford Motor Company</title>
    </head>
    <body>
      <h1>Search our Job Opportunities at Ford Motor Company</h1>
      <p>Search results.</p>
      <a href="/search-jobs">Search Jobs</a>
      <label>Job Category</label>
      <p>23 Results found</p>
      <p>Filtered by</p>
      <ul>
        <li>Country: India</li>
        <li>Chennai, India</li>
      </ul>
      <a href="/job/chennai/vehicle-technical-illustration-engineer/48560/11111111111">
        Vehicle Technical Illustration Engineer
      </a>
    </body>
  </html>
`

const searchResultsPayload = {
  status: 'success',
  results: `
    <section id="search-results" data-total-job-results="42" data-total-pages="3" data-current-page="1">
      <section id="search-results-list">
        <ul>
          <li class="job-result">
            <a href="/job/chennai/cyber-security/48560/97412337792" data-job-id="97412337792">
              <h2>Cyber Security</h2>
              <span class="job-location">Chennai, India</span>
            </a>
          </li>
          <li class="job-result">
            <a href="/job/india/customer-identity-platform-engineer/48560/97219053104" data-job-id="97219053104">
              <h2>Customer Identity Platform Engineer</h2>
              <span class="job-location">India</span>
            </a>
          </li>
          <li class="job-result">
            <a href="/job/dearborn/platform-engineer/48560/97111111111" data-job-id="97111111111">
              <h2>Platform Engineer</h2>
              <span class="job-location">Dearborn, Michigan</span>
            </a>
          </li>
        </ul>
        <nav class="pagination">
          <a class="next" href="/search-jobs/results?p=2">next page</a>
        </nav>
      </section>
    </section>
  `,
}

const detailHtml = `
  <html>
    <head>
      <meta name="search-job-apply-url" content="https://apply.ford.com/en/sites/CX_1/job/66213/apply/email">
      <meta name="job-ats-req-id" content="66213">
      <script type="application/ld+json">{
        "@context":"http://schema.org",
        "@type":"JobPosting",
        "datePosted":"2026-7-8",
        "description":"<p>Ford is building secure customer experiences in India.</p><p><strong>Required Skills</strong></p><ul><li><p>Threat modeling for cloud-native applications.</p></li><li><p>Identity and access management fundamentals.</p></li></ul><p><strong>Preferred Skills</strong></p><ul><li><p>Experience with customer identity platforms.</p></li></ul><p><strong>Education</strong></p><ul><li><p>Bachelor's degree in Computer Science or a related field.</p></li></ul><p>Applicants should bring 5+ years of experience building secure services.</p>",
        "employmentType":"Regular",
        "identifier":"66213",
        "title":"Cyber Security",
        "url":"https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792",
        "hiringOrganization":{"@type":"Organization","name":"Ford Motor Pvt Ltd"},
        "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Chennai","addressRegion":"Tamil Nadu","addressCountry":"India"}}]
      }</script>
    </head>
    <body>
      <section class="ajd_section ajd_job-details job-description" data-selector-name="jobdetails" data-org-id="48560" data-job-id="97412337792">
        <h2 class="ajd_section__heading ajd_job-details__heading heading-2">Cyber Security</h2>
        <p class="ajd_header__location">Chennai, India</p>
      </section>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fordindia/script.js')
  } catch {
    assert.fail('Expected Ford India scraper module at ../../scraper/fordindia/script.js')
  }
}

test('Ford India exports a stable exact-name wrapper over the verified Ford India TalentBrew public contract', async () => {
  const fordIndia = await loadModule()

  assert.equal(fordIndia.SOURCE, 'fordindia')
  assert.equal(fordIndia.COMPANY, 'Ford India')
  assert.equal(fordIndia.OFFICIAL_BRAND_NAME, 'Ford Motor Pvt Ltd')
  assert.equal(
    fordIndia.CAREERS_URL,
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(fordIndia.RESULTS_POST_URL, 'https://www.careers.ford.com/search-jobs/resultspost')
  assert.equal(fordIndia.INDIA_FACET_ID, '1269750')
  assert.equal(fordIndia.VERIFIED_ON, '2026-07-15')
  assert.match(fordIndia.VERIFIED_SURFACE_SUMMARY, /23 Results found/i)
  assert.equal(fordIndia.hasVerifiedFordIndiaCareersPageSignal(careersPageHtml), true)
  assert.deepEqual(
    fordIndia.decorateFordIndiaJob(
      {
        title: 'Cyber Security',
        company: 'Ford Motor Pvt Ltd',
        source: 'fordmotorpvtltd',
        jobId: '97412337792',
        link: 'https://apply.ford.com/en/sites/CX_1/job/66213/apply/email',
        applyUrl: 'https://apply.ford.com/en/sites/CX_1/job/66213/apply/email',
        sourceUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
      },
      '2026-07-15T19:00:00.000Z',
    ),
    {
      title: 'Cyber Security',
      company: 'Ford India',
      source: 'fordindia',
      jobId: '97412337792',
      link: 'https://apply.ford.com/en/sites/CX_1/job/66213/apply/email',
      applyUrl: 'https://apply.ford.com/en/sites/CX_1/job/66213/apply/email',
      sourceUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
      companyCareerPage:
        'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
      companyDomain: 'careers.ford.com',
      atsPlatform: 'talentbrew-radancy',
      scrapedAt: '2026-07-15T19:00:00.000Z',
    },
  )
})

test('Ford India run validates the careers page and decorates jobs from the existing Ford India TalentBrew scraper', async () => {
  const fordIndia = await loadModule()
  const requests = []

  const jobs = await fordIndia.createFordIndiaScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-15T19:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requests.push(url)
      assert.equal(
        url,
        'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
      )
      return {
        status: 200,
        url,
        html: careersPageHtml,
      }
    },
    fetchJson: async () => {
      assert.fail('Ford India should use the filtered Ford search page HTML, not resultspost')
    },
    fetchText: async (url) => {
      requests.push(url)
      if (url === 'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D') {
        return searchResultsPayload.results
      }
      if (url === 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792') {
        return detailHtml
      }
      throw new Error(`Unexpected Ford India detail URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
    'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'fordindia')
  assert.equal(jobs[0].company, 'Ford India')
  assert.equal(jobs[0].companyCareerPage, fordIndia.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'careers.ford.com')
  assert.equal(jobs[0].atsPlatform, 'talentbrew-radancy')
  assert.equal(jobs[0].requisitionId, '66213')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T19:00:00.000Z')
})

test('Ford India fails closed when the verified India-filtered Ford careers page drifts materially', async () => {
  const fordIndia = await loadModule()

  await assert.rejects(
    fordIndia.createFordIndiaScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Different careers surface</h1></body></html>',
      }),
    }),
    /verified Ford India careers page/i,
  )
})
