import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Explore new horizons with Boeing</title>
    <meta name="description" content="Join Boeing and do work that changes the world. Explore aerospace and defense careers in engineering, business, IT and more, search jobs and apply here.">
  </head>
  <body id="home">
    <form class="search-form" action="/search-jobs">
      <button>Search Jobs</button>
    </form>
    <a class="header-nav__login-link" href="https://boeing.wd1.myworkdayjobs.com/en-US/EXTERNAL_CAREERS/login">Login</a>
    <p>Join a team of innovators who are creating what's next in aerospace and defense.</p>
  </body>
</html>
`

const searchResultsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Search our Job Opportunities at Boeing</title>
    <meta name="search-analytics-total-jobs" content="14">
    <meta name="dimension7" content="India">
  </head>
  <body>
    <section
      class="search-results"
      id="search-results"
      data-location="India"
      data-location-path="1269750"
      data-total-results="14"
      data-total-job-results="14"
      data-total-pages="1"
      data-current-page="1"
    >
      <div class="search-results__list" id="search-results-list">
        <ul>
          <li class="no-security-clearance">
            <a class="search-results__job-link" href="/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928" data-job-id="97595724928"><span class="search-results__job-title">Experienced Software Engineer &#x2013; UI UX Designer</span></a>
            <span class="search-results__job-info location">Bengaluru, India</span>
            <span class="search-results__job-info date">07/10/2026</span>
          </li>
          <li class="no-security-clearance">
            <a class="search-results__job-link" href="/job/bengaluru/associate-ai-ml-engineer-predictive-maintenance/185/97556420896" data-job-id="97556420896"><span class="search-results__job-title">Associate AI/ML Engineer &#x2013; Predictive Maintenance</span></a>
            <span class="search-results__job-info location">Bengaluru, India</span>
            <span class="search-results__job-info date">07/09/2026</span>
          </li>
          <li>
            <a class="search-results__job-link" href="/job/seattle/lead-engineer/185/12345678900" data-job-id="12345678900"><span class="search-results__job-title">Lead Engineer</span></a>
            <span class="search-results__job-info location">Seattle, United States</span>
            <span class="search-results__job-info date">07/08/2026</span>
          </li>
        </ul>
      </div>
    </section>
  </body>
</html>
`

const zeroResultsSearchHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Search our Job Opportunities at Boeing</title>
    <meta name="search-analytics-total-jobs" content="0">
    <meta name="dimension7" content="India">
  </head>
  <body>
    <section
      class="search-results"
      id="search-results"
      data-location="India"
      data-location-path="1269750"
      data-total-results="0"
      data-total-job-results="0"
      data-total-pages="1"
      data-current-page="1"
      data-no-results="true"
    >
      <h2 class="search-results__heading"><span class="search-results__results-count">0</span> results found in India</h2>
      <div class="search-results__list" id="search-results-list">
        <p class="search-results__no-results-msg" id="no-results">Please try a different keyword/location combination or broaden your search criteria.</p>
      </div>
    </section>
  </body>
</html>
`

const detailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Experienced Software Engineer – UI UX Designer</title>
    <meta name="search-job-apply-url" content="https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---UI-UX-Designer_JR2026516414-1/apply">
    <script type="application/ld+json">{
      "@context":"http://schema.org",
      "@type":"JobPosting",
      "datePosted":"2026-7-10",
      "description":"<p><b>Job Description</b></p><p>At Boeing, we innovate and collaborate to make the world a better place.</p><p><b>Technology for today and tomorrow</b></p><p>The Boeing India Engineering &amp; Technology Center (BIETC) is a 5500+ engineering workforce that contributes to global aerospace growth.</p><p><b>Basic Qualification:</b></p><ul><li><span>Professional UX/UI design</span></li><li><span>Excellent proficiency with Figma</span></li></ul><p><b>Preferred Qualifications (Desired Skills/Experience):</b></p><ul><li>Candidates with experience in Aviation domain will be preferred</li><li>Experience working in a global organization is preferred</li></ul><p><b>Typical Education &amp; Experience:</b> Education/experience typically acquired through advanced education (e.g. Bachelor) and typically 8-12 years' related work experience.</p><p>Applications for this position will be accepted until <b>Jul. 25, 2026</b></p>",
      "employmentType":"Regular",
      "identifier":"JR2026516414",
      "industry":"CORP",
      "title":"Experienced Software Engineer – UI UX Designer",
      "url":"https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928",
      "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Bangalore","addressRegion":"Karnātaka","addressCountry":"India"}}]
    }</script>
  </head>
  <body>
    <section class="job-description" data-selector-name="jobdetails" data-org-id="185" data-job-id="97595724928" data-save-jobs="true">
      <h1 class="job-description__job-title">Experienced Software Engineer &#x2013; UI UX Designer</h1>
      <span class="job-description__job-location">Bengaluru, Karnataka</span>
      <span class="job-description__job-info job-id"><span>Job ID</span> JR2026516414</span>
      <span class="job-description__job-info job-category"><span>Category</span> Information Technology</span>
      <span class="job-description__job-info job-role-type"><span> Role Type</span> Hybrid</span>
      <span class="job-description__job-info job-date"><span>Post Date</span> Jul. 10, 2026</span>
      <a class="button job-apply top" href="https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---UI-UX-Designer_JR2026516414-1/apply">Apply Now</a>
    </section>
  </body>
</html>
`

const loadBoeingIndiaModule = async () => {
  try {
    return await import('../../scraper/boeingindia/script.js')
  } catch {
    assert.fail('Expected Boeing India scraper module at ../../scraper/boeingindia/script.js')
  }
}

test('Boeing India helpers stay pinned to the Thursday, August 13, 2026 careers redirect, India search route, and job detail handoff', async () => {
  const boeingIndia = await loadBoeingIndiaModule()

  assert.equal(boeingIndia.SOURCE, 'boeingindia')
  assert.equal(boeingIndia.COMPANY_NAME, 'Boeing India')
  assert.equal(boeingIndia.OFFICIAL_BRAND_NAME, 'Boeing')
  assert.equal(boeingIndia.ATS_PLATFORM, 'talentbrew-radancy')
  assert.equal(boeingIndia.VERIFIED_ON, '2026-08-13')
  assert.equal(boeingIndia.HOMEPAGE_URL, 'https://www.boeing.com/careers/')
  assert.equal(boeingIndia.CAREERS_LANDING_URL, 'https://jobs.boeing.com/')
  assert.equal(
    boeingIndia.SEARCH_RESULTS_URL,
    'https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2',
  )
  assert.equal(
    boeingIndia.SAMPLE_JOB_URL,
    'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
  )
  assert.equal(boeingIndia.buildSearchUrl(), boeingIndia.SEARCH_RESULTS_URL)
  assert.equal(
    boeingIndia.buildSearchUrl({ page: 2 }),
    'https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2?p=2',
  )
  assert.equal(boeingIndia.hasCareersLandingSignal(homepageHtml), true)
  assert.equal(boeingIndia.hasIndiaSearchResultsSignal(searchResultsHtml), true)
  assert.equal(boeingIndia.hasIndiaSearchResultsSignal(zeroResultsSearchHtml), true)
  assert.deepEqual(boeingIndia.extractPaginationSummary(searchResultsHtml), {
    hasNext: false,
    currentPage: 1,
    totalPages: 1,
    totalJobCount: 14,
  })
  assert.deepEqual(boeingIndia.extractPaginationSummary(zeroResultsSearchHtml), {
    hasNext: false,
    currentPage: 1,
    totalPages: 1,
    totalJobCount: 0,
  })
  assert.deepEqual(
    boeingIndia.extractSearchResults(searchResultsHtml),
    [
      {
        title: 'Experienced Software Engineer – UI UX Designer',
        company: 'Boeing India',
        department: null,
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: '97595724928',
        requisitionId: '97595724928',
        sourceUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
        applyUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-10',
        closingDate: null,
        jobDescription: null,
      },
      {
        title: 'Associate AI/ML Engineer – Predictive Maintenance',
        company: 'Boeing India',
        department: null,
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: '97556420896',
        requisitionId: '97556420896',
        sourceUrl: 'https://jobs.boeing.com/job/bengaluru/associate-ai-ml-engineer-predictive-maintenance/185/97556420896',
        applyUrl: 'https://jobs.boeing.com/job/bengaluru/associate-ai-ml-engineer-predictive-maintenance/185/97556420896',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-09',
        closingDate: null,
        jobDescription: null,
      },
    ],
  )
})

test('Boeing India extractJobDetail reads the first-party detail page and Workday apply handoff', async () => {
  const boeingIndia = await loadBoeingIndiaModule()

  const detail = boeingIndia.extractJobDetail(detailHtml, {
    title: 'Experienced Software Engineer – UI UX Designer',
    company: 'Boeing India',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '97595724928',
    requisitionId: '97595724928',
    sourceUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
    applyUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-10',
    closingDate: null,
    jobDescription: null,
  })

  assert.deepEqual(detail, {
    title: 'Experienced Software Engineer – UI UX Designer',
    company: 'Boeing India',
    department: 'Information Technology',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '97595724928',
    requisitionId: 'JR2026516414',
    sourceUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
    applyUrl: 'https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---UI-UX-Designer_JR2026516414-1/apply',
    employmentType: 'Full-time',
    experienceRequired: '8-12 years',
    minimumQualification: "Education/experience typically acquired through advanced education (e.g. Bachelor) and typically 8-12 years' related work experience.",
    preferredQualification: 'Candidates with experience in Aviation domain will be preferred; Experience working in a global organization is preferred',
    requiredSkills: [
      'Professional UX/UI design',
      'Excellent proficiency with Figma',
    ],
    postingDate: '2026-07-10',
    closingDate: null,
    jobDescription: "Job Description At Boeing, we innovate and collaborate to make the world a better place. Technology for today and tomorrow The Boeing India Engineering & Technology Center (BIETC) is a 5500+ engineering workforce that contributes to global aerospace growth. Basic Qualification: Professional UX/UI design Excellent proficiency with Figma Preferred Qualifications (Desired Skills/Experience): Candidates with experience in Aviation domain will be preferred Experience working in a global organization is preferred Typical Education & Experience: Education/experience typically acquired through advanced education (e.g. Bachelor) and typically 8-12 years' related work experience. Applications for this position will be accepted until Jul. 25, 2026",
    remoteStatus: 'Hybrid',
  })
})

test('Boeing India extractJobDetail captures open-ended experience phrasing from the official job description', async () => {
  const boeingIndia = await loadBoeingIndiaModule()

  const detail = boeingIndia.extractJobDetail(
    `
      <html lang="en">
        <head>
          <title>Experienced Software Engineer - FSD at Boeing</title>
          <meta name="search-job-apply-url" content="https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---FSD_JR2026515903-1/apply">
          <script type="application/ld+json">{
            "@context":"http://schema.org",
            "@type":"JobPosting",
            "datePosted":"2026-7-14",
            "description":"<p><b>Job Description</b></p><p><b>Typical Education &amp; Experience</b>:</p><ul><li><p>Education/experience typically acquired through advanced education (e.g. Bachelor/Masters) and typically 8 or more years' related work experience.</p></li></ul>",
            "employmentType":"Regular",
            "identifier":"JR2026515903",
            "title":"Experienced Software Engineer - FSD",
            "url":"https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-fsd/185/96869650448",
            "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Bangalore","addressCountry":"India"}}]
          }</script>
        </head>
        <body>
          <section class="job-description" data-selector-name="jobdetails" data-org-id="185" data-job-id="96869650448">
            <h1 class="job-description__job-title">Experienced Software Engineer - FSD</h1>
            <span class="job-description__job-location">Bengaluru, Karnataka</span>
            <span class="job-description__job-info job-id"><span>Job ID</span> JR2026515903</span>
          </section>
        </body>
      </html>
    `,
    {
      title: 'Experienced Software Engineer - FSD',
      company: 'Boeing India',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '96869650448',
      requisitionId: '96869650448',
      sourceUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-fsd/185/96869650448',
      applyUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-fsd/185/96869650448',
      postingDate: '2026-07-14',
    },
  )

  assert.equal(detail.experienceRequired, '8+ years')
})

test('Boeing India run validates the careers redirect, parses the India search results, and enriches detail pages', async () => {
  const boeingIndia = await loadBoeingIndiaModule()
  const requests = []

  const jobs = await boeingIndia.createBoeingIndiaScraper({ maxPages: 1, maxJobs: 1 }).run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === boeingIndia.HOMEPAGE_URL) {
        return { status: 200, url: boeingIndia.CAREERS_LANDING_URL, html: homepageHtml }
      }

      if (url === boeingIndia.SEARCH_RESULTS_URL) {
        return { status: 200, url, html: searchResultsHtml }
      }

      if (url === boeingIndia.SAMPLE_JOB_URL) {
        return { status: 200, url, html: detailHtml }
      }

      throw new Error(`Unexpected Boeing India URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    boeingIndia.HOMEPAGE_URL,
    boeingIndia.SEARCH_RESULTS_URL,
    boeingIndia.SAMPLE_JOB_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Experienced Software Engineer – UI UX Designer',
    company: 'Boeing India',
    department: 'Information Technology',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '97595724928',
    requisitionId: 'JR2026516414',
    sourceUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
    applyUrl: 'https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---UI-UX-Designer_JR2026516414-1/apply',
    employmentType: 'Full-time',
    experienceRequired: '8-12 years',
    minimumQualification: "Education/experience typically acquired through advanced education (e.g. Bachelor) and typically 8-12 years' related work experience.",
    preferredQualification: 'Candidates with experience in Aviation domain will be preferred; Experience working in a global organization is preferred',
    requiredSkills: [
      'Professional UX/UI design',
      'Excellent proficiency with Figma',
    ],
    postingDate: '2026-07-10',
    closingDate: null,
    jobDescription: "Job Description At Boeing, we innovate and collaborate to make the world a better place. Technology for today and tomorrow The Boeing India Engineering & Technology Center (BIETC) is a 5500+ engineering workforce that contributes to global aerospace growth. Basic Qualification: Professional UX/UI design Excellent proficiency with Figma Preferred Qualifications (Desired Skills/Experience): Candidates with experience in Aviation domain will be preferred Experience working in a global organization is preferred Typical Education & Experience: Education/experience typically acquired through advanced education (e.g. Bachelor) and typically 8-12 years' related work experience. Applications for this position will be accepted until Jul. 25, 2026",
    remoteStatus: 'Hybrid',
    link: 'https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---UI-UX-Designer_JR2026516414-1/apply',
    source: 'boeingindia',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Boeing India returns an honest zero-job slice when the verified India search route currently exposes no public results', async () => {
  const boeingIndia = await loadBoeingIndiaModule()
  const requests = []

  const jobs = await boeingIndia.createBoeingIndiaScraper({ maxPages: 1 }).run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === boeingIndia.HOMEPAGE_URL) {
        return { status: 200, url: boeingIndia.CAREERS_LANDING_URL, html: homepageHtml }
      }

      if (url === boeingIndia.SEARCH_RESULTS_URL) {
        return { status: 200, url, html: zeroResultsSearchHtml }
      }

      throw new Error(`Unexpected Boeing India URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    boeingIndia.HOMEPAGE_URL,
    boeingIndia.SEARCH_RESULTS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Boeing India fails closed when the careers redirect, India search page, or Workday handoff drifts', async () => {
  const boeingIndia = await loadBoeingIndiaModule()

  await assert.rejects(
    boeingIndia.createBoeingIndiaScraper().run({
      fetchText: async (url) => {
        if (url === boeingIndia.HOMEPAGE_URL) {
          return { status: 200, url: boeingIndia.CAREERS_LANDING_URL, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Boeing India URL: ${url}`)
      },
    }),
    /careers landing/i,
  )

  await assert.rejects(
    boeingIndia.createBoeingIndiaScraper().run({
      fetchText: async (url) => {
        if (url === boeingIndia.HOMEPAGE_URL) {
          return { status: 200, url: boeingIndia.CAREERS_LANDING_URL, html: homepageHtml }
        }

        if (url === boeingIndia.SEARCH_RESULTS_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Search our Job Opportunities at Boeing</title></head><body><section id="search-results" data-location="Canada" data-total-job-results="0" data-total-pages="1" data-current-page="1"></section></body></html>',
          }
        }

        throw new Error(`Unexpected Boeing India URL: ${url}`)
      },
    }),
    /India search results/i,
  )

  await assert.rejects(
    boeingIndia.createBoeingIndiaScraper({ maxPages: 1, maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === boeingIndia.HOMEPAGE_URL) {
          return { status: 200, url: boeingIndia.CAREERS_LANDING_URL, html: homepageHtml }
        }

        if (url === boeingIndia.SEARCH_RESULTS_URL) {
          return { status: 200, url, html: searchResultsHtml }
        }

        if (url === boeingIndia.SAMPLE_JOB_URL) {
          return {
            status: 200,
            url,
            html: detailHtml.replace(
              'https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS/job/IND---Bangalore-India/Experienced-Software-Engineer---UI-UX-Designer_JR2026516414-1/apply',
              'https://example.com/apply',
            ),
          }
        }

        throw new Error(`Unexpected Boeing India URL: ${url}`)
      },
    }),
    /job detail/i,
  )
})
