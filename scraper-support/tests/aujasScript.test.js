import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  extractJobDetail,
  extractJobUrls,
} from '../../scraper/aujas/script.js'

const listingHtml = `
  <html>
    <body>
      <a href="https://www.nusummit.com/current-opening/ai-product-engineer/">AI Product Engineer</a>
      <a href="https://www.nusummit.com/current-opening/devops-engineer/">DevOps Engineer</a>
      <a href="https://www.nusummituat.com/current-opening/java-developer/">Ignore UAT duplicate</a>
      <a href="/current-opening/devops-engineer/">DevOps Engineer duplicate</a>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <head>
      <meta property="og:title" content=" AI Product Engineer ·">
      <meta property="og:description" content="Job Code: CXIO_Job_195 Role: AI Product Engineer Experience: 5-10 Yrs Location: Mumbai, Pune, Chennai, Bangalore, Gurugram Job Type: Full Time Job Description: Responsibilities: Design and Develop AI-Powered Products. Experiment with different architectures and training techniques.">
      <title>AI Product Engineer ·</title>
    </head>
  </html>
`

test('CAREER_PAGE_URL keeps the Aujas scraper on the official NuSummit openings page', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.nusummit.com/current-openings/')
})

test('extractJobUrls keeps only unique production current-opening links', () => {
  assert.deepEqual(extractJobUrls(listingHtml), [
    'https://www.nusummit.com/current-opening/ai-product-engineer/',
    'https://www.nusummit.com/current-opening/devops-engineer/',
  ])
})

test('extractJobDetail reads Aujas/NuSummit detail metadata into scraper jobs', () => {
  assert.deepEqual(
    extractJobDetail(detailHtml, 'https://www.nusummit.com/current-opening/ai-product-engineer/'),
    {
      title: 'AI Product Engineer',
      company: 'Aujas Cybersecurity',
      department: null,
      location: 'Mumbai, Pune, Chennai, Bangalore, Gurugram',
      city: 'Mumbai',
      jobId: 'ai-product-engineer',
      requisitionId: 'CXIO_Job_195',
      sourceUrl: 'https://www.nusummit.com/current-opening/ai-product-engineer/',
      applyUrl: 'https://www.nusummit.com/current-opening/ai-product-engineer/',
      employmentType: 'Full Time',
      experienceRequired: '5-10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Responsibilities: Design and Develop AI-Powered Products. Experiment with different architectures and training techniques.',
    },
  )
})
