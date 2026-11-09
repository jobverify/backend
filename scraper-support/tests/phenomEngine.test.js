import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createPhenomScraper } from '../phenom/engine.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Example Phenom Company',
  source: 'example-phenom',
  baseUrl: 'https://careers.example.com',
  searchPath: '/global/en/search-results',
  scraperDir: testDir,
})

const buildJobDetailHtml = (job) => `<!doctype html>
<html>
  <head>
    <link rel="canonical" href="https://careers.example.com/global/en/job/${job.reqId || job.jobId}/sample-role" />
    <script>
      phApp.ddo = ${JSON.stringify({ jobDetail: { data: { job } } })}
    </script>
  </head>
  <body></body>
</html>`

const listing = {
  title: 'Example Role',
  location: 'Bengaluru, Karnataka, India',
  city: 'Bengaluru',
  country: 'India',
  jobId: 'example-role-1',
  requisitionId: 'example-role-1',
  department: 'Engineering',
  sourceUrl: 'https://careers.example.com/global/en/job/example-role-1/sample-role',
}

test('extractSearchResults normalizes numeric experience snippets from Phenom listings', () => {
  const [job] = scraper.extractSearchResults({
    jobs: [
      {
        reqId: 'cyber-threat-hunter-1',
        jobId: 'cyber-threat-hunter-1',
        title: 'Cyber Threat Hunter',
        cityStateCountry: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        country: 'India',
        category: 'Security',
        type: 'Full time',
        experience: '3+ years of experience in cybersecurity operations, with hands-on experience in threat hunting.',
        applyUrl: 'https://careers.example.com/apply/cyber-threat-hunter-1',
        postedDate: '2026-07-30T00:00:00.000Z',
      },
    ],
  })

  assert.equal(job.experienceRequired, '3+ years')
})

test('extractJobDetail normalizes structured experience sentences to numeric chips', () => {
  const detail = scraper.extractJobDetail(
    buildJobDetailHtml({
      reqId: '22066',
      jobId: '22066',
      title: 'Senior Business Operations Analyst',
      ml_country: 'India',
      experience_sentences: [
        'Proven experience (5+ years) as a Analyst / Sr. Analyst in a similar role.',
      ],
      ml_Description: '<p>Proven experience (5+ years) as a Analyst / Sr. Analyst in a similar role.</p>',
    }),
    {
      ...listing,
      title: 'Senior Business Operations Analyst',
      jobId: '22066',
      requisitionId: '22066',
      sourceUrl: 'https://careers.example.com/global/en/job/22066/senior-business-operations-analyst',
    },
  )

  assert.equal(detail.experienceRequired, '5+ years')
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractJobDetail normalizes description-only numeric experience requirements', () => {
  const detail = scraper.extractJobDetail(
    buildJobDetailHtml({
      reqId: '21965',
      jobId: '21965',
      title: 'IT Operations Analyst II',
      ml_country: 'India',
      ml_Description: '<p>4+ years of experience in application support with good communication skills.</p>',
    }),
    {
      ...listing,
      title: 'IT Operations Analyst II',
      jobId: '21965',
      requisitionId: '21965',
      sourceUrl: 'https://careers.example.com/global/en/job/21965/it-operations-analyst-ii',
    },
  )

  assert.equal(detail.experienceRequired, '4+ years')
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractJobDetail preserves explicit no-experience labels from structured job data', () => {
  const detail = scraper.extractJobDetail(
    buildJobDetailHtml({
      reqId: '24271',
      jobId: '24271',
      title: 'Accounting Services Associate IV',
      ml_country: 'India',
      experience_sentences: ['No experience required'],
      ml_Description: '<p>No experience required</p>',
    }),
    {
      ...listing,
      title: 'Accounting Services Associate IV',
      jobId: '24271',
      requisitionId: '24271',
      sourceUrl: 'https://careers.example.com/global/en/job/24271/accounting-services-associate-iv',
    },
  )

  assert.equal(detail.experienceRequired, 'No experience required')
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractJobDetail ignores generic equivalent experience prose without numeric requirements', () => {
  const detail = scraper.extractJobDetail(
    buildJobDetailHtml({
      reqId: '24559',
      jobId: '24559',
      title: 'Customer Experience Associate II',
      ml_country: 'India',
      ml_Description: '<ul><li>Requires vocational training, certifications, licensures, or equivalent experience.</li></ul>',
    }),
    {
      ...listing,
      title: 'Customer Experience Associate II',
      jobId: '24559',
      requisitionId: '24559',
      sourceUrl: 'https://careers.example.com/global/en/job/24559/customer-experience-associate-ii',
    },
  )

  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
})
