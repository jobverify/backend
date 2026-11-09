import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  EXPECTED_PAGE_TITLE,
  KNOWN_ROLE_TITLES,
  createCarePlixScraper,
  extractPublicListingsFromBundle,
  extractPublicListings,
  hasOfficialCareersSurface,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>CarePlix | AI Health OS & Face Scan Vitals</title>
    </head>
    <body>
      <main>
        <section class="hero">
          <p>We're Hiring</p>
          <h1>Build the Future of Healthcare Intelligence</h1>
        </section>

        <section class="open-positions">
          <h2>Open Positions</h2>

          <article id="senior-ml-engineer" class="job-card">
            <h3>Senior ML Engineer</h3>
            <p>AI Research</p>
            <p>Bengaluru, India</p>
            <p>Full-time</p>
            <a href="/careers/senior-ml-engineer">Apply now</a>
          </article>

          <article id="product-designer" class="job-card">
            <h3>Product Designer</h3>
            <p>Design</p>
            <p>Remote, India</p>
            <a href="https://careplix.com/careers/product-designer">Apply now</a>
          </article>

          <article id="backend-engineer-go-python" class="job-card">
            <h3>Backend Engineer (Go/Python)</h3>
            <p>Platform Engineering</p>
            <p>Bengaluru, India</p>
            <a href="/careers/backend-engineer-go-python">Apply now</a>
          </article>

          <article id="clinical-validation-specialist" class="job-card">
            <h3>Clinical Validation Specialist</h3>
            <p>Clinical Operations</p>
            <p>Mumbai, India</p>
            <a href="/careers/clinical-validation-specialist">Apply now</a>
          </article>

          <article id="enterprise-sales-director" class="job-card">
            <h3>Enterprise Sales Director</h3>
            <p>Sales</p>
            <p>Gurugram, India</p>
            <a href="/careers/enterprise-sales-director">Apply now</a>
          </article>

          <article id="devops-engineer" class="job-card">
            <h3>DevOps Engineer</h3>
            <p>Infrastructure</p>
            <p>Hybrid - Bengaluru, India</p>
            <a href="/careers/devops-engineer">Apply now</a>
          </article>
        </section>
      </main>
    </body>
  </html>
`

const currentShellHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>CarePlix | AI Health OS & Face Scan Vitals</title>
      <script type="module" src="/assets/index-9CcugMK2.js"></script>
    </head>
    <body><div id="root"></div></body>
  </html>
`

const currentPublicJobsBundle = `
  const pages = {
    careers: { title: "Join Our Team", subtitle: "Express your interest in career opportunities" },
    resources: { title: "Download Resources" }
  };
  const i=[
    {title:"Senior ML Engineer",department:"AI & Research",location:"Remote / Kolkata",type:"Full-time",description:"Build and optimize physiological signal processing models for real-time vital extraction."},
    {title:"Product Designer",department:"Design",location:"Remote / Chicago",type:"Full-time",description:"Craft intuitive experiences for healthcare professionals and patients across our product suite."}
  ],o=[{emoji:"Science",title:"Science First",description:"Every claim we make is backed by rigorous validation."}];
`

test('validates the official CarePlix careers surface and extracts visible public roles', () => {
  assert.equal(CAREERS_URL, 'https://careplix.com/careers')
  assert.equal(EXPECTED_PAGE_TITLE, 'CarePlix | AI Health OS & Face Scan Vitals')
  assert.deepEqual(KNOWN_ROLE_TITLES, [
    'Senior ML Engineer',
    'Product Designer',
    'Backend Engineer (Go/Python)',
    'Clinical Validation Specialist',
    'Enterprise Sales Director',
    'DevOps Engineer',
  ])

  assert.equal(hasOfficialCareersSurface(careersHtml), true)

  const jobs = extractPublicListings(careersHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Senior ML Engineer',
    company: 'CarePlix',
    department: 'AI Research',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'senior-ml-engineer',
    requisitionId: 'senior-ml-engineer',
    sourceUrl: 'https://careplix.com/careers#senior-ml-engineer',
    applyUrl: 'https://careplix.com/careers/senior-ml-engineer',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs[1].title, 'Product Designer')
  assert.equal(jobs[1].location, 'Remote, India')
  assert.equal(jobs[2].applyUrl, 'https://careplix.com/careers/backend-engineer-go-python')
  assert.equal(jobs[3].department, 'Clinical Operations')
  assert.equal(jobs[4].city, 'Gurugram')
  assert.equal(jobs[5].location, 'Hybrid - Bengaluru, India')
})

test('run fetches the official CarePlix careers page and decorates scraped jobs', async () => {
  const requestedUrls = []
  const scraper = createCarePlixScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'careplix')
  assert.equal(jobs[0].link, 'https://careplix.com/careers/senior-ml-engineer')
  assert.equal(jobs[0].company, 'CarePlix')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('extractPublicListingsFromBundle parses the current CarePlix client-side role list', () => {
  const jobs = extractPublicListingsFromBundle(currentPublicJobsBundle)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior ML Engineer',
    company: 'CarePlix',
    department: 'AI & Research',
    location: 'Remote / Kolkata',
    city: 'Kolkata',
    country: 'India',
    jobId: 'senior-ml-engineer',
    requisitionId: 'senior-ml-engineer',
    sourceUrl: 'https://careplix.com/careers#senior-ml-engineer',
    applyUrl: 'mailto:careers@careplix.com?subject=Application%20for%20Senior%20ML%20Engineer',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build and optimize physiological signal processing models for real-time vital extraction.',
    publicExperienceChecked: true,
  })
  assert.equal(jobs[1].country, null)
  assert.equal(jobs[1].experienceRequired, null)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('run parses the current CarePlix careers shell from the verified client bundle', async () => {
  const requestedUrls = []
  const scraper = createCarePlixScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_URL) return currentShellHtml
      if (url === 'https://careplix.com/assets/index-9CcugMK2.js') return currentPublicJobsBundle

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    'https://careplix.com/assets/index-9CcugMK2.js',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'careplix')
  assert.equal(jobs[0].link, 'mailto:careers@careplix.com?subject=Application%20for%20Senior%20ML%20Engineer')
  assert.equal(jobs[0].experienceRequired, null)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})
