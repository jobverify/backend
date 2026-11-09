import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const loadPixdynamicsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected PixDynamics scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Secure Online Identity Verification Service KYC, AML | Pixdynamics</title>
      <link rel="canonical" href="https://pixdynamics.com/" />
      <meta property="og:site_name" content="PixDynamics" />
    </head>
    <body>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://pixdynamics.com/#organization",
          "name": "PixDynamics Private Limited",
          "alternateName": "PixDynamics",
          "url": "https://pixdynamics.com/"
        }
      </script>
      <h1>AI-Powered KYC &amp; Identity Verification Solutions | PixDynamics</h1>
      <a href="about-us.html">About Us</a>
      <a href="contact-us.html">Contact Us</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Job Vacancies in Kochi</title>
      <link rel="canonical" href="https://pixdynamics.com/career" />
      <meta property="og:url" content="https://pixdynamics.com/career" />
      <meta property="og:site_name" content="PixDynamics" />
    </head>
    <body>
      <section class="ocrSolutionbanner">
        <h1>Join Us at Pixdynamics</h1>
        <p>At Pixdynamics, we are a team of innovators, creators, and problem-solvers.</p>
        <a href="#section1">View Openings</a>
      </section>

      <section id="section1" class="py-5">
        <h2>Check out our</h2>
        <h3>Job Openings</h3>

        <div class="job-card bg-white border bd_gray br_20 shadow_sm15 overflow-hidden mb-4">
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center p-4 border-bottom bd_gray">
            <div class="d-flex align-items-start gap_20">
              <div>
                <h3 class="font_22 font_600 text_black mb-2 font_family4">Digital Marketing Intern (SEO)</h3>
                <div class="d-flex flex-wrap gap_10">
                  <span><i class="fas fa-map-marker-alt"></i> Kochi</span>
                  <span><i class="fas fa-briefcase"></i> Internship</span>
                  <span><i class="fas fa-search"></i> SEO</span>
                </div>
              </div>
            </div>
          </div>

          <div class="job-card-body p-4 bg_light11 border-top bd_gray" style="display: none;">
            <div class="mb-4">
              <h4>About the Role</h4>
              <p>
                PixDynamics is looking for a motivated and enthusiastic Digital Marketing Intern (SEO)
                to join our team and support SEO, content optimization, and website performance analysis.
              </p>
            </div>

            <div class="col-lg-6 mb-4">
              <h4>Required Skills &amp; Qualifications</h4>
              <ul>
                <li>Basic understanding of SEO concepts and search engine algorithms.</li>
                <li>Familiarity with keyword research and SEO tools.</li>
                <li>Strong analytical and research skills.</li>
                <li>Interest in digital marketing and content optimization.</li>
              </ul>
            </div>

            <div class="col-lg-6 mb-4">
              <h4>How to Apply</h4>
              <a href="mailto:hr@pixl.ai?subject=Application for Digital Marketing Intern (SEO) - Kochi">
                hr@pixl.ai
              </a>
            </div>
          </div>
        </div>

        <div class="job-card bg-white border bd_gray br_20 shadow_sm15 overflow-hidden mb-4">
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center p-4 border-bottom bd_gray">
            <div class="d-flex align-items-start gap_20">
              <div>
                <h3 class="font_22 font_600 text_black mb-2 font_family4">Lead Support Engineer</h3>
                <div class="d-flex flex-wrap gap_10">
                  <span><i class="fas fa-map-marker-alt"></i> Kochi, Kerala</span>
                  <span><i class="fas fa-briefcase"></i> 3 Years Exp</span>
                  <span><i class="fas fa-user-friends"></i> Male Candidates Preferred</span>
                </div>
              </div>
            </div>
          </div>

          <div class="job-card-body p-4 bg_light11 border-top bd_gray" style="display: none;">
            <div class="mb-4">
              <h4>About the Role</h4>
              <p>
                PixDynamics is looking for a Support Engineer Lead to manage technical support
                operations, client escalations, and support team activities.
              </p>
            </div>

            <div class="col-lg-6 mb-4">
              <h4>Required Skills</h4>
              <ul>
                <li>SQL, REST APIs, and log analysis.</li>
                <li>Basic knowledge of Python, Kubernetes, and Docker.</li>
                <li>Linux &amp; Windows environment support.</li>
                <li>Jira, Freshdesk, or similar ticketing tools.</li>
              </ul>
            </div>

            <div class="col-lg-12 mb-4">
              <h4>How to Apply</h4>
              <a href="mailto:hr@pixl.ai?subject=Application for Lead Support Engineer - Kochi">
                hr@pixl.ai
              </a>
            </div>
          </div>
        </div>
      </section>

      <section class="d-none">
        <h1>We are Hiring</h1>
        <div class="card">
          <div class="card-header">
            <span class="pl-2">DevOps Engineer</span>
          </div>
          <div class="card-body">
            <p>Legacy hidden role</p>
            <a href="mailto:hr@pixl.ai?subject=Application for DevOps Engineer">Apply Now</a>
          </div>
        </div>
      </section>
    </body>
  </html>
`

test('PixDynamics sentinels recognize the verified homepage and first-party career page', async () => {
  const pixdynamics = await loadPixdynamicsModule()

  assert.equal(pixdynamics.SOURCE, 'pixdynamics')
  assert.equal(pixdynamics.COMPANY, 'PixDynamics')
  assert.equal(pixdynamics.HOMEPAGE_URL, 'https://pixdynamics.com/')
  assert.equal(pixdynamics.CAREERS_URL, 'https://pixdynamics.com/career')
  assert.equal(pixdynamics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(pixdynamics.hasOfficialCareerPageSignal(careersHtml), true)
})

test('PixDynamics extracts only the visible first-party openings and ignores the hidden legacy section', async () => {
  const pixdynamics = await loadPixdynamicsModule()

  const cards = pixdynamics.extractVisibleJobCards(careersHtml)
  const jobs = pixdynamics.extractIndiaJobOpenings(careersHtml)

  assert.equal(cards.length, 2)
  assert.deepEqual(
    cards.map((card) => card.title),
    ['Digital Marketing Intern (SEO)', 'Lead Support Engineer'],
  )

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      state,
      country,
      employmentType,
      experienceRequired,
      sourceUrl,
      applyUrl,
      jobId,
      requisitionId,
      requiredSkills,
    }) => ({
      title,
      department,
      location,
      city,
      state,
      country,
      employmentType,
      experienceRequired,
      sourceUrl,
      applyUrl,
      jobId,
      requisitionId,
      requiredSkills,
    }))(jobs[0]),
    {
      title: 'Digital Marketing Intern (SEO)',
      department: 'SEO',
      location: 'Kochi, India',
      city: 'Kochi',
      state: null,
      country: 'India',
      employmentType: 'Internship',
      experienceRequired: null,
      sourceUrl: 'https://pixdynamics.com/career',
      applyUrl: 'mailto:hr@pixl.ai?subject=Application for Digital Marketing Intern (SEO) - Kochi',
      jobId: 'pixdynamics-digital-marketing-intern-seo-kochi',
      requisitionId: 'pixdynamics-digital-marketing-intern-seo-kochi',
      requiredSkills: [
        'Basic understanding of SEO concepts and search engine algorithms.',
        'Familiarity with keyword research and SEO tools.',
        'Strong analytical and research skills.',
        'Interest in digital marketing and content optimization.',
      ],
    },
  )

  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      state,
      country,
      employmentType,
      experienceRequired,
      applyUrl,
      jobId,
      requisitionId,
      requiredSkills,
    }) => ({
      title,
      department,
      location,
      city,
      state,
      country,
      employmentType,
      experienceRequired,
      applyUrl,
      jobId,
      requisitionId,
      requiredSkills,
    }))(jobs[1]),
    {
      title: 'Lead Support Engineer',
      department: null,
      location: 'Kochi, Kerala, India',
      city: 'Kochi',
      state: 'Kerala',
      country: 'India',
      employmentType: null,
      experienceRequired: '3 years',
      applyUrl: 'mailto:hr@pixl.ai?subject=Application for Lead Support Engineer - Kochi',
      jobId: 'pixdynamics-lead-support-engineer-kochi-kerala',
      requisitionId: 'pixdynamics-lead-support-engineer-kochi-kerala',
      requiredSkills: [
        'SQL, REST APIs, and log analysis.',
        'Basic knowledge of Python, Kubernetes, and Docker.',
        'Linux & Windows environment support.',
        'Jira, Freshdesk, or similar ticketing tools.',
      ],
    },
  )

  const normalized = normalizeScrapedJob(jobs[1], {
    source: 'pixdynamics',
    companyName: 'PixDynamics',
    companyCareerPage: 'https://pixdynamics.com/career',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
  })

  assert.equal(normalized.jobType, 'Full-time Experienced')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.companyDomain, 'pixdynamics.com')
})

test('PixDynamics run verifies the trusted surfaces and returns the current visible openings', async () => {
  const pixdynamics = await loadPixdynamicsModule()
  const requestedUrls = []

  const jobs = await pixdynamics.createPixdynamicsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === pixdynamics.HOMEPAGE_URL) return homepageHtml
      if (url === pixdynamics.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pixdynamics.HOMEPAGE_URL,
    pixdynamics.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      source: job.source,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Digital Marketing Intern (SEO)',
        company: 'PixDynamics',
        source: 'pixdynamics',
        link: 'https://pixdynamics.com/career',
        companyCareerPage: 'https://pixdynamics.com/career',
        companyDomain: 'pixdynamics.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Lead Support Engineer',
        company: 'PixDynamics',
        source: 'pixdynamics',
        link: 'https://pixdynamics.com/career',
        companyCareerPage: 'https://pixdynamics.com/career',
        companyDomain: 'pixdynamics.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
})

test('PixDynamics fails closed when the verified homepage or public career structure changes', async () => {
  const pixdynamics = await loadPixdynamicsModule()

  await assert.rejects(
    pixdynamics.createPixdynamicsScraper().run({
      fetchText: async (url) => {
        if (url === pixdynamics.HOMEPAGE_URL) {
          return homepageHtml.replace('PixDynamics Private Limited', 'Another Company')
        }

        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    pixdynamics.createPixdynamicsScraper().run({
      fetchText: async (url) => {
        if (url === pixdynamics.HOMEPAGE_URL) return homepageHtml
        if (url === pixdynamics.CAREERS_URL) {
          return careersHtml.replaceAll(
            'class="job-card bg-white border bd_gray br_20 shadow_sm15 overflow-hidden mb-4"',
            'class="legacy-card"',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /visible public job cards/i,
  )
})
