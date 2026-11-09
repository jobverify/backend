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
    <meta charset="UTF-8" />
    <title>CRTD Technologies</title>
    <script type="module" crossorigin src="/assets/index-DlI3UhW3.js"></script>
  </head>
  <body>
    <div id="root" class="min-h-screen min-h-[100dvh]"></div>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>CRTD Technologies</title>
    <script type="module" crossorigin src="/assets/index-DlI3UhW3.js"></script>
  </head>
  <body>
    <div id="root" class="min-h-screen min-h-[100dvh]"></div>
  </body>
</html>
`

const jobsBundleJs = `
const baseUrl="/api";
const routes=["/","/fresher-jobs","/job-description/:id","/services"];
const statsEndpoint="/jobs/dynamic-job-openings/";
const jobsEndpoint="/jobs/?page=1&page_size=100";
const emptyTitle="0 Immediate New Vacancies!";
const emptyBody="No jobs found.";
const footerEmail="careers@crtd.in";
`

test('CRTD Technologies scraper module loads and exposes the verified first-party sentinel contract', async () => {
  const crtd = await loadModule()
  assert.ok(crtd, 'CRTD Technologies scraper module should load')

  assert.equal(crtd.HOMEPAGE_URL, 'https://www.crtd.in/')
  assert.equal(crtd.CAREERS_URL, 'https://www.crtd.in/fresher-jobs')
  assert.equal(crtd.API_JOBS_URL, 'https://www.crtd.in/api/jobs/?page=1&page_size=100')
  assert.equal(crtd.API_STATS_URL, 'https://www.crtd.in/api/jobs/dynamic-job-openings/')
  assert.equal(crtd.hasOfficialShellSignal(homepageHtml), true)
  assert.equal(crtd.hasOfficialShellSignal('<html><body>Other company</body></html>'), false)
  assert.equal(
    crtd.extractBundleAssetUrl(jobsPageHtml),
    'https://www.crtd.in/assets/index-DlI3UhW3.js',
  )
  assert.equal(crtd.hasVerifiedPublicJobsBundleSignal(jobsBundleJs), true)
  assert.equal(
    crtd.hasVerifiedPublicJobsBundleSignal('const routes=["/careers"];'),
    false,
  )
  assert.equal(crtd.isVerifiedBadRequestStatus(400), true)
  assert.equal(crtd.isVerifiedBadRequestStatus(200), false)
})

test('CRTD Technologies scraper returns no jobs only while the verified first-party empty state still holds', async () => {
  const crtd = await loadModule()
  assert.ok(crtd, 'CRTD Technologies scraper module should load')

  const requests = []
  const jobs = await crtd.createCrtdTechnologiesScraper().run({
    fetchPage: async (url) => {
      requests.push(url)
      if (url === crtd.HOMEPAGE_URL || url === crtd.CAREERS_URL) {
        return { status: 200, url, html: jobsPageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requests.push(url)
      if (url === crtd.extractBundleAssetUrl(jobsPageHtml)) return jobsBundleJs
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchStatus: async (url) => {
      requests.push(url)
      if (url === crtd.API_JOBS_URL || url === crtd.API_STATS_URL) {
        return 400
      }

      throw new Error(`Unexpected status URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    crtd.HOMEPAGE_URL,
    crtd.CAREERS_URL,
    'https://www.crtd.in/assets/index-DlI3UhW3.js',
    crtd.API_JOBS_URL,
    crtd.API_STATS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('CRTD Technologies scraper fails closed when the verified public surface changes', async () => {
  const crtd = await loadModule()
  assert.ok(crtd, 'CRTD Technologies scraper module should load')

  await assert.rejects(
    crtd.createCrtdTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === crtd.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unbranded shell</body></html>' }
        }

        return { status: 200, url, html: jobsPageHtml }
      },
      fetchStatus: async () => 400,
    }),
    /official CRTD Technologies site shell/i,
  )

  await assert.rejects(
    crtd.createCrtdTechnologiesScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: jobsPageHtml }),
      fetchText: async (url) => {
        return 'const routes=["/fresher-jobs"];'
      },
      fetchStatus: async () => 400,
    }),
    /verified public jobs bundle/i,
  )

  await assert.rejects(
    crtd.createCrtdTechnologiesScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: jobsPageHtml }),
      fetchText: async (url) => {
        return jobsBundleJs
      },
      fetchStatus: async () => 200,
    }),
    /public jobs API state changed/i,
  )
})
