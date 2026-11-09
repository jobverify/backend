import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Exide - India's largest selling batteries</title>
  </head>
  <body>
    <nav>
      <a href="https://careers.exideindustries.com/">CAREERS</a>
    </nav>
    <section>
      <h2>Automotive Batteries</h2>
      <h2>Inverter Batteries</h2>
    </section>
  </body>
</html>
`

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>:: EXIDE CAREERS ::</title>
  </head>
  <body>
    <nav>
      <a href="https://www.exideindustries.com/">About Exide</a>
      <a href="/opportunities-exide/interns.aspx">Interns</a>
      <a href="/opportunities-exide/professionals.aspx">Professionals</a>
      <a href="/current-vacancy.aspx">Vacancies @ Exide</a>
    </nav>
    <section>
      <h2>EXIDE EXCITES</h2>
      <p>Discover the promise of Exide</p>
    </section>
  </body>
</html>
`

const currentVacancyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>:: EXIDE CAREERS - Current Vacancy ::</title>
  </head>
  <body>
    <h1>Current Vacancy</h1>
    <p>We could not find you any jobs.</p>
    <p>No jobs are posted right now. However, please drop your profile through 'Drop CV' on this page, so we can contact you in case we have any job openings matching your profile, in the future.</p>
    <ul>
      <li><a href="https://www.naukri.com/job-listings-territory-executive-home-exide-industries-kolkata-2-to-3-years-100725013754">Territory Executive-Home</a></li>
      <li><a href="https://www.naukri.com/job-listings-design-engineer-rooftop-solar-solutions-kolkata-exide-industries-kolkata-2-to-3-years-100725013755">Design Engineer-Rooftop Solar Solutions Kolkata</a></li>
    </ul>
    <h4>Drop your CV here</h4>
    <a href="/drop-cv.aspx">Drop CV</a>
  </body>
</html>
`

const dropCvHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>:: EXIDE CAREERS - Current Vacancy ::</title>
  </head>
  <body>
    <h1>Drop your CV</h1>
    <form>
      <label>upload CV in Word/PDF format (NOTE : Allowable file type is .doc,.docx,.pdf.</label>
      <p>Maximum file size is 2 MB)</p>
      <p>Enter image verification code</p>
    </form>
  </body>
</html>
`

const loadExideIndustriesModule = async () => {
  try {
    return await import('../../scraper/exideindustries/script.js')
  } catch {
    assert.fail('Expected Exide Industries scraper module at ../../scraper/exideindustries/script.js')
  }
}

test('Exide Industries scraper constants and helpers stay pinned to the verified no-public-jobs contract from July 15, 2026', async () => {
  const exideIndustries = await loadExideIndustriesModule()

  assert.equal(exideIndustries.SOURCE, 'exideindustries')
  assert.equal(exideIndustries.COMPANY, 'Exide Industries')
  assert.equal(exideIndustries.OFFICIAL_BRAND_NAME, 'Exide Industries Limited')
  assert.equal(exideIndustries.VERIFIED_ON, '2026-07-15')
  assert.equal(exideIndustries.HOMEPAGE_URL, 'https://www.exideindustries.com/')
  assert.equal(exideIndustries.CAREERS_LANDING_URL, 'https://careers.exideindustries.com/')
  assert.equal(exideIndustries.CURRENT_VACANCY_URL, 'https://careers.exideindustries.com/current-vacancy.aspx')
  assert.equal(exideIndustries.DROP_CV_URL, 'https://careers.exideindustries.com/drop-cv.aspx')
  assert.equal(exideIndustries.EXTERNAL_JOBS_HOST, 'www.naukri.com')
  assert.match(exideIndustries.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(exideIndustries.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(exideIndustries.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(exideIndustries.hasExternalNaukriHandoffSignal(currentVacancyHtml), true)
  assert.equal(exideIndustries.hasNoPublicJobsCurrentVacancySignal(currentVacancyHtml), true)
  assert.equal(exideIndustries.hasDropCvSignal(dropCvHtml), true)
})

test('Exide Industries returns [] only while the verified first-party surface remains a contradictory no-public-jobs handoff', async () => {
  const exideIndustries = await loadExideIndustriesModule()
  const requestedUrls = []

  const jobs = await exideIndustries.createExideIndustriesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === exideIndustries.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === exideIndustries.CAREERS_LANDING_URL) {
        return { status: 200, url, html: careersLandingHtml }
      }

      if (url === exideIndustries.CURRENT_VACANCY_URL) {
        return { status: 200, url, html: currentVacancyHtml }
      }

      if (url === exideIndustries.DROP_CV_URL) {
        return { status: 200, url, html: dropCvHtml }
      }

      throw new Error(`Unexpected Exide Industries URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    exideIndustries.HOMEPAGE_URL,
    exideIndustries.CAREERS_LANDING_URL,
    exideIndustries.CURRENT_VACANCY_URL,
    exideIndustries.DROP_CV_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Exide Industries fails closed when the verified homepage, careers shell, vacancy page, or drop-cv form drift', async () => {
  const exideIndustries = await loadExideIndustriesModule()

  await assert.rejects(
    exideIndustries.createExideIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === exideIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Exide Industries URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    exideIndustries.createExideIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === exideIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === exideIndustries.CAREERS_LANDING_URL) {
          return { status: 200, url, html: '<html><title>:: EXIDE CAREERS ::</title></html>' }
        }

        throw new Error(`Unexpected Exide Industries URL: ${url}`)
      },
    }),
    /verified careers landing page/i,
  )

  await assert.rejects(
    exideIndustries.createExideIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === exideIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === exideIndustries.CAREERS_LANDING_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === exideIndustries.CURRENT_VACANCY_URL) {
          return {
            status: 200,
            url,
            html: currentVacancyHtml.replace('We could not find you any jobs.', 'Current openings are live.'),
          }
        }

        throw new Error(`Unexpected Exide Industries URL: ${url}`)
      },
    }),
    /verified current vacancy no-public-jobs handoff/i,
  )

  await assert.rejects(
    exideIndustries.createExideIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === exideIndustries.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === exideIndustries.CAREERS_LANDING_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === exideIndustries.CURRENT_VACANCY_URL) {
          return { status: 200, url, html: currentVacancyHtml }
        }

        if (url === exideIndustries.DROP_CV_URL) {
          return { status: 200, url, html: '<html><body><h1>Drop your CV</h1></body></html>' }
        }

        throw new Error(`Unexpected Exide Industries URL: ${url}`)
      },
    }),
    /verified drop cv form/i,
  )
})
