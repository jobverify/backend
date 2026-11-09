import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
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
    <title>Rappit - Rappit</title>
  </head>
  <body>
    <main>
      <h1>Rappit</h1>
      <p>Platform for business users and developers.</p>
      <a href="https://rappit.io/about-us/">About Us</a>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About us | Rappit - Innovating IT Solutions for Enterprises</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Vanenburg software started in 2009.</p>
      <p>Vanenburg rebrands to Rappit in 2024.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Rappit - Join our team of experienced IT professionals</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Join our team of experienced IT professionals</p>
      <a href="https://rappit.io/vacancies/">Vacancies</a>
    </main>
  </body>
</html>
`

const vacanciesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vacancies - Rappit</title>
  </head>
  <body>
    <main>
      <h1>Vacancies</h1>
      <a href="https://rappit.io/vacancies/senior-sales-director/">Senior Sales Director</a>
    </main>
  </body>
</html>
`

const vacancyDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Sales Director - Rappit</title>
    <meta property="article:modified_time" content="2026-07-28T07:24:02+00:00" />
    <script type="application/ld+json">
      {"datePublished":"2026-07-24T13:45:36+00:00"}
    </script>
  </head>
  <body>
    <main>
      <h1><span>Senior Sales Director (Global)</span></h1>
      <div class="v-labels__label">Putten, The Netherlands</div>
      <div class="v-labels__label">Sales</div>
      <p class="intro">Due to the continued growth of our international sales activities, we are looking for a strategic and driven Senior Sales Director.</p>
      <h3>Profile</h3>
      <p>In this senior role, you will hold final responsibility for the global commercial strategy and execution.</p>
      <h3>Responsibilities</h3>
      <ul>
        <li><strong>Leadership &amp; coaching:</strong> Managing the international sales team.</li>
        <li><strong>Channel partner strategy:</strong> Building a strong international partner strategy.</li>
      </ul>
      <h3>We also require</h3>
      <ul>
        <li>Extensive enterprise software sales leadership experience.</li>
      </ul>
      <h3>What we offer</h3>
      <p>A competitive compensation package and remote work compensation.</p>
      <h3>About Rappit</h3>
      <p>Rappit has offices in Europe and India.</p>
      <h2>Interested? Apply for this role</h2>
    </main>
  </body>
</html>
`

test('Rappit validates the verified homepage, rebrand about page, careers page, and live vacancies board', async () => {
  const rappit = await loadModule()
  assert.ok(rappit, 'Rappit scraper module should load')

  assert.equal(rappit.SOURCE, 'rappit')
  assert.equal(rappit.COMPANY, 'Rappit')
  assert.equal(rappit.HOMEPAGE_URL, 'https://rappit.io/')
  assert.equal(rappit.ABOUT_URL, 'https://rappit.io/about-us/')
  assert.equal(rappit.CAREERS_URL, 'https://rappit.io/about-us/careers/')
  assert.equal(rappit.VACANCIES_URL, 'https://rappit.io/vacancies/')
  assert.equal(rappit.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(rappit.hasRebrandAboutSignal(aboutHtml), true)
  assert.equal(rappit.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(rappit.extractVacancyUrls(vacanciesHtml), [
    'https://rappit.io/vacancies/senior-sales-director/',
  ])

  const job = rappit.extractVacancyDetails(
    vacancyDetailHtml,
    'https://rappit.io/vacancies/senior-sales-director/',
  )

  assert.equal(job.title, 'Senior Sales Director (Global)')
  assert.equal(job.location, 'Putten, The Netherlands')
  assert.equal(job.city, 'Putten')
  assert.equal(job.country, 'The Netherlands')
  assert.equal(job.department, 'Sales')
  assert.equal(job.jobId, 'senior-sales-director')
  assert.equal(job.postingDate, '2026-07-24')
  assert.equal(job.lastUpdatedDate, '2026-07-28')
  assert.match(job.jobDescription, /continued growth of our international sales activities/i)
  assert.match(job.jobDescription, /global commercial strategy/i)
  assert.equal(job.requiredSkills.length, 3)
})

test('Rappit run returns the live first-party vacancies when the board exposes public job links', async () => {
  const rappit = await loadModule()
  assert.ok(rappit, 'Rappit scraper module should load')

  const requestedUrls = []
  const jobs = await rappit.createRappitScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === rappit.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === rappit.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === rappit.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === rappit.VACANCIES_URL) return { status: 200, url, html: vacanciesHtml }
      if (url === 'https://rappit.io/vacancies/senior-sales-director/') {
        return { status: 200, url, html: vacancyDetailHtml }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    rappit.HOMEPAGE_URL,
    rappit.ABOUT_URL,
    rappit.CAREERS_URL,
    rappit.VACANCIES_URL,
    'https://rappit.io/vacancies/senior-sales-director/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'rappit')
  assert.equal(jobs[0].link, 'https://rappit.io/vacancies/senior-sales-director/')
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})

test('Rappit fails closed when the homepage, about page, careers page, or first-party vacancy detail contract drifts', async () => {
  const rappit = await loadModule()
  assert.ok(rappit, 'Rappit scraper module should load')

  await assert.rejects(
    rappit.createRappitScraper().run({
      fetchPage: async (url) => {
        if (url === rappit.HOMEPAGE_URL) return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        if (url === rappit.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === rappit.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === rappit.VACANCIES_URL) return { status: 200, url, html: vacanciesHtml }
        return { status: 200, url, html: vacancyDetailHtml }
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    rappit.createRappitScraper().run({
      fetchPage: async (url) => {
        if (url === rappit.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === rappit.ABOUT_URL) return { status: 200, url, html: '<html><body><h1>About</h1></body></html>' }
        if (url === rappit.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === rappit.VACANCIES_URL) return { status: 200, url, html: vacanciesHtml }
        return { status: 200, url, html: vacancyDetailHtml }
      },
    }),
    /about page/i,
  )

  await assert.rejects(
    rappit.createRappitScraper().run({
      fetchPage: async (url) => {
        if (url === rappit.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === rappit.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === rappit.CAREERS_URL) return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        if (url === rappit.VACANCIES_URL) return { status: 200, url, html: vacanciesHtml }
        return { status: 200, url, html: vacancyDetailHtml }
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    rappit.createRappitScraper().run({
      fetchPage: async (url) => {
        if (url === rappit.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === rappit.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === rappit.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === rappit.VACANCIES_URL) return { status: 200, url, html: '<html><body><h1>Vacancies</h1></body></html>' }
        return { status: 200, url, html: vacancyDetailHtml }
      },
    }),
    /vacancies page/i,
  )

  await assert.rejects(
    rappit.createRappitScraper().run({
      fetchPage: async (url) => {
        if (url === rappit.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === rappit.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === rappit.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === rappit.VACANCIES_URL) return { status: 200, url, html: vacanciesHtml }
        return { status: 200, url, html: '<html><body><h1>Missing detail</h1></body></html>' }
      },
    }),
    /vacancy detail page/i,
  )
})
