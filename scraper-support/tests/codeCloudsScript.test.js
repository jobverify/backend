import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/codeclouds/script.js')
  } catch {
    assert.fail('Expected CodeClouds scraper module at ../../scraper/codeclouds/script.js')
  }
}

const zeroJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search Jobs at CodeClouds</title>
  </head>
  <body>
    <main>
      <h1>Search Jobs at CodeClouds</h1>
      <p>Discover your dream job at CodeClouds. Browse our current openings and apply now!</p>
      <p>Categories 34</p>
      <p>Showing 0 jobs</p>
      <p>No jobs found with current filters. Please adjust your criteria.</p>
      <a href="mailto:hiring@codeclouds.com">hiring@codeclouds.com</a>
    </main>
  </body>
</html>
`

const liveJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Search Jobs at CodeClouds</h1>
    <article>
      <h2>Senior PHP Developer</h2>
      <a href="/jobs/senior-php-developer/">Apply now</a>
    </article>
  </body>
</html>
`

test('CodeClouds sentinel pins the verified first-party zero-results jobs page', async () => {
  const codeClouds = await loadModule()

  assert.equal(codeClouds.SOURCE, 'codeclouds')
  assert.equal(codeClouds.COMPANY, 'CodeClouds')
  assert.equal(codeClouds.CAREERS_URL, 'https://careers.codeclouds.com/jobs/')
  assert.equal(codeClouds.VERIFIED_ON, '2026-07-17')
  assert.equal(codeClouds.hasVerifiedCareersSignal(zeroJobsHtml), true)
  assert.equal(codeClouds.hasVerifiedZeroJobsSignal(zeroJobsHtml), true)
  assert.equal(codeClouds.hasVerifiedZeroJobsSignal(liveJobsHtml), false)
})

test('CodeClouds returns [] only while the verified first-party jobs page stays in the zero-results state', async () => {
  const codeClouds = await loadModule()

  const jobs = await codeClouds.createCodeCloudsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, codeClouds.CAREERS_URL)
      return zeroJobsHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('CodeClouds fails closed when the verified jobs page drifts or starts exposing live postings', async () => {
  const codeClouds = await loadModule()

  await assert.rejects(
    codeClouds.createCodeCloudsScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified CodeClouds jobs page/i,
  )

  await assert.rejects(
    codeClouds.createCodeCloudsScraper().run({
      fetchText: async () => liveJobsHtml,
    }),
    /zero-results state/i,
  )
})
