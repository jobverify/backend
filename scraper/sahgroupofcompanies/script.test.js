import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SAH Group of Companies scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SAH - Coming Soon</title>
  </head>
  <body>
    <main>
      <h1>Coming Soon</h1>
      <p>SAH</p>
      <p>We are working hard to launch our website.</p>
    </main>
  </body>
</html>
`

const missingCareersPage = {
  url: 'https://www.sah.co.in/careers',
  status: 404,
  text: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found</title>
      </head>
      <body>
        <h1>404</h1>
      </body>
    </html>
  `,
}

const missingJobsPage = {
  url: 'https://www.sah.co.in/jobs',
  status: 404,
  text: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found</title>
      </head>
      <body>
        <h1>404</h1>
      </body>
    </html>
  `,
}

test('SAH Group of Companies sentinel pins the verified first-party homepage and missing careers surfaces', async () => {
  const sah = await loadModule()

  assert.equal(sah.SOURCE, 'sahgroupofcompanies')
  assert.equal(sah.COMPANY, 'SAH Group of Companies')
  assert.equal(sah.HOMEPAGE_URL, 'https://www.sah.co.in/')
  assert.equal(sah.CAREERS_PAGE_URL, 'https://www.sah.co.in/careers')
  assert.equal(sah.JOBS_PAGE_URL, 'https://www.sah.co.in/jobs')
  assert.deepEqual(sah.OFFICIAL_SURFACE_URLS, [
    'https://www.sah.co.in/',
    'https://www.sah.co.in/careers',
    'https://www.sah.co.in/jobs',
  ])
  assert.equal(sah.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(sah.isVerifiedMissingJobsPage(missingCareersPage), true)
  assert.equal(sah.isVerifiedMissingJobsPage(missingJobsPage), true)
})

test('SAH Group of Companies sentinel returns no jobs while the verified first-party site remains a placeholder with no public careers pages', async () => {
  const sah = await loadModule()
  const requestedPages = []

  const jobs = await sah.createSahGroupOfCompaniesScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === sah.HOMEPAGE_URL) {
        return {
          url,
          status: 200,
          text: officialHomepageHtml,
        }
      }

      if (url === sah.CAREERS_PAGE_URL) {
        return missingCareersPage
      }

      if (url === sah.JOBS_PAGE_URL) {
        return missingJobsPage
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    sah.HOMEPAGE_URL,
    sah.CAREERS_PAGE_URL,
    sah.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SAH Group of Companies sentinel fails closed when the placeholder homepage or missing-jobs contract drifts', async () => {
  const sah = await loadModule()

  await assert.rejects(
    sah.createSahGroupOfCompaniesScraper().run({
      fetchPage: async (url) => {
        if (url === sah.HOMEPAGE_URL) {
          return {
            url,
            status: 200,
            text: '<html><head><title>Careers</title></head><body>Open Roles</body></html>',
          }
        }

        if (url === sah.CAREERS_PAGE_URL) {
          return missingCareersPage
        }

        if (url === sah.JOBS_PAGE_URL) {
          return missingJobsPage
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /verified SAH homepage/i,
  )

  await assert.rejects(
    sah.createSahGroupOfCompaniesScraper().run({
      fetchPage: async (url) => {
        if (url === sah.HOMEPAGE_URL) {
          return {
            url,
            status: 200,
            text: officialHomepageHtml,
          }
        }

        if (url === sah.CAREERS_PAGE_URL) {
          return {
            url,
            status: 200,
            text: '<html><head><title>Careers</title></head><body>Apply now</body></html>',
          }
        }

        if (url === sah.JOBS_PAGE_URL) {
          return missingJobsPage
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /verified missing careers page/i,
  )

  await assert.rejects(
    sah.createSahGroupOfCompaniesScraper().run({
      fetchPage: async (url) => {
        if (url === sah.HOMEPAGE_URL) {
          return {
            url,
            status: 200,
            text: officialHomepageHtml,
          }
        }

        if (url === sah.CAREERS_PAGE_URL) {
          return missingCareersPage
        }

        if (url === sah.JOBS_PAGE_URL) {
          return {
            url,
            status: 302,
            text: '',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /verified missing jobs page/i,
  )
})
