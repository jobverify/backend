import assert from 'node:assert/strict'
import test from 'node:test'

const loadCoditasModule = async () => {
  try {
    return await import('../../scraper/coditas/script.js')
  } catch {
    return null
  }
}

const listingPayload = {
  statusCode: 200,
  data: [
    {
      id: '31162000033464447',
      jobId: '31162000033464447',
      jobPostTitle: 'Content Writer',
      category: 'Sales and Marketing',
      jobType: 'Full time',
      workExpRequired: '2-3 years',
      city: 'Pune City',
      requiredSkills: 'content writing, short form, AI tools',
      jdSummary: 'Create engaging B2B content.',
      jobDescription: '<p>Create <strong>engaging</strong> B2B content.</p>',
      publish: true,
    },
    {
      id: 'hidden-role',
      jobPostTitle: 'Hidden role',
      city: 'Pune City',
      publish: false,
    },
  ],
}

test('Coditas scraper constants point to the public first-party job openings API', async () => {
  const coditas = await loadCoditasModule()
  assert.ok(coditas)

  assert.equal(coditas.CAREER_PAGE_URL, 'https://www.coditas.com/careers/job-opportunities')
  assert.equal(
    coditas.JOBS_API_URL,
    'https://4ht8rp26o5.execute-api.ap-south-1.amazonaws.com/prod/job-openings/get-openings',
  )
  assert.equal(
    coditas.buildJobUrl('31162000033464447'),
    'https://www.coditas.com/careers/job-apply?jobId=31162000033464447',
  )
})

test('extractJobs normalizes published Coditas API jobs and excludes unpublished roles', async () => {
  const coditas = await loadCoditasModule()
  assert.ok(coditas)

  const jobs = coditas.extractJobs(listingPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Content Writer',
      company: 'Coditas Solutions LLP',
      department: 'Sales and Marketing',
      location: 'Pune City, India',
      city: 'Pune City',
      country: 'India',
      jobId: '31162000033464447',
      requisitionId: '31162000033464447',
      sourceUrl: 'https://www.coditas.com/careers/job-apply?jobId=31162000033464447',
      applyUrl: 'https://www.coditas.com/careers/job-apply?jobId=31162000033464447',
      employmentType: 'Full time',
      experienceRequired: '2-3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['content writing', 'short form', 'AI tools'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Create engaging B2B content.',
    },
  ])
})

test('run fetches the public Coditas API and decorates jobs for the shared runner', async () => {
  const coditas = await loadCoditasModule()
  assert.ok(coditas)

  const requestedUrls = []
  const jobs = await coditas.createCoditasScraper().run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return listingPayload
    },
  })

  assert.deepEqual(requestedUrls, [coditas.JOBS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'coditas')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
