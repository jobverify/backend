import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  HOMEPAGE_URL,
  createEconSystemScraper,
  extractOpenings,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>e-con Systems: Develops & Manufactures OEM Cameras</title>
    </head>
    <body>
      <footer>
        <a href="/about-us.asp">About Us</a>
        <a href="/careers.asp">Careers</a>
        <a href="https://hrmax.myadrenalin.com/">Employee Login</a>
      </footer>
      <p>Since 2003, e-con Systems® has been addressing the embedded camera needs of different types of markets across the world.</p>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Join Our Team: Innovation & Engineering Careers at e-con Systems</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <p>We at e-con Systems® are geared towards bracing up the challenges in product development.</p>
        <h3>Positions and Eligibility:</h3>

        <section class="career-opening">
          <h2>JOB ID: e-con001</h2>
          <h3>Job Synopsis:</h3>
          <p>Position: Sales Hunter - SR.BDE / Business Development Manager</p>
          <p>Geography: US, EU, KOREA - 3 Nos.</p>
          <p>Location: Chennai</p>
          <p>Experience: 2- 6 years</p>
          <p>Educational Qualification : Any Engineering + MBA - Marketing / IBM (Optional)</p>
          <h3>Role Overview:</h3>
          <p>As a Sales Inbound Hunter with e-con Systems, you'll be the catalyst for turning inbound interest into business success.</p>
          <h3>Skillsets:</h3>
          <h4>What you will do:</h4>
          <ul>
            <li>Build your network with C-Level audience at USA.</li>
            <li>Work with product management & marketing teams.</li>
          </ul>
          <h4>What We Expect:</h4>
          <ul>
            <li>Consultative selling skills.</li>
            <li>Experience with CRMs such as Zoho and Salesforce.</li>
          </ul>
          <a href="https://www.e-consystems.com/careers.asp#apply-e-con001">Apply Here</a>
        </section>

        <section class="career-opening">
          <h2>JOB ID: e-con003</h2>
          <h3>Job Synopsis:</h3>
          <p>Position: Marketing Internship</p>
          <p>Geography: US, EU, KOREA - 3 Nos.</p>
          <p>Location: Chennai</p>
          <p>Experience: Intern / Fresher (2024/ 2025)</p>
          <p>Internship period : 3 Months (Can be considered for full-time based on performance)</p>
          <p>Educational Qualification : Any B.E/ B.Tech + Full Time MBA (Marketing/ Analytics/ IBM)</p>
          <h3>Role Overview:</h3>
          <p>e-con Systems is seeking a motivated and creative Marketing Intern to join our dynamic marketing team.</p>
          <h3>Skillsets:</h3>
          <ul>
            <li>Develop and execute digital marketing campaigns.</li>
            <li>Manage the company's online marketing presence.</li>
          </ul>
          <a href="https://www.e-consystems.com/careers.asp#apply-e-con003">Apply Here</a>
        </section>
      </main>
    </body>
  </html>
`

test('detects the verified official e-con Systems homepage and careers job surface', () => {
  assert.equal(HOMEPAGE_URL, 'https://www.e-consystems.com/')
  assert.equal(CAREER_PAGE_URL, 'https://www.e-consystems.com/careers.asp')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><body>Placeholder</body></html>'), false)
  assert.equal(hasOfficialCareersSignal('<html><body>No openings listed</body></html>'), false)
})

test('extractOpenings parses official e-con Systems jobs from the careers page', () => {
  assert.deepEqual(extractOpenings(careersHtml), [
    {
      title: 'Sales Hunter - SR.BDE / Business Development Manager',
      company: 'e-con Systems',
      department: 'US, EU, KOREA - 3 Nos.',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'e-con001',
      requisitionId: 'e-con001',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: 'https://www.e-consystems.com/careers.asp#apply-e-con001',
      employmentType: 'Full-time',
      experienceRequired: '2- 6 years',
      minimumQualification: 'Any Engineering + MBA - Marketing / IBM (Optional)',
      preferredQualification: null,
      requiredSkills: [
        'Build your network with C-Level audience at USA.',
        'Work with product management & marketing teams.',
        'Consultative selling skills.',
        'Experience with CRMs such as Zoho and Salesforce.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: "As a Sales Inbound Hunter with e-con Systems, you'll be the catalyst for turning inbound interest into business success.",
    },
    {
      title: 'Marketing Internship',
      company: 'e-con Systems',
      department: 'US, EU, KOREA - 3 Nos.',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'e-con003',
      requisitionId: 'e-con003',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: 'https://www.e-consystems.com/careers.asp#apply-e-con003',
      employmentType: 'Internship',
      experienceRequired: 'Intern / Fresher (2024/ 2025)',
      minimumQualification: 'Any B.E/ B.Tech + Full Time MBA (Marketing/ Analytics/ IBM)',
      preferredQualification: null,
      requiredSkills: [
        'Develop and execute digital marketing campaigns.',
        "Manage the company's online marketing presence.",
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'e-con Systems is seeking a motivated and creative Marketing Intern to join our dynamic marketing team.',
    },
  ])
})

test('run validates the official site surfaces before returning decorated e-con Systems jobs', async () => {
  const requestedUrls = []
  const jobs = await createEconSystemScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'econsystem')
  assert.equal(jobs[0].link, 'https://www.e-consystems.com/careers.asp#apply-e-con001')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run fails closed when the verified official e-con Systems surface changes', async () => {
  await assert.rejects(
    createEconSystemScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>Home</body></html>'
        return careersHtml
      },
    }),
    /homepage no longer matches the verified official public site/i,
  )

  await assert.rejects(
    createEconSystemScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Careers</h1></body></html>'
      },
    }),
    /careers page no longer matches the verified official public jobs surface/i,
  )
})
