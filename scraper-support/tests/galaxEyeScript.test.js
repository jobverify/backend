import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mission Drishti | World's First OptoSAR EO Satellite</title>
  </head>
  <body>
    <nav>
      <a href="/">home</a>
      <a href="/technology">technology</a>
      <a href="/about-us">about us</a>
      <a href="/job-portal">careers</a>
    </nav>
    <main>
      <h1>World's First OptoSAR Imaging Satellite</h1>
      <p>A New Era in Satellite Intelligence</p>
    </main>
    <footer>
      <p>Galaxeye Space Solutions Private Limited (CIN: U30304TN2021PTC143654)</p>
    </footer>
  </body>
</html>
`

const jobPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at GalaxEye | Shape the Future of Earth Observation</title>
  </head>
  <body>
    <main>
      <h1>Your Life's Work Could Be Defining the Future of Observation.</h1>
      <p>
        This is more than a job; it's a mission to build a new kind of planetary vision.
      </p>
      <h2>Find Your Mission</h2>
      <p>Explore our open roles</p>
      <a href="https://careers.galaxeye.space/jobs/Careers">Join Us Now</a>
    </main>
    <footer>
      <p>Galaxeye Space Solutions Private Limited (CIN: U30304TN2021PTC143654)</p>
    </footer>
  </body>
</html>
`

const publicJobsShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | GalaxEye</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const publicJobsListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | GalaxEye</title>
  </head>
  <body>
    <main>
      <h1>Open Roles</h1>
      <article class="job-card">
        <a href="https://careers.galaxeye.space/jobs/Careers/90010000000012345/Thermal-Engineer?source=CareerSite">
          Thermal Engineer
        </a>
        <p>Bengaluru, India</p>
        <a href="https://careers.galaxeye.space/jobs/Careers/90010000000012345/Thermal-Engineer?source=CareerSite">
          Apply Now
        </a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/galaxeye/script.js')
  } catch {
    assert.fail('Expected GalaxEye scraper module at ../../scraper/galaxeye/script.js')
  }
}

test('GalaxEye constants and page signals stay pinned to the verified first-party handoff plus shell-only jobs board', async () => {
  const galaxEye = await loadModule()

  assert.equal(galaxEye.COMPANY, 'GalaxEye')
  assert.equal(galaxEye.OFFICIAL_BRAND_NAME, 'Galaxeye Space Solutions Private Limited')
  assert.equal(galaxEye.SOURCE, 'galaxeye')
  assert.equal(galaxEye.VERIFIED_AT, '2026-07-15')
  assert.equal(galaxEye.HOMEPAGE_URL, 'https://galaxeye.space/')
  assert.equal(galaxEye.JOB_PORTAL_URL, 'https://galaxeye.space/job-portal')
  assert.equal(
    galaxEye.PUBLIC_JOBS_SHELL_URL,
    'https://careers.galaxeye.space/jobs/Careers',
  )
  assert.equal(galaxEye.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(galaxEye.extractJobPortalUrl(homepageHtml), 'https://galaxeye.space/job-portal')
  assert.equal(galaxEye.hasOfficialJobPortalSignal(jobPortalHtml), true)
  assert.equal(
    galaxEye.extractCareersHandoffUrl(jobPortalHtml),
    'https://careers.galaxeye.space/jobs/Careers',
  )
  assert.equal(galaxEye.hasPublicJobsShellSignal(publicJobsShellHtml), true)
  assert.equal(galaxEye.publicJobsShellExposesTrustworthyListings(publicJobsShellHtml), false)
  assert.equal(galaxEye.publicJobsShellExposesTrustworthyListings(publicJobsListingHtml), true)
})

test('GalaxEye returns no jobs only while the first-party page still hands off to the shell-only jobs board', async () => {
  const galaxEye = await loadModule()
  const requestedUrls = []

  const jobs = await galaxEye.createGalaxEyeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === galaxEye.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === galaxEye.JOB_PORTAL_URL) {
        return { status: 200, url, html: jobPortalHtml }
      }

      if (url === galaxEye.PUBLIC_JOBS_SHELL_URL) {
        return { status: 200, url, html: publicJobsShellHtml }
      }

      throw new Error(`Unexpected GalaxEye URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    galaxEye.HOMEPAGE_URL,
    galaxEye.JOB_PORTAL_URL,
    galaxEye.PUBLIC_JOBS_SHELL_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('GalaxEye fails closed when the homepage, job portal, or public jobs shell drifts into a real public jobs surface', async () => {
  const galaxEye = await loadModule()

  await assert.rejects(
    galaxEye.createGalaxEyeScraper().run({
      fetchPage: async (url) => {
        if (url === galaxEye.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Placeholder</title></head><body>Welcome</body></html>',
          }
        }

        throw new Error(`Unexpected GalaxEye URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    galaxEye.createGalaxEyeScraper().run({
      fetchPage: async (url) => {
        if (url === galaxEye.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === galaxEye.JOB_PORTAL_URL) {
          return { status: 200, url, html: jobPortalHtml.replace(
            'https://careers.galaxeye.space/jobs/Careers',
            'https://example.com/jobs',
          ) }
        }

        throw new Error(`Unexpected GalaxEye URL: ${url}`)
      },
    }),
    /verified first-party job portal/i,
  )

  await assert.rejects(
    galaxEye.createGalaxEyeScraper().run({
      fetchPage: async (url) => {
        if (url === galaxEye.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === galaxEye.JOB_PORTAL_URL) {
          return { status: 200, url, html: jobPortalHtml }
        }

        if (url === galaxEye.PUBLIC_JOBS_SHELL_URL) {
          return { status: 200, url, html: publicJobsListingHtml }
        }

        throw new Error(`Unexpected GalaxEye URL: ${url}`)
      },
    }),
    /trustworthy public jobs surface|shell-only jobs board/i,
  )
})
