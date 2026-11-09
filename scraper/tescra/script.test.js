import assert from 'node:assert/strict'
import test from 'node:test'

const loadTescraModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tescra</title>
  </head>
  <body>
    <header>
      <a href="https://www.tescra.com/">Home</a>
      <a href="https://www.tescra.com/current-openings/">Current Openings</a>
    </header>
    <main>
      <h2>Software Advisory Services</h2>
      <p>At Tescra, we drive digital transformation through cutting-edge technology and innovative solutions.</p>
      <p>Trusted by Fortune companies Worldwide</p>
    </main>
  </body>
</html>
`

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings – Tescra</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <section>
      <div class="elementor-icon-box-content">
        <h3 class="elementor-icon-box-title"><span>Software Engineer_Full Stack</span></h3>
        <p class="elementor-icon-box-description"><b>Must Have : </b>C#, ASP.NET framework, .NET CORE, HTML, ANGULAR</p>
      </div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/6843b60ab74bb8d18e738104?type=default&amp;uid=6843b60ab74bb8d18e738104&amp;mod=jobs">
          <span class="elementor-button-text">Easy Apply</span>
        </a>
      </div>
    </section>
    <section>
      <div class="elementor-icon-box-content">
        <h3 class="elementor-icon-box-title"><span>Qa Automation Engineer</span></h3>
        <p class="elementor-icon-box-description"><b>Must Have : </b>SELENIUM, AUTOMATION, JAVASCRIPT, NODE, BDD</p>
      </div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67f4c22c964d3b8986247cf4?type=default&amp;uid=67f4c22c964d3b8986247cf4&amp;mod=jobs">
          <span class="elementor-button-text">Easy Apply</span>
        </a>
      </div>
    </section>
    <section>
      <div class="elementor-icon-box-content">
        <h3 class="elementor-icon-box-title"><span>Customer Excellence Data Analysts</span></h3>
        <p class="elementor-icon-box-description"><b>Must Have : </b>DATA VISUALIZATION, POWER BI, PYTHON, MYSQL</p>
      </div>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67ee3b37470c11a71b785aa3?navigation=opportunity-&amp;companyName=undefined&amp;location=undefined&amp;recentWorkType=undefined&amp;resultsStartIndex=10&amp;type=default&amp;uid=67ee3b37470c11a71b785aa3&amp;mod=jobs">
          <span class="elementor-button-text">Easy Apply</span>
        </a>
      </div>
    </section>
    <footer>
      <a href="https://www.linkedin.com/company/tescra">Linkedin</a>
    </footer>
  </body>
</html>
`

const achnetErrorShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="document-not-found">
      <div class="not-found-text"><h1>Something Went Wrong</h1></div>
      <div class="not-found-text">We have encountered an unexpected error. Please try again after some time.</div>
    </div>
  </body>
</html>
`

test('TESCRA scraper recognizes the verified homepage and current openings page', async () => {
  const tescra = await loadTescraModule()
  assert.ok(tescra, 'Expected scraper module at ./script.js')

  assert.equal(tescra.SOURCE, 'tescra')
  assert.equal(tescra.COMPANY, 'TESCRA')
  assert.equal(tescra.HOMEPAGE_URL, 'https://www.tescra.com/')
  assert.equal(tescra.CURRENT_OPENINGS_URL, 'https://www.tescra.com/current-openings/')
  assert.equal(tescra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tescra.hasCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.deepEqual(tescra.extractJobCards(currentOpeningsHtml), [
    {
      title: 'Software Engineer_Full Stack',
      description: 'Must Have : C#, ASP.NET framework, .NET CORE, HTML, ANGULAR',
      sourceUrl: 'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/6843b60ab74bb8d18e738104?type=default&uid=6843b60ab74bb8d18e738104&mod=jobs',
      applyUrl: 'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/6843b60ab74bb8d18e738104?type=default&uid=6843b60ab74bb8d18e738104&mod=jobs',
    },
    {
      title: 'Qa Automation Engineer',
      description: 'Must Have : SELENIUM, AUTOMATION, JAVASCRIPT, NODE, BDD',
      sourceUrl: 'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67f4c22c964d3b8986247cf4?type=default&uid=67f4c22c964d3b8986247cf4&mod=jobs',
      applyUrl: 'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67f4c22c964d3b8986247cf4?type=default&uid=67f4c22c964d3b8986247cf4&mod=jobs',
    },
    {
      title: 'Customer Excellence Data Analysts',
      description: 'Must Have : DATA VISUALIZATION, POWER BI, PYTHON, MYSQL',
      sourceUrl: 'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67ee3b37470c11a71b785aa3?navigation=opportunity-&companyName=undefined&location=undefined&recentWorkType=undefined&resultsStartIndex=10&type=default&uid=67ee3b37470c11a71b785aa3&mod=jobs',
      applyUrl: 'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67ee3b37470c11a71b785aa3?navigation=opportunity-&companyName=undefined&location=undefined&recentWorkType=undefined&resultsStartIndex=10&type=default&uid=67ee3b37470c11a71b785aa3&mod=jobs',
    },
  ])
})

test('TESCRA scraper run() fetches the official homepage and first-party current openings page', async () => {
  const tescra = await loadTescraModule()
  assert.ok(tescra, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await tescra.createTescraScraper({
    now: () => '2026-08-05T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tescra.HOMEPAGE_URL) return homepageHtml
      if (url === tescra.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tescra.HOMEPAGE_URL,
    tescra.CURRENT_OPENINGS_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'tescra')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-05T00:00:00.000Z')
})

test('TESCRA scraper marks jobs as verified-missing when the live ACHNET detail pages resolve to the current public error shell', async () => {
  const tescra = await loadTescraModule()
  assert.ok(tescra, 'Expected scraper module at ./script.js')

  const requestedDetailUrls = []
  const jobs = await tescra.createTescraScraper({
    now: () => '2026-08-05T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === tescra.HOMEPAGE_URL) return homepageHtml
      if (url === tescra.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPublicJobText: async (url) => {
      requestedDetailUrls.push(url)
      return achnetErrorShellHtml
    },
  })

  assert.deepEqual(requestedDetailUrls, [
    'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/6843b60ab74bb8d18e738104?type=default&uid=6843b60ab74bb8d18e738104&mod=jobs',
    'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67f4c22c964d3b8986247cf4?type=default&uid=67f4c22c964d3b8986247cf4&mod=jobs',
    'https://www.achnet.com/business/59b8fbbb0f97e21b3ca67a33/public/careers/67ee3b37470c11a71b785aa3?navigation=opportunity-&companyName=undefined&location=undefined&recentWorkType=undefined&resultsStartIndex=10&type=default&uid=67ee3b37470c11a71b785aa3&mod=jobs',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[2].publicExperienceChecked, true)
})

test('TESCRA scraper serializes ACHNET detail checks when a single browser-backed fetcher is used', async () => {
  const tescra = await loadTescraModule()
  assert.ok(tescra, 'Expected scraper module at ./script.js')

  let activeRequests = 0
  let maxConcurrentRequests = 0

  const jobs = await tescra.createTescraScraper({
    now: () => '2026-08-05T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === tescra.HOMEPAGE_URL) return homepageHtml
      if (url === tescra.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPublicJobText: async () => {
      activeRequests += 1
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeRequests -= 1
      return achnetErrorShellHtml
    },
  })

  assert.equal(maxConcurrentRequests, 1)
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[2].publicExperienceChecked, true)
})

test('TESCRA scraper fails closed when the verified public surface drifts', async () => {
  const tescra = await loadTescraModule()
  assert.ok(tescra, 'Expected scraper module at ./script.js')

  await assert.rejects(
    tescra.createTescraScraper().run({
      fetchText: async (url) => {
        if (url === tescra.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    tescra.createTescraScraper().run({
      fetchText: async (url) => {
        if (url === tescra.HOMEPAGE_URL) return homepageHtml
        if (url === tescra.CURRENT_OPENINGS_URL) return '<html><body><h1>Current Openings</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified current openings/i,
  )
})
