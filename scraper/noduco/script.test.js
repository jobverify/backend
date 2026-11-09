import assert from 'node:assert/strict'
import test from 'node:test'

const loadNoducoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const FIXED_NOW = '2026-07-11T12:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Noduco Software Engineering Company | Custom Software &amp; AI Solutions</title>
    <meta name="description" content="Noduco is a software engineering company specializing in enterprise software development.">
    <link rel="canonical" href="https://noduco.com/">
  </head>
  <body>
    <header>
      <nav>
        <a href="/">HOME</a>
        <a href="/what-we-do/">WHAT WE DO</a>
        <a href="/careers/">JOIN US</a>
      </nav>
    </header>
    <main>
      <span>SOFTWARE ENGINEERING FOR THE ENTERPRISE</span>
      <p>Noduco is a software engineering company. We bridge the gap between abstract innovation and industrial-scale execution.</p>
      <p>Precision digital engineering for organizations that define their industry.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Engineering Careers &amp; Open Roles | Noduco | Noduco</title>
    <meta name="description" content="Join a culture of engineering excellence and human partnership.">
    <link rel="canonical" href="https://noduco.com/careers/">
  </head>
  <body>
    <main>
      <section class="careers-hero">
        <h1>Build What Matters</h1>
      </section>
      <section class="section">
        <span>VACANCIES</span>
        <h2>Open Roles</h2>
        <div class="job-list-container">
          <div class="reveal job-card" style="transition-delay:0ms">
            <div class="job-card-meta">
              <div class="flex items-center gap-3 mb-2">
                <span class="type-label-sm job-dept-chip">Engineering</span>
                <span class="type-label-sm job-type-text">Full-Time</span>
              </div>
              <h3 class="type-title-lg job-title">Senior Java / Spring Boot Developer (Microservices)</h3>
              <div class="flex flex-wrap items-center gap-2 mb-4 md:mb-0">
                <p class="type-body-sm job-experience-text">Experience: <span class="job-experience-highlight">5+ Years</span></p>
                <span class="type-label-sm job-tag">Java 8</span>
                <span class="type-label-sm job-tag">Spring Boot</span>
                <span class="type-label-sm job-tag">Microservices</span>
                <span class="type-label-sm job-tag">+<!-- -->5</span>
              </div>
            </div>
            <a class="btn-primary" href="/careers/1/">View Job</a>
          </div>
          <div class="reveal job-card" style="transition-delay:100ms">
            <div class="job-card-meta">
              <div class="flex items-center gap-3 mb-2">
                <span class="type-label-sm job-dept-chip">Engineering</span>
                <span class="type-label-sm job-type-text">Full-Time</span>
              </div>
              <h3 class="type-title-lg job-title">Full Stack Developer II (Vue.js, Node.js, AWS)</h3>
              <div class="flex flex-wrap items-center gap-2 mb-4 md:mb-0">
                <p class="type-body-sm job-experience-text">Experience: <span class="job-experience-highlight">5+ Years</span></p>
                <span class="type-label-sm job-tag">Vue.js</span>
                <span class="type-label-sm job-tag">Node.js</span>
                <span class="type-label-sm job-tag">TypeScript</span>
                <span class="type-label-sm job-tag">AWS</span>
                <span class="type-label-sm job-tag">+<!-- -->3</span>
              </div>
            </div>
            <a class="btn-primary" href="/careers/10/">View Job</a>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
`

const detailHtml1 = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Java / Spring Boot Developer (Microservices) - Careers at Noduco | Noduco</title>
    <meta name="description" content="Be an integral part of the development, design, and integration of software systems.">
  </head>
  <body>
    <main>
      <div class="job-detail-page">
        <section class="job-detail-hero">
          <div class="container">
            <a class="job-back-link mb-8" href="/careers/">← Back to Open Roles</a>
            <h1 class="job-title-display reveal">Senior Java / Spring Boot Developer (Microservices)</h1>
            <div class="job-meta-item"><span class="job-sidebar-label">Department</span><span class="job-sidebar-value">Engineering</span></div>
            <div class="job-meta-item"><span class="job-sidebar-label">Experience</span><span class="job-sidebar-value">5+ Years</span></div>
            <div class="job-meta-item"><span class="job-sidebar-label">Type</span><span class="job-sidebar-value">Full-Time</span></div>
            <a class="btn-primary" href="/cdn-cgi/l/email-protection#127a60527c7d7667717d3c717d7f">Apply Now</a>
          </div>
        </section>
        <section class="section">
          <p class="job-section-text">Be an integral part of the development, design, and integration of software systems from definition to implementation, identifying deficiencies and delivering robust microservices and cloud solutions.</p>
          <div>
            <h3 class="job-section-title">What You Will Do</h3>
            <ul class="job-section-list">
              <li>Be an integral part of the development, design, and integration of software systems from the definition phase to implementation.</li>
              <li>Identify system deficiencies and develop effective solutions.</li>
            </ul>
          </div>
          <div>
            <h3 class="job-section-title">Requirements</h3>
            <ul class="job-section-list">
              <li>5+ years of IT industry experience.</li>
              <li>Strong expertise in Java (Java 8) and Spring Framework.</li>
            </ul>
          </div>
          <div>
            <h3 class="job-section-title">Nice to Have</h3>
            <ul class="job-section-list">
              <li>Bachelor's or Master's degree in CS, engineering, or related field/experience.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
    <script>self.__next_f.push([1,"8:[\\"$\\",\\"$L16\\",null,{\\"job\\":{\\"id\\":1,\\"contactEmail\\":\\"hr@noduco.com\\"}}]"])</script>
  </body>
</html>
`

const detailHtml10 = `
<!doctype html>
<html lang="en">
  <head>
    <title>Full Stack Developer II (Vue.js, Node.js, AWS) - Careers at Noduco | Noduco</title>
    <meta name="description" content="Work on end-to-end full-stack projects in a role aligned with your skills and career goals.">
  </head>
  <body>
    <main>
      <div class="job-detail-page">
        <section class="job-detail-hero">
          <div class="container">
            <a class="job-back-link mb-8" href="/careers/">← Back to Open Roles</a>
            <h1 class="job-title-display reveal">Full Stack Developer II (Vue.js, Node.js, AWS)</h1>
            <div class="job-meta-item"><span class="job-sidebar-label">Department</span><span class="job-sidebar-value">Engineering</span></div>
            <div class="job-meta-item"><span class="job-sidebar-label">Experience</span><span class="job-sidebar-value">5+ Years</span></div>
            <div class="job-meta-item"><span class="job-sidebar-label">Type</span><span class="job-sidebar-value">Full-Time</span></div>
            <a class="btn-primary" href="/cdn-cgi/l/email-protection#127a60527c7d7667717d3c717d7f">Apply Now</a>
          </div>
        </section>
        <section class="section">
          <p class="job-section-text">Work on end-to-end full-stack projects in a role aligned with your skills and career goals, designing and implementing projects that support large scales of data and traffic.</p>
          <div>
            <h3 class="job-section-title">What You Will Do</h3>
            <ul class="job-section-list">
              <li>Work on end-to-end projects in a full-stack role, aligned with your skills and career goals.</li>
              <li>Design and implement new projects while supporting large scales of data and traffic.</li>
            </ul>
          </div>
          <div>
            <h3 class="job-section-title">Requirements</h3>
            <ul class="job-section-list">
              <li>Minimum of 3 years of experience in full-stack development using JavaScript, TypeScript, and Java.</li>
              <li>Strong experience with modern web frameworks, particularly Vue.js.</li>
            </ul>
          </div>
          <div>
            <h3 class="job-section-title">What You Will Bring</h3>
            <ul class="job-section-list">
              <li>Experience with back-end technologies.</li>
              <li>Excellent communication skills.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
    <script>self.__next_f.push([1,"8:[\\"$\\",\\"$L16\\",null,{\\"job\\":{\\"id\\":10,\\"contactEmail\\":\\"hr@noduco.com\\"}}]"])</script>
  </body>
</html>
`

test('Noduco scraper recognizes the verified homepage and careers cards', async () => {
  const noduco = await loadNoducoModule()
  assert.ok(noduco, 'Expected Noduco scraper module at ./script.js')

  const {
    SOURCE,
    COMPANY,
    HOMEPAGE_URL,
    CAREERS_URL,
    decodeCloudflareEmail,
    extractCareerJobCards,
    extractJobDetail,
    hasOfficialCareersSignal,
    hasOfficialHomepageSignal,
  } = noduco

  assert.equal(SOURCE, 'noduco')
  assert.equal(COMPANY, 'Noduco')
  assert.equal(HOMEPAGE_URL, 'https://noduco.com/')
  assert.equal(CAREERS_URL, 'https://noduco.com/careers/')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    decodeCloudflareEmail('127a60527c7d7667717d3c717d7f'),
    'hr@noduco.com',
  )

  assert.deepEqual(extractCareerJobCards(careersHtml), [
    {
      jobId: 'noduco-1',
      requisitionId: '1',
      title: 'Senior Java / Spring Boot Developer (Microservices)',
      company: 'Noduco',
      department: 'Engineering',
      location: null,
      city: null,
      // A listing card has no role-owned country; detail JobPosting may bind it.
      country: null,
      sourceUrl: 'https://noduco.com/careers/1/',
      applyUrl: null,
      employmentType: 'Full-Time',
      experienceRequired: '5+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Java 8', 'Spring Boot', 'Microservices'],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      jobId: 'noduco-10',
      requisitionId: '10',
      title: 'Full Stack Developer II (Vue.js, Node.js, AWS)',
      company: 'Noduco',
      department: 'Engineering',
      location: null,
      city: null,
      country: null,
      sourceUrl: 'https://noduco.com/careers/10/',
      applyUrl: null,
      employmentType: 'Full-Time',
      experienceRequired: '5+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Vue.js', 'Node.js', 'TypeScript', 'AWS'],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])

  const detail = extractJobDetail(detailHtml1, {
    jobId: 'noduco-1',
    requisitionId: '1',
    title: 'Senior Java / Spring Boot Developer (Microservices)',
    department: 'Engineering',
    employmentType: 'Full-Time',
    experienceRequired: '5+ Years',
    requiredSkills: ['Java 8', 'Spring Boot', 'Microservices'],
    sourceUrl: 'https://noduco.com/careers/1/',
  })

  assert.equal(detail.applyUrl, 'mailto:hr@noduco.com')
  assert.equal(detail.minimumQualification, null)
  assert.equal(
    detail.preferredQualification,
    "Bachelor's or Master's degree in CS, engineering, or related field/experience.",
  )
  assert.match(detail.jobDescription, /WHAT YOU WILL DO:/)
  assert.match(detail.jobDescription, /REQUIREMENTS:/)
})

test('Noduco run fetches the official homepage, careers page, and same-domain detail pages', async () => {
  const noduco = await loadNoducoModule()
  assert.ok(noduco, 'Expected Noduco scraper module at ./script.js')

  const requests = []
  const jobs = await noduco.createNoducoScraper({
    now: () => FIXED_NOW,
  }).run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === noduco.HOMEPAGE_URL) return homepageHtml
      if (url === noduco.CAREERS_URL) return careersHtml
      if (url === 'https://noduco.com/careers/1/') return detailHtml1
      if (url === 'https://noduco.com/careers/10/') return detailHtml10

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://noduco.com/',
    'https://noduco.com/careers/',
    'https://noduco.com/careers/1/',
    'https://noduco.com/careers/10/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.link,
      source: job.source,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Senior Java / Spring Boot Developer (Microservices)',
        jobId: 'noduco-1',
        sourceUrl: 'https://noduco.com/careers/1/',
        applyUrl: 'mailto:hr@noduco.com',
        link: 'https://noduco.com/careers/1/',
        source: 'noduco',
        companyCareerPage: 'https://noduco.com/careers/',
        companyDomain: 'noduco.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: FIXED_NOW,
      },
      {
        title: 'Full Stack Developer II (Vue.js, Node.js, AWS)',
        jobId: 'noduco-10',
        sourceUrl: 'https://noduco.com/careers/10/',
        applyUrl: 'mailto:hr@noduco.com',
        link: 'https://noduco.com/careers/10/',
        source: 'noduco',
        companyCareerPage: 'https://noduco.com/careers/',
        companyDomain: 'noduco.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: FIXED_NOW,
      },
    ],
  )
})

test('Noduco fails closed when the verified homepage, careers shell, or apply contact drifts', async () => {
  const noduco = await loadNoducoModule()
  assert.ok(noduco, 'Expected Noduco scraper module at ./script.js')

  await assert.rejects(
    noduco.createNoducoScraper().run({
      fetchText: async (url) => {
        if (url === noduco.HOMEPAGE_URL) {
          return '<html><head><title>Home</title></head><body><h1>Welcome</h1></body></html>'
        }

        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    noduco.createNoducoScraper().run({
      fetchText: async (url) => {
        if (url === noduco.HOMEPAGE_URL) return homepageHtml
        if (url === noduco.CAREERS_URL) {
          return `
            <html>
              <head><title>Join Us, Careers in Software Engineering | Noduco | Noduco</title></head>
              <body><main><h2>Open Roles</h2><p>No cards here anymore.</p></main></body>
            </html>
          `
        }

        return detailHtml1
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    noduco.createNoducoScraper().run({
      fetchText: async (url) => {
        if (url === noduco.HOMEPAGE_URL) return homepageHtml
        if (url === noduco.CAREERS_URL) return careersHtml
        return detailHtml1.replace(/\/cdn-cgi\/l\/email-protection#[0-9a-f]+/i, '/contact/')
      },
    }),
    /apply email/i,
  )
})
