import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/gainsight/script.js')
  } catch {
    assert.fail('Expected Gainsight scraper module at ../../scraper/gainsight/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Culture | Gainsight Software</title>
  </head>
  <body>
    <h1>Find Authentic Jobs</h1>
    <p>Gainsight Software</p>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Culture | Gainsight Software</title>
  </head>
  <body>
    <nav>Company Careers &amp; Culture</nav>
    <h1>Careers at Gainsight</h1>
    <p>The work you and the real you are the same.</p>
    <h2>Find Your Dream Job</h2>
    <p>Human-First isn't just a slogan.</p>
    <p>Gainsight Software</p>
  </body>
</html>
`

const jobsShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gainsight Careers</title>
    <script>
      window._jibe = {"cid":"gainsight"};
    </script>
  </head>
  <body>
    <div class="search-results-none"></div>
    <a href="/Join-Our-Talent-Network/talentcommunity">Join Our Talent Community</a>
  </body>
</html>
`

const locationsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gainsight Careers</title>
  </head>
  <body>
    <h2>By City</h2>
    <p>No cities</p>
    <p>No country</p>
  </body>
</html>
`

test('Gainsight validates the verified first-party careers page and empty Jibe shell signals', async () => {
  const gainsight = await loadModule()

  assert.equal(gainsight.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(gainsight.hasOfficialCareersPageSignal(currentCareersHtml), true)
  assert.equal(gainsight.extractJibeCompanyId(jobsShellHtml), 'gainsight')
  assert.equal(gainsight.hasEmptyJobsShellSignal(jobsShellHtml), true)
  assert.equal(gainsight.hasEmptyLocationsSignal(locationsHtml), true)
  assert.equal(gainsight.hasPublicJobSignal(jobsShellHtml), false)
})

test('Gainsight run returns [] only while the verified first-party Jibe shell stays empty', async () => {
  const gainsight = await loadModule()
  const requestedUrls = []

  const jobs = await gainsight.createGainsightScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === gainsight.CAREERS_URL) return careersHtml
      if (url === gainsight.JOBS_SHELL_URL) return jobsShellHtml
      if (url === gainsight.LOCATIONS_URL) return locationsHtml
      throw new Error(`Unexpected Gainsight URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    gainsight.CAREERS_URL,
    gainsight.JOBS_SHELL_URL,
    gainsight.LOCATIONS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Gainsight fails closed when public jobs appear or the empty-shell signals drift', async () => {
  const gainsight = await loadModule()

  await assert.rejects(
    gainsight.createGainsightScraper().run({
      fetchText: async (url) => {
        if (url === gainsight.CAREERS_URL) return careersHtml
        if (url === gainsight.JOBS_SHELL_URL) {
          return jobsShellHtml.replace(
            '</body>',
            '<a href="/jobs/software-engineer">Software Engineer</a></body>',
          )
        }
        return locationsHtml
      },
    }),
    /now appears to expose public jobs/i,
  )

  await assert.rejects(
    gainsight.createGainsightScraper().run({
      fetchText: async (url) => {
        if (url === gainsight.CAREERS_URL) return careersHtml
        if (url === gainsight.JOBS_SHELL_URL) return '<html><body><h1>Unexpected shell</h1></body></html>'
        return locationsHtml
      },
    }),
    /verified empty first-party Jibe shell changed materially/i,
  )
})
