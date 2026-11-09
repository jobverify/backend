import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_JOBS = [
  {
    title: 'Quality Analyst (QA)',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '4-7 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/quality-analyst-qa/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Quality+Analyst+%28QA%29',
    aboutRole: [
      'Support quality assurance initiatives across backend banking operations to ensure accuracy, compliance, and operational excellence.',
      'Partner with operations, training, and compliance teams to drive continuous process improvement.',
    ],
    jobDescription: [
      'Conduct regular audits and quality reviews of backend banking transactions and operational processes.',
      'Prepare quality reports, scorecards, dashboards, and management review presentations.',
    ],
    educationalQualifications: [
      'Bachelor’s degree in Commerce, Finance, Business Administration, Banking, or a related discipline.',
    ],
    experienceDetails: [
      '2–6 years of experience in Quality Assurance, Quality Control, Banking Operations, or Financial Services environments.',
    ],
    skills: [
      'Strong knowledge of banking operations including account maintenance, payments, reconciliations, and compliance processes.',
    ],
    perks: [
      '2-way cab pick-up and drop-off facility for a stress-free commute.',
    ],
    trainingSupport: [
      'Comprehensive project-specific training will be provided to help you succeed in your role.',
    ],
  },
  {
    title: 'Risk Lines of Defense Professionals',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '2+ Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/risk-lines-of-defense-professionals/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Risk+Lines+of+Defense+Professionals',
    aboutRole: [
      'Support risk and control programs across banking and financial services operations.',
    ],
    jobDescription: [
      'Execute risk assessments, control testing, and issue tracking for banking processes.',
    ],
    educationalQualifications: [
      'Bachelor’s degree in Finance, Accounting, Risk Management, Business, or a related field.',
    ],
    experienceDetails: [
      '2+ years of experience in risk, control, audit, or compliance functions.',
    ],
    skills: [
      'Understanding of risk frameworks, controls, governance, and regulatory compliance.',
    ],
    perks: [
      'Exposure to multiple functional areas, enhancing your professional growth.',
    ],
    trainingSupport: [
      'Role-specific onboarding and process training will be provided.',
    ],
  },
  {
    title: 'Assistant Manager – Banking Backend Operations',
    jobType: 'Full Time (Night Shift)',
    location: 'Noida / Gurugram',
    experience: '4-7 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/assistant-manager-banking-backend-operations/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Assistant+Manager+%E2%80%93+Banking+Backend+Operations',
    aboutRole: ['Lead banking backend operations teams during the night shift.'],
    jobDescription: ['Manage daily backend banking operations, SLAs, and quality outcomes.'],
    educationalQualifications: ['Bachelor’s degree in Banking, Finance, Commerce, or related discipline.'],
    experienceDetails: ['4–7 years of experience in banking backend operations and team leadership.'],
    skills: ['Strong people management, SLA governance, and process-improvement skills.'],
    perks: ['One complimentary meal provided during the shift.'],
    trainingSupport: ['Project-specific process training will be provided.'],
  },
  {
    title: 'Solution Consulting Lead',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '4-7 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/solution-consulting-lead/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Solution+Consulting+Lead',
    aboutRole: ['Drive solution consulting for BFSI engagements.'],
    jobDescription: ['Translate client needs into solution proposals and implementation roadmaps.'],
    educationalQualifications: ['Bachelor’s degree in Business, Finance, Technology, or related field.'],
    experienceDetails: ['4–7 years of consulting or BFSI solutioning experience.'],
    skills: ['Strong consulting, presentation, stakeholder, and BFSI domain skills.'],
    perks: ['Supportive work environment focused on learning and development.'],
    trainingSupport: ['Comprehensive project-specific training will be provided.'],
  },
  {
    title: 'Senior Data Architect & Modeling Specialist',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '4-7 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/senior-data-architect-modeling-specialist/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Senior+Data+Architect+%26+Modeling+Specialist',
    aboutRole: ['Own data architecture and modeling initiatives for enterprise BFSI use cases.'],
    jobDescription: ['Design scalable data models and data architecture patterns.'],
    educationalQualifications: ['Bachelor’s degree in Computer Science, Engineering, Data, or related field.'],
    experienceDetails: ['4–7 years of data architecture and modeling experience.'],
    skills: ['Strong dimensional modeling, database design, and enterprise data architecture skills.'],
    perks: ['Exposure to multiple functional areas, enhancing your professional growth.'],
    trainingSupport: ['Role-specific training support will be provided.'],
  },
  {
    title: 'Alteryx Designer & Server Admin',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '5 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/alteryx-designer-server-admin/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Alteryx+Designer+%26+Server+Admin',
    aboutRole: ['Administer Alteryx Server and support workflow development.'],
    jobDescription: ['Maintain Alteryx infrastructure and enable designer productivity.'],
    educationalQualifications: ['Bachelor’s degree in Technology, Analytics, or related discipline.'],
    experienceDetails: ['5 years of Alteryx Designer and Server administration experience.'],
    skills: ['Strong Alteryx workflow, server administration, and automation skills.'],
    perks: ['Supportive work environment focused on learning and development.'],
    trainingSupport: ['Project-specific training support will be provided.'],
  },
  {
    title: 'Senior Analyst – Advisory & Professional Services (BFSI)',
    detailPageTitle: 'Senior Analyst - Advisory & Professional Services (BFSI)',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '4-7 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/senior-analyst-advisory-professional-services-bfsi/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Senior+Analyst+%E2%80%93+Advisory+%26+Professional+Services+%28BFSI%29',
    aboutRole: ['Deliver advisory and professional services for BFSI clients.'],
    jobDescription: ['Support client assessments, recommendations, and solution execution.'],
    educationalQualifications: ['Bachelor’s degree in Finance, Business, Technology, or related field.'],
    experienceDetails: ['4–7 years of advisory or professional services experience in BFSI.'],
    skills: ['Strong analysis, documentation, and client-engagement skills.'],
    perks: ['Exposure to multiple functional areas, enhancing your professional growth.'],
    trainingSupport: ['Comprehensive project-specific training will be provided.'],
  },
  {
    title: 'Full Stack Developer – Microsoft/Azure Technology',
    jobType: 'Full Time',
    location: 'Noida / Gurugram',
    experience: '8 Years',
    dateOpened: '01 june 2026',
    country: 'India',
    detailUrl: 'https://www.anaptyss.com/job-post/full-stack-developer-microsoft-azure-technology/',
    applyUrl: 'https://www.anaptyss.com/apply-now/?post=Full+Stack+Developer+%E2%80%93+Microsoft%2FAzure+Technology',
    aboutRole: ['Build cloud-native full-stack solutions on Microsoft and Azure technologies.'],
    jobDescription: ['Develop, deploy, and maintain enterprise-grade full-stack applications.'],
    educationalQualifications: ['Bachelor’s degree in Computer Science, Engineering, or related discipline.'],
    experienceDetails: ['8 years of full-stack development experience on Microsoft and Azure stacks.'],
    skills: ['Strong .NET, Azure, API, and modern front-end development skills.'],
    perks: ['Supportive work environment focused on learning and development.'],
    trainingSupport: ['Role-specific onboarding and project training will be provided.'],
  },
]

const VERIFIED_JOB_DETAIL_URLS = VERIFIED_JOBS.map((job) => job.detailUrl)

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Digital Knowledge Operations | Anaptyss Inc.</title>
  </head>
  <body>
    <nav>
      <a href="https://www.anaptyss.com/careers/">Careers</a>
      <a href="https://www.anaptyss.com/life-at-anaptyss/">Life @ Anaptyss</a>
    </nav>
    <main>
      <h1>Human-Governed. Audit-Ready on the Go.</h1>
      <p>Digital Knowledge Operations</p>
    </main>
  </body>
</html>
`

const careersLandingHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers - Anaptyss Inc.</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Come, join us and make yourself a rewarding career.</p>
    <a href="https://www.anaptyss.com/jobs/">Explore Opportunities</a>
  </body>
</html>
`

const buildJobsHtml = (jobs) => `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Jobs - Anaptyss Inc.</title>
  </head>
  <body>
    <h1>Build an Exciting &amp; Fulfilling Career with Anaptyss</h1>
    <h2>Join us</h2>
    <p>Current Openings</p>
    ${jobs.map((job) => `
      <div class="job-profile-item job-shadow">
        <a href="javascript:void(0)">
          <div class="jobs-contents">
            <div class="job-profile-info">
              <h4>${job.title}</h4>
              <ul>
                <li>${job.jobType}</li>
                <li>${job.location}</li>
              </ul>
            </div>
          </div>
        </a>
        <div class="job-profile-item-content">
          <h5>Job Information</h5>
          <div class="row">
            <div class="col-lg-4 col-md-4">
              <ul class="cw-summary-list">
                <li><span class="spn1">Industry</span><span class="spn2">Banking &amp; Financial Services</span></li>
                <li><span class="spn1">Work Experience</span><span class="spn2">${job.experience}</span></li>
                <li><span class="spn1">Date Opened</span><span class="spn2">${job.dateOpened}</span></li>
              </ul>
            </div>
            <div class="col-lg-4 col-md-4">
              <ul class="cw-summary-list">
                <li><span class="spn1">City</span><span class="spn2">${job.location}</span></li>
                <li><span class="spn1">State/Province</span><span class="spn2">Uttar Pradesh, Haryana</span></li>
                <li><span class="spn1">Country</span><span class="spn2">${job.country}</span></li>
              </ul>
            </div>
            <div class="col-lg-4 col-md-4">
              <ul class="cw-summary-list">
                <li><span class="spn1">Job Type</span><span class="spn2">${job.jobType}</span></li>
                <li><span class="spn1">Zip/Postal Code</span><span class="spn2">201309/122002</span></li>
              </ul>
              <div class="job-apply-button">
                <a href="${job.detailUrl}" class="links">View More</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('\n')}
  </body>
</html>
`

const buildDetailHtml = (job) => `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>${job.detailPageTitle ?? job.title} - Anaptyss Inc.</title>
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"${job.detailUrl}","name":"${job.detailPageTitle ?? job.title} - Anaptyss Inc.","datePublished":"2026-06-03T08:48:24+00:00"}]}
    </script>
  </head>
  <body>
    <h1>${job.title}</h1>
    <section class="job-info-sec">
      <h2 class="job-title">Job Information</h2>
      <ul class="cww-summary-list">
        <li><span class="spn1">Industry</span><span class="spn2">Banking &amp; Financial Services</span></li>
        <li><span class="spn1">Work Experience</span><span class="spn2">${job.experience}</span></li>
        <li><span class="spn1">Date Opened</span><span class="spn2">${job.dateOpened}</span></li>
        <li><span class="spn1">Job Type</span><span class="spn2">${job.jobType}</span></li>
        <li><span class="spn1">City</span><span class="spn2">${job.location}</span></li>
        <li><span class="spn1">Country</span><span class="spn2">${job.country}</span></li>
      </ul>
      <div class="job-apply text-center mt-4">
        <a href="${job.applyUrl}" class="apply-now-button">Apply Now</a>
      </div>
    </section>
    <section class="role-single-careers-desc-sec">
      <h2 class="title tg-element-title">About the Role</h2>
      <div class="job-desc-lists"><ul>${job.aboutRole.map((item) => `<li>${item}</li>`).join('')}</ul></div>
    </section>
    <section class="jobdesc-single-careers-sec">
      <h2 class="title tg-element-title">Job Description</h2>
      <div class="job-desc-lists"><ul>${job.jobDescription.map((item) => `<li>${item}</li>`).join('')}</ul></div>
    </section>
    <section class="single-job-bg-parallax">
      <h2 class="title tg-element-title">Qualifications</h2>
      <section class="single-careers-edu-sec">
        <h2 class="title tg-element-title">Educational Qualifications</h2>
        <div class="job-desc-lists"><ul>${job.educationalQualifications.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      </section>
      <section class="single-careers-experience-sec">
        <h2 class="title tg-element-title">Experience</h2>
        <div class="job-desc-lists"><ul>${job.experienceDetails.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      </section>
      <section class="single-careers-skill-sec">
        <h2 class="title tg-element-title">Skills</h2>
        <div class="job-desc-lists"><ul>${job.skills.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      </section>
    </section>
    <section class="single-careers-perks-sec">
      <h2 class="title tg-element-title">Perks and Benefits</h2>
      <div class="job-desc-lists"><ul>${job.perks.map((item) => `<li>${item}</li>`).join('')}</ul></div>
    </section>
    <section class="single-careers-training-sec">
      <h2 class="title tg-element-title">Training Support</h2>
      <div class="job-desc-lists"><ul>${job.trainingSupport.map((item) => `<li>${item}</li>`).join('')}</ul></div>
    </section>
    <section class="full-cta-sec">
      <a href="${job.applyUrl}" class="btn-1">Apply Now</a>
    </section>
  </body>
</html>
`

const jobsHtml = buildJobsHtml(VERIFIED_JOBS)

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.anaptyss.com/post-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.anaptyss.com/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.anaptyss.com/job_post-sitemap.xml</loc></sitemap>
</sitemapindex>
`

const jobPostSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${[...VERIFIED_JOB_DETAIL_URLS].reverse().map((url) => `<url><loc>${url}</loc></url>`).join('')}
</urlset>
`

const publicJobsDriftHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Jobs - Anaptyss Inc.</title>
  </head>
  <body>
    <h1>Build an Exciting &amp; Fulfilling Career with Anaptyss</h1>
    <p>Current Openings</p>
    <a href="https://external.example/jobs">View More</a>
  </body>
</html>
`

const loadAnaptyssModule = async () => {
  try {
    return await import('../../scraper/anaptyss/script.js')
  } catch {
    assert.fail('Expected Anaptyss scraper module at ../../scraper/anaptyss/script.js')
  }
}

test('Anaptyss helpers stay pinned to the verified homepage, careers landing, jobs page, and job-post detail-page signals', async () => {
  const anaptyss = await loadAnaptyssModule()

  assert.equal(anaptyss.SOURCE, 'anaptyss')
  assert.equal(anaptyss.COMPANY, 'Anaptyss')
  assert.equal(anaptyss.OFFICIAL_BRAND_NAME, 'Anaptyss Inc.')
  assert.equal(anaptyss.VERIFIED_ON, '2026-10-03')
  assert.equal(anaptyss.HOMEPAGE_URL, 'https://www.anaptyss.com/')
  assert.equal(anaptyss.CAREERS_LANDING_URL, 'https://www.anaptyss.com/careers/')
  assert.equal(anaptyss.JOBS_URL, 'https://www.anaptyss.com/jobs/')
  assert.equal(anaptyss.SITEMAP_URL, 'https://www.anaptyss.com/sitemap_index.xml')
  assert.equal(anaptyss.JOB_POST_SITEMAP_URL, 'https://www.anaptyss.com/job_post-sitemap.xml')
  assert.deepEqual(anaptyss.VERIFIED_JOB_DETAIL_URLS, VERIFIED_JOB_DETAIL_URLS)
  assert.equal(anaptyss.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(anaptyss.hasCareersLandingSignal(careersLandingHtml), true)
  assert.equal(anaptyss.extractJobsPageUrl(careersLandingHtml), 'https://www.anaptyss.com/jobs/')
  assert.equal(anaptyss.hasJobsPageSignal(jobsHtml), true)
  assert.deepEqual(anaptyss.extractJobPostUrlsFromSitemap(jobPostSitemapXml), VERIFIED_JOB_DETAIL_URLS)
  assert.deepEqual(
    anaptyss.extractJobCards(jobsHtml).map((job) => ({
      title: job.title,
      jobType: job.jobType,
      location: job.location,
      experience: job.experience,
      dateOpened: job.dateOpened,
      country: job.country,
      detailUrl: job.detailUrl,
    })),
    VERIFIED_JOBS.map((job) => ({
      title: job.title,
      jobType: job.jobType,
      location: job.location,
      experience: job.experience,
      dateOpened: job.dateOpened,
      country: job.country,
      detailUrl: job.detailUrl,
    })),
  )
  assert.equal(
    anaptyss.extractApplyUrl(buildDetailHtml(VERIFIED_JOBS[0])),
    VERIFIED_JOBS[0].applyUrl,
  )
  assert.match(
    anaptyss.extractDetailDescription(buildDetailHtml(VERIFIED_JOBS[0])),
    /Support quality assurance initiatives across backend banking operations/i,
  )
  assert.match(
    anaptyss.extractDetailDescription(buildDetailHtml(VERIFIED_JOBS[0])),
    /Bachelor’s degree in Commerce, Finance, Business Administration/i,
  )
})

test('Anaptyss run returns verified India jobs from the first-party jobs page and detail pages', async () => {
  const anaptyss = await loadAnaptyssModule()
  const requestedUrls = []

  const jobs = await anaptyss.createAnaptyssScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === anaptyss.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === anaptyss.CAREERS_LANDING_URL) {
        return { status: 200, url, html: careersLandingHtml }
      }

      if (url === anaptyss.JOBS_URL) {
        return { status: 200, url, html: jobsHtml }
      }

      if (url === anaptyss.SITEMAP_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === anaptyss.JOB_POST_SITEMAP_URL) {
        return { status: 200, url, html: jobPostSitemapXml }
      }

      const matchedJob = VERIFIED_JOBS.find((job) => job.detailUrl === url)
      if (matchedJob) {
        return { status: 200, url, html: buildDetailHtml(matchedJob) }
      }

      throw new Error(`Unexpected Anaptyss URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    anaptyss.HOMEPAGE_URL,
    anaptyss.CAREERS_LANDING_URL,
    anaptyss.JOBS_URL,
    anaptyss.SITEMAP_URL,
    anaptyss.JOB_POST_SITEMAP_URL,
    ...VERIFIED_JOB_DETAIL_URLS,
  ])

  assert.equal(jobs.length, VERIFIED_JOBS.length)
  assert.deepEqual(
    jobs.map((job) => job.sourceUrl),
    VERIFIED_JOB_DETAIL_URLS,
  )
  assert.deepEqual(jobs.slice(0, 2), [
    {
      title: 'Quality Analyst (QA)',
      company: 'Anaptyss',
      department: 'Banking & Financial Services',
      location: 'Noida / Gurugram, India',
      city: 'Noida',
      country: 'India',
      jobId: 'quality-analyst-qa',
      requisitionId: null,
      sourceUrl: 'https://www.anaptyss.com/job-post/quality-analyst-qa/',
      applyUrl: 'https://www.anaptyss.com/apply-now/?post=Quality+Analyst+%28QA%29',
      employmentType: 'Full Time',
      experienceRequired: '4-7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-01',
      closingDate: null,
      jobDescription: 'About the Role: Support quality assurance initiatives across backend banking operations to ensure accuracy, compliance, and operational excellence. Partner with operations, training, and compliance teams to drive continuous process improvement. Job Description: Conduct regular audits and quality reviews of backend banking transactions and operational processes. Prepare quality reports, scorecards, dashboards, and management review presentations. Educational Qualifications: Bachelor’s degree in Commerce, Finance, Business Administration, Banking, or a related discipline. Experience: 2–6 years of experience in Quality Assurance, Quality Control, Banking Operations, or Financial Services environments. Skills: Strong knowledge of banking operations including account maintenance, payments, reconciliations, and compliance processes. Perks and Benefits: 2-way cab pick-up and drop-off facility for a stress-free commute. Training Support: Comprehensive project-specific training will be provided to help you succeed in your role.',
      source: 'anaptyss',
      link: 'https://www.anaptyss.com/apply-now/?post=Quality+Analyst+%28QA%29',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Risk Lines of Defense Professionals',
      company: 'Anaptyss',
      department: 'Banking & Financial Services',
      location: 'Noida / Gurugram, India',
      city: 'Noida',
      country: 'India',
      jobId: 'risk-lines-of-defense-professionals',
      requisitionId: null,
      sourceUrl: 'https://www.anaptyss.com/job-post/risk-lines-of-defense-professionals/',
      applyUrl: 'https://www.anaptyss.com/apply-now/?post=Risk+Lines+of+Defense+Professionals',
      employmentType: 'Full Time',
      experienceRequired: '2+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-01',
      closingDate: null,
      jobDescription: 'About the Role: Support risk and control programs across banking and financial services operations. Job Description: Execute risk assessments, control testing, and issue tracking for banking processes. Educational Qualifications: Bachelor’s degree in Finance, Accounting, Risk Management, Business, or a related field. Experience: 2+ years of experience in risk, control, audit, or compliance functions. Skills: Understanding of risk frameworks, controls, governance, and regulatory compliance. Perks and Benefits: Exposure to multiple functional areas, enhancing your professional growth. Training Support: Role-specific onboarding and process training will be provided.',
      source: 'anaptyss',
      link: 'https://www.anaptyss.com/apply-now/?post=Risk+Lines+of+Defense+Professionals',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Anaptyss fails closed when the homepage, careers landing, jobs listing surface, or detail-page apply handoff drifts', async () => {
  const anaptyss = await loadAnaptyssModule()

  await assert.rejects(
    anaptyss.createAnaptyssScraper().run({
      fetchPage: async (url) => {
        if (url === anaptyss.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Anaptyss URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    anaptyss.createAnaptyssScraper().run({
      fetchPage: async (url) => {
        if (url === anaptyss.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === anaptyss.CAREERS_LANDING_URL) {
          return { status: 200, url, html: careersLandingHtml.replace('https://www.anaptyss.com/jobs/', 'https://external.example/jobs') }
        }

        throw new Error(`Unexpected Anaptyss URL: ${url}`)
      },
    }),
    /careers landing/i,
  )

  await assert.rejects(
    anaptyss.createAnaptyssScraper().run({
      fetchPage: async (url) => {
        if (url === anaptyss.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === anaptyss.CAREERS_LANDING_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === anaptyss.JOBS_URL) {
          return { status: 200, url, html: publicJobsDriftHtml }
        }

        throw new Error(`Unexpected Anaptyss URL: ${url}`)
      },
    }),
    /jobs page/i,
  )

  await assert.rejects(
    anaptyss.createAnaptyssScraper().run({
      fetchPage: async (url) => {
        if (url === anaptyss.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === anaptyss.CAREERS_LANDING_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === anaptyss.JOBS_URL) {
          return { status: 200, url, html: jobsHtml }
        }

        if (url === anaptyss.SITEMAP_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === anaptyss.JOB_POST_SITEMAP_URL) {
          return { status: 200, url, html: jobPostSitemapXml }
        }

        const matchedJob = VERIFIED_JOBS.find((job) => job.detailUrl === url)
        if (matchedJob) {
          return {
            status: 200,
            url,
            html: buildDetailHtml(matchedJob).split(matchedJob.applyUrl).join('https://external.example/apply'),
          }
        }

        throw new Error(`Unexpected Anaptyss URL: ${url}`)
      },
    }),
    /detail page surface changed/i,
  )
})

test('Anaptyss follows the redesigned first-party openings page and validates its India detail and apply URL', async () => {
  const anaptyss = await loadAnaptyssModule()
  const detailUrl = 'https://www.anaptyss.com/job-post/quality-analyst-qa'
  const homepage = '<html><head><title>Anaptyss — Building Intelligent Enterprises for What&#x27;s Next</title></head><body><a href="/life-at-anaptyss">Life @ Anaptyss</a><a href="/careers/openings">Current Openings</a></body></html>'
  const careers = '<html><head><title>Current Openings | Anaptyss</title><link rel="canonical" href="https://anaptyss.com/careers/openings"></head><body><details class="op-card"><summary><h4>Quality Analyst (QA)</h4><span class="op-card-meta"><span><svg></svg>Full Time</span><span><svg></svg>Noida / Gurugram</span></span></summary><div><dl><div><dt>Industry</dt><dd>Banking &amp; Financial Services</dd></div><div><dt>Work Experience</dt><dd>4-7 Years</dd></div><div><dt>Date Opened</dt><dd>01 June 2026</dd></div></dl><a href="/job-post/quality-analyst-qa"><span>View More</span></a></div></details></body></html>'
  const detail = '<html><head><title>Quality Analyst (QA) | Anaptyss</title></head><body><h1>Quality Analyst (QA)</h1><h2>Job Information</h2><dl><div><dt>Country</dt><dd>India</dd></div><div><dt>City</dt><dd>Noida / Gurugram</dd></div></dl><a href="/apply-now?post=Quality%20Analyst%20(QA)">Apply Now</a><div class="jb-block"><h2 class="sec-title">Job Description</h2><div class="jb-prose"><p>Review banking operations for quality.</p></div></div></body></html>'
  const fetchPage = async (url) => ({ status: 200, url, html: new Map([
    [anaptyss.HOMEPAGE_URL, homepage],
    [anaptyss.CURRENT_CAREERS_URL, careers],
    [detailUrl, detail],
  ]).get(url) })

  const jobs = await anaptyss.createAnaptyssScraper().run({ fetchPage })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Quality Analyst (QA)')
  assert.equal(jobs[0].location, 'Noida / Gurugram, India')
  assert.equal(jobs[0].sourceUrl, detailUrl)
  assert.equal(jobs[0].applyUrl, 'https://www.anaptyss.com/apply-now?post=Quality%20Analyst%20(QA)')

  await assert.rejects(anaptyss.createAnaptyssScraper().run({
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: url === detailUrl ? detail.replace('<dd>India</dd>', '<dd>United States</dd>') : (await fetchPage(url)).html,
    }),
  }), /current job detail changed/i)
})
