import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  CAREERS_ROUTE_URL,
  JOBS_ROUTE_URL,
  createEmptyCupScraper,
  hasOfficialSiteSignal,
  isMissingCareerRoute,
} from '../../scraper/emptycup/script.js'

const homepageHtml = `
  <html>
    <head><title>EmptyCup | Interior Design</title></head>
    <body><h1>Welcome to EmptyCup</h1></body>
  </html>
`

const notFoundHtml = `
  <html>
    <head><title>404 Not Found</title></head>
    <body><h1>Not Found</h1></body>
  </html>
`

const currentSpaShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" href="/favicon.png">
    <title>EmptyCup 3D</title>
    <link rel="modulepreload" href="/_app/immutable/entry/start.e46f5699.js">
    <link rel="modulepreload" href="/_app/immutable/entry/app.a977b97e.js">
  </head>
  <body>
    <div id="master-spinner"><img src="/img/website/yinyang.png" alt=""></div>
    <div id="app-container">
      <script>Promise.all([import("/_app/immutable/entry/start.e46f5699.js"), import("/_app/immutable/entry/app.a977b97e.js")]);</script>
    </div>
  </body>
</html>
`

const currentAppBundleUrl = 'https://emptycup.in/_app/immutable/entry/app.a977b97e.js'
const currentAppBundle = `
const dictionary = {
  "/(open)": [19,[3]],
  "/(open)/about": [20,[3]],
  "/(open)/contact-us": [21,[3]],
  "/(open)/gallery": [23,[3]],
  "/(open)/pricing": [24,[3]],
  "/(open)/privacy": [25,[3]]
};
export { dictionary };
`

test('EmptyCup scraper targets the official site and recognizes unavailable careers routes', () => {
  assert.equal(CAREER_PAGE_URL, 'https://emptycup.in/')
  assert.equal(CAREERS_ROUTE_URL, 'https://emptycup.in/careers')
  assert.equal(JOBS_ROUTE_URL, 'https://emptycup.in/jobs')
  assert.equal(hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(isMissingCareerRoute(notFoundHtml), true)
})

test('run returns no jobs when EmptyCup exposes no public careers or jobs route', async () => {
  const requestedUrls = []
  const jobs = await createEmptyCupScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) return homepageHtml
      if (url === CAREERS_ROUTE_URL || url === JOBS_ROUTE_URL) return notFoundHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    CAREERS_ROUTE_URL,
    JOBS_ROUTE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run treats the verified SvelteKit fallback as missing only when its route dictionary has no careers route', async () => {
  const requestedUrls = []
  const jobs = await createEmptyCupScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if ([CAREER_PAGE_URL, CAREERS_ROUTE_URL, JOBS_ROUTE_URL].includes(url)) {
        return currentSpaShellHtml
      }
      if (url === currentAppBundleUrl) return currentAppBundle
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    CAREERS_ROUTE_URL,
    JOBS_ROUTE_URL,
    currentAppBundleUrl,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the SvelteKit route dictionary exposes a careers route', async () => {
  await assert.rejects(
    createEmptyCupScraper().run({
      fetchText: async (url) => {
        if ([CAREER_PAGE_URL, CAREERS_ROUTE_URL, JOBS_ROUTE_URL].includes(url)) {
          return currentSpaShellHtml
        }
        if (url === currentAppBundleUrl) {
          return currentAppBundle.replace(
            '};',
            ', "/(open)/careers": [28,[3]] };',
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /route dictionary.*careers/i,
  )
})

test('run fails closed when the SvelteKit app bundle has no verifiable route dictionary', async () => {
  await assert.rejects(
    createEmptyCupScraper().run({
      fetchText: async (url) => {
        if ([CAREER_PAGE_URL, CAREERS_ROUTE_URL, JOBS_ROUTE_URL].includes(url)) {
          return currentSpaShellHtml
        }
        if (url === currentAppBundleUrl) return 'export const boot = true;'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /route dictionary/i,
  )
})

test('run fails closed when the EmptyCup homepage or careers routes change', async () => {
  await assert.rejects(
    createEmptyCupScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) return '<html><title>Unexpected</title></html>'
        return notFoundHtml
      },
    }),
    /verified public surface/i,
  )

  await assert.rejects(
    createEmptyCupScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) return homepageHtml
        if (url === CAREERS_ROUTE_URL) return '<html><body>Open Positions</body></html>'
        if (url === JOBS_ROUTE_URL) return notFoundHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no-public-listings surface/i,
  )
})
