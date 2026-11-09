import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createSahajAiScraper,
  extractJobDetail,
  extractListings,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <html>
    <head>
      <title>Careers Sahaj Software</title>
    </head>
    <body>
      <h2>Work will never be the same again!</h2>
      <section>
        <h2>Explore Open Roles</h2>
        <div class="explore-role-grid">
          <h3 class="role-title mb-4 mulish-bold font-32">Data Scientist</h3>
          <p>Role summary</p>
          <a href="https://sahaj.ai/joinus/data-scientist/" class="theme-btn text-center">Know More</a>
        </div>
        <div class="explore-role-grid">
          <h3 class="role-title mb-4 mulish-bold font-32">Data Engineer</h3>
          <p>Role summary</p>
          <a href="https://sahaj.ai/joinus/data-engineer/" class="theme-btn text-center">Know More</a>
        </div>
        <div class="explore-role-grid">
          <h3 class="role-title mb-4 mulish-bold font-32">Senior and Lead Engineer - Full Stack</h3>
          <p>Role summary</p>
          <a href="https://sahaj.ai/joinus/full-stack-engineer/" class="theme-btn text-center">Know More</a>
        </div>
      </section>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <head>
      <title>Data Scientist Sahaj Software</title>
    </head>
    <body>
      <h1>Data Scientist</h1>
      <p>Location: Bengaluru | London | Pune</p>
      <h2>About the role</h2>
      <p>Build applied machine learning systems.</p>
      <h2>Qualification/experience:</h2>
      <p>Strong background in machine learning and statistics.</p>
    </body>
  </html>
`

test('Sahaj AI careers verifier and listing extractor accept the current classed job cards', () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    extractListings(careersHtml).map((job) => [job.title, job.jobId, job.sourceUrl]),
    [
      ['Data Scientist', 'data-scientist', 'https://sahaj.ai/joinus/data-scientist/'],
      ['Data Engineer', 'data-engineer', 'https://sahaj.ai/joinus/data-engineer/'],
      ['Senior and Lead Engineer - Full Stack', 'full-stack-engineer', 'https://sahaj.ai/joinus/full-stack-engineer/'],
    ],
  )
})

test('Sahaj AI detail extractor keeps the India location and description fields from the live detail pattern', () => {
  assert.deepEqual(
    extractJobDetail(detailHtml, {
      title: 'Data Scientist',
      sourceUrl: 'https://sahaj.ai/joinus/data-scientist/',
      applyUrl: 'https://sahaj.ai/joinus/data-scientist/',
      jobId: 'data-scientist',
      requisitionId: 'data-scientist',
    }),
    {
      title: 'Data Scientist',
      location: 'Bengaluru | London | Pune',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'data-scientist',
      requisitionId: 'data-scientist',
      sourceUrl: 'https://sahaj.ai/joinus/data-scientist/',
      applyUrl: 'https://sahaj.ai/joinus/data-scientist/',
      employmentType: null,
      experienceRequired: null,
      department: null,
      minimumQualification: 'Strong background in machine learning and statistics.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'About the role Build applied machine learning systems.',
    },
  )
})

test('Sahaj AI run returns the same-domain roles from the verified careers page', async () => {
  const scraper = createSahajAiScraper()
  const requestedUrls = []

  const jobs = await scraper.run({
    now: () => '2026-08-04T00:00:00.000Z',
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === 'https://sahaj.ai/joinus/data-scientist/') return detailHtml
      if (url === 'https://sahaj.ai/joinus/data-engineer/') {
        return detailHtml
          .replaceAll('Data Scientist', 'Data Engineer')
          .replace('Bengaluru | London | Pune', 'Bengaluru | Chennai | Hyderabad | London | Pune')
      }
      if (url === 'https://sahaj.ai/joinus/full-stack-engineer/') {
        return detailHtml
          .replaceAll('Data Scientist', 'Senior and Lead Engineer - Full Stack')
          .replace('Bengaluru | London | Pune', 'Bengaluru | Chennai | Hyderabad | London | Pune')
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    'https://sahaj.ai/joinus/data-scientist/',
    'https://sahaj.ai/joinus/data-engineer/',
    'https://sahaj.ai/joinus/full-stack-engineer/',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.country, job.company, job.source]),
    [
      ['Data Scientist', 'Bengaluru', 'India', COMPANY, SOURCE],
      ['Data Engineer', 'Bengaluru', 'India', COMPANY, SOURCE],
      ['Senior and Lead Engineer - Full Stack', 'Bengaluru', 'India', COMPANY, SOURCE],
    ],
  )
})
