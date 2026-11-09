import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  CONTACT_URL,
  HOMEPAGE_URL,
  MISSING_ROUTE_URLS,
  SOURCE,
  createMachGlobalTechnologiesScraper,
  extractPublicJobs,
  hasOfficialCareersSignal,
  hasOfficialContactSignal,
  hasOfficialHomepageSignal,
  hasVerifiedCareersLink,
  isVerifiedMissingRoute,
} from './script.js'

const homepageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Mach Global Technologies</title>
    </head>
    <body>
      <nav class="navbar">
        <a href="index.php"><img src="./images/logo.png" alt="Logo" width="200px" /></a>
        <ul class="nav-links" id="nav-links">
          <li><a href="index.php" class="active">Home</a></li>
          <li><a href="about-us.php">About Us</a></li>
          <li><a href="careers.php">Careers</a></li>
          <li><a href="thought-leadership.php">Thought Leadership</a></li>
          <li><a href="contact-us.php">Contact Us</a></li>
        </ul>
      </nav>

      <section class="overview">
        <h2>A Future of Certified Excellence</h2>
        <p>Since 2023, Mach Global Technologies has specialized in delivering comprehensive certification and engineering services to the aviation industry.</p>
      </section>

      <section class="value-prop">
        <h2>Convergence of Safety, Engineering, and Innovation</h2>
        <p>Mach Global Technologies represents the convergence of safety, engineering, and innovation.</p>
        <p>Unlike short-lived consumer products, aerospace systems demand decades of reliability, zero tolerance for defects, and demonstrable compliance.</p>
      </section>

      <section class="why-mach">
        <h2>Why Choose Mach Global</h2>
        <h3>Global Reach Innovation Driven</h3>
        <p>Engineering hubs in India and Australia with seamless 24/7 collaboration.</p>
      </section>

      <footer class="footer">
        <h3>Mach Global Technologies</h3>
        <p>Trusted partner for aerospace and defense certification engineering.</p>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Careers - Mach Global Technologies</title>
    </head>
    <body>
      <nav class="navbar">
        <ul class="nav-links" id="nav-links">
          <li><a href="index.php">Home</a></li>
          <li><a href="about-us.php">About Us</a></li>
          <li><a href="careers.php" class="active">Careers</a></li>
          <li><a href="thought-leadership.php">Thought Leadership</a></li>
          <li><a href="contact-us.php">Contact Us</a></li>
        </ul>
      </nav>

      <section class="careers-hero">
        <div class="careers-hero-content">
          <h1>Build Your Career at Mach Global</h1>
          <p>Join a team where careers are built on innovation, safety, and global exposure. Work on systems that keep passengers safe, pilots empowered, and nations secure.</p>
        </div>
      </section>

      <section class="career-opportunities">
        <h2 class="section-title">Career Opportunities</h2>
        <p class="section-subtitle">We offer structured career paths across multiple disciplines. Whether you're starting your career or are an experienced professional, we have opportunities that challenge and inspire.</p>

        <div class="jobs-grid">
          <div class="job-card">
            <img src="./images/Embedded_debugging.jpg" alt="Avionics Software Engineer" />
            <div class="job-card-content">
              <h3>Avionics Software Engineer</h3>
              <span class="job-tag">Software Team</span>
              <p>Develop high-integrity embedded software for safety-critical aerospace applications. Work on real-time systems, RTOS integration, and DO-178C certified software.</p>
            </div>
          </div>

          <div class="job-card">
            <img src="./images/DO-178C-Certification.webp" alt="Certification Engineer" />
            <div class="job-card-content">
              <h3>Certification Engineer</h3>
              <span class="job-tag">Safety Team</span>
              <p>Lead certification activities for DO-178C, DO-254, and DO-160 standards. Interface with DERs and regulatory authorities to achieve audit-ready deliverables.</p>
            </div>
          </div>

          <div class="job-card">
            <img src="./images/HSIT_TESTING.jpg" alt="Hardware Engineer" />
            <div class="job-card-content">
              <h3>Hardware Engineer (FPGA/ASIC)</h3>
              <span class="job-tag">Hardware Team</span>
              <p>Design and develop DO-254 certified hardware for avionics systems. Work with VHDL, ASIC/FPGA design, and hardware-software integration.</p>
            </div>
          </div>

          <div class="job-card">
            <img src="./images/Avionics-Engineering-Services.webp" alt="Safety Engineer" />
            <div class="job-card-content">
              <h3>Safety Engineer</h3>
              <span class="job-tag">Safety Team</span>
              <p>Conduct safety analysis, risk assessment, and validation for avionics systems. Ensure designs meet safety objectives and certification requirements.</p>
            </div>
          </div>

          <div class="job-card">
            <img src="./images/Our_project_UH60X.jpg" alt="Test Automation Engineer" />
            <div class="job-card-content">
              <h3>Test Automation Engineer</h3>
              <span class="job-tag">QA Team</span>
              <p>Build automated test frameworks for HIL/SIL testing. Verify system requirements and ensure comprehensive test coverage.</p>
            </div>
          </div>

          <div class="job-card">
            <img src="./images/Digital_CockPit_helipcoter.jpg" alt="Systems Engineer" />
            <div class="job-card-content">
              <h3>Systems Engineer</h3>
              <span class="job-tag">Systems Team</span>
              <p>Define requirements, system architecture, and integration strategies. Ensure seamless operation of complex aerospace systems.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="join-banner">
        <h2>Ready to Shape the Future of Aerospace?</h2>
        <p>Join Mach Global and help build the systems that safely move people, missions, and ideas around the world.</p>
        <p>If interested in working with Mach send in resumes to <a href="mailto:info@machglobaltech.com">info@machglobaltech.com</a></p>
      </section>
    </body>
  </html>
`

const contactHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Contact Us - Mach Global Technologies</title>
    </head>
    <body>
      <section class="global-presence-page">
        <div class="card-content-page">
          <h3>India</h3>
          <span class="hub-type-page">Engineering &amp; Certification Hub</span>
          <p>Large ODC capacity, specialized labs, and certification infrastructure. Our primary engineering center delivering scale and certification-grade excellence.</p>
          <p>Engineering, Certification, and Development Center</p>
        </div>
        <div class="card-content-page">
          <h3>Australia</h3>
          <span class="hub-type-page">Client Interface &amp; Expansion Hub</span>
          <p>Business interface for Asia-Pacific and Europe, enabling cultural alignment and strategic expansion.</p>
        </div>
      </section>

      <footer class="footer">
        <ul>
          <li>info@machglobaltech.com</li>
          <li>www.machglobaltech.com</li>
          <li>India | Australia</li>
          <li>Soon in Europe</li>
        </ul>
      </footer>
    </body>
  </html>
`

test('Mach Global Technologies scraper recognizes the verified homepage, careers page, contact page, and missing-route surface', () => {
  assert.equal(SOURCE, 'machglobaltechnologies')
  assert.equal(COMPANY, 'Mach Global Technologies')
  assert.equal(HOMEPAGE_URL, 'https://www.machglobaltech.com/')
  assert.equal(CAREERS_URL, 'https://www.machglobaltech.com/careers.php')
  assert.equal(CONTACT_URL, 'https://www.machglobaltech.com/contact-us.php')
  assert.deepEqual(MISSING_ROUTE_URLS, [
    'https://www.machglobaltech.com/careers',
    'https://www.machglobaltech.com/career',
    'https://www.machglobaltech.com/jobs',
    'https://www.machglobaltech.com/join-us',
    'https://www.machglobaltech.com/current-openings',
    'https://www.machglobaltech.com/openings',
    'https://www.machglobaltech.com/work-with-us',
  ])

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialContactSignal(contactHtml), true)
  assert.equal(isVerifiedMissingRoute({ status: 404, html: '' }), true)
})

test('Mach Global Technologies scraper extracts the six verified public openings with shared email apply flow', () => {
  const jobs = extractPublicJobs(careersHtml)

  assert.equal(jobs.length, 6)

  assert.deepEqual(jobs[0], {
    title: 'Avionics Software Engineer',
    company: COMPANY,
    department: 'Software Team',
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'machglobaltechnologies-avionics-software-engineer',
    requisitionId: null,
    sourceUrl: CAREERS_URL,
    applyUrl: 'mailto:info@machglobaltech.com',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Develop high-integrity embedded software for safety-critical aerospace applications. Work on real-time systems, RTOS integration, and DO-178C certified software.',
    publicExperienceChecked: true,
    remoteStatus: null,
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.department]),
    [
      ['Avionics Software Engineer', 'Software Team'],
      ['Certification Engineer', 'Safety Team'],
      ['Hardware Engineer (FPGA/ASIC)', 'Hardware Team'],
      ['Safety Engineer', 'Safety Team'],
      ['Test Automation Engineer', 'QA Team'],
      ['Systems Engineer', 'Systems Team'],
    ],
  )

  assert.equal(jobs[1].applyUrl, 'mailto:info@machglobaltech.com')
  assert.match(jobs[1].jobDescription, /DO-178C, DO-254, and DO-160 standards/i)
  assert.match(jobs[2].jobDescription, /VHDL, ASIC\/FPGA design/i)
  assert.match(jobs[3].jobDescription, /risk assessment/i)
  assert.match(jobs[4].jobDescription, /HIL\/SIL testing/i)
  assert.match(jobs[5].jobDescription, /system architecture/i)
})

test('Mach Global Technologies scraper runs end to end and fails closed on drift', async () => {
  const requestedUrls = []
  const jobs = await createMachGlobalTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.equal(jobs.length, 6)
  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    CONTACT_URL,
    ...MISSING_ROUTE_URLS,
  ])
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].link, 'mailto:info@machglobaltech.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'machglobaltech.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].publicExperienceChecked, true)

  await assert.rejects(
    createMachGlobalTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    createMachGlobalTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace('<h3>Systems Engineer</h3>', '<h3>Principal Systems Engineer</h3>'),
          }
        }

        if (url === CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public openings changed materially|unexpected public opening/i,
  )
})
