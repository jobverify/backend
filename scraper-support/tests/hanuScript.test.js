import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/hanu/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const redirectedInsightHomepageHtml = readHtmlFixture('insight-homepage.html')

const loadHanuModule = async () => {
  try {
    return await import('../../scraper/hanu/script.js')
  } catch {
    assert.fail('Expected Hanu scraper module at ../../scraper/hanu/script.js')
  }
}

const getCareersTargetUrls = (hanu) =>
  hanu.CAREERS_ROUTE_URLS.map((routeUrl) => hanu.getExpectedCareersRedirectTarget(routeUrl))

test('Hanu validates the verified homepage redirect and the redirect-only careers routes', async () => {
  const hanu = await loadHanuModule()

  assert.equal(hanu.SOURCE, 'hanu')
  assert.equal(hanu.COMPANY, 'Hanu')
  assert.equal(hanu.HOMEPAGE_URL, 'https://www.hanu.com/')
  assert.equal(hanu.HOMEPAGE_REDIRECT_URL, 'https://www.insight.com/en_US/home.html/')
  assert.deepEqual(hanu.CAREERS_ROUTE_URLS, [
    'https://www.hanu.com/careers',
    'https://www.hanu.com/careers/',
    'https://www.hanu.com/jobs',
    'https://www.hanu.com/jobs/',
    'https://www.hanu.com/company/careers',
  ])
  assert.equal(hanu.hasOfficialHomepageSignal(redirectedInsightHomepageHtml), true)
  assert.equal(hanu.hasPublicJobsSignal(redirectedInsightHomepageHtml), false)
  assert.equal(
    hanu.isVerifiedHomepageRedirect({
      status: 301,
      url: hanu.HOMEPAGE_URL,
      headers: { location: hanu.HOMEPAGE_REDIRECT_URL },
      html: '',
    }),
    true,
  )
  assert.equal(
    hanu.isVerifiedCareersRouteRedirect({
      routeUrl: hanu.CAREERS_ROUTE_URLS[0],
      page: {
        status: 301,
        url: hanu.CAREERS_ROUTE_URLS[0],
        headers: { location: 'https://www.insight.com/en_US/home.html/careers' },
        html: '',
      },
    }),
    true,
  )
  assert.equal(
    hanu.isVerifiedCareersRouteRedirect({
      routeUrl: hanu.CAREERS_ROUTE_URLS[0],
      page: {
        status: 200,
        url: hanu.CAREERS_ROUTE_URLS[0],
        headers: {},
        html: '<html><body><h1>Open positions</h1><a href="/jobs/cloud-engineer">Apply now</a></body></html>',
      },
    }),
    false,
  )
})

test('Hanu returns no jobs only while the verified redirects still resolve to the Insight homepage shell', async () => {
  const hanu = await loadHanuModule()
  const requests = []

  const jobs = await hanu.createHanuScraper().run({
    fetchPage: async (url, options = {}) => {
      requests.push({ url, manualRedirect: options.manualRedirect === true })

      if (url === hanu.HOMEPAGE_URL) {
        return {
          status: 301,
          url,
          headers: { location: hanu.HOMEPAGE_REDIRECT_URL },
          html: '',
        }
      }

      if (url === hanu.HOMEPAGE_REDIRECT_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: redirectedInsightHomepageHtml,
        }
      }

      const careersTarget = hanu.getExpectedCareersRedirectTarget(url)
      if (careersTarget) {
        if (options.manualRedirect) {
          return {
            status: 301,
            url,
            headers: { location: careersTarget },
            html: '',
          }
        }

        return {
          status: 200,
          url: careersTarget,
          headers: {},
          html: redirectedInsightHomepageHtml,
        }
      }

      if (getCareersTargetUrls(hanu).includes(url)) {
        return {
          status: 200,
          url,
          headers: {},
          html: redirectedInsightHomepageHtml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { url: hanu.HOMEPAGE_URL, manualRedirect: true },
    { url: hanu.HOMEPAGE_REDIRECT_URL, manualRedirect: false },
    { url: hanu.CAREERS_ROUTE_URLS[0], manualRedirect: true },
    { url: 'https://www.insight.com/en_US/home.html/careers', manualRedirect: false },
    { url: hanu.CAREERS_ROUTE_URLS[1], manualRedirect: true },
    { url: 'https://www.insight.com/en_US/home.html/careers/', manualRedirect: false },
    { url: hanu.CAREERS_ROUTE_URLS[2], manualRedirect: true },
    { url: 'https://www.insight.com/en_US/home.html/jobs', manualRedirect: false },
    { url: hanu.CAREERS_ROUTE_URLS[3], manualRedirect: true },
    { url: 'https://www.insight.com/en_US/home.html/jobs/', manualRedirect: false },
    { url: hanu.CAREERS_ROUTE_URLS[4], manualRedirect: true },
    { url: 'https://www.insight.com/en_US/home.html/company/careers', manualRedirect: false },
  ])
  assert.deepEqual(jobs, [])
})

test('Hanu fails closed when the verified redirect contract or redirected homepage shell changes', async () => {
  const hanu = await loadHanuModule()

  await assert.rejects(
    hanu.createHanuScraper().run({
      fetchPage: async (url) => {
        if (url === hanu.HOMEPAGE_URL) {
          return {
            status: 301,
            url,
            headers: { location: 'https://www.insight.com/en_US/careers.html' },
            html: '',
          }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: redirectedInsightHomepageHtml,
        }
      },
    }),
    /homepage redirect no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    hanu.createHanuScraper().run({
      fetchPage: async (url, options = {}) => {
        if (url === hanu.HOMEPAGE_URL) {
          return {
            status: 301,
            url,
            headers: { location: hanu.HOMEPAGE_REDIRECT_URL },
            html: '',
          }
        }

        if (url === hanu.HOMEPAGE_REDIRECT_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected landing page</h1></body></html>',
          }
        }

        const careersTarget = hanu.getExpectedCareersRedirectTarget(url)
        if (careersTarget) {
          return options.manualRedirect
            ? {
                status: 301,
                url,
                headers: { location: careersTarget },
                html: '',
              }
            : {
                status: 200,
                url: careersTarget,
                headers: {},
                html: redirectedInsightHomepageHtml,
              }
        }

        if (getCareersTargetUrls(hanu).includes(url)) {
          return {
            status: 200,
            url,
            headers: {},
            html: redirectedInsightHomepageHtml,
          }
        }

        throw new Error(`Unexpected fixture URL: ${url}`)
      },
    }),
    /redirected official homepage no longer matches the verified public surface/i,
  )

  await assert.rejects(
    hanu.createHanuScraper().run({
      fetchPage: async (url, options = {}) => {
        if (url === hanu.HOMEPAGE_URL) {
          return {
            status: 301,
            url,
            headers: { location: hanu.HOMEPAGE_REDIRECT_URL },
            html: '',
          }
        }

        if (url === hanu.HOMEPAGE_REDIRECT_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: redirectedInsightHomepageHtml,
          }
        }

        const careersTarget = hanu.getExpectedCareersRedirectTarget(url)
        if (careersTarget) {
          if (url === hanu.CAREERS_ROUTE_URLS[0] && options.manualRedirect) {
            return {
              status: 301,
              url,
              headers: { location: 'https://www.insight.com/en_US/careers.html' },
              html: '',
            }
          }

          return options.manualRedirect
            ? {
                status: 301,
                url,
                headers: { location: careersTarget },
                html: '',
              }
            : {
                status: 200,
                url: careersTarget,
                headers: {},
                html: redirectedInsightHomepageHtml,
              }
        }

        if (getCareersTargetUrls(hanu).includes(url)) {
          return {
            status: 200,
            url,
            headers: {},
            html: redirectedInsightHomepageHtml,
          }
        }

        throw new Error(`Unexpected fixture URL: ${url}`)
      },
    }),
    /careers route redirect no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    hanu.createHanuScraper().run({
      fetchPage: async (url, options = {}) => {
        if (url === hanu.HOMEPAGE_URL) {
          return {
            status: 301,
            url,
            headers: { location: hanu.HOMEPAGE_REDIRECT_URL },
            html: '',
          }
        }

        if (url === hanu.HOMEPAGE_REDIRECT_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: redirectedInsightHomepageHtml,
          }
        }

        const careersTarget = hanu.getExpectedCareersRedirectTarget(url)
        if (careersTarget) {
          return options.manualRedirect
            ? {
                status: 301,
                url,
                headers: { location: careersTarget },
                html: '',
              }
            : {
                status: 200,
                url: careersTarget,
                headers: {},
                html: `${redirectedInsightHomepageHtml}<a href="https://jobs.lever.co/insight">Open positions</a>`,
              }
        }

        if (getCareersTargetUrls(hanu).includes(url)) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${redirectedInsightHomepageHtml}<a href="https://jobs.lever.co/insight">Open positions</a>`,
          }
        }

        throw new Error(`Unexpected fixture URL: ${url}`)
      },
    }),
    /careers route target now appears to expose a public jobs surface/i,
  )
})
