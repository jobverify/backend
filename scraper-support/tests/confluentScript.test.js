import assert from 'node:assert/strict'
import test from 'node:test'

const indiaRemoteJob = {
  id: 'confluent-india-remote',
  title: 'Senior Backend Engineer',
  isListed: true,
  location: 'IN Remote India',
  address: {
    postalAddress: {
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      addressCountry: 'India',
    },
  },
  department: 'Engineering',
  employmentType: 'FullTime',
  publishedAt: '2026-07-14T00:00:00.000Z',
  descriptionHtml: '<p>Build streaming infrastructure for Confluent.</p>',
  jobUrl: 'https://jobs.ashbyhq.com/confluent/confluent-india-remote',
  applyUrl: 'https://jobs.ashbyhq.com/confluent/confluent-india-remote/application',
}

const nonIndiaJob = {
  id: 'confluent-london-role',
  title: 'Solutions Engineer',
  isListed: true,
  location: 'London, United Kingdom',
  address: {
    postalAddress: {
      addressLocality: 'London',
      addressCountry: 'United Kingdom',
    },
  },
  jobUrl: 'https://jobs.ashbyhq.com/confluent/confluent-london-role',
  applyUrl: 'https://jobs.ashbyhq.com/confluent/confluent-london-role/application',
}

const unlistedIndiaJob = {
  ...indiaRemoteJob,
  id: 'confluent-unlisted-india-role',
  isListed: false,
  jobUrl: 'https://jobs.ashbyhq.com/confluent/confluent-unlisted-india-role',
  applyUrl: 'https://jobs.ashbyhq.com/confluent/confluent-unlisted-india-role/application',
}

const loadConfluentModule = async () => {
  try {
    return await import('../../scraper/confluent/script.js')
  } catch {
    assert.fail('Expected Confluent scraper module at ../../scraper/confluent/script.js')
  }
}

test('extractAshbyJobs keeps listed IN Remote India jobs and excludes non-India or unlisted jobs', async () => {
  const confluent = await loadConfluentModule()
  const jobs = confluent.extractAshbyJobs({
    jobs: [indiaRemoteJob, nonIndiaJob, unlistedIndiaJob],
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Backend Engineer',
    company: 'Confluent',
    department: 'Engineering',
    location: 'IN Remote India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: 'confluent-india-remote',
    requisitionId: 'confluent-india-remote',
    sourceUrl: 'https://jobs.ashbyhq.com/confluent/confluent-india-remote',
    applyUrl: 'https://jobs.ashbyhq.com/confluent/confluent-india-remote/application',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-14T00:00:00.000Z',
    closingDate: null,
    jobDescription: '<p>Build streaming infrastructure for Confluent.</p>',
  })
})

test('run reads the public Confluent Ashby board only and returns runner metadata', async () => {
  const confluent = await loadConfluentModule()
  const requestedUrls = []

  const jobs = await confluent.createConfluentScraper().run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return { jobs: [indiaRemoteJob] }
    },
  })

  assert.equal(confluent.CAREER_PAGE_URL, 'https://careers.confluent.io/')
  assert.equal(confluent.PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/confluent')
  assert.equal(confluent.ASHBY_JOB_BOARD_URL, 'https://api.ashbyhq.com/posting-api/job-board/confluent')
  assert.deepEqual(requestedUrls, [confluent.ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'confluent')
  assert.equal(jobs[0].link, 'https://jobs.ashbyhq.com/confluent/confluent-india-remote/application')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
