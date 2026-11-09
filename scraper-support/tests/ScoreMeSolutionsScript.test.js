import assert from 'node:assert/strict'
import test from 'node:test'

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings - ScoreMe | Digital lending made Simple | Paperless Analysis</title>
  </head>
  <body>
    <h1>Job Openings</h1>
    <p>Filter by</p>
    <article>
      <h2><a href="https://scoreme.in/jobs/data-pipeline-developer/">Data Pipeline Developer</a></h2>
      <p>Development</p>
      <p>Gurgaon</p>
      <a href="https://scoreme.in/jobs/data-pipeline-developer/">More Details</a>
    </article>
    <article>
      <h2><a href="https://scoreme.in/jobs/digital-marketing-associate/">Digital Marketing Associate</a></h2>
      <p>Marketing</p>
      <p>Gurgaon</p>
      <a href="https://scoreme.in/jobs/digital-marketing-associate/">More Details</a>
    </article>
    <article>
      <h2><a href="https://scoreme.in/jobs/new-york-growth-lead/">New York Growth Lead</a></h2>
      <p>Growth</p>
      <p>New York</p>
      <a href="https://scoreme.in/jobs/new-york-growth-lead/">More Details</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/scoreme/script.js')
  } catch {
    assert.fail('Expected ScoreMe Solutions scraper module at ../../scraper/scoreme/script.js')
  }
}

test('ScoreMe Solutions helpers stay pinned to the verified first-party jobs page', async () => {
  const scoreme = await loadModule()

  assert.equal(scoreme.SOURCE, 'scoreme')
  assert.equal(scoreme.COMPANY, 'ScoreMe Solutions')
  assert.equal(scoreme.CAREERS_URL, 'https://scoreme.in/jobs/')
  assert.equal(scoreme.VERIFIED_ON, '2026-07-17')
  assert.equal(scoreme.hasOfficialCareersSignal(jobsHtml), true)
  assert.equal(scoreme.hasOfficialCareersSignal('<html><body><h1>Job Openings</h1></body></html>'), false)
  assert.deepEqual(scoreme.extractJobs(jobsHtml), [
    {
      title: 'Data Pipeline Developer',
      company: 'ScoreMe Solutions',
      department: 'Development',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'data-pipeline-developer',
      requisitionId: 'data-pipeline-developer',
      sourceUrl: 'https://scoreme.in/jobs/data-pipeline-developer/',
      applyUrl: 'https://scoreme.in/jobs/data-pipeline-developer/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Digital Marketing Associate',
      company: 'ScoreMe Solutions',
      department: 'Marketing',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'digital-marketing-associate',
      requisitionId: 'digital-marketing-associate',
      sourceUrl: 'https://scoreme.in/jobs/digital-marketing-associate/',
      applyUrl: 'https://scoreme.in/jobs/digital-marketing-associate/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('ScoreMe Solutions run validates the verified jobs page before decorating extracted jobs', async () => {
  const scoreme = await loadModule()
  const requestedUrls = []

  const jobs = await scoreme.createScoreMeScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === scoreme.CAREERS_URL) return jobsHtml
      throw new Error(`Unexpected ScoreMe URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [scoreme.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'scoreme')
  assert.equal(jobs[0].link, 'https://scoreme.in/jobs/data-pipeline-developer/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('ScoreMe Solutions run fails closed when the verified jobs page drifts', async () => {
  const scoreme = await loadModule()

  await assert.rejects(
    scoreme.createScoreMeScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified scoreme solutions jobs page/i,
  )
})
