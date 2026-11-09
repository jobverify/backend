import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

test('missing employer descriptions remain eligible without substituting display text for source content', () => {
  const empty = [undefined, null, '', ' \n\t\u00a0\u200b', '<p>&nbsp;<br></p>', '<!-- vacancy --><style>body{color:red}</style><script>ignored()</script>', '&#160;&#xA0;', '<br>'.repeat(10000), '<script>' + 'ignored();'.repeat(10000) + '</script>']
  const jobs = empty.map((sourceDescription, index) => ({
    jobId: `empty-${index}`, title: 'Engineer', location: 'India', applyUrl: `https://example.test/jobs/${index}`,
    ...(sourceDescription === undefined ? {} : { sourceDescription, description: 'A previous generated description must not stand in for missing employer source.' }),
  }))
  jobs.push({ jobId: 'legacy', title: 'Engineer', location: 'India', applyUrl: 'https://example.test/jobs/legacy', description: 'Build APIs.' })
  jobs.push({ jobId: 'source', title: 'Engineer', location: 'India', applyUrl: 'https://example.test/jobs/source', sourceDescription: '\u00a0'.repeat(10000) + '<script></script><!-- spacer -->'.repeat(100) + '<p>Build APIs.</p>' })
  jobs.push({ jobId: 'alias', title: 'Engineer', location: 'India', applyUrl: 'https://example.test/jobs/alias', jobDescription: 'Build APIs.' })
  const result = analyzePublishableJobs(jobs)
  assert.equal(result.eligibleJobs.length, 12)
  assert.deepEqual(result.eligibleJobs, jobs)
  assert.equal(result.filterCounts.emptyDescription, 0)
  assert.equal(jobs[2].sourceDescription, '')
})

test('missing descriptions do not bypass geography, age, expiry, URL or individual-vacancy requirements', () => {
  const base = { title: 'Engineer', location: 'India', applyUrl: 'https://example.test/jobs/1' }
  const result = analyzePublishableJobs([
    { ...base, jobId: 'eligible' },
    { ...base, jobId: 'foreign', location: 'London, United Kingdom' },
    { ...base, jobId: 'old', postingDate: '2026-08-01' },
    { ...base, jobId: 'closed', closingDate: '2026-10-19' },
    { ...base, jobId: 'invalid', applyUrl: 'javascript:alert(1)' },
    { ...base, title: 'Current openings at Example', jobId: 'example-current-openings', applyUrl: 'https://wellfound.com/company/example/jobs' },
  ], { now: new Date('2026-10-23T12:00:00Z') })
  assert.deepEqual(result.eligibleJobs.map(job => job.jobId), ['eligible'])
  assert.deepEqual(result.filterCounts, { nonIndia: 1, old: 1, closed: 1, invalidUrl: 1, nonJob: 1, emptyDescription: 0 })
})

test('excludes an open India job posted before the previous calendar month', () => {
  const result = analyzePublishableJobs([{
    title: 'Open legacy role',
    location: 'Bengaluru, India',
    applyUrl: 'https://example.com/jobs/open-legacy-role',
    postingDate: '2026-05-01',
    description: 'Build and maintain software for customers.',
  }], { now: new Date('2026-09-12T12:00:00.000Z') })

  assert.equal(result.eligibleJobs.length, 0)
  assert.equal(result.filterCounts.old, 1)
})

test('posting age keeps the cutoff day and unknown dates, with source dates taking precedence over scraping', () => {
  const base = { title: 'Engineer', location: 'India', applyUrl: 'https://example.test/jobs/1', description: 'Build APIs.' }
  const jobs = [
    { ...base, jobId: 'old', postingDate: '2026-09-20T23:59:59.999Z', scrapedAt: '2026-10-21' },
    { ...base, jobId: 'cutoff', postingDate: '2026-09-21' },
    { ...base, jobId: 'recent', postedAt: '2026-10-20' },
    { ...base, jobId: 'old-postedAt', postedAt: '2026-08-01' },
    { ...base, jobId: 'unknown', postingDate: 'NA' },
  ]
  const result = analyzePublishableJobs(jobs, { now: new Date('2026-10-21T12:00:00Z') })
  assert.deepEqual(result.eligibleJobs.map(job => job.jobId), ['cutoff', 'recent', 'unknown'])
  assert.equal(result.filterCounts.old, 2)
})

test('rejects historic aggregate opening sentinels while preserving individual vacancies', () => {
  const result = analyzePublishableJobs([
    { title: 'Current remote openings at Example', jobId: 'example-current-openings', location: 'India', applyUrl: 'https://himalayas.app/companies/example' },
    { title: 'Current openings at Example', requisitionId: 'example-current-openings', location: 'India', applyUrl: 'https://wellfound.com/company/example/jobs' },
    { title: 'Software Engineer', jobId: 'real-1', location: 'India', applyUrl: 'https://example.test/jobs/real-1', description: 'Build and maintain software for customers.' },
  ])
  assert.deepEqual(result.eligibleJobs.map((job) => job.jobId), ['real-1'])
  assert.equal(result.filterCounts.nonJob, 2)
})

test('email application roles remain publishable when the verified public role page is available', () => {
  const result = analyzePublishableJobs([
    { title: 'Lead Engineer', location: 'Chennai, India', applyUrl: 'mailto:jobs@example.com?subject=Lead%20Engineer', sourceUrl: 'https://example.com/careers#lead-engineer', description: 'Lead the software engineering team.' },
    { title: 'Unlinked role', location: 'Chennai, India', applyUrl: 'mailto:jobs@example.com' },
  ])
  assert.equal(result.eligibleJobs.length, 1)
  assert.equal(result.eligibleJobs[0].title, 'Lead Engineer')
  assert.equal(result.filterCounts.invalidUrl, 1)
})

test('an unsafe application scheme is rejected even if a source URL exists', () => {
  const result = analyzePublishableJobs([{ title: 'Engineer', location: 'India', applyUrl: 'javascript:alert(1)', sourceUrl: 'https://example.com/careers' }])
  assert.equal(result.eligibleJobs.length, 0)
  assert.equal(result.filterCounts.invalidUrl, 1)
})
