import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  KULA_JOBS_URL,
  createAckoScraper,
  extractSearchResults,
} from './script.js'

const sampleHtml = `
<script>
window.__APOLLO_STATE__="{\\"jobs\\":[{\\"id\\":\\"job-123\\",\\"title\\":\\"Lead DevOps Engineer\\",\\"ats_job\\":{\\"ats_department\\":{\\"name\\":\\"Engineering\\"},\\"employment_type\\":\\"full_time\\",\\"job_description\\":\\"Own platform reliability and cloud infrastructure.\\",\\"offices\\":[{\\"location\\":\\"Bengaluru, Karnataka, India\\",\\"country\\":\\"India\\"}]}},{\\"id\\":\\"job-456\\",\\"title\\":\\"  Specialist - Motor Claims  \\\",\\"ats_job\\":{\\"ats_department\\":{\\"name\\":\\"Claims\\"},\\"employment_type\\":\\"contract\\",\\"job_description\\":\\"Handle end-to-end motor claims.\\",\\"offices\\":[{\\"name\\":\\"Remote\\",\\"remote\\":true,\\"country\\":\\"India\\"},{\\"location\\":\\"Bengaluru, Karnataka, India\\",\\"country\\":\\"India\\"}]}}],\\"departments\\":[]}";
</script>
`

test('uses the public ACKO careers page and Kula jobs listing endpoint', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.acko.com/careers/jobs/')
  assert.equal(KULA_JOBS_URL, 'https://careers.kula.ai/acko?jobs=true')
})

test('extractSearchResults normalizes Kula embedded jobs into shared scraper fields', () => {
  const jobs = extractSearchResults(sampleHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Lead DevOps Engineer',
      company: 'ACKO',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'job-123',
      requisitionId: 'job-123',
      sourceUrl: 'https://careers.kula.ai/acko/job-123/?jobs=true',
      applyUrl: 'https://careers.kula.ai/acko/job-123/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Own platform reliability and cloud infrastructure.',
    },
    {
      title: 'Specialist - Motor Claims',
      company: 'ACKO',
      department: 'Claims',
      location: 'Remote; Bengaluru, Karnataka, India',
      city: 'Remote',
      country: 'India',
      jobId: 'job-456',
      requisitionId: 'job-456',
      sourceUrl: 'https://careers.kula.ai/acko/job-456/?jobs=true',
      applyUrl: 'https://careers.kula.ai/acko/job-456/?jobs=true',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Handle end-to-end motor claims.',
    },
  ])
})

test('run adds scraper metadata and respects maxJobs', async () => {
  const scraper = createAckoScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, KULA_JOBS_URL)
      return sampleHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'acko')
  assert.equal(jobs[0].link, 'https://careers.kula.ai/acko/job-123/?jobs=true')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
