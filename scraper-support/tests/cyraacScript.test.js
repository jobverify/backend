import assert from 'node:assert/strict'
import test from 'node:test'

const loadCyraacModule = async () => import('../../scraper/cyraac/script.js')

const careersHtml = `
  <section class="careers">
    <h2>Product and Technology</h2>
    <article class="job-card">
      <h3>Full Stack Developer</h3>
      <p>As a Full Stack Developer at CyRAACS, you will build our GRC platform.</p>
      <a href="/full-stack-developer/">VIEW JOB DETAIL</a>
    </article>
    <h2>Consultants</h2>
    <article class="job-card">
      <h3>Sr. VAPT Consultant</h3>
      <p>Experience: 2-5 years Location: Bengaluru</p>
      <a href="/job-description/sr-vapt-consultant/">VIEW JOB DETAIL</a>
    </article>
  </section>
`

test('extractJobCards maps native CyRAACS cards without inventing geography or requisitions', async () => {
  const cyraac = await loadCyraacModule()

  const cards=cyraac.extractJobCards(careersHtml)
  assert.equal(cards[1].sourceNativeListingRecord.locationLabel,'Bengaluru')
  assert.deepEqual(cards.map(({sourceNativeListingRecord,...card})=>card), [
    {
      title: 'Full Stack Developer',
      department: 'Product and Technology',
      jobDescription: 'As a Full Stack Developer at CyRAACS, you will build our GRC platform.',
      experienceRequired: null,
      location: null,
      city: null,
      sourceUrl: 'https://cyraacs.com/full-stack-developer/',
      applyUrl: null,
      jobId: 'full-stack-developer',
      requisitionId: null,
    },
    {
      title: 'Sr. VAPT Consultant',
      department: 'Consultants',
      jobDescription: null,
      experienceRequired: '2-5 years',
      location: null,
      city: null,
      sourceUrl: 'https://cyraacs.com/job-description/sr-vapt-consultant/',
      applyUrl: null,
      jobId: 'sr-vapt-consultant',
      requisitionId: null,
    },
  ])
})

test('extractJobCards recognizes the nested Elementor job-detail buttons used on the live CyRAACS careers page', async () => {
  const cyraac = await loadCyraacModule()
  const liveMarkupShape = `
    <h2>Product and Technology</h2>
    <h3 class="elementor-heading-title">Technology Head</h3>
    <p>Lead the vision, architecture, and execution of an AI-driven cybersecurity platform.</p>
    <a class="elementor-button-link elementor-size-sm" href="https://cyraacs.com/technology-head/">
      <span class="elementor-button-content-wrapper">
        <span class="elementor-button-text">VIEW JOB DETAIL</span>
      </span>
    </a>
  `

  assert.equal(cyraac.extractJobCards(liveMarkupShape).length, 1)
  assert.equal(cyraac.extractJobCards(liveMarkupShape)[0].title, 'Technology Head')
})

test('extractJobCards supports the Technical Architect heading level and excludes careers-page anchors', async () => {
  const cyraac = await loadCyraacModule()
  const liveMarkupShape = `
    <h2>Product and Technology</h2>
    <h4 class="elementor-heading-title">Technical Architect</h4>
    <p>Experience: 8 - 14 Years Location: Bengaluru</p>
    <a href="https://cyraacs.com/job-description-technical-architect/">
      <span>VIEW JOB DETAIL</span>
    </a>
    <h3>Consulting Services</h3>
    <a href="https://cyraacs.com/careers/#risk_assessment"><span>VIEW JOB DETAIL</span></a>
  `

  const jobs = cyraac.extractJobCards(liveMarkupShape)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Technical Architect')
  assert.equal(jobs[0].jobId, 'job-description-technical-architect')
})

test('extractJobCards reads a CyRAACS heading whose title is wrapped in an Elementor span', async () => {
  const cyraac = await loadCyraacModule()
  const liveMarkupShape = `
    <h2>Product and Technology</h2>
    <h3 class="elementor-icon-box-title"><span>Technical Architect</span></h3>
    <p>Experience: 8 - 14 Years Location: Bengaluru</p>
    <a href="https://cyraacs.com/job-description-technical-architect/"><span>VIEW JOB DETAIL</span></a>
  `

  assert.equal(cyraac.extractJobCards(liveMarkupShape)[0].title, 'Technical Architect')
})

test('extractJobCards uses the nearest heading before a job-detail button', async () => {
  const cyraac = await loadCyraacModule()
  const nestedMarkupShape = `
    <h2>Product and Technology</h2>
    <h3>Consulting Services</h3>
    <div><h3><span>Technical Architect</span></h3></div>
    <p>Experience: 8 - 14 Years Location: Bengaluru</p>
    <a href="https://cyraacs.com/job-description-technical-architect/"><span>VIEW JOB DETAIL</span></a>
  `

  assert.equal(cyraac.extractJobCards(nestedMarkupShape)[0].title, 'Technical Architect')
})

test('extractJobCards does not let a preceding non-job anchor consume the first job button', async () => {
  const cyraac = await loadCyraacModule()
  const liveMarkupShape = `
    <a href="https://cyraacs.com/careers/#risk_assessment">Risk Assessment</a>
    <h2>Product and Technology</h2>
    <h3>Technical Architect</h3>
    <a href="https://cyraacs.com/job-description-technical-architect/"><span>VIEW JOB DETAIL</span></a>
  `

  const jobs = cyraac.extractJobCards(liveMarkupShape)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Technical Architect')
})

test('run decorates CyRAACS jobs using official detail pages', async () => {
  const cyraac = await loadCyraacModule()
  const requestedUrls = []
  const jobs = await cyraac.createCyraacScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cyraac.CAREERS_PAGE_URL) return careersHtml
      const title=url.includes('/sr-vapt-consultant/')?'Sr. VAPT Consultant':'Full Stack Developer'
      return '<h1>'+title+'</h1><p>Role Overview: Build resilient GRC software.</p>'
    },
  })

  assert.deepEqual(requestedUrls, [
    cyraac.CAREERS_PAGE_URL,
    'https://cyraacs.com/full-stack-developer/',
    'https://cyraacs.com/job-description/sr-vapt-consultant/',
    'https://cyraacs.com/full-stack-developer/',
    'https://cyraacs.com/job-description/sr-vapt-consultant/',
    cyraac.CAREERS_PAGE_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'CYRAAC Services Private Limited')
  assert.equal(jobs[0].source, 'cyraac')
  assert.equal(jobs[0].country,null)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.match(jobs[0].jobDescription, /Build resilient GRC software/i)
})
