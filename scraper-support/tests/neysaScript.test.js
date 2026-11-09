import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Neysa</title>
  </head>
  <body>
    <h1>Career</h1>
    <p>Build the Future of AI Infrastructure with Neysa.</p>
    <a href="https://neysa.ai/careers/job-openings/">View Job Openings</a>
  </body>
</html>
`

const jobOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings - Neysa</title>
  </head>
  <body>
    <script>var ajaxAction = "filter_career_listings";</script>
    <div class="job-section">
      <h2 class="test">Engineering</h2>
      <div class="job-card">
        <h3 class="job-title">Backend Engineer</h3>
        <div class="job-meta">
          <div class="meta-row"><span>Minimum Experience:</span><span>5 to 7 years</span></div>
          <div class="meta-row"><span>Location:</span><span>Mumbai</span></div>
        </div>
        <a class="job-btn" href="https://neysa.ai/careers/job-openings/backend-engineer/">Job Details</a>
      </div>
      <div class="job-card">
        <h3 class="job-title">Threat Detection Engineer - Cybersecurity</h3>
        <div class="job-meta">
          <div class="meta-row"><span>Minimum Experience:</span><span>3 to 5 years</span></div>
          <div class="meta-row"><span>Location:</span><span>Chennai</span></div>
        </div>
        <a class="job-btn" href="https://neysa.ai/careers/job-openings/threat-detection-engineer-cybersecurity/">Job Details</a>
      </div>
    </div>
    <div class="job-section">
      <h2 class="test">Finance &amp; Procurement</h2>
      <div class="job-card">
        <h3 class="job-title">Legal Counsel</h3>
        <div class="job-meta">
          <div class="meta-row"><span>Minimum Experience:</span><span>2 to 5 years</span></div>
          <div class="meta-row"><span>Location:</span><span>Mumbai</span></div>
        </div>
        <a class="job-btn" href="https://neysa.ai/careers/job-openings/legal-counsel/">Job Details</a>
      </div>
    </div>
  </body>
</html>
`

const liveJobOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opening - Build a Career at Neysa</title>
  </head>
  <body>
    <script>var ajaxAction = "filter_career_listings";</script>
    <div class="job-section">
      <h2 class="department-title">Finance</h2>
      <div class="job-card">
        <div class="job-details-wrapper">
          <h3 class="job-title">Legal Counsel</h3>
          <div class="job-meta">
            <div class="locations"><span class="prefix-meta">Location:</span> <span class="details-highlight">Mumbai</span></div>
          </div>
        </div>
        <div class="jd-btn-wrapper">
          <a href="https://neysa.ai/careers/job-openings/?job_id=51219" class="job-btn">Job Details</a>
        </div>
      </div>
      <h2 class="department-title">Tech</h2>
      <div class="job-card">
        <div class="job-details-wrapper">
          <h3 class="job-title">Backend Engineer</h3>
          <div class="job-meta">
            <div class="locations"><span class="prefix-meta">Location:</span> <span class="details-highlight">Mumbai</span></div>
          </div>
        </div>
        <div class="jd-btn-wrapper">
          <a href="https://neysa.ai/careers/job-openings/?job_id=51964" class="job-btn">Job Details</a>
        </div>
      </div>
      <div class="job-card">
        <div class="job-details-wrapper">
          <h3 class="job-title">QA Lead - Cloud/AI/Infrastructure</h3>
          <div class="job-meta">
            <div class="locations"><span class="prefix-meta">Location:</span> <span class="details-highlight">Mumbai</span></div>
          </div>
        </div>
        <div class="jd-btn-wrapper">
          <a href="https://neysa.ai/careers/job-openings/?job_id=52093" class="job-btn">Job Details</a>
        </div>
      </div>
    </div>
  </body>
</html>
`

const backendDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Backend Engineer - Neysa</title>
    <meta property="og:title" content="Backend Engineer" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "datePublished": "2026-07-04T06:03:35+00:00"
      }
    </script>
  </head>
  <body>
    <h2>Job Description</h2>
    <div class="job-description">
      <p>Position – Backend Engineer</p>
      <p>Experience: 5 to 7 years</p>
      <p>Primary Focus: Backend development, bug fixing, API/microservice development, production support</p>
      <p>Project: Overwatch, a NestJS/Nx monorepo with gRPC-based backend microservices</p>
      <h3>Role Summary</h3>
      <p>Build and support backend microservices for Neysa cloud products.</p>
      <h3>Key Responsibilities</h3>
      <ul>
        <li>Develop backend APIs and microservices.</li>
        <li>Support production systems and bug fixes.</li>
      </ul>
    </div>
    <button>Apply Now</button>
  </body>
</html>
`

const liveBackendDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opening - Build a Career at Neysa</title>
    <meta property="og:title" content="Job Openings" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "datePublished": "2025-05-22T06:03:35+00:00"
      }
    </script>
  </head>
  <body>
    <div class="job-card">
      <div class="job-header">
        <div class="job-title-group">
          <h1 class="job-title">Backend Engineer</h1>
          <p class="job-department">Tech</p>
        </div>
        <div class="job-apply">
          <a href="https://careers.kula.ai/neysa/51964" class="apply-btn" target="_blank">Apply Now</a>
        </div>
      </div>
    </div>
    <div class="job-details-wrapper">
      <div class="job-details">
        <div class="detail-item"><span class="label">Type</span> <span class="value">Full-time</span></div>
        <div class="detail-item"><span class="label">Department</span> <span class="value">Tech</span></div>
        <div class="detail-item"><span class="label">Location</span> <span class="value">Mumbai (On-site)</span></div>
        <div class="detail-item"><span class="label">Minimum Qualifications</span> <span class="value">Bachelor's Degree or Equivalent</span></div>
      </div>
    </div>
    <section>
      <div class="job-description">
        <h2>Job Description</h2>
        <p><strong>Experience:</strong>&nbsp;5 to 7 years</p>
        <p><strong>Primary Focus:</strong>&nbsp;Backend development, bug fixing, API/microservice development, production support</p>
        <p><strong>Project:</strong>&nbsp;Overwatch, a NestJS/Nx monorepo with gRPC-based backend microservices</p>
        <p><strong>Role Summary:</strong>&nbsp;Build and support backend microservices for Neysa cloud products.</p>
      </div>
    </section>
  </body>
</html>
`

const legalDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Legal Counsel - Neysa</title>
    <meta property="og:title" content="Legal Counsel" />
  </head>
  <body>
    <h2>Job Description</h2>
    <div class="job-description">
      <p>Position – Legal Counsel</p>
      <p>Experience: 2 to 5 years</p>
      <p>Support commercial contracting and regulatory review.</p>
    </div>
    <button>Apply Now</button>
  </body>
</html>
`

const loadNeysaModule = async () => {
  try {
    return await import('../../scraper/neysa/script.js')
  } catch {
    assert.fail('Expected Neysa scraper module at ../../scraper/neysa/script.js')
  }
}

test('Neysa verifies the official careers page and same-domain job openings signals', async () => {
  const neysa = await loadNeysaModule()

  assert.equal(neysa.SOURCE, 'neysa')
  assert.equal(neysa.COMPANY, 'Neysa')
  assert.equal(neysa.OFFICIAL_BRAND_NAME, 'Neysa')
  assert.equal(neysa.CAREERS_PAGE_URL, 'https://neysa.ai/careers/')
  assert.equal(neysa.JOB_OPENINGS_URL, 'https://neysa.ai/careers/job-openings/')
  assert.equal(neysa.COMPANY_DOMAIN, 'neysa.ai')
  assert.equal(neysa.VERIFIED_ON, '2026-08-07')
  assert.equal(neysa.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(neysa.hasOfficialJobOpeningsSignal(jobOpeningsHtml), true)
  assert.equal(neysa.hasOfficialJobOpeningsSignal(liveJobOpeningsHtml), true)
  assert.equal(
    neysa.extractOfficialJobOpeningsUrl(careersPageHtml),
    'https://neysa.ai/careers/job-openings/',
  )
})

test('Neysa extracts live job cards and enriches them from detail pages', async () => {
  const neysa = await loadNeysaModule()

  const listings = neysa.extractJobListings(jobOpeningsHtml)
  assert.equal(listings.length, 3)
  assert.deepEqual(
    listings.map((listing) => ({
      title: listing.title,
      department: listing.department,
      experienceRequired: listing.experienceRequired,
      location: listing.location,
      detailUrl: listing.detailUrl,
    })),
    [
      {
        title: 'Backend Engineer',
        department: 'Engineering',
        experienceRequired: '5-7 years',
        location: 'Mumbai, India',
        detailUrl: 'https://neysa.ai/careers/job-openings/backend-engineer/',
      },
      {
        title: 'Threat Detection Engineer - Cybersecurity',
        department: 'Engineering',
        experienceRequired: '3-5 years',
        location: 'Chennai, India',
        detailUrl: 'https://neysa.ai/careers/job-openings/threat-detection-engineer-cybersecurity/',
      },
      {
        title: 'Legal Counsel',
        department: 'Finance & Procurement',
        experienceRequired: '2-5 years',
        location: 'Mumbai, India',
        detailUrl: 'https://neysa.ai/careers/job-openings/legal-counsel/',
      },
    ],
  )

  const backendJob = neysa.extractJobDetail(backendDetailHtml, listings[0])
  assert.deepEqual(backendJob, {
    title: 'Backend Engineer',
    company: 'Neysa',
    department: 'Engineering',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'backend-engineer',
    requisitionId: 'backend-engineer',
    sourceUrl: 'https://neysa.ai/careers/job-openings/backend-engineer/',
    applyUrl: 'https://neysa.ai/careers/job-openings/backend-engineer/',
    employmentType: null,
    experienceRequired: '5-7 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-04',
    closingDate: null,
    jobDescription:
      'Position - Backend Engineer Experience: 5 to 7 years Primary Focus: Backend development, bug fixing, API/microservice development, production support Project: Overwatch, a NestJS/Nx monorepo with gRPC-based backend microservices Role Summary Build and support backend microservices for Neysa cloud products. Key Responsibilities Develop backend APIs and microservices. Support production systems and bug fixes.',
    remoteStatus: 'On-site',
  })
})

test('Neysa extracts the current department-title cards and query-string job ids from the live openings shape', async () => {
  const neysa = await loadNeysaModule()
  const listings = neysa.extractJobListings(liveJobOpeningsHtml)

  assert.equal(listings.length, 3)
  assert.deepEqual(
    listings.map((listing) => ({
      title: listing.title,
      department: listing.department,
      location: listing.location,
      jobId: listing.jobId,
      requisitionId: listing.requisitionId,
      detailUrl: listing.detailUrl,
    })),
    [
      {
        title: 'Legal Counsel',
        department: 'Finance',
        location: 'Mumbai, India',
        jobId: '51219',
        requisitionId: '51219',
        detailUrl: 'https://neysa.ai/careers/job-openings/?job_id=51219',
      },
      {
        title: 'Backend Engineer',
        department: 'Tech',
        location: 'Mumbai, India',
        jobId: '51964',
        requisitionId: '51964',
        detailUrl: 'https://neysa.ai/careers/job-openings/?job_id=51964',
      },
      {
        title: 'QA Lead - Cloud/AI/Infrastructure',
        department: 'Tech',
        location: 'Mumbai, India',
        jobId: '52093',
        requisitionId: '52093',
        detailUrl: 'https://neysa.ai/careers/job-openings/?job_id=52093',
      },
    ],
  )
})

test('Neysa extracts the current live detail shell with h1 title, Kula apply url, and labeled fields', async () => {
  const neysa = await loadNeysaModule()

  const job = neysa.extractJobDetail(liveBackendDetailHtml, {
    title: 'Backend Engineer',
    department: 'Tech',
    location: 'Mumbai, India',
    city: 'Mumbai',
    detailUrl: 'https://neysa.ai/careers/job-openings/?job_id=51964',
    sourceUrl: 'https://neysa.ai/careers/job-openings/?job_id=51964',
    applyUrl: 'https://neysa.ai/careers/job-openings/?job_id=51964',
    jobId: '51964',
    requisitionId: '51964',
  })

  assert.deepEqual(job, {
    title: 'Backend Engineer',
    company: 'Neysa',
    department: 'Tech',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '51964',
    requisitionId: '51964',
    sourceUrl: 'https://neysa.ai/careers/job-openings/?job_id=51964',
    applyUrl: 'https://careers.kula.ai/neysa/51964',
    employmentType: 'Full-time',
    experienceRequired: '5-7 years',
    minimumQualification: "Bachelor's Degree or Equivalent",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-05-22',
    closingDate: null,
    jobDescription:
      'Experience: 5 to 7 years Primary Focus: Backend development, bug fixing, API/microservice development, production support Project: Overwatch, a NestJS/Nx monorepo with gRPC-based backend microservices Role Summary: Build and support backend microservices for Neysa cloud products.',
    remoteStatus: 'On-site',
  })
})

test('Neysa run verifies the public careers surface before scraping and decorating jobs', async () => {
  const neysa = await loadNeysaModule()
  const requestedUrls = []

  const jobs = await neysa.createNeysaScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === neysa.CAREERS_PAGE_URL) return careersPageHtml
      if (url === neysa.JOB_OPENINGS_URL) return jobOpeningsHtml
      if (url === 'https://neysa.ai/careers/job-openings/backend-engineer/') return backendDetailHtml
      if (url === 'https://neysa.ai/careers/job-openings/threat-detection-engineer-cybersecurity/') {
        return backendDetailHtml.replace(/Backend Engineer/g, 'Threat Detection Engineer - Cybersecurity')
          .replace(/backend-engineer/g, 'threat-detection-engineer-cybersecurity')
          .replace(/5 to 7 years/g, '3 to 5 years')
          .replace(/2026-07-04/g, '2026-07-05')
      }
      if (url === 'https://neysa.ai/careers/job-openings/legal-counsel/') return legalDetailHtml
      throw new Error(`Unexpected Neysa fixture URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    neysa.CAREERS_PAGE_URL,
    neysa.JOB_OPENINGS_URL,
    'https://neysa.ai/careers/job-openings/backend-engineer/',
    'https://neysa.ai/careers/job-openings/threat-detection-engineer-cybersecurity/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'neysa')
  assert.equal(jobs[0].company, 'Neysa')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].companyCareerPage, undefined)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('Neysa fails closed when the verified job openings page drifts materially', async () => {
  const neysa = await loadNeysaModule()

  await assert.rejects(
    neysa.createNeysaScraper().run({
      fetchText: async (url) => {
        if (url === neysa.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body><h1>Unexpected</h1></body></html>'
      },
    }),
    /verified Neysa job openings page/i,
  )
})
