import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India's Largest Lending Platform - Apply for a Personal Loan | Fibe</title>
  </head>
  <body>
    <main>
      <h1>India's Largest Lending Platform</h1>
      <a href="/careers/"><span>Careers</span></a>
      <p>Explore jobs at Fibe that best suits your passion and dreams</p>
    </main>
  </body>
</html>
`

const emptyCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Join our Team | Fibe</title>
    <link rel="canonical" href="https://www.fibe.in/careers/" />
  </head>
  <body>
    <main>
      <h1>Join us in building digital financial solutions</h1>
      <h2>Be a Part of Fibe</h2>
      <div>No Jobs found</div>
      <div>Rewards and recognition keep us going</div>
    </main>
  </body>
</html>
`

const jobs404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>India&#x27;s Largest Lending Platform | Fibe (formerly EarlySalary</title>
  </head>
  <body>
    <main>
      <h2>Page Not Found</h2>
      <a href="/">Go to homepage</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Join our Team | Fibe</title>
    <link rel="canonical" href="https://www.fibe.in/careers/" />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer"}
    </script>
  </head>
  <body>
    <main>
      <h1>Join us in building digital financial solutions</h1>
      <h2>Be a Part of Fibe</h2>
      <div>Open jobs</div>
      <a href="/careers/software-engineer">Apply now</a>
      <script>
        window.__DATA__ = {
          "currentjobopenings": {
            "currentjobopeningsdepts": [{"title":"Engineering"}]
          }
        }
      </script>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fibe/script.js')
  } catch {
    assert.fail('Expected Fibe scraper module at ../../scraper/fibe/script.js')
  }
}

test('Fibe helpers stay pinned to the verified first-party empty careers contract', async () => {
  const fibe = await loadModule()

  assert.equal(fibe.COMPANY, 'Fibe')
  assert.equal(fibe.SOURCE, 'fibe')
  assert.equal(fibe.HOMEPAGE_URL, 'https://www.fibe.in/')
  assert.equal(fibe.CAREERS_URL, 'https://www.fibe.in/careers/')
  assert.equal(fibe.JOBS_URL, 'https://www.fibe.in/jobs')
  assert.equal(fibe.VERIFIED_ON, '2026-07-15')
  assert.match(fibe.VERIFIED_SURFACE_SUMMARY, /No Jobs found/i)
  assert.equal(
    fibe.extractHomepageCareersUrl(homepageHtml),
    'https://www.fibe.in/careers/',
  )
  assert.equal(fibe.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fibe.hasOfficialCareersPageSignal(emptyCareersPageHtml), true)
  assert.equal(fibe.hasEmptyJobsStateSignal(emptyCareersPageHtml), true)
  assert.equal(fibe.pageExposesPublicJobListings(emptyCareersPageHtml), false)
  assert.equal(fibe.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    fibe.isVerifiedMissingJobsRoute(
      { status: 404, url: 'https://www.fibe.in/jobs/', html: jobs404Html },
    ),
    true,
  )
})

test('Fibe returns no jobs while the verified careers page remains first-party and empty', async () => {
  const fibe = await loadModule()
  const requestedUrls = []

  const jobs = await fibe.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === fibe.HOMEPAGE_URL) {
        return {
          status: 200,
          url: fibe.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === fibe.CAREERS_URL) {
        return {
          status: 200,
          url: fibe.CAREERS_URL,
          html: emptyCareersPageHtml,
        }
      }

      if (url === fibe.JOBS_URL) {
        return {
          status: 404,
          url: 'https://www.fibe.in/jobs/',
          html: jobs404Html,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fibe.HOMEPAGE_URL,
    fibe.CAREERS_URL,
    fibe.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Fibe fails closed when the homepage, careers empty state, or jobs-route 404 drift', async () => {
  const fibe = await loadModule()

  await assert.rejects(
    fibe.run({
      fetchPage: async (url) => {
        if (url === fibe.HOMEPAGE_URL) {
          return {
            status: 200,
            url: fibe.HOMEPAGE_URL,
            html: '<html><body><h1>Different homepage</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage changed materially|verified official homepage/i,
  )

  await assert.rejects(
    fibe.run({
      fetchPage: async (url) => {
        if (url === fibe.HOMEPAGE_URL) {
          return {
            status: 200,
            url: fibe.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === fibe.CAREERS_URL) {
          return {
            status: 200,
            url: fibe.CAREERS_URL,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page changed materially|public jobs surface/i,
  )

  await assert.rejects(
    fibe.run({
      fetchPage: async (url) => {
        if (url === fibe.HOMEPAGE_URL) {
          return {
            status: 200,
            url: fibe.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === fibe.CAREERS_URL) {
          return {
            status: 200,
            url: fibe.CAREERS_URL,
            html: emptyCareersPageHtml,
          }
        }

        if (url === fibe.JOBS_URL) {
          return {
            status: 200,
            url: fibe.JOBS_URL,
            html: '<html><body><h1>Jobs</h1><a href="/careers/software-engineer">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs route changed materially|public jobs surface/i,
  )
})
