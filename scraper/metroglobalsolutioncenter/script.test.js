import assert from 'node:assert/strict'
import test from 'node:test'

import {
  API_CONFIG,
  CAREERS_URL,
  COMPANY,
  COMPANY_DOMAIN,
  HOMEPAGE_URL,
  JOBS_URL,
  JOIN_US_URL,
  MISSING_ROUTE_URLS,
  SOURCE,
  buildMagResultsUrl,
  createMetroGlobalSolutionCenterScraper,
  extractJobsFromSearchResponse,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialJobsSignal,
  isVerifiedCareersRedirect,
  isVerifiedMissingRoute,
} from './script.js'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home | METRO GSC IN</title>
    <meta
      name="description"
      content="METRO GSC India is a strategic partner powering METRO&rsquo;s global transformation. From Pune, we deliver solutions that drive operational excellence and digital innovation."
    />
    <meta property="og:title" content="METRO Global Solution Center India" />
  </head>
  <body>
    <nav>
      <a href="/who-we-are">Who we are</a>
      <a href="/what-we-do">What we do</a>
      <a href="/careers">Careers</a>
      <a href="/careers/jobs">Jobs</a>
    </nav>
    <section>
      <h1>METRO Global Solution Center India</h1>
      <p>
        METRO GSC India is a strategic partner powering METRO&rsquo;s global transformation. From Pune, we deliver
        solutions that drive operational excellence and digital innovation.
      </p>
    </section>
    <div class="teaser">
      <p>At METRO GSC India, you matter. Shape our future and your career- together with us.</p>
    </div>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | METRO GSC IN</title>
    <meta
      name="description"
      content="At METRO GSC India, you'll help build the future of METRO from the inside out."
    />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>At METRO GSC India, you'll help build the future of METRO from the inside out.</p>
      <a href="/careers/why-join-us">Why Join Us</a>
      <a href="/careers/people-of-mgsc-india">People of MGSC India</a>
      <a href="/careers/career-development">Career Development</a>
      <a href="/careers/jobs">Jobs</a>
    </main>
  </body>
</html>
`

const JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | METRO GSC IN</title>
    <meta name="description" content="Jobs Overview" />
  </head>
  <body>
    <header>
      <div class="results-count">60 opportunities to join the <img src="/shape-m.png" alt="" /></div>
    </header>
    <section>
      <h2>Latest job offerings</h2>
      <div
        class="component search-results job-offer-results re-mb"
        data-properties='{"endpoint":"//magsxa/magsearch/magresults/","v":"{8AF7A602-D842-42B8-8A1A-BCDFF6D918BB}","s":"{6305DF2F-712E-4006-963F-15D4A5187C7D}","l":"en","p":10,"defaultSortOrder":"Md Created Date,Descending","sig":"jb","itemid":"{79AC8E87-20AD-483F-9749-48D15B642A1C}","datasourceid":"{849536EB-BF94-4567-84A4-B0EA0236B612}","autoFireSearch":true}'
      >
        <div class="component-content">
          <div class="no-results" style="display:none">No results found</div>
          <div class="progress"></div>
        </div>
      </div>
      <div class="component mag-load-more" data-properties='{"searchResultsSignature":"jb"}'>
        <a class="icon-reload-b loadmore link-underlined" title="Load more" data-toggle="load-more">
          <span>Load more</span>
        </a>
      </div>
      <a href="/careers/savedjobs">Saved jobs</a>
      <p>Follow METRO GSC India on social media</p>
    </section>
  </body>
</html>
`

const NOT_FOUND_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>not-found | METRO GSC IN</title>
    <meta property="og:title" content="not-found" />
  </head>
  <body>
    <h1><p>Page not found</p></h1>
  </body>
</html>
`

const ACCESS_DENIED_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Access Denied</title>
  </head>
  <body>
    <h1>Access Denied</h1>
    <p>You don't have permission to access "http://www.metro-gsc.in/" on this server.</p>
    <p>https://errors.edgesuite.net/18.12345678.1234567890.deadbeef</p>
  </body>
</html>
`

const SEARCH_RESPONSE_PAGE_1 = {
  TotalTime: 100,
  QueryTime: 50,
  Signature: 'jb',
  Index: 'sitecore_sxa_web_jobs_index',
  Count: 3,
  Results: [
    {
      Id: 'job-1',
      Html: `
        <div class="teaser--job teaser" id="job-607055d7-5995-4236-a710-c49436e93415" itemscope itemtype="https://schema.org/JobPosting">
          <a
            class ="teaser__link"
            href ="https://www.metro-gsc.in/careers/jobs/sr-full-stack-engineer?jid=607055d7-5995-4236-a710-c49436e93415"
            title="Sr Full Stack Engineer"
            itemprop="url"
          ></a>
          <h3 class="teaser-title field-jobname" itemprop="title">Sr Full Stack Engineer</h3>
          <span class="field-employmenttype">Professionals</span>
          <div class="field-department" itemprop="department">IT</div>
          <div class="field-jobtype" itemprop="employmentType">Full time</div>
          <meta itemprop="addressCountry" content="IN" />
          <meta itemprop="addressLocality" content="Pune" />
          <meta itemprop="addressRegion" content="MH" />
          <span class="field-fulllocation">Pune, MH, India</span>
          <div itemprop="hiringOrganization" itemscope itemtype="https://schema.org/Organization">
            <meta itemprop="name" content="METRO Global Solution Center IN" />
          </div>
          <meta itemprop="description" content="Build scalable products &amp;amp; services." />
          <meta itemprop="datePosted" content="2026-07-10T11:07:48.000Z" />
        </div>
      `,
    },
    {
      Id: 'job-2',
      Html: `
        <div class="teaser--job teaser" id="job-2469ba38-1029-432a-b1aa-d2d950366ea7" itemscope itemtype="https://schema.org/JobPosting">
          <a
            class ="teaser__link"
            href ="https://www.metro-gsc.in/careers/jobs/group-manager-transitions?jid=2469ba38-1029-432a-b1aa-d2d950366ea7"
            title="Group Manager - Transitions"
            itemprop="url"
          ></a>
          <h3 class="teaser-title field-jobname" itemprop="title">Group Manager - Transitions</h3>
          <span class="field-employmenttype">Professionals</span>
          <div class="field-department" itemprop="department">Transitions</div>
          <div class="field-jobtype" itemprop="employmentType">Full time</div>
          <meta itemprop="addressCountry" content="IN" />
          <meta itemprop="addressLocality" content="Pune" />
          <meta itemprop="addressRegion" content="Maharashtra" />
          <span class="field-fulllocation">Pune, Maharashtra, India</span>
          <div itemprop="hiringOrganization" itemscope itemtype="https://schema.org/Organization">
            <meta itemprop="name" content="METRO Global Solution Center IN" />
          </div>
          <meta itemprop="description" content="Lead complex transitions across functions." />
          <meta itemprop="datePosted" content="2026-07-10T11:06:51.000Z" />
        </div>
      `,
    },
  ],
}

const SEARCH_RESPONSE_PAGE_2 = {
  TotalTime: 120,
  QueryTime: 60,
  Signature: 'jb',
  Index: 'sitecore_sxa_web_jobs_index',
  Count: 3,
  Results: [
    {
      Id: 'job-3',
      Html: `
        <div class="teaser--job teaser" id="job-non-india" itemscope itemtype="https://schema.org/JobPosting">
          <a
            class ="teaser__link"
            href ="https://www.metro-gsc.in/careers/jobs/eu-platform-architect?jid=job-non-india"
            title="EU Platform Architect"
            itemprop="url"
          ></a>
          <h3 class="teaser-title field-jobname" itemprop="title">EU Platform Architect</h3>
          <span class="field-employmenttype">Professionals</span>
          <div class="field-department" itemprop="department">Architecture</div>
          <div class="field-jobtype" itemprop="employmentType">Full time</div>
          <meta itemprop="addressCountry" content="DE" />
          <meta itemprop="addressLocality" content="Dusseldorf" />
          <meta itemprop="addressRegion" content="NW" />
          <span class="field-fulllocation">Dusseldorf, NW, Germany</span>
          <div itemprop="hiringOrganization" itemscope itemtype="https://schema.org/Organization">
            <meta itemprop="name" content="METRO Global Solution Center IN" />
          </div>
          <meta itemprop="description" content="This should be filtered out." />
          <meta itemprop="datePosted" content="2026-07-09T10:00:00.000Z" />
        </div>
      `,
    },
  ],
}

const DETAIL_HTML_BY_URL = {
  'https://www.metro-gsc.in/careers/jobs/sr-full-stack-engineer?jid=607055d7-5995-4236-a710-c49436e93415': `
    <!doctype html>
    <html lang="en">
      <head>
        <title>sr-full-stack-engineer</title>
      </head>
      <body>
        <h1>Sr Full Stack Engineer</h1>
        <a
          class="btn btn-primary btn-lg job-apply"
          href="https://jobs.smartrecruiters.com/METROMAKRO/744000137129495-sr-full-stack-engineer?oga=true&amp;amp;utm_source=external careers"
        >
          Apply
        </a>
        <h2>Key Facts</h2>
        <h2>Job Description</h2>
        <p>Build modern full-stack services.</p>
        <h2>Qualifications</h2>
        <ul>
          <li>5+ years of experience</li>
          <li>JavaScript and cloud engineering</li>
        </ul>
        <h2>Benefits</h2>
        <p>Hybrid work and wellbeing support.</p>
      </body>
    </html>
  `,
  'https://www.metro-gsc.in/careers/jobs/group-manager-transitions?jid=2469ba38-1029-432a-b1aa-d2d950366ea7': `
    <!doctype html>
    <html lang="en">
      <head>
        <title>group-manager-transitions</title>
      </head>
      <body>
        <h1>Group Manager - Transitions</h1>
        <a
          class="btn btn-primary btn-lg job-apply"
          href="https://jobs.smartrecruiters.com/METROMAKRO/744000137128765-group-manager-transitions?oga=true&amp;amp;utm_source=external careers"
        >
          Apply
        </a>
        <h2>Key Facts</h2>
        <h2>Job Description</h2>
        <p>Lead program governance and transformation planning.</p>
        <h2>Qualifications</h2>
        <p>Strong stakeholder and transitions experience.</p>
        <h2>Benefits</h2>
        <p>Recognition, flexibility, and wellbeing benefits.</p>
      </body>
    </html>
  `,
}

test('Metro Global Solution Center exposes the verified first-party route chain and search configuration', () => {
  assert.equal(SOURCE, 'metroglobalsolutioncenter')
  assert.equal(COMPANY, 'Metro Global Solution Center Pvt. Ltd.')
  assert.equal(COMPANY_DOMAIN, 'metro-gsc.in')
  assert.equal(HOMEPAGE_URL, 'https://www.metro-gsc.in/')
  assert.equal(CAREERS_URL, 'https://www.metro-gsc.in/careers')
  assert.equal(JOBS_URL, 'https://www.metro-gsc.in/careers/jobs')
  assert.equal(JOIN_US_URL, 'https://www.metro-gsc.in/join-us')
  assert.deepEqual(MISSING_ROUTE_URLS, [
    'https://www.metro-gsc.in/career',
    'https://www.metro-gsc.in/jobs',
    'https://www.metro-gsc.in/openings',
    'https://www.metro-gsc.in/current-openings',
    'https://www.metro-gsc.in/work-with-us',
  ])
  assert.deepEqual(API_CONFIG, {
    endpointPath: '/magsxa/magsearch/magresults/',
    siteId: '{6305DF2F-712E-4006-963F-15D4A5187C7D}',
    itemId: '{79AC8E87-20AD-483F-9749-48D15B642A1C}',
    dataSourceId: '{849536EB-BF94-4567-84A4-B0EA0236B612}',
    versionId: '{8AF7A602-D842-42B8-8A1A-BCDFF6D918BB}',
    language: 'en',
    signature: 'jb',
    defaultSortOrder: 'Md Created Date,Descending',
  })
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(hasOfficialJobsSignal(JOBS_HTML), true)
  assert.equal(
    isVerifiedCareersRedirect({
      status: 200,
      url: CAREERS_URL,
      html: CAREERS_HTML,
    }),
    true,
  )
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      url: 'https://www.metro-gsc.in/not-found',
      html: NOT_FOUND_HTML,
    }),
    true,
  )
  assert.equal(
    buildMagResultsUrl({ pageSize: 10, offset: 0 }),
    'https://www.metro-gsc.in/magsxa/magsearch/magresults/?l=en&s=%7B6305DF2F-712E-4006-963F-15D4A5187C7D%7D&itemid=%7B79AC8E87-20AD-483F-9749-48D15B642A1C%7D&autoFireSearch=true&datasourceid=%7B849536EB-BF94-4567-84A4-B0EA0236B612%7D&sig=jb&p=10&o=Md+Created+Date%2CDescending&v=%7B8AF7A602-D842-42B8-8A1A-BCDFF6D918BB%7D',
  )
  assert.equal(
    buildMagResultsUrl({ pageSize: 10, offset: 10 }),
    'https://www.metro-gsc.in/magsxa/magsearch/magresults/?l=en&s=%7B6305DF2F-712E-4006-963F-15D4A5187C7D%7D&itemid=%7B79AC8E87-20AD-483F-9749-48D15B642A1C%7D&autoFireSearch=true&datasourceid=%7B849536EB-BF94-4567-84A4-B0EA0236B612%7D&sig=jb&p=10&e=10&o=Md+Created+Date%2CDescending&v=%7B8AF7A602-D842-42B8-8A1A-BCDFF6D918BB%7D',
  )
})

test('Metro Global Solution Center extracts India jobs from the verified paginated jobs API and detail pages', async () => {
  const jobs = await extractJobsFromSearchResponse({
    searchResponse: SEARCH_RESPONSE_PAGE_1,
    fetchText: async (url) => {
      const html = DETAIL_HTML_BY_URL[url]
      if (!html) throw new Error(`Unexpected detail URL: ${url}`)
      return html
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      city: job.city,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      requisitionId: job.requisitionId,
    })),
    [
      {
        title: 'Sr Full Stack Engineer',
        department: 'IT',
        city: 'Pune',
        country: 'India',
        sourceUrl: 'https://www.metro-gsc.in/careers/jobs/sr-full-stack-engineer?jid=607055d7-5995-4236-a710-c49436e93415',
        applyUrl:
          'https://jobs.smartrecruiters.com/METROMAKRO/744000137129495-sr-full-stack-engineer?oga=true&utm_source=external%20careers',
        requisitionId: '607055d7-5995-4236-a710-c49436e93415',
      },
      {
        title: 'Group Manager - Transitions',
        department: 'Transitions',
        city: 'Pune',
        country: 'India',
        sourceUrl: 'https://www.metro-gsc.in/careers/jobs/group-manager-transitions?jid=2469ba38-1029-432a-b1aa-d2d950366ea7',
        applyUrl:
          'https://jobs.smartrecruiters.com/METROMAKRO/744000137128765-group-manager-transitions?oga=true&utm_source=external%20careers',
        requisitionId: '2469ba38-1029-432a-b1aa-d2d950366ea7',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Build modern full-stack services\./)
  assert.match(jobs[0].minimumQualification, /5\+ years of experience/i)
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.deepEqual(jobs[0].requiredSkills, ['5+ years of experience', 'JavaScript and cloud engineering'])
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('Metro Global Solution Center falls back to listing-only jobs when the verified detail page is Akamai-blocked', async () => {
  const jobs = await extractJobsFromSearchResponse({
    searchResponse: {
      ...SEARCH_RESPONSE_PAGE_1,
      Results: [SEARCH_RESPONSE_PAGE_1.Results[0]],
    },
    fetchText: async () => {
      throw new Error('HTTP 403 for https://www.metro-gsc.in/careers/jobs/sr-full-stack-engineer?jid=607055d7-5995-4236-a710-c49436e93415')
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Sr Full Stack Engineer',
    company: COMPANY,
    department: 'IT',
    location: 'Pune, MH, India',
    city: 'Pune',
    country: 'India',
    jobId: 'metroglobalsolutioncenter-607055d7-5995-4236-a710-c49436e93415',
    requisitionId: '607055d7-5995-4236-a710-c49436e93415',
    sourceUrl: 'https://www.metro-gsc.in/careers/jobs/sr-full-stack-engineer?jid=607055d7-5995-4236-a710-c49436e93415',
    applyUrl: 'https://www.metro-gsc.in/careers/jobs/sr-full-stack-engineer?jid=607055d7-5995-4236-a710-c49436e93415',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-10T11:07:48.000Z',
    closingDate: null,
    jobDescription: 'Build scalable products & services.',
    publicExperienceChecked: true,
  })
})

test('Metro Global Solution Center run() validates the route chain, paginates the jobs API, filters non-India entries, and returns catalog-ready jobs', async () => {
  const requestedJsonUrls = []
  const requestedTextUrls = []

  const jobs = await createMetroGlobalSolutionCenterScraper({ pageSize: 2 }).run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
      if (url === CAREERS_URL) return { status: 200, url, html: CAREERS_HTML }
      if (url === JOBS_URL) return { status: 200, url, html: JOBS_HTML }
      if (url === JOIN_US_URL) return { status: 200, url: CAREERS_URL, html: CAREERS_HTML }
      if (MISSING_ROUTE_URLS.includes(url)) return { status: 404, url: 'https://www.metro-gsc.in/not-found', html: NOT_FOUND_HTML }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === buildMagResultsUrl({ pageSize: 2, offset: 0 })) return SEARCH_RESPONSE_PAGE_1
      if (url === buildMagResultsUrl({ pageSize: 2, offset: 2 })) return SEARCH_RESPONSE_PAGE_2

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      const html = DETAIL_HTML_BY_URL[url]
      if (!html) throw new Error(`Unexpected detail URL: ${url}`)
      return html
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedJsonUrls, [
    buildMagResultsUrl({ pageSize: 2, offset: 0 }),
    buildMagResultsUrl({ pageSize: 2, offset: 2 }),
  ])
  assert.deepEqual(requestedTextUrls, Object.keys(DETAIL_HTML_BY_URL))
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      company: job.company,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      link: job.link,
      scrapedAt: job.scrapedAt,
      experienceRequired: job.experienceRequired,
      publicExperienceChecked: job.publicExperienceChecked,
    })),
    [
      {
        title: 'Sr Full Stack Engineer',
        source: SOURCE,
        company: COMPANY,
        companyCareerPage: JOBS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        link:
          'https://jobs.smartrecruiters.com/METROMAKRO/744000137129495-sr-full-stack-engineer?oga=true&utm_source=external%20careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        experienceRequired: '5+ years',
        publicExperienceChecked: true,
      },
      {
        title: 'Group Manager - Transitions',
        source: SOURCE,
        company: COMPANY,
        companyCareerPage: JOBS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        link:
          'https://jobs.smartrecruiters.com/METROMAKRO/744000137128765-group-manager-transitions?oga=true&utm_source=external%20careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        experienceRequired: null,
        publicExperienceChecked: true,
      },
    ],
  )
})

test('Metro Global Solution Center returns [] when homepage, careers, and jobs are all on the verified Akamai access-denied shell', async () => {
  const jobs = await createMetroGlobalSolutionCenterScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: ACCESS_DENIED_HTML,
    }),
    fetchJson: async () => {
      throw new Error('Jobs API should not be called when all verified first-party routes are blocked')
    },
  })

  assert.deepEqual(jobs, [])
})
