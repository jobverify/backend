import assert from 'node:assert/strict'
import test from 'node:test'

const careersHomeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>M2P Fintech | Build your career in fintech with us</title>
    <link rel="canonical" href="https://careers.m2pfintech.com/" />
  </head>
  <body>
    <main>
      <h1><span>Ambitious</span><span>?</span> <span>You’ll</span> <em>fit right in.</em></h1>
      <p>At M2P, we <strong>don't just work</strong>, we build the future of fintech.</p>
      <a href="/view-jobs/">View Jobs</a>
      <a href="/view-jobs/">Join us</a>
    </main>
  </body>
</html>
`

const zeroJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>M2P Fintech | Careers | Job Listing</title>
  </head>
  <body>
    <main>
      <section class="banner-sec">
        <h1>Our Job Openings</h1>
        <p>Find your place with us, where opportunities meet your aspirations.</p>
      </section>
      <div class="not-found">
        <h4>No Jobs Found</h4>
        <p>Keep exploring this space.</p>
      </div>
    </main>
  </body>
</html>
`

const jobsVisibleHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>M2P Fintech | Careers | Job Listing</title>
  </head>
  <body>
    <main>
      <section class="banner-sec">
        <h1>Our Job Openings</h1>
      </section>
      <article class="job-card">
        <h2>SDE 1 - Java Developer</h2>
        <a href="/view-jobs/sde-1-java-developer">Apply</a>
      </article>
    </main>
  </body>
</html>
`

const loadM2PFintechModule = async () => {
  try {
    return await import('../../scraper/m2pfintech/script.js')
  } catch {
    assert.fail('Expected M2P Fintech scraper module at ../../scraper/m2pfintech/script.js')
  }
}

test('M2P Fintech helpers stay pinned to the verified careers homepage and zero-openings jobs page', async () => {
  const m2pFintech = await loadM2PFintechModule()

  assert.equal(m2pFintech.SOURCE, 'm2pfintech')
  assert.equal(m2pFintech.COMPANY, 'M2P Fintech')
  assert.equal(m2pFintech.CAREERS_HOME_URL, 'https://careers.m2pfintech.com/')
  assert.equal(m2pFintech.JOBS_PAGE_URL, 'https://careers.m2pfintech.com/view-jobs/')
  assert.equal(m2pFintech.hasVerifiedCareersHomeSignal(careersHomeHtml), true)
  assert.equal(
    m2pFintech.extractViewJobsUrl(careersHomeHtml),
    'https://careers.m2pfintech.com/view-jobs/',
  )
  assert.equal(m2pFintech.hasVerifiedZeroJobsPageSignal(zeroJobsHtml), true)
  assert.equal(m2pFintech.hasVerifiedZeroJobsPageSignal(jobsVisibleHtml), false)
})

test('M2P Fintech returns no jobs only while the verified first-party jobs page stays in the no-openings state', async () => {
  const m2pFintech = await loadM2PFintechModule()
  const requestedUrls = []

  const jobs = await m2pFintech.createM2PFintechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === m2pFintech.CAREERS_HOME_URL) return careersHomeHtml
      if (url === m2pFintech.JOBS_PAGE_URL) return zeroJobsHtml

      throw new Error(`Unexpected M2P Fintech fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    m2pFintech.CAREERS_HOME_URL,
    m2pFintech.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('M2P Fintech fails closed when the homepage handoff drifts or the jobs page starts exposing openings', async () => {
  const m2pFintech = await loadM2PFintechModule()

  await assert.rejects(
    m2pFintech.createM2PFintechScraper().run({
      fetchText: async (url) => {
        if (url === m2pFintech.CAREERS_HOME_URL) {
          return careersHomeHtml.replace('/view-jobs/', '/jobs/')
        }

        throw new Error(`Unexpected M2P Fintech fixture URL: ${url}`)
      },
    }),
    /verified view jobs handoff/i,
  )

  await assert.rejects(
    m2pFintech.createM2PFintechScraper().run({
      fetchText: async (url) => {
        if (url === m2pFintech.CAREERS_HOME_URL) return careersHomeHtml
        if (url === m2pFintech.JOBS_PAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'

        throw new Error(`Unexpected M2P Fintech fixture URL: ${url}`)
      },
    }),
    /verified zero-openings jobs page/i,
  )

  await assert.rejects(
    m2pFintech.createM2PFintechScraper().run({
      fetchText: async (url) => {
        if (url === m2pFintech.CAREERS_HOME_URL) return careersHomeHtml
        if (url === m2pFintech.JOBS_PAGE_URL) return jobsVisibleHtml

        throw new Error(`Unexpected M2P Fintech fixture URL: ${url}`)
      },
    }),
    /now exposes public openings/i,
  )
})
