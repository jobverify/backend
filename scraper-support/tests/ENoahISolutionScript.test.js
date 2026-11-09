import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - eNoah iSolution</title>
  </head>
  <body>
    <h1>Job Opportunity</h1>
    <p>Watch this space for updates on current Job Opportunities at eNoah.</p>
    <a href="https://enoahisolution.com/careers/jobs/">Current Job Opportunities</a>
  </body>
</html>
`

const jobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Job Opportunities</h1>
    <p>We currently have no job openings</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/enoahisolution/script.js')
  } catch {
    assert.fail('Expected eNoah iSolution scraper module at ../../scraper/enoahisolution/script.js')
  }
}

test('eNoah iSolution validates the verified zero-openings surface and returns no jobs', async () => {
  const enoah = await loadModule()

  assert.equal(enoah.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(enoah.extractJobsPageUrl(careersHtml), enoah.JOBS_PAGE_URL)
  assert.equal(enoah.hasZeroOpeningsSignal(jobsHtml), true)
  assert.equal(
    enoah.hasTrustworthyPublicJobsSignal(`
      ${jobsHtml}
      <div class="job_listing">Theme wrapper only</div>
    `),
    false,
  )

  const jobs = await enoah.createENoahISolutionScraper().run({
    fetchText: async (url) => {
      if (url === enoah.CAREERS_URL) return careersHtml
      if (url === enoah.JOBS_PAGE_URL) return jobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('eNoah iSolution fails closed if trustworthy public job cards appear', async () => {
  const enoah = await loadModule()

  await assert.rejects(
    enoah.createENoahISolutionScraper().run({
      fetchText: async (url) => {
        if (url === enoah.CAREERS_URL) return careersHtml
        return `
          ${jobsHtml}
          <section class="job_listing">
            <h2>Support Engineer</h2>
            <a href="https://enoahisolution.com/careers/jobs/support-engineer">Apply now</a>
          </section>
        `
      },
    }),
    /trustworthy public jobs surface/i,
  )
})
