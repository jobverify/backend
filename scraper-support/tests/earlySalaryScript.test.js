import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedHomepageHtml = `
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
      <h1>Be a Part of Fibe</h1>
      <div>No Jobs found</div>
      <div>Rewards and recognition keep us going</div>
      <script>
        window.__DATA__ = {
          "currentjobopenings":{
            "__typename":"Page_Currentjobopenings",
            "showcurrentjobopenings":true,
            "currentjobopeningsorderid":2,
            "currentjobopeningstitle":"Be a Part of Fibe",
            "currentjobopeningsdepts":null
          }
        }
      </script>
    </main>
  </body>
</html>
`

const jobs404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 | Fibe</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Page not found.</p>
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
      <h1>Be a Part of Fibe</h1>
      <div>Open jobs</div>
      <a href="/careers/software-engineer">Apply now</a>
      <script>
        window.__DATA__ = {
          "currentjobopenings":{
            "__typename":"Page_Currentjobopenings",
            "currentjobopeningsdepts":[{"title":"Engineering"}]
          }
        }
      </script>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/earlysalary/script.js')
  } catch {
    assert.fail('Expected EarlySalary scraper module at ../../scraper/earlysalary/script.js')
  }
}

test('EarlySalary helpers stay pinned to the verified Fibe redirect and empty careers contract', async () => {
  const earlySalary = await loadModule()

  assert.equal(earlySalary.COMPANY, 'EarlySalary')
  assert.equal(earlySalary.OFFICIAL_BRAND_NAME, 'Fibe')
  assert.equal(earlySalary.SOURCE, 'earlysalary')
  assert.equal(earlySalary.HOMEPAGE_URL, 'https://www.earlysalary.com/')
  assert.equal(earlySalary.REDIRECTED_HOMEPAGE_URL, 'https://www.fibe.in/')
  assert.equal(earlySalary.CAREERS_URL, 'https://www.fibe.in/careers/')
  assert.equal(earlySalary.LEGACY_CAREERS_URL, 'https://www.earlysalary.com/careers/')
  assert.equal(earlySalary.JOBS_URL, 'https://www.fibe.in/jobs')
  assert.equal(earlySalary.VERIFIED_ON, '2026-07-15')
  assert.match(earlySalary.VERIFIED_SURFACE_SUMMARY, /No Jobs found/i)
  assert.equal(
    earlySalary.extractHomepageCareersUrl(redirectedHomepageHtml),
    'https://www.fibe.in/careers/',
  )
  assert.equal(earlySalary.hasOfficialRedirectedHomepageSignal(redirectedHomepageHtml), true)
  assert.equal(earlySalary.hasOfficialCareersPageSignal(emptyCareersPageHtml), true)
  assert.equal(earlySalary.hasEmptyJobsStateSignal(emptyCareersPageHtml), true)
  assert.equal(earlySalary.pageExposesPublicJobListings(emptyCareersPageHtml), false)
  assert.equal(earlySalary.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    earlySalary.isVerifiedMissingJobsRoute(
      { status: 404, url: 'https://www.fibe.in/jobs/', html: jobs404Html },
    ),
    true,
  )
})

test('EarlySalary returns no jobs while the verified Fibe careers page remains first-party and empty', async () => {
  const earlySalary = await loadModule()
  const requestedUrls = []

  const jobs = await earlySalary.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === earlySalary.HOMEPAGE_URL) {
        return {
          status: 200,
          url: earlySalary.REDIRECTED_HOMEPAGE_URL,
          html: redirectedHomepageHtml,
        }
      }

      if (url === earlySalary.CAREERS_URL) {
        return {
          status: 200,
          url: earlySalary.CAREERS_URL,
          html: emptyCareersPageHtml,
        }
      }

      if (url === earlySalary.JOBS_URL) {
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
    earlySalary.HOMEPAGE_URL,
    earlySalary.CAREERS_URL,
    earlySalary.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('EarlySalary fails closed when the verified redirect, careers empty state, or jobs-route 404 drift', async () => {
  const earlySalary = await loadModule()

  await assert.rejects(
    earlySalary.run({
      fetchPage: async (url) => {
        if (url === earlySalary.HOMEPAGE_URL) {
          return {
            status: 200,
            url: earlySalary.HOMEPAGE_URL,
            html: redirectedHomepageHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /redirected homepage no longer matches|verified official redirect/i,
  )

  await assert.rejects(
    earlySalary.run({
      fetchPage: async (url) => {
        if (url === earlySalary.HOMEPAGE_URL) {
          return {
            status: 200,
            url: earlySalary.REDIRECTED_HOMEPAGE_URL,
            html: redirectedHomepageHtml,
          }
        }

        if (url === earlySalary.CAREERS_URL) {
          return {
            status: 200,
            url: earlySalary.CAREERS_URL,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page changed materially|public jobs surface/i,
  )

  await assert.rejects(
    earlySalary.run({
      fetchPage: async (url) => {
        if (url === earlySalary.HOMEPAGE_URL) {
          return {
            status: 200,
            url: earlySalary.REDIRECTED_HOMEPAGE_URL,
            html: redirectedHomepageHtml,
          }
        }

        if (url === earlySalary.CAREERS_URL) {
          return {
            status: 200,
            url: earlySalary.CAREERS_URL,
            html: emptyCareersPageHtml,
          }
        }

        if (url === earlySalary.JOBS_URL) {
          return {
            status: 200,
            url: earlySalary.JOBS_URL,
            html: '<html><body><h1>Jobs</h1><a href="/careers/software-engineer">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs route changed materially|public jobs surface/i,
  )
})
