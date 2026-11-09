import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createEmtensorScraper,
  extractJobDetail,
  extractListings,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <p>The following job positions are available:</p>
      <a href="#job-1299">Test Engineer &#8212; Electromagnetic Tomography</a>
      <a href="#job-1326">RF / SDR FPGA Engineer</a>

      <h3 id="job-1299">Test Engineer &#8212; Electromagnetic Tomography</h3>
      <p>emtensor is seeking a proactive Test Engineer to join our Vienna-based laboratory.</p>
      <a class="btn" href="https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/">Learn More &raquo;</a>

      <h3 id="job-1326">RF / SDR FPGA Engineer</h3>
      <p>Location: Bangalore, India (On-site / Hybrid)</p>
      <p>Employment Type: Full-time or Contract</p>
      <a class="btn" href="/about-us/recruitment/rf-sdr-fpga-engineer/">Learn More &raquo;</a>
    </body>
  </html>
`

const detailHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Test Engineer - Electromagnetic Tomography</h1>
      <section>
        <p>Location: Bangalore, India (On-site / Hybrid)</p>
        <p>Employment Type: Full-time or Contract</p>
        <h2>About the Role</h2>
        <p>Validate tomography systems for industrial sensing.</p>
        <h2>Your Profile</h2>
        <p>Experience with embedded measurement systems.</p>
        <h2>Technical Skills - Required</h2>
        <p>Signal processing and instrumentation.</p>
        <h2>Key Responsibilities</h2>
        <p>Collaborate with the Bengaluru engineering team.</p>
      </section>
    </body>
  </html>
`

test('hasOfficialCareersSignal validates the verified EMTensor public careers surface', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('extractListings reads first-party EMTensor job links from the careers page', () => {
  const listings = extractListings(careersHtml)

  assert.deepEqual(listings, [
    {
      title: 'Test Engineer - Electromagnetic Tomography',
      company: 'EMTensor',
      jobId: 'test-engineer-electromagnetic-tomography',
      requisitionId: 'test-engineer-electromagnetic-tomography',
      sourceUrl: 'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/',
      applyUrl: 'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/',
    },
    {
      title: 'RF / SDR FPGA Engineer',
      company: 'EMTensor',
      jobId: 'rf-sdr-fpga-engineer',
      requisitionId: 'rf-sdr-fpga-engineer',
      sourceUrl: 'https://www.emtensor.com/about-us/recruitment/rf-sdr-fpga-engineer/',
      applyUrl: 'https://www.emtensor.com/about-us/recruitment/rf-sdr-fpga-engineer/',
    },
  ])
})

test('extractJobDetail maps EMTensor detail-page content', () => {
  const detail = extractJobDetail(detailHtml, {
    title: 'Test Engineer - Electromagnetic Tomography',
    jobId: 'test-engineer-electromagnetic-tomography',
    requisitionId: 'test-engineer-electromagnetic-tomography',
    sourceUrl: 'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/',
  })

  assert.equal(detail.title, 'Test Engineer - Electromagnetic Tomography')
  assert.equal(detail.location, 'Bengaluru, India (On-site / Hybrid)')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.employmentType, 'Full-time or Contract')
  assert.equal(detail.applyUrl, 'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/')
  assert.equal(detail.remoteStatus, 'On-site')
  assert.match(detail.jobDescription, /About the Role/i)
  assert.match(detail.jobDescription, /Signal processing and instrumentation/i)
})

test('extractJobDetail does not force India onto Vienna-only EMTensor roles', () => {
  const detail = extractJobDetail(`
    <html>
      <body>
        <h1>Test Engineer - Electromagnetic Tomography</h1>
        <p>emtensor is seeking a proactive Test Engineer to join our Vienna-based laboratory.</p>
      </body>
    </html>
  `, {
    title: 'Test Engineer - Electromagnetic Tomography',
    jobId: 'test-engineer-electromagnetic-tomography',
    requisitionId: 'test-engineer-electromagnetic-tomography',
    sourceUrl: 'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/',
  })

  assert.equal(detail.location, 'Vienna, Austria')
  assert.equal(detail.city, 'Vienna')
  assert.equal(detail.country, 'Austria')
})

test('run fetches the EMTensor careers page and enriches jobs from official detail pages', async () => {
  const requestedUrls = []

  const jobs = await createEmtensorScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === 'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/') return detailHtml
      if (url === 'https://www.emtensor.com/about-us/recruitment/rf-sdr-fpga-engineer/') return detailHtml.replace(/Test Engineer - Electromagnetic Tomography/g, 'RF / SDR FPGA Engineer')
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    'https://www.emtensor.com/about-us/recruitment/test-engineer-electromagnetic-tomography/',
    'https://www.emtensor.com/about-us/recruitment/rf-sdr-fpga-engineer/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'emtensor')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run fails closed when the EMTensor careers surface changes', async () => {
  await assert.rejects(
    createEmtensorScraper().run({
      fetchText: async () => '<html><body>No public job links here</body></html>',
    }),
    /verified official public jobs surface/i,
  )
})
