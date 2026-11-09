import assert from 'node:assert/strict'
import test from 'node:test'

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

const currentSearchPageHtml = `
  <section id="search-results" class="search-results" data-total-job-results="2" data-total-pages="1" data-current-page="1" data-records-per-page="15">
    <p id="search-results-headline-label" class="search-results__heading">2 Results found</p>
    <div id="search-results-list" class="search-results-list">
      <div id="applied-filters" class="applied-filters">
        <h2 id="applied-filters-label" class="applied-filters__heading">Filtered by</h2>
        <ul class="applied-filters__list">
          <li class="applied-filters__item">
            <button class="applied-filters__btn" data-id="1269750" data-field-name="" data-facet-type="2">Country: India</button>
          </li>
        </ul>
      </div>
      <ul id="search-results-jobs" class="search-results-list__list" data-results-count="2">
        <li class="search-results-list__item">
          <div class="search-results-list__content">
            <h2 class="search-results-list__job-title">
              <a class="search-results-list__job-link" href="/job/chennai/cyber-security/48560/97412337792" data-job-id="97412337792" id="job-97412337792">Cyber Security &amp; Identity</a>
            </h2>
            <ul class="search-results-list__job-info-list">
              <li class="search-results-list__job-info job-location"> Chennai, India </li>
            </ul>
          </div>
        </li>
        <li class="search-results-list__item">
          <div class="search-results-list__content">
            <h2 class="search-results-list__job-title">
              <a class="search-results-list__job-link" href="/job/india/customer-identity-platform-engineer/48560/97219053104" data-job-id="97219053104" id="job-97219053104">Customer Identity Platform Engineer</a>
            </h2>
            <ul class="search-results-list__job-info-list">
              <li class="search-results-list__job-info job-location"> India, Remote </li>
            </ul>
          </div>
        </li>
      </ul>
    </div>
  </section>
  <div class="partial partial-2">
    <div class="job-list" data-selector-name="joblist">
      <a class="job-list__job-link" href="/job/chennai/related-role/48560/11111111111" data-job-id="11111111111">Related Ford role</a>
      <li class="job-list__job-info job-location">Chennai, India</li>
    </div>
  </div>
`

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
    return await import('../../scraper/fordmotorpvtltd/script.js')
  } catch {
    return null
  }
}

test('Ford Motor Pvt Ltd exports a stable India TalentBrew public contract', async () => {
  const ford = await loadModule()
  assert.ok(ford)

  assert.equal(ford.COMPANY_NAME, 'Ford Motor Pvt Ltd')
  assert.equal(ford.SOURCE, 'fordmotorpvtltd')
  assert.equal(ford.ATS_PLATFORM, 'talentbrew-radancy')
  assert.equal(
    ford.CAREER_PAGE_URL,
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(ford.buildSearchUrl(), ford.CAREER_PAGE_URL)
  assert.equal(
    ford.buildSearchUrl({ page: 2 }),
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D&p=2',
  )
})

test('extractSearchResults keeps only India jobs from Ford TalentBrew HTML fragments', async () => {
  const ford = await loadModule()
  assert.ok(ford)

  const jobs = ford.extractSearchResults(searchResultsPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Cyber Security',
    company: 'Ford Motor Pvt Ltd',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '97412337792',
    requisitionId: '97412337792',
    sourceUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
    applyUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs[1].jobId, '97219053104')
  assert.equal(jobs[1].city, null)
})

test('extractSearchResults reads the current Ford filtered search page job-list markup', async () => {
  const ford = await loadModule()
  assert.ok(ford)

  const jobs = ford.extractSearchResults(currentSearchPageHtml)

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Cyber Security & Identity')
  assert.equal(jobs[0].location, 'Chennai, India')
  assert.equal(jobs[0].jobId, '97412337792')
  assert.equal(
    jobs[0].sourceUrl,
    'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
  )
  assert.equal(jobs[1].title, 'Customer Identity Platform Engineer')
  assert.equal(jobs[1].location, 'India, Remote')
  assert.equal(jobs[1].city, 'India')
})

test('extractPaginationSummary reads Ford TalentBrew paging from the HTML fragment payload', async () => {
  const ford = await loadModule()
  assert.ok(ford)

  assert.deepEqual(ford.extractPaginationSummary(searchResultsPayload), {
    hasNext: true,
    currentPage: 1,
    totalPages: 3,
    totalJobCount: 42,
  })
})

test('extractJobDetail reads Ford detail JSON-LD and first-step apply handoff', async () => {
  const ford = await loadModule()
  assert.ok(ford)

  const detail = ford.extractJobDetail(detailHtml, {
    title: 'Cyber Security',
    company: 'Ford Motor Pvt Ltd',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '97412337792',
    requisitionId: '97412337792',
    sourceUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
    applyUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
  })

  assert.deepEqual(detail, {
    title: 'Cyber Security',
    company: 'Ford Motor Pvt Ltd',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '97412337792',
    requisitionId: '66213',
    sourceUrl: 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
    applyUrl: 'https://apply.ford.com/en/sites/CX_1/job/66213/apply/email',
    employmentType: 'Full-time',
    experienceRequired: '5+ years',
    minimumQualification: "Bachelor's degree in Computer Science or a related field.",
    preferredQualification: 'Experience with customer identity platforms.',
    requiredSkills: [
      'Threat modeling for cloud-native applications.',
      'Identity and access management fundamentals.',
    ],
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription: /Ford is building secure customer experiences in India/i.test(detail.jobDescription)
      ? detail.jobDescription
      : null,
    remoteStatus: null,
  })
})

test('run paginates Ford India results, enriches detail pages, and decorates shared runner fields', async () => {
  const ford = await loadModule()
  assert.ok(ford)

  const requests = []
  const scraper = ford.createFordMotorPvtLtdScraper({ maxPages: 1, maxJobs: 1 })

  const jobs = await scraper.run({
    fetchJson: async () => {
      assert.fail('Ford scraper should fetch the filtered search page HTML, not resultspost')
    },
    fetchText: async (url) => {
      requests.push(url)
      if (url === 'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D') {
        return currentSearchPageHtml
      }
      if (url === 'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792') {
        return detailHtml
      }
      throw new Error(`Unexpected Ford URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
    'https://www.careers.ford.com/job/chennai/cyber-security/48560/97412337792',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'fordmotorpvtltd')
  assert.equal(jobs[0].company, 'Ford Motor Pvt Ltd')
  assert.equal(jobs[0].jobId, '97412337792')
  assert.equal(jobs[0].requisitionId, '66213')
  assert.equal(jobs[0].applyUrl, 'https://apply.ford.com/en/sites/CX_1/job/66213/apply/email')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
