import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Visual Project Management Platform For Your Teams - NimbleWork</title>
  </head>
  <body>
    <main>
      <h1>The delivery intelligence layer for human + agentic teams</h1>
      <p>AI-first where it counts. Intelligent by design.</p>
      <p>Meet Nimble - The AI-powered Work management that adapts to you!</p>
    </main>
    <footer>
      <p><a href="/careers/">Careers</a></p>
      <p>&copy; 2026 NimbleWork, Inc. - All rights reserved.</p>
    </footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Careers And Growth Opportunities At NimbleWork</title>
    <meta
      name="description"
      content="Watch out for open positions on this page - we periodically announce openings for various functions here!"
    />
  </head>
  <body>
    <main>
      <h1 class="elementor-heading-title elementor-size-default">Careers at NimbleWork</h1>
      <p>
        We are a leader in the field of AI-driven Lean-Agile Software Delivery and Project Management products.
      </p>
      <p>
        Founded in 2002 by respected Silicon Valley-based Indo-American entrepreneurs, NimbleWork boasts of a strong
        and experienced leadership and a young and energetic team. NimbleWork has offices in USA and India, and
        customers worldwide! If you are interested in applying for a position at NimbleWork, send your resume to
        <a href="mailto:careers@nimblework.com">careers@nimblework.com</a>. If there's a match, we will get back to
        you! or Check out our open positions in the link given below.
      </p>
      <a class="elementor-button elementor-button-link" href="/careers/current-openings/">
        <span class="elementor-button-text">Learn More</span>
      </a>
    </main>
  </body>
</html>
`

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings At Nimblework</title>
  </head>
  <body>
    <nav aria-label="breadcrumbs" class="rank-math-breadcrumb">
      <p>
        <a href="https://www.digite.com">Home</a>
        <span class="separator"> &raquo; </span>
        <a href="https://www.nimblework.com/careers/">Careers</a>
        <span class="separator"> &raquo; </span>
        <span class="last">Current Openings</span>
      </p>
    </nav>

    <h1 class="elementor-heading-title elementor-size-default">Careers at NimbleWork</h1>
    <h2 class="elementor-heading-title elementor-size-default">Current Openings</h2>
    <p>Contact us at <a href="mailto:careers@nimblework.com">careers@nimblework.com</a></p>

    <div class="eael-adv-accordion">
      <div id="1-full-stack-developer" class="elementor-tab-title eael-accordion-header" data-tab="1">
        <span class="eael-accordion-tab-title">1. Full Stack Developer</span>
      </div>
      <div
        id="elementor-tab-content-7141"
        class="eael-accordion-content clearfix"
        data-tab="1"
        aria-labelledby="1-full-stack-developer"
      >
        <p><strong>Job Requirements:</strong></p>
        <ul>
          <li>Working with a diverse and distributed team of Product Developers, Product Owners, Data Scientists, Business Analysts, and Domain Experts</li>
          <li>The ability to effectively participate in remote teams with individuals from a wide variety of backgrounds, both technical and non-technical, is required.</li>
          <li>Developing cloud native and microservices architecture-based products.</li>
        </ul>
        <p><strong>Required Skills:</strong></p>
        <ul>
          <li>Programming JavaScript (ES5 / ES6 versions), HTML5, and CSS(SASS/LESS)</li>
          <li>Knowledge of responsive web programming using ReactJS and Material design</li>
          <li>Server-side programming in one of Java with Spring Boot or NodeJS with Moleculer and ExpressJS</li>
        </ul>
        <p><strong>Requisites:</strong></p>
        <ul>
          <li>BE/B.Tech/ M.E/M.Tech/MCA from a reputed university</li>
          <li>0 to 3 years of experience.</li>
        </ul>
      </div>

      <div id="2-product-manager" class="elementor-tab-title eael-accordion-header" data-tab="2">
        <span class="eael-accordion-tab-title">2. Product Manager</span>
      </div>
      <div
        id="elementor-tab-content-7142"
        class="eael-accordion-content clearfix"
        data-tab="2"
        aria-labelledby="2-product-manager"
      >
        <p><strong>Product Manager responsibilities include:</strong></p>
        <p>
          We are looking for a Product Manager to lead the development of our Lean Agile, Kanban, and Project /
          Portfolio management tools.
        </p>
        <p><strong>Requirements:</strong></p>
        <ul>
          <li>Work experience as a Product Manager or similar role in product management</li>
          <li>Hands-on experience managing all stages of the product life cycle</li>
          <li>Technical background with knowledge of software development and web technologies</li>
        </ul>
        <p><strong>Experience:</strong> 8 - 12 yrs.</p>
        <p>
          <strong>Education Qualification:</strong> MBA from a reputed institute with excellent academic record. A
          technical background helps!
        </p>
      </div>

      <div id="3-senior-test-engineer" class="elementor-tab-title eael-accordion-header" data-tab="3">
        <span class="eael-accordion-tab-title">3. Senior Test Engineer</span>
      </div>
      <div
        id="elementor-tab-content-7143"
        class="eael-accordion-content clearfix"
        data-tab="3"
        aria-labelledby="3-senior-test-engineer"
      >
        <p><strong>We are looking for following qualities in you:</strong></p>
        <ul>
          <li>You should have worked in Test Automation, Test Environment &amp; Test Data Management as part of continuous testing platform.</li>
          <li>You should have the passion to find defects in the software under test and build the career as full stack developer in testing domain.</li>
        </ul>
        <p><strong>Technical/Tools Skill Requirement:</strong></p>
        <ul>
          <li>Programming Skills: Java, C/C++, Python, Ruby, javascript</li>
          <li>Automation Tools: SAHI, Selenium, JMeter, Web driver, Jasmine, Cucumber, MABL, Karate</li>
          <li>Sound knowledge of API Testing and Service virtualization tools: wiremock, mountebank</li>
        </ul>
        <p><strong>Experience:</strong> 3+ years</p>
        <p><strong>Education Qualification:</strong> B.E/B.Tech/MCA/M.Tech from a reputed institute with excellent academic record</p>
      </div>

      <div id="5-sr-full-stack-developer" class="elementor-tab-title eael-accordion-header" data-tab="4">
        <span class="eael-accordion-tab-title">5. Sr. Full Stack Developer</span>
      </div>
      <div
        id="elementor-tab-content-7144"
        class="eael-accordion-content clearfix"
        data-tab="4"
        aria-labelledby="5-sr-full-stack-developer"
      >
        <p><strong>Job Requirements:</strong></p>
        <ul>
          <li>Developing cloud native and microservices architecture based products and learning skills to plan and design solutions.</li>
          <li>Planning and designing solutions end to end including database schema and solution architecture.</li>
        </ul>
        <p><strong>Key Skills</strong>: Microservices, Cloud Native Development, serverless, REST API, event sourcing, web development, mobile development, reactive programming, JavaScript, HTML, CSS, SQL, database</p>
        <p><strong>Required Skills:</strong></p>
        <ul>
          <li>Test Driven Development and the ability to apply SOLID and Clean code principles in day to day work</li>
          <li>Programming JavaScript (ES6 version), HTML, and CSS(SASS/LESS)</li>
          <li>Server-side programming in at-least two of Scala, Python, Java, NodeJS</li>
        </ul>
        <p><strong>Requisites:</strong></p>
        <ul>
          <li>BE/B.Tech/ M.E/M.Tech/MCA from a reputed university</li>
          <li>3+ years of experience</li>
        </ul>
      </div>

      <div id="6-principal-software-engineer" class="elementor-tab-title eael-accordion-header" data-tab="5">
        <span class="eael-accordion-tab-title">6. Principal Software Engineer</span>
      </div>
      <div
        id="elementor-tab-content-7145"
        class="eael-accordion-content clearfix"
        data-tab="5"
        aria-labelledby="6-principal-software-engineer"
      >
        <p><strong>Job Requirements:</strong></p>
        <p>
          A principal software engineer at Digite is at the helm of both innovation and technology leadership and is
          one of the key persons responsible for developing cutting edge solutions to contribute in overall growth of
          the product family.
        </p>
        <p><strong>Must-Have:</strong></p>
        <ul>
          <li>At least 10 years of experience in Software Development</li>
          <li>Hands-on experience with cloud infrastructure, solution architecture on AWS or Azure</li>
          <li>Avid practitioner and coach of Test-Driven Development</li>
        </ul>
        <p><strong>Good To Have:</strong></p>
        <ul>
          <li>Hands-on experience with Continuous Delivery and DevOps automation</li>
          <li>SRE and Observability implementation experience</li>
        </ul>
        <p><strong>How To Apply:</strong></p>
        <p>Please share GitHub, one of LeetCode, Hackerank, CodeSignal profiles as part of your application</p>
        <p>Send in your profile to <a href="mailto:careers@nimblework.com">careers@nimblework.com</a></p>
      </div>
    </div>
  </body>
</html>
`

const challengeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <main>
      <h1>Just a moment...</h1>
      <p>Enable JavaScript and cookies to continue</p>
    </main>
  </body>
</html>
`

test('NimbleWork validates the verified official homepage, careers handoff, and current openings surfaces', async () => {
  const nimble = await loadModule()
  assert.ok(nimble)

  assert.equal(nimble.SOURCE, 'nimblework')
  assert.equal(nimble.COMPANY, 'Nimble Work, Inc')
  assert.equal(nimble.HOMEPAGE_URL, 'https://www.nimblework.com/')
  assert.equal(nimble.CAREERS_URL, 'https://www.nimblework.com/careers/')
  assert.equal(nimble.CURRENT_OPENINGS_URL, 'https://www.nimblework.com/careers/current-openings/')
  assert.equal(nimble.COMPANY_DOMAIN, 'nimblework.com')

  assert.equal(nimble.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nimble.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(nimble.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)

  const jobs = nimble.extractPublicJobs(currentOpeningsHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Full Stack Developer',
      'Product Manager',
      'Senior Test Engineer',
      'Sr. Full Stack Developer',
      'Principal Software Engineer',
    ],
  )

  assert.deepEqual(jobs[0], {
    title: 'Full Stack Developer',
    company: 'Nimble Work, Inc',
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'nimblework-full-stack-developer',
    requisitionId: '1-full-stack-developer',
    sourceUrl: 'https://www.nimblework.com/careers/current-openings/#1-full-stack-developer',
    applyUrl: 'https://www.nimblework.com/careers/current-openings/#1-full-stack-developer',
    department: null,
    employmentType: 'Full-time',
    experienceRequired: '0 to 3 years',
    minimumQualification: 'BE/B.Tech/ M.E/M.Tech/MCA from a reputed university',
    preferredQualification: null,
    requiredSkills: [
      'Programming JavaScript (ES5 / ES6 versions), HTML5, and CSS(SASS/LESS)',
      'Knowledge of responsive web programming using ReactJS and Material design',
      'Server-side programming in one of Java with Spring Boot or NodeJS with Moleculer and ExpressJS',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply via careers@nimblework.com. Working with a diverse and distributed team of Product Developers, Product Owners, Data Scientists, Business Analysts, and Domain Experts The ability to effectively participate in remote teams with individuals from a wide variety of backgrounds, both technical and non-technical, is required. Developing cloud native and microservices architecture-based products.',
    remoteStatus: null,
  })

  assert.equal(jobs[1].minimumQualification, 'MBA from a reputed institute with excellent academic record. A technical background helps!')
  assert.equal(jobs[1].experienceRequired, '8 - 12 yrs')
  assert.match(jobs[1].jobDescription, /lean agile, kanban, and project/i)

  assert.equal(jobs[2].minimumQualification, 'B.E/B.Tech/MCA/M.Tech from a reputed institute with excellent academic record')
  assert.equal(jobs[2].experienceRequired, '3+ years')
  assert.deepEqual(jobs[2].requiredSkills, [
    'Programming Skills: Java, C/C++, Python, Ruby, javascript',
    'Automation Tools: SAHI, Selenium, JMeter, Web driver, Jasmine, Cucumber, MABL, Karate',
    'Sound knowledge of API Testing and Service virtualization tools: wiremock, mountebank',
  ])

  assert.equal(jobs[3].requisitionId, '5-sr-full-stack-developer')
  assert.equal(jobs[3].experienceRequired, '3+ years')
  assert.equal(jobs[3].minimumQualification, 'BE/B.Tech/ M.E/M.Tech/MCA from a reputed university')
  assert.match(jobs[3].jobDescription, /microservices, cloud native development, serverless/i)

  assert.equal(jobs[4].requisitionId, '6-principal-software-engineer')
  assert.equal(jobs[4].experienceRequired, 'At least 10 years of experience')
  assert.equal(jobs[4].minimumQualification, null)
  assert.deepEqual(jobs[4].requiredSkills, [
    'At least 10 years of experience in Software Development',
    'Hands-on experience with cloud infrastructure, solution architecture on AWS or Azure',
    'Avid practitioner and coach of Test-Driven Development',
  ])
  assert.match(jobs[4].jobDescription, /Apply via careers@nimblework\.com/i)
})

test('NimbleWork run fetches the verified first-party pages in sequence and normalizes jobs', async () => {
  const nimble = await loadModule()
  assert.ok(nimble)

  const requestedUrls = []
  const jobs = await nimble.createNimbleWorkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nimble.HOMEPAGE_URL) return homepageHtml
      if (url === nimble.CAREERS_URL) return careersHtml
      if (url === nimble.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    nimble.HOMEPAGE_URL,
    nimble.CAREERS_URL,
    nimble.CURRENT_OPENINGS_URL,
  ])

  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].source, 'nimblework')
  assert.equal(jobs[0].company, 'Nimble Work, Inc')
  assert.equal(jobs[0].companyCareerPage, 'https://www.nimblework.com/careers/current-openings/')
  assert.equal(jobs[0].companyDomain, 'nimblework.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].normalizedTitle, 'Software Engineer')
  assert.equal(jobs[0].engineeringDomain, 'Software Engineering')
  assert.equal(jobs[0].jobType, 'Full-time Fresher')
  assert.equal(jobs[0].sourceUrl, 'https://www.nimblework.com/careers/current-openings/#1-full-stack-developer')
  assert.equal(jobs[0].link, 'https://www.nimblework.com/careers/current-openings/#1-full-stack-developer')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')

  assert.equal(jobs[1].jobType, 'Full-time Experienced')
  assert.equal(jobs[1].experienceLevel, 'Senior Level')
  assert.equal(jobs[1].country, 'India')

  assert.equal(jobs[2].experienceLevel, 'Senior Level')
  assert.equal(jobs[2].jobCategory, 'Verification Engineer')

  assert.equal(jobs[4].jobType, 'Full-time Experienced')
  assert.match(jobs[4].jobDescription, /Apply via careers@nimblework\.com/i)
})

test('NimbleWork fails closed when the verified homepage, careers, or current openings surface drifts', async () => {
  const nimble = await loadModule()
  assert.ok(nimble)

  await assert.rejects(
    nimble.createNimbleWorkScraper().run({
      fetchText: async (url) => {
        if (url === nimble.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No careers link</body></html>'
        }
        if (url === nimble.CAREERS_URL) return careersHtml
        return currentOpeningsHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nimble.createNimbleWorkScraper().run({
      fetchText: async (url) => {
        if (url === nimble.HOMEPAGE_URL) return homepageHtml
        if (url === nimble.CAREERS_URL) {
          return careersHtml.replace('/careers/current-openings/', '/careers/join-us/')
        }
        return currentOpeningsHtml
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    nimble.createNimbleWorkScraper().run({
      fetchText: async (url) => {
        if (url === nimble.HOMEPAGE_URL) return homepageHtml
        if (url === nimble.CAREERS_URL) return careersHtml
        return currentOpeningsHtml.replace(/eael-accordion-tab-title/g, 'career-card-title')
      },
    }),
    /verified first-party current openings page/i,
  )
})

test('NimbleWork returns [] when homepage, careers, and current openings all match the verified Cloudflare challenge shell', async () => {
  const nimble = await loadModule()
  assert.ok(nimble)

  const requestedUrls = []
  const jobs = await nimble.createNimbleWorkScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        html: challengeHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    nimble.HOMEPAGE_URL,
    nimble.CAREERS_URL,
    nimble.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(jobs, [])
})
