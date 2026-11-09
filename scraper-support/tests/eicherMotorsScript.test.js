import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eicher :: Eicher Motors Limited :: Home</title>
  </head>
  <body>
    <a href="/careers">CAREERS</a>
    <p>Incorporated in 1982, Eicher Motors Limited is the flagship company of the Eicher Group in India and a leading player of the Indian automobile industry.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career- Eicher</title>
  </head>
  <body>
    <h2>CAREERS</h2>
    <p>At Eicher, challenges appear every day and our people rise to the occasion.</p>
    <p>Visit Careers at <a href="http://royalenfield.com/aboutus/careers/" target="_blank" title="Royal Enfield">Royal Enfield</a></p>
    <p>Visit Careers at <a href="http://careers.vecv.in/" target="_blank" title="VECV">VECV</a></p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eicher Jobs</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://www.eicher.in/apply">Apply now</a>
  </body>
</html>
`

const blockedVecvCareersPage = {
  status: 403,
  url: 'https://careers.vecv.in/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Attention Required! | Cloudflare</title>
      </head>
      <body>
        <h1>Forbidden</h1>
        <p>cf-mitigated challenge</p>
      </body>
    </html>
  `,
}

const loadEicherMotorsModule = async () => {
  try {
    return await import('../../scraper/eichermotors/script.js')
  } catch {
    assert.fail('Expected Eicher Motors scraper module at ../../scraper/eichermotors/script.js')
  }
}

test('Eicher Motors scraper constants stay pinned to the verified subsidiary-handoff no-public-jobs surface from July 15, 2026', async () => {
  const eicherMotors = await loadEicherMotorsModule()

  assert.equal(eicherMotors.SOURCE, 'eichermotors')
  assert.equal(eicherMotors.COMPANY, 'Eicher Motors')
  assert.equal(eicherMotors.OFFICIAL_BRAND_NAME, 'Eicher Motors Limited')
  assert.equal(eicherMotors.VERIFIED_ON, '2026-07-15')
  assert.equal(eicherMotors.HOMEPAGE_URL, 'https://www.eicher.in/')
  assert.equal(eicherMotors.CAREERS_PAGE_URL, 'https://www.eicher.in/careers')
  assert.deepEqual(eicherMotors.DIRECT_JOB_ROUTE_URLS, [
    'https://www.eicher.in/career',
    'https://www.eicher.in/jobs',
    'https://www.eicher.in/current-openings',
  ])
  assert.deepEqual(eicherMotors.LINKED_CAREER_URLS, [
    'http://royalenfield.com/aboutus/careers/',
    'http://careers.vecv.in/',
  ])
  assert.equal(eicherMotors.VECV_CAREERS_URL, 'https://careers.vecv.in/')
  assert.match(eicherMotors.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.match(eicherMotors.VERIFIED_SURFACE_SUMMARY, /Eicher Motors/i)
  assert.equal(eicherMotors.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eicherMotors.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(eicherMotors.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(eicherMotors.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(eicherMotors.hasSubsidiaryCareerHandoffSignal(careersHtml), true)
  assert.equal(
    eicherMotors.isMissingDirectJobRoute({
      status: 404,
      url: eicherMotors.DIRECT_JOB_ROUTE_URLS[0],
      html: '',
    }),
    true,
  )
  assert.equal(eicherMotors.isBlockedVecvCareersRoute(blockedVecvCareersPage), true)
})

test('Eicher Motors returns [] only while the verified first-party careers surface remains a subsidiary handoff without public Eicher Motors jobs', async () => {
  const eicherMotors = await loadEicherMotorsModule()
  const requestedUrls = []

  const jobs = await eicherMotors.createEicherMotorsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eicherMotors.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === eicherMotors.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (eicherMotors.DIRECT_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      if (url === eicherMotors.VECV_CAREERS_URL) {
        return blockedVecvCareersPage
      }

      throw new Error(`Unexpected Eicher Motors URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eicherMotors.HOMEPAGE_URL,
    eicherMotors.CAREERS_PAGE_URL,
    ...eicherMotors.DIRECT_JOB_ROUTE_URLS,
    eicherMotors.VECV_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Eicher Motors fails closed when the homepage, careers page, direct job routes, or blocked VECV handoff drift', async () => {
  const eicherMotors = await loadEicherMotorsModule()

  await assert.rejects(
    eicherMotors.createEicherMotorsScraper().run({
      fetchPage: async (url) => {
        if (url === eicherMotors.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Eicher Motors URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    eicherMotors.createEicherMotorsScraper().run({
      fetchPage: async (url) => {
        if (url === eicherMotors.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eicherMotors.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><title>Career- Eicher</title></html>' }
        }

        throw new Error(`Unexpected Eicher Motors URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    eicherMotors.createEicherMotorsScraper().run({
      fetchPage: async (url) => {
        if (url === eicherMotors.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eicherMotors.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === eicherMotors.DIRECT_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url === eicherMotors.VECV_CAREERS_URL) {
          return blockedVecvCareersPage
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-jobs route changed/i,
  )

  await assert.rejects(
    eicherMotors.createEicherMotorsScraper().run({
      fetchPage: async (url) => {
        if (url === eicherMotors.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eicherMotors.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (eicherMotors.DIRECT_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '' }
        }

        if (url === eicherMotors.VECV_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected Eicher Motors URL: ${url}`)
      },
    }),
    /verified vecv careers handoff/i,
  )
})
