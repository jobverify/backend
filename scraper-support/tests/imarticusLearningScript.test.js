import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>ISFB - India's First Finance Focused School</p>
      <h1>Real Learning that delivers your career goals</h1>
      <p>Unmatched Outcomes from job-ready, certification, and executive programs</p>
      <p>All Programs</p>
    </main>
  </body>
</html>
`

const careerServicesHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>ISFB - India's First Finance Focused School</p>
      <h1>Real Learning that delivers your career goals</h1>
      <p>Unmatched Outcomes from job-ready, certification, and executive programs</p>
      <p>All Programs</p>
    </main>
  </body>
</html>
`

const currentHomepageHtml = homepageHtml.replace(
  "ISFB - India's First Finance Focused School",
  "ISFB - India's First Finance Focused B-School",
)

const homepageWithCareerOpportunitiesCopyHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>ISFB - India's First Finance Focused School</p>
      <h1>Real Learning that delivers your career goals</h1>
      <p>Unmatched Outcomes from job-ready, certification, and executive programs</p>
      <p>Our learners unlock career opportunities through industry-aligned programs.</p>
      <p>All Programs</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Imarticus Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Business Analyst"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.example.com/imarticus/business-analyst">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/imarticuslearning/script.js')
  } catch {
    assert.fail('Expected Imarticus Learning scraper module at ../../scraper/imarticuslearning/script.js')
  }
}

test('Imarticus Learning helpers stay pinned to the verified redirected no-jobs first-party surface', async () => {
  const imarticusLearning = await loadModule()

  assert.equal(imarticusLearning.SOURCE, 'imarticuslearning')
  assert.equal(imarticusLearning.COMPANY, 'Imarticus Learning')
  assert.equal(imarticusLearning.HOMEPAGE_URL, 'https://imarticus.org/')
  assert.equal(imarticusLearning.CAREERS_URL, 'https://imarticus.org/careers/')
  assert.equal(
    imarticusLearning.CANONICAL_CAREER_SERVICES_URL,
    'https://imarticus.org/',
  )
  assert.equal(imarticusLearning.COMPANY_DOMAIN, 'imarticus.org')
  assert.equal(imarticusLearning.VERIFIED_ON, '2026-08-02')
  assert.equal(imarticusLearning.extractCareerPageUrl(homepageHtml), null)
  assert.equal(imarticusLearning.hasVerifiedHomepageSignals(homepageHtml), true)
  assert.equal(imarticusLearning.hasVerifiedHomepageSignals(currentHomepageHtml), true)
  assert.equal(imarticusLearning.hasVerifiedCareerServicesSignals(careerServicesHtml), true)
  assert.equal(imarticusLearning.hasPublicEmployerJobSignals(careerServicesHtml), false)
  assert.equal(imarticusLearning.hasPublicEmployerJobSignals(homepageWithCareerOpportunitiesCopyHtml), false)
  assert.equal(imarticusLearning.hasPublicEmployerJobSignals(publicJobsHtml), true)
})

test('Imarticus Learning returns [] while the verified first-party surface remains a redirected no-jobs homepage', async () => {
  const imarticusLearning = await loadModule()
  const requestedUrls = []

  const jobs = await imarticusLearning.createImarticusLearningScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === imarticusLearning.HOMEPAGE_URL) return homepageHtml
      if (url === imarticusLearning.CAREERS_URL) return careerServicesHtml
      throw new Error(`Unexpected Imarticus Learning URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    imarticusLearning.HOMEPAGE_URL,
    imarticusLearning.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Imarticus Learning fails closed when the homepage drifts or the careers surface turns into an employer jobs page', async () => {
  const imarticusLearning = await loadModule()

  await assert.rejects(
    imarticusLearning.run({
      fetchText: async (url) => {
        if (url === imarticusLearning.HOMEPAGE_URL) {
          return homepageHtml.replace('All Programs', 'Unexpected')
        }
        if (url === imarticusLearning.CAREERS_URL) return careerServicesHtml
        throw new Error(`Unexpected Imarticus Learning URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    imarticusLearning.run({
      fetchText: async (url) => {
        if (url === imarticusLearning.HOMEPAGE_URL) return homepageHtml
        if (url === imarticusLearning.CAREERS_URL) return '<html><body><h1>Different page</h1></body></html>'
        throw new Error(`Unexpected Imarticus Learning URL: ${url}`)
      },
    }),
    /verified career services page/i,
  )

  await assert.rejects(
    imarticusLearning.run({
      fetchText: async (url) => {
        if (url === imarticusLearning.HOMEPAGE_URL) return homepageHtml
        if (url === imarticusLearning.CAREERS_URL) return publicJobsHtml
        throw new Error(`Unexpected Imarticus Learning URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
