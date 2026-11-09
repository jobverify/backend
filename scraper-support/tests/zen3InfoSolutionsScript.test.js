import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zen3</title>
    <script defer src="/static/js/main.abc123.js"></script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
  </body>
</html>
`

const bundleJs = `
/*! react production bundle */
const zen3App = { version: '1.0.0' };
`

const loadModule = async () => {
  try {
    return await import('../../scraper/zen3infosolutions/script.js')
  } catch {
    assert.fail('Expected Zen3 Info Solutions scraper module at ../../scraper/zen3infosolutions/script.js')
  }
}

test('Zen3 Info Solutions validates the homepage and missing careers routes before returning no jobs', async () => {
  const zen3 = await loadModule()

  assert.equal(zen3.SOURCE, 'zen3infosolutions')
  assert.equal(zen3.COMPANY, 'Zen3 Info Solutions')
  assert.equal(zen3.HOMEPAGE_URL, 'https://zen3.com/')
  assert.equal(zen3.VERIFIED_ON, '2026-07-18')
  assert.equal(zen3.hasOfficialHomepageSignal(homepageHtml), true)

  const jobs = await zen3.createZen3InfoSolutionsScraper().run({
    fetchPage: async (url) => {
      if (url === zen3.HOMEPAGE_URL || zen3.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === 'https://zen3.com/static/js/main.abc123.js') {
        return { status: 200, url, html: bundleJs }
      }

      throw new Error(`Unexpected Zen3 URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Zen3 Info Solutions fails closed if a first-party careers route starts returning a live jobs page', async () => {
  const zen3 = await loadModule()

  await assert.rejects(
    zen3.createZen3InfoSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === zen3.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === 'https://zen3.com/static/js/main.abc123.js') {
          return { status: 200, url, html: bundleJs }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Careers</h1><a href="/careers/software-engineer">Software Engineer</a></body></html>',
        }
      },
    }),
    /verified no-public-careers surface changed/i,
  )
})
