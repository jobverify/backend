import assert from 'node:assert/strict'
import test from 'node:test'

const SOURCE = 'sastraroboticssgbiinc'
const COMPANY = 'Sastra Robotics-SGBI INC'
const HOMEPAGE_URL = 'https://sgbi.us/'
const CAREERS_URL = 'https://sgbi.us/career/'
const SITEMAP_INDEX_URL = 'https://sgbi.us/sitemap_index.xml'
const JOBS_SITEMAP_URL = 'https://sgbi.us/awsm_job_openings-sitemap.xml'

const EXPECTED_PUBLIC_OPENINGS = [
  {
    roleId: '5639',
    title: 'FULL STACK DEVELOPER',
    detailUrl: 'https://sgbi.us/careers/full-stack-developer-2/',
    categories: ['Software'],
    employmentType: 'Full Time',
    locationTerm: 'Cochin',
    experienceLine: '5+ years of experience building production web applications.',
    requiredSkills: [
      'Proficiency in Python, React, HTML, and SQL.',
      'Strong debugging and code review practices.',
    ],
  },
  {
    roleId: '5278',
    title: 'Embedded Software Engineer',
    detailUrl: 'https://sgbi.us/careers/embedded-software-engineer/',
    categories: ['Embedded'],
    employmentType: 'Full Time',
    locationTerm: 'India',
    experienceLine: '1.6 years of embedded software development experience.',
    requiredSkills: [
      'Experience with RTOS and Cortex-M platforms.',
      'Hands-on debugging for UART, SPI, Ethernet, and CAN.',
    ],
  },
  {
    roleId: '4514',
    title: 'Technical Content Writer',
    detailUrl: 'https://sgbi.us/careers/technical-content-writer/',
    categories: ['Marketing'],
    employmentType: 'Full Time',
    locationTerm: 'Cochin',
    experienceLine: '2+ years of technical writing experience.',
    requiredSkills: [
      'Ability to translate robotics workflows into clear product content.',
      'Strong editorial review and stakeholder collaboration.',
    ],
  },
  {
    roleId: '4081',
    title: 'Quality Engineer',
    detailUrl: 'https://sgbi.us/careers/quality-engineer/',
    categories: ['Mechanical'],
    employmentType: 'Full Time',
    locationTerm: 'Cochin',
    experienceLine: '3+ years of quality engineering experience.',
    requiredSkills: [
      'Experience with process audits and corrective actions.',
      'Comfort working with multidisciplinary robotics teams.',
    ],
  },
  {
    roleId: '3963',
    title: 'Fitter Machinist',
    detailUrl: 'https://sgbi.us/careers/job-summary/',
    categories: ['Mechanical'],
    employmentType: 'Internship',
    locationTerm: 'Cochin',
    experienceLine: '0-1 years of machining workshop exposure.',
    requiredSkills: [
      'Ability to support assembly and fabrication tasks.',
      'Comfort reading mechanical drawings and instructions.',
    ],
  },
  {
    roleId: '3863',
    title: 'Full Stack Developer',
    detailUrl: 'https://sgbi.us/careers/full-stack-developer/',
    categories: ['Information Technology (IT)'],
    employmentType: 'Full Time',
    locationTerm: 'Cochin',
    experienceLine: '4+ years of full-stack software development experience.',
    requiredSkills: [
      'Strong React and backend API development skills.',
      'Comfort collaborating with QA and product teams.',
    ],
  },
  {
    roleId: '3678',
    title: 'Business Development Executive',
    detailUrl: 'https://sgbi.us/careers/inside-sales-executive/',
    categories: ['Sales'],
    employmentType: 'Full Time',
    locationTerm: 'Cochin',
    experienceLine: '3+ years of B2B inside sales experience.',
    requiredSkills: [
      'Strong verbal and written communication skills.',
      'Ability to manage outbound prospecting and CRM hygiene.',
    ],
  },
]

const loadSastraModule = async () => import('./script.js')

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Robotic Testing Solutions for Real Devices | SGBI</title>
    <link rel="canonical" href="https://sgbi.us/" />
    <meta name="description" content="SGBI delivers robotic testing solutions for real devices, helping teams automate testing for mobile apps, POS systems, and smart devices efficiently." />
  </head>
  <body>
    <nav>
      <a href="https://sgbi.us/career/">Career</a>
    </nav>
    <main>
      <h1>Quality Testing made Faster &amp; Accurate with Real Robots</h1>
      <p>Trusted by industry leaders for robotic testing automation.</p>
    </main>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Corporation","name":"SGBI","legalName":"SGBI Inc","email":"contact@sgbi.us"}
    </script>
  </body>
</html>
`

const SITEMAP_INDEX_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://sgbi.us/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://sgbi.us/awsm_job_openings-sitemap.xml</loc></sitemap>
</sitemapindex>
`

const JOBS_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sgbi.us/careers/</loc></url>
  ${EXPECTED_PUBLIC_OPENINGS.map((opening) => `<url><loc>${opening.detailUrl}</loc></url>`).join('\n')}
</urlset>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Robotic Test Automation Careers | AI Robotics Jobs at SGBI</title>
    <link rel="canonical" href="https://sgbi.us/career/" />
    <meta name="description" content="Explore robotic test automation careers at SGBI. Join our AI-powered robotics team and build innovative automation testing solutions." />
    <link rel="stylesheet" id="awsm-jobs-style-css" href="https://sgbi.us/wp-content/plugins/wp-job-openings/assets/css/style.min.css" />
  </head>
  <body>
    <h1>Life at SGBI</h1>
    <h2>Career Opportunities</h2>
    <p>Join our AI-powered robotics team and build innovative automation testing solutions.</p>
    <div class="awsm-job-wrap">
      <div class="awsm-job-listings awsm-lists" data-listings="${EXPECTED_PUBLIC_OPENINGS.length}">
        ${EXPECTED_PUBLIC_OPENINGS.map((opening) => `
          <div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-${opening.roleId}">
            <div class="awsm-job-item">
              <div class="awsm-list-left-col">
                <h2 class="awsm-job-post-title">
                  <a href="${opening.detailUrl}">${opening.title.replace(/&/g, '&#038;')}</a>
                </h2>
                <div class="awsm-job-specification-wrapper">
                  <div class="awsm-job-specification-item awsm-job-specification-job-category">
                    ${opening.categories.map((category) => `<span class="awsm-job-specification-term">${category}</span>`).join(' ')}
                  </div>
                  <div class="awsm-job-specification-item awsm-job-specification-job-type">
                    <span class="awsm-job-specification-term">${opening.employmentType}</span>
                  </div>
                  <div class="awsm-job-specification-item awsm-job-specification-job-location">
                    <span class="awsm-job-specification-term">${opening.locationTerm}</span>
                  </div>
                </div>
                <div class="awsm-job-more-container">
                  <a class="awsm-job-more" href="${opening.detailUrl}">More Details <span></span></a>
                </div>
              </div>
            </div>
          </div>
        `).join('\n')}
      </div>
    </div>
    <footer>
      <a href="mailto:contact@sgbi.us">contact@sgbi.us</a>
      <div>SGBI Inc</div>
    </footer>
  </body>
</html>
`

const createDetailHtml = (opening) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>${opening.title.replace(/&/g, '&amp;')} | SGBI</title>
    <link rel="canonical" href="${opening.detailUrl}" />
  </head>
  <body>
    <div class="awsm-job-content">
      <h1 class="awsm-jobs-single-title">${opening.title.replace(/&/g, '&#038;')}</h1>
      <div class="awsm-job-specifications-container">
        <div class="awsm-job-specification-item awsm-job-specification-job-category">
          <span class="awsm-job-specification-label"><strong>Job Category: </strong></span>
          ${opening.categories.map((category) => `<span class="awsm-job-specification-term">${category}</span>`).join(' ')}
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-label"><strong>Job Type: </strong></span>
          <span class="awsm-job-specification-term">${opening.employmentType}</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-label"><strong>Job Location: </strong></span>
          <span class="awsm-job-specification-term">${opening.locationTerm}</span>
        </div>
      </div>
      <div class="awsm-job-entry-content entry-content">
        <p>SGBI builds robotic testing automation products for real-world devices.</p>
        <h3>Requirements</h3>
        <ul>
          <li>${opening.experienceLine}</li>
          ${opening.requiredSkills.map((skill) => `<li>${skill}</li>`).join('')}
        </ul>
      </div><!-- .awsm-job-entry-content -->
    </div>
    <div class="awsm-job-form">
      <h2>Apply for this position</h2>
      <form id="awsm-application-form">
        <input id="awsm-applicant-name" />
        <input id="awsm-applicant-email" />
        <input id="awsm-applicant-phone" />
        <label>Upload CV/Resume</label>
      </form>
    </div>
  </body>
</html>
`

test('Sastra Robotics-SGBI INC scraper recognizes the verified homepage, sitemap index, jobs sitemap, and careers page', async () => {
  const sastra = await loadSastraModule()

  assert.equal(sastra.SOURCE, SOURCE)
  assert.equal(sastra.COMPANY, COMPANY)
  assert.equal(sastra.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(sastra.CAREERS_URL, CAREERS_URL)
  assert.equal(sastra.SITEMAP_INDEX_URL, SITEMAP_INDEX_URL)
  assert.equal(sastra.JOBS_SITEMAP_URL, JOBS_SITEMAP_URL)
  assert.equal(sastra.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(sastra.hasVerifiedSitemapIndexSignal(SITEMAP_INDEX_XML), true)
  assert.equal(sastra.hasVerifiedJobsSitemapSignal(JOBS_SITEMAP_XML), true)
  assert.equal(sastra.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('Sastra Robotics-SGBI INC scraper extracts the seven verified role cards and detail metadata', async () => {
  const sastra = await loadSastraModule()

  assert.deepEqual(
    sastra.extractCurrentRoleCards(CAREERS_HTML),
    EXPECTED_PUBLIC_OPENINGS.map(({ roleId, title, detailUrl }) => ({ roleId, title, detailUrl })),
  )

  const detail = sastra.extractDetailPage({
    title: EXPECTED_PUBLIC_OPENINGS[0].title,
    detailUrl: EXPECTED_PUBLIC_OPENINGS[0].detailUrl,
    html: createDetailHtml(EXPECTED_PUBLIC_OPENINGS[0]),
  })

  assert.deepEqual(detail, {
    title: 'FULL STACK DEVELOPER',
    department: 'Software',
    location: 'Cochin, India',
    city: 'Cochin',
    country: 'India',
    employmentType: 'Full Time',
    applyUrl: 'https://sgbi.us/careers/full-stack-developer-2/',
    experienceRequired: '5+ years',
    requiredSkills: [
      EXPECTED_PUBLIC_OPENINGS[0].experienceLine,
      ...EXPECTED_PUBLIC_OPENINGS[0].requiredSkills,
    ],
    jobDescription: [
      'SGBI builds robotic testing automation products for real-world devices.',
      'Requirements',
      EXPECTED_PUBLIC_OPENINGS[0].experienceLine,
      ...EXPECTED_PUBLIC_OPENINGS[0].requiredSkills,
    ].join('\n'),
  })
})

test('Sastra Robotics-SGBI INC scraper run() validates the first-party surface and returns the seven current jobs', async () => {
  const sastra = await loadSastraModule()
  const fetchCounts = new Map()

  const fetchPage = async (url) => {
    fetchCounts.set(url, (fetchCounts.get(url) || 0) + 1)

    if (url === HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
    if (url === SITEMAP_INDEX_URL) return { status: 200, url, html: SITEMAP_INDEX_XML }
    if (url === JOBS_SITEMAP_URL) return { status: 200, url, html: JOBS_SITEMAP_XML }
    if (url === CAREERS_URL) return { status: 200, url, html: CAREERS_HTML }

    const opening = EXPECTED_PUBLIC_OPENINGS.find((item) => item.detailUrl === url)
    if (opening) return { status: 200, url, html: createDetailHtml(opening) }

    throw new Error(`Unexpected URL ${url}`)
  }

  const jobs = await sastra.createSastraRoboticsSgbiIncScraper({
    now: () => '2026-07-11T03:00:00.000Z',
  }).run({ fetchPage })

  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs[0], {
    title: 'FULL STACK DEVELOPER',
    company: COMPANY,
    department: 'Software',
    location: 'Cochin, India',
    city: 'Cochin',
    country: 'India',
    jobId: 'sastraroboticssgbiinc-5639',
    requisitionId: '5639',
    sourceUrl: 'https://sgbi.us/careers/full-stack-developer-2/',
    applyUrl: 'https://sgbi.us/careers/full-stack-developer-2/',
    employmentType: 'Full Time',
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      '5+ years of experience building production web applications.',
      'Proficiency in Python, React, HTML, and SQL.',
      'Strong debugging and code review practices.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'SGBI builds robotic testing automation products for real-world devices.',
      'Requirements',
      '5+ years of experience building production web applications.',
      'Proficiency in Python, React, HTML, and SQL.',
      'Strong debugging and code review practices.',
    ].join('\n'),
    remoteStatus: 'On-site',
    source: SOURCE,
    link: 'https://sgbi.us/careers/full-stack-developer-2/',
    scrapedAt: '2026-07-11T03:00:00.000Z',
    companyCareerPage: CAREERS_URL,
    companyDomain: 'sgbi.us',
    atsPlatform: 'official-company-careers',
  })
  assert.equal(fetchCounts.get(HOMEPAGE_URL), 1)
  assert.equal(fetchCounts.get(SITEMAP_INDEX_URL), 1)
  assert.equal(fetchCounts.get(JOBS_SITEMAP_URL), 1)
  assert.equal(fetchCounts.get(CAREERS_URL), 1)
  assert.equal(EXPECTED_PUBLIC_OPENINGS.every((opening) => fetchCounts.get(opening.detailUrl) === 1), true)
})

test('Sastra Robotics-SGBI INC scraper fails closed when the verified public role cards drift', async () => {
  const sastra = await loadSastraModule()
  const driftedCareersHtml = CAREERS_HTML.replace(
    'Business Development Executive',
    'Senior Business Development Executive',
  )

  await assert.rejects(
    sastra.createSastraRoboticsSgbiIncScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === SITEMAP_INDEX_URL) return { status: 200, url, html: SITEMAP_INDEX_XML }
        if (url === JOBS_SITEMAP_URL) return { status: 200, url, html: JOBS_SITEMAP_XML }
        if (url === CAREERS_URL) return { status: 200, url, html: driftedCareersHtml }

        const opening = EXPECTED_PUBLIC_OPENINGS.find((item) => item.detailUrl === url)
        if (opening) return { status: 200, url, html: createDetailHtml(opening) }

        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /current public openings changed materially/i,
  )
})
