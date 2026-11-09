import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eicher Trucks and Buses : Best-in-Class Commercial Vehicles in India</title>
  </head>
  <body>
    <a href="/careers">CAREERS</a>
    <h1>Eicher Trucks and Buses Leading the Way in Innovation and Reliability for the Future of Commercial Transportation</h1>
    <p>At Eicher, we drive relevant modernization via next-gen technology, sustainable solutions and connected vehicles.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Eicher Trucks & Buses</title>
  </head>
  <body>
    <h2>The Eicher Path to Progress</h2>
    <p>Welcome aboard an exciting journey.</p>
    <h4>Join our Family</h4>
    <p>Browse through the current openings and let the journey begin.</p>
    <a href="https://careers.vecv.in/" target="_blank">Explore Opportunities</a>
    <h4>Beware Of Fake Job Offers</h4>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Eicher Trucks Jobs</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://www.eichertrucksandbuses.com/apply">Apply now</a>
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

const loadEicherTrucksModule = async () => {
  try {
    return await import('../../scraper/eichertrucks/script.js')
  } catch {
    assert.fail('Expected Eicher Trucks scraper module at ../../scraper/eichertrucks/script.js')
  }
}

test('Eicher Trucks scraper constants stay pinned to the verified brand-site handoff no-public-jobs surface from July 15, 2026', async () => {
  const eicherTrucks = await loadEicherTrucksModule()

  assert.equal(eicherTrucks.SOURCE, 'eichertrucks')
  assert.equal(eicherTrucks.COMPANY, 'Eicher Trucks')
  assert.equal(eicherTrucks.OFFICIAL_BRAND_NAME, 'Eicher Trucks and Buses')
  assert.equal(eicherTrucks.VERIFIED_ON, '2026-07-15')
  assert.equal(eicherTrucks.HOMEPAGE_URL, 'https://www.eichertrucksandbuses.com/')
  assert.equal(eicherTrucks.CAREERS_PAGE_URL, 'https://www.eichertrucksandbuses.com/careers')
  assert.deepEqual(eicherTrucks.DIRECT_JOB_ROUTE_URLS, [
    'https://www.eichertrucksandbuses.com/career',
    'https://www.eichertrucksandbuses.com/jobs',
    'https://www.eichertrucksandbuses.com/current-openings',
    'https://www.eichertrucksandbuses.com/join-us',
  ])
  assert.deepEqual(eicherTrucks.LINKED_CAREER_URLS, [
    'https://careers.vecv.in/',
  ])
  assert.equal(eicherTrucks.VECV_CAREERS_URL, 'https://careers.vecv.in/')
  assert.match(eicherTrucks.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.match(eicherTrucks.VERIFIED_SURFACE_SUMMARY, /Eicher Trucks/i)
  assert.equal(eicherTrucks.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eicherTrucks.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(eicherTrucks.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(eicherTrucks.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(eicherTrucks.hasVecvCareerHandoffSignal(careersHtml), true)
  assert.equal(
    eicherTrucks.isMissingDirectJobRoute({
      status: 404,
      url: eicherTrucks.DIRECT_JOB_ROUTE_URLS[0],
      html: '',
    }),
    true,
  )
  assert.equal(eicherTrucks.isBlockedVecvCareersRoute(blockedVecvCareersPage), true)
})

test('Eicher Trucks returns [] only while the verified first-party careers surface remains a VECV handoff without public Eicher Trucks jobs', async () => {
  const eicherTrucks = await loadEicherTrucksModule()
  const requestedUrls = []

  const jobs = await eicherTrucks.createEicherTrucksScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eicherTrucks.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === eicherTrucks.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (eicherTrucks.DIRECT_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      if (url === eicherTrucks.VECV_CAREERS_URL) {
        return blockedVecvCareersPage
      }

      throw new Error(`Unexpected Eicher Trucks URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eicherTrucks.HOMEPAGE_URL,
    eicherTrucks.CAREERS_PAGE_URL,
    ...eicherTrucks.DIRECT_JOB_ROUTE_URLS,
    eicherTrucks.VECV_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Eicher Trucks fails closed when the homepage, careers page, direct job routes, or blocked VECV handoff drift', async () => {
  const eicherTrucks = await loadEicherTrucksModule()

  await assert.rejects(
    eicherTrucks.createEicherTrucksScraper().run({
      fetchPage: async (url) => {
        if (url === eicherTrucks.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Eicher Trucks URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    eicherTrucks.createEicherTrucksScraper().run({
      fetchPage: async (url) => {
        if (url === eicherTrucks.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eicherTrucks.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><title>Careers - Eicher Trucks & Buses</title></html>' }
        }

        throw new Error(`Unexpected Eicher Trucks URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    eicherTrucks.createEicherTrucksScraper().run({
      fetchPage: async (url) => {
        if (url === eicherTrucks.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eicherTrucks.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === eicherTrucks.DIRECT_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (url === eicherTrucks.VECV_CAREERS_URL) {
          return blockedVecvCareersPage
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-jobs route changed/i,
  )

  await assert.rejects(
    eicherTrucks.createEicherTrucksScraper().run({
      fetchPage: async (url) => {
        if (url === eicherTrucks.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === eicherTrucks.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (eicherTrucks.DIRECT_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '' }
        }

        if (url === eicherTrucks.VECV_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected Eicher Trucks URL: ${url}`)
      },
    }),
    /verified vecv careers handoff/i,
  )
})
