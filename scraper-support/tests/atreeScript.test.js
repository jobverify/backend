import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_LISTINGS = [
  {
    title: 'Executive Assistant',
    deadline: 'July 31, 2026',
    detailUrl: 'https://www.atree.org/career/executive-assistant-2/',
    applyUrl: 'https://forms.gle/y2nuF4BbwMEf9bky6',
    postingDate: '10 July 2026',
    validThrough: 'July 31, 2026',
    employmentType: 'Full-time',
    location: 'Bangalore',
    description:
      'The Executive Assistant (EA) to the Director Development will provide high-level administrative and operational support to the Director Development as well as ensure the efficient functioning of the Development Office.',
    responsibilities: [
      'Core Administrative Support',
      'Proactively manage the Director&#8217;s calendar, schedule meetings, appointments, and travel arrangements.',
      'Handle Donor and partner correspondence, emails, and phone calls, ensuring timely and accurate responses.',
    ],
    qualifications:
      '7 or more years of experience in an executive assistant or administrative support role, preferably in a nonprofit or development setting. Strong written and verbal communication skills.',
    howToApply: 'Interested individuals can apply using the &#8216;Apply Now&#8217; button.',
  },
  {
    title: 'Junior Research Fellow (JRF) Position in an Anusandhan National Research Foundation (ANRF)-Funded Project',
    deadline: 'July 19, 2026',
    detailUrl: 'https://www.atree.org/career/jrf-anrf/',
    applyUrl:
      'https://mail.google.com/mail/?view=cm&fs=1&to=ashish.kumar@atree.org&cc=radhika.reddy@atree.org&su=Application%20for%20JRF%20%E2%80%93%20Reconstream',
    postingDate: '7 July 2026',
    validThrough: 'July 19, 2026',
    employmentType: 'Full-time',
    location: 'Bangalore',
    description:
      'The Ashoka Trust for Research in Ecology and the Environment (ATREE), Bangalore, is seeking applications from highly motivated and enthusiastic candidates to fill the position of Junior Research Fellow (JRF) under the Anusandhan National Research Foundation (ANRF)-funded project.',
    responsibilities: [
      'Conduct hydrological modelling, geospatial analysis, and climate change research.',
      'Process and analyse remote sensing, GIS, and hydro-meteorological datasets.',
      'Assist in field surveys, data collection, and validation of model outputs.',
    ],
    qualifications:
      'Applicants should possess: A Master&#8217;s degree in Hydrology, Water Resources Engineering, Soil and Water Conservation Engineering, Geoinformatics, or a closely related discipline.',
    howToApply:
      'Interested candidates may send their application via email, along with the following documents: An updated Curriculum Vitae (CV).',
  },
  {
    title: 'Doctoral Researcher Position: Urban Ecology and Biodiversity',
    deadline: 'July 15, 2026',
    detailUrl: 'https://www.atree.org/career/doctoral-researcher-position-ueb/',
    applyUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLSdXL1QPZ8w4m0n8B9FUg00THXYjmDQ0M9zSyQdPdMvBc2p-mQ/viewform?usp=sharing&ouid=107152544725028953630',
    postingDate: '16 June 2026',
    validThrough: 'July 15, 2026',
    employmentType: 'Full-time',
    location: 'Bengaluru',
    description:
      'The Ashoka Trust for Research in Ecology and the Environment (ATREE) invites applications for a fully funded doctoral researcher position on the interdisciplinary research theme “Rurban Ecologies, Cultural Flows, and the Making of Urban Nature.”',
    responsibilities: [
      'Review and synthesise relevant literature on rurbanity, urban ecology, biodiversity, and cultural landscapes.',
      'Design and conduct interdisciplinary field research using ecological and social science methods.',
      'Map and analyse culturally induced flows of plant material and their ecological implications.',
    ],
    qualifications:
      'Applicants should hold a postgraduate degree in Ecology, Environmental Science, Conservation Biology, Sustainability Studies, or a closely related discipline.',
    howToApply: 'Interested individuals can apply using the &#8216;Apply Now&#8217; button.',
  },
]

const VERIFIED_JOB_DETAIL_URLS = VERIFIED_LISTINGS.map((job) => job.detailUrl)
const VERIFIED_APPLY_URLS = VERIFIED_LISTINGS.map((job) => job.applyUrl)

const CURRENT_LISTINGS = [
  {
    title: 'Fellow in Agroecology',
    deadline: 'July 15, 2026',
    detailUrl: 'https://www.atree.org/career/fellow-in-agroecology/',
    applyUrl: 'https://mail.google.com/mail/?view=cm&fs=1&to=hr@atree.org',
    postingDate: '4 July 2026',
    validThrough: 'July 15, 2026',
    employmentType: 'Full-time',
    location: 'Bangalore',
  },
  {
    title: 'Executive Assistant',
    deadline: 'July 31, 2026',
    detailUrl: 'https://www.atree.org/career/executive-assistant-2/',
    applyUrl: 'https://forms.gle/y2nuF4BbwMEf9bky6',
    postingDate: '10 July 2026',
    validThrough: 'July 31, 2026',
    employmentType: 'Full-time',
    location: 'Bangalore',
  },
  {
    title: 'Junior Research Fellow (JRF) Position in an Anusandhan National Research Foundation (ANRF)-Funded Project',
    deadline: 'July 19, 2026',
    detailUrl: 'https://www.atree.org/career/jrf-anrf/',
    applyUrl:
      'https://mail.google.com/mail/?view=cm&fs=1&to=ashish.kumar@atree.org&cc=radhika.reddy@atree.org&su=Application%20for%20JRF%20%E2%80%93%20Reconstream',
    postingDate: '7 July 2026',
    validThrough: 'July 19, 2026',
    employmentType: 'Full-time',
    location: 'Bangalore',
  },
]

const CURRENT_JOB_DETAIL_URLS = CURRENT_LISTINGS.map((job) => job.detailUrl)

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title></title>
  </head>
  <body>
    <nav>
      <a href="https://www.atree.org/get-involved/">Get Involved</a>
    </nav>
    <main>
      <p>
        Ashoka Trust for Research in Ecology and the Environment (ATREE) is a globally recognised non-profit organisation
        focused on environmental conservation and sustainable, socially just development.
      </p>
      <a href="https://www.atree.org/careers/">Work With Us</a>
      <a href="https://www.atree.org/internship/">Internship</a>
      <a href="https://www.atree.org/volunteer/">Volunteer</a>
      <p>ATREE © 2026 | Designed and Developed by Refraction Media</p>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      ${CURRENT_LISTINGS.map((job) => `
        <h6><a href="${job.detailUrl}">${job.title}</a></h6>
        <p>Deadline: ${job.deadline}</p>
        <a href="${job.detailUrl}"><span>VIEW</span></a>
      `).join('\n')}
      <p>No Job Post Available</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      ${VERIFIED_LISTINGS.map((job) => `
        <div class="elementor-element elementor-element-card e-con-full e-flex e-con e-child">
          <div class="elementor-widget elementor-widget-theme-post-title elementor-page-title elementor-widget-heading">
            <div class="elementor-widget-container">
              <h6 class="elementor-heading-title elementor-size-default">
                <a href="${job.detailUrl}">${job.title}</a>
              </h6>
            </div>
          </div>
          <div class="elementor-element elementor-element-deadline elementor-widget elementor-widget-text-editor">
            <div class="elementor-widget-container">Deadline: ${job.deadline}</div>
          </div>
          <div class="elementor-element elementor-widget elementor-widget-button">
            <div class="elementor-widget-container">
              <div class="elementor-button-wrapper">
                <a class="elementor-button elementor-button-link elementor-size-lg" href="${job.detailUrl}" target="_blank">
                  <span class="elementor-button-content-wrapper">
                    <span class="elementor-button-text">VIEW</span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      `).join('\n')}
      <p>No Job Post Available</p>
    </main>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.atree.org/wp-sitemap-posts-post-1.xml</loc></sitemap>
  <sitemap><loc>https://www.atree.org/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://www.atree.org/wp-sitemap-posts-career-1.xml</loc></sitemap>
</sitemapindex>
`

const careerPostSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.atree.org/career/project-consultant/</loc></url>
  <url><loc>https://www.atree.org/career/thi-recruitments/</loc></url>
  <url><loc>https://www.atree.org/career/urban-resilience-hiring/</loc></url>
  ${VERIFIED_JOB_DETAIL_URLS.map((url) => `<url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`

const currentCareerPostSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${CURRENT_JOB_DETAIL_URLS.map((url) => `<url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const buildDetailHtml = (job) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>${job.title === 'Executive Assistant' ? ' Executive Assistant ' : job.title}</title>
  </head>
  <body>
    <a href="#content">Skip to content</a>
    <main id="content">
      <h3 class="elementor-heading-title elementor-size-default">Description</h3>
      <div class="elementor-widget-container">
        <p>${job.description}</p>
      </div>
      <h3 class="elementor-heading-title elementor-size-default">Responsibilities</h3>
      <div class="elementor-widget-container">
        <ul>${job.responsibilities.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
      <h3 class="elementor-heading-title elementor-size-default">Qualifications</h3>
      <div class="elementor-widget-container">
        <p>${job.qualifications}</p>
      </div>
      <h3 class="elementor-heading-title elementor-size-default">How to Apply</h3>
      <div class="elementor-widget-container">
        <p>${job.howToApply}</p>
      </div>
      <h3 class="elementor-heading-title elementor-size-default">Contact</h3>
      <div class="elementor-widget-container">
        <p>Please direct your questions regarding this position to hr@atree.org</p>
      </div>
      <h3 class="elementor-heading-title elementor-size-default">Note</h3>
      <div class="elementor-widget-container">
        <p>Only candidates who are shortlisted for the interview will be contacted.</p>
      </div>
      <h3 class="elementor-heading-title elementor-size-default">Date Posted</h3>
      <div class="elementor-widget-container">${job.postingDate}</div>
      <h3 class="elementor-heading-title elementor-size-default">Valid Through</h3>
      <div class="elementor-widget-container">${job.validThrough}</div>
      <h3 class="elementor-heading-title elementor-size-default">Employment Type</h3>
      <div class="elementor-widget-container">${job.employmentType}</div>
      <h3 class="elementor-heading-title elementor-size-default">Job Location</h3>
      <div class="elementor-widget-container">
        <p><img src="data:image/png;base64,AAAA" alt="" />${job.location}</p>
      </div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="${job.applyUrl.replaceAll('&', '&#038;')}" target="_blank">
          <span class="elementor-button-content-wrapper">
            <span class="elementor-button-text">Apply Now</span>
          </span>
        </a>
      </div>
    </main>
  </body>
</html>
`

const buildCurrentDetailHtml = (job) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>${job.title}</title>
  </head>
  <body>
    <main>
      <h3>Position Title</h3>
      <h2>${job.title}</h2>
      <h3>Description</h3>
      <p>${job.title} public description.</p>
      <h3>Responsibilities</h3>
      <ul><li>Deliver the listed responsibilities.</li></ul>
      <h3>Qualifications</h3>
      <p>Relevant experience and qualifications.</p>
      <h3>How to Apply</h3>
      <p>Use the Apply Now button.</p>
      <h3>Date Posted</h3>
      <p>${job.postingDate}</p>
      <h3>Valid Through</h3>
      <p>${job.validThrough}</p>
      <h3>Employment Type</h3>
      <p>${job.employmentType}</p>
      <h3>Job Location</h3>
      <p>${job.location}</p>
      <a href="${job.applyUrl.replaceAll('&', '&#038;')}">Apply Now</a>
    </main>
  </body>
</html>
`

const buildExpectedDescription = (job) => [
  `Description: ${job.description}`,
  `Responsibilities: ${job.responsibilities.join(' ')}`,
  `Qualifications: ${job.qualifications}`,
  `How to Apply: ${job.howToApply}`,
].join(' ')

const loadAtreeModule = async () => {
  try {
    return await import('../../scraper/atree/script.js')
  } catch {
    assert.fail('Expected Atree scraper module at ../../scraper/atree/script.js')
  }
}

test('Atree helpers stay pinned to the verified homepage, careers listing, sitemap, and detail-page handoffs', async () => {
  const atree = await loadAtreeModule()

  assert.equal(atree.SOURCE, 'atree')
  assert.equal(atree.COMPANY, 'Atree')
  assert.equal(
    atree.OFFICIAL_BRAND_NAME,
    'Ashoka Trust for Research in Ecology and the Environment (ATREE)',
  )
  assert.equal(atree.VERIFIED_ON, '2026-07-15')
  assert.equal(atree.HOMEPAGE_URL, 'https://www.atree.org/')
  assert.equal(atree.GET_INVOLVED_URL, 'https://www.atree.org/get-involved/')
  assert.equal(atree.CAREERS_URL, 'https://www.atree.org/careers/')
  assert.equal(atree.LEGACY_CAREER_URL, 'https://www.atree.org/career/')
  assert.equal(atree.WORK_WITH_US_URL, 'https://www.atree.org/work-with-us/')
  assert.equal(atree.SITEMAP_URL, 'https://www.atree.org/wp-sitemap.xml')
  assert.equal(
    atree.CAREER_POST_SITEMAP_URL,
    'https://www.atree.org/wp-sitemap-posts-career-1.xml',
  )
  assert.deepEqual(atree.CHECKED_MISSING_ROUTE_URLS, [
    'https://www.atree.org/jobs/',
    'https://www.atree.org/openings/',
  ])
  assert.deepEqual(atree.VERIFIED_JOB_DETAIL_URLS, VERIFIED_JOB_DETAIL_URLS)
  assert.deepEqual(atree.VERIFIED_APPLY_URLS, VERIFIED_APPLY_URLS)
  assert.equal(atree.extractCareersUrl(homepageHtml), 'https://www.atree.org/careers/')
  assert.equal(atree.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(atree.hasCareersPageSignal(careersHtml), true)
  assert.equal(atree.hasSitemapIndexSignal(sitemapIndexXml), true)
  assert.deepEqual(
    atree.extractCareerUrlsFromSitemap(careerPostSitemapXml),
    VERIFIED_JOB_DETAIL_URLS,
  )
  assert.equal(
    atree.isLegacyCareerRedirect({
      requestedUrl: atree.LEGACY_CAREER_URL,
      status: 200,
      url: atree.CAREERS_URL,
      html: careersHtml,
    }),
    true,
  )
  assert.equal(
    atree.isMissingCareersRoute({
      status: 404,
      url: atree.CHECKED_MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
  assert.deepEqual(atree.extractListingCards(careersHtml), VERIFIED_LISTINGS.map((job) => ({
    title: job.title,
    deadline: job.deadline,
    detailUrl: job.detailUrl,
  })))
  assert.equal(atree.extractApplyUrl(buildDetailHtml(VERIFIED_LISTINGS[0])), VERIFIED_LISTINGS[0].applyUrl)
  assert.equal(atree.extractApplyUrl(buildDetailHtml(VERIFIED_LISTINGS[1])), VERIFIED_LISTINGS[1].applyUrl)
  assert.equal(atree.extractApplyUrl(buildDetailHtml(VERIFIED_LISTINGS[2])), VERIFIED_LISTINGS[2].applyUrl)
  assert.equal(atree.extractLabeledFieldValue(buildDetailHtml(VERIFIED_LISTINGS[0]), 'Date Posted'), '10 July 2026')
  assert.equal(atree.extractLabeledFieldValue(buildDetailHtml(VERIFIED_LISTINGS[2]), 'Job Location'), 'Bengaluru')
  assert.equal(
    atree.extractDetailDescription(buildDetailHtml(VERIFIED_LISTINGS[0])),
    buildExpectedDescription(VERIFIED_LISTINGS[0]),
  )
})

test('Atree recognizes the current first-party ERP jobs portal with no rendered vacancy links', async () => {
  const atree = await loadAtreeModule()
  const erpJobsHtml = [
    '<html><head><title> Job Openings </title></head>',
    '<body class="jobs-page">Built on Frappe',
    '<input id="search-box" type="search" />',
    '</body></html>',
  ].join('')

  assert.equal(atree.ERP_JOBS_URL, 'https://erp.atree.org/jobs')
  assert.equal(atree.hasErpJobsPageSignal(erpJobsHtml), true)
  assert.equal(atree.erpJobsPageHasPublicListings(erpJobsHtml), false)
})

test('Atree accepts only the exact first-party ERP job application route', async () => {
  const atree = await loadAtreeModule()
  const url = 'https://erp.atree.org/job_application/new?job_title=HR-OPN-2026-0051'
  assert.equal(atree.extractApplyUrl(`<a href="${url}">Apply Now</a>`), url)
  for (const invalid of [url.replace('erp.atree.org', 'erp.atree.org.example.com'), url.replace('https:', 'http:'),
    url.replace('job_title=', 'other='), url.replace('0051', 'oops'), url + '&redirect=https://example.com']) {
    assert.equal(atree.extractApplyUrl(`<a href="${invalid}">Apply Now</a>`), null)
  }
})

test('Atree run matches entity-encoded detail titles and preserves the verified public apply handoffs', async () => {
  const atree = await loadAtreeModule()
  const requestedUrls = []

  const jobs = await atree.createAtreeScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === atree.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === atree.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === atree.SITEMAP_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === atree.CAREER_POST_SITEMAP_URL) {
        return { status: 200, url, html: careerPostSitemapXml }
      }

      if (url === atree.LEGACY_CAREER_URL) {
        return { status: 200, url: atree.CAREERS_URL, html: careersHtml }
      }

      if (atree.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      const matchedJob = VERIFIED_LISTINGS.find((job) => job.detailUrl === url)
      if (matchedJob) {
        const encodedTitle = [...matchedJob.title].map(character => `&#${character.codePointAt(0)};`).join('')
        return { status: 200, url, html: buildDetailHtml(matchedJob).replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title>${encodedTitle}</title>`) }
      }

      throw new Error(`Unexpected Atree URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    atree.HOMEPAGE_URL,
    atree.CAREERS_URL,
    atree.SITEMAP_URL,
    atree.CAREER_POST_SITEMAP_URL,
    atree.LEGACY_CAREER_URL,
    ...atree.CHECKED_MISSING_ROUTE_URLS,
    ...VERIFIED_JOB_DETAIL_URLS,
  ])

  assert.deepEqual(jobs, VERIFIED_LISTINGS.map((job) => ({
    title: job.title,
    company: 'Atree',
    department: null,
    location: `${job.location}, India`,
    city: job.location,
    country: 'India',
    jobId: new URL(job.detailUrl).pathname.split('/').filter(Boolean).at(-1),
    requisitionId: null,
    sourceUrl: job.detailUrl,
    applyUrl: job.applyUrl,
    employmentType: job.employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: ({
      '10 July 2026': '2026-07-10',
      '7 July 2026': '2026-07-07',
      '16 June 2026': '2026-06-16',
    })[job.postingDate],
    closingDate: ({
      'July 31, 2026': '2026-07-31',
      'July 19, 2026': '2026-07-19',
      'July 15, 2026': '2026-07-15',
    })[job.validThrough],
    jobDescription: buildExpectedDescription(job),
    source: 'atree',
    link: job.applyUrl,
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })))
})

test('Atree run follows the current first-party careers listing instead of a stale pinned role set', async () => {
  const atree = await loadAtreeModule()
  const requestedUrls = []

  const jobs = await atree.createAtreeScraper({
    now: () => '2026-07-19T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === atree.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === atree.CAREERS_URL) {
        return { status: 200, url, html: currentCareersHtml }
      }

      if (url === atree.SITEMAP_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === atree.CAREER_POST_SITEMAP_URL) {
        return { status: 200, url, html: currentCareerPostSitemapXml }
      }

      if (url === atree.LEGACY_CAREER_URL) {
        return { status: 200, url: atree.CAREERS_URL, html: currentCareersHtml }
      }

      if (atree.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      const matchedJob = CURRENT_LISTINGS.find((job) => job.detailUrl === url)
      if (matchedJob) {
        return { status: 200, url, html: buildCurrentDetailHtml(matchedJob) }
      }

      throw new Error(`Unexpected Atree URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    atree.HOMEPAGE_URL,
    atree.CAREERS_URL,
    atree.SITEMAP_URL,
    atree.CAREER_POST_SITEMAP_URL,
    atree.LEGACY_CAREER_URL,
    ...atree.CHECKED_MISSING_ROUTE_URLS,
    ...CURRENT_JOB_DETAIL_URLS,
  ])
  assert.deepEqual(jobs.map((job) => [job.title, job.applyUrl, job.city]), [
    ['Fellow in Agroecology', 'https://mail.google.com/mail/?view=cm&fs=1&to=hr@atree.org', 'Bangalore'],
    ['Executive Assistant', 'https://forms.gle/y2nuF4BbwMEf9bky6', 'Bangalore'],
    [
      'Junior Research Fellow (JRF) Position in an Anusandhan National Research Foundation (ANRF)-Funded Project',
      'https://mail.google.com/mail/?view=cm&fs=1&to=ashish.kumar@atree.org&cc=radhika.reddy@atree.org&su=Application%20for%20JRF%20%E2%80%93%20Reconstream',
      'Bangalore',
    ],
  ])
})

test('Atree fails closed when the homepage, careers listing, sitemap, legacy redirect, missing-route topology, or detail apply handoff drifts', async () => {
  const atree = await loadAtreeModule()

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('https://www.atree.org/careers/', 'https://www.atree.org/jobs/'),
          }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /homepage careers link/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === atree.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Careers</title></head><body><h1>Careers</h1><p>No Job Post Available</p></body></html>',
          }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === atree.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === atree.SITEMAP_URL) {
          return { status: 200, url, html: '<sitemapindex></sitemapindex>' }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === atree.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === atree.SITEMAP_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === atree.CAREER_POST_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: careerPostSitemapXml.replace(
              '<url><loc>https://www.atree.org/career/jrf-anrf/</loc></url>',
              '',
            ),
          }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /career sitemap/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === atree.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === atree.SITEMAP_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === atree.CAREER_POST_SITEMAP_URL) {
          return { status: 200, url, html: careerPostSitemapXml }
        }

        if (url === atree.LEGACY_CAREER_URL) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /legacy career route/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === atree.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === atree.SITEMAP_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === atree.CAREER_POST_SITEMAP_URL) {
          return { status: 200, url, html: careerPostSitemapXml }
        }

        if (url === atree.LEGACY_CAREER_URL) {
          return { status: 200, url: atree.CAREERS_URL, html: careersHtml }
        }

        if (atree.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
          return {
            status: url === atree.CHECKED_MISSING_ROUTE_URLS[0] ? 200 : 404,
            url,
            html: url === atree.CHECKED_MISSING_ROUTE_URLS[0] ? careersHtml : missingRouteHtml,
          }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /missing careers route changed/i,
  )

  await assert.rejects(
    atree.createAtreeScraper().run({
      fetchPage: async (url) => {
        if (url === atree.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === atree.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === atree.SITEMAP_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === atree.CAREER_POST_SITEMAP_URL) {
          return { status: 200, url, html: careerPostSitemapXml }
        }

        if (url === atree.LEGACY_CAREER_URL) {
          return { status: 200, url: atree.CAREERS_URL, html: careersHtml }
        }

        if (atree.CHECKED_MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        const matchedJob = VERIFIED_LISTINGS.find((job) => job.detailUrl === url)
        if (matchedJob) {
          return {
            status: 200,
            url,
            html: buildDetailHtml(matchedJob).replace(matchedJob.applyUrl.replaceAll('&', '&#038;'), 'https://example.com/apply'),
          }
        }

        throw new Error(`Unexpected Atree URL: ${url}`)
      },
    }),
    /detail page surface changed/i,
  )
})
