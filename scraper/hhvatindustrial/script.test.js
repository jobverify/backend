import assert from 'node:assert/strict'
import test from 'node:test'

const homepageRedirectHtml = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>'
const parkedLanderHtml = '<!doctype html><html lang="en"><head><meta charset="UTF-8"/><script>window.LANDER_SYSTEM="PW"</script><script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script><script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script></head><body></body></html>'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected HHVAT Industrial scraper module at ./script.js')
  }
}

test('HHVAT Industrial pins the verified first-party parked-domain zero-jobs surface', async () => {
  const hhvat = await loadModule()

  assert.equal(hhvat.SOURCE, 'hhvatindustrial')
  assert.equal(hhvat.COMPANY, 'HHVAT Industrial')
  assert.equal(hhvat.HOMEPAGE_URL, 'https://hhvat.com/')
  assert.equal(hhvat.LANDER_URL, 'https://hhvat.com/lander')
  assert.deepEqual(hhvat.PUBLIC_JOB_ROUTE_URLS, [
    'https://hhvat.com/careers',
    'https://hhvat.com/jobs',
  ])
  assert.equal(hhvat.hasHomepageRedirectSignal(homepageRedirectHtml), true)
  assert.equal(hhvat.hasParkedLanderSignal(parkedLanderHtml), true)
})

test('HHVAT Industrial sentinel returns no jobs only while the verified parked-domain contract holds', async () => {
  const hhvat = await loadModule()
  const requestedUrls = []

  const jobs = await hhvat.createHhvatIndustrialScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === hhvat.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageRedirectHtml }
      }

      if (url === hhvat.LANDER_URL) {
        return { status: 200, url, html: parkedLanderHtml }
      }

      if (hhvat.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageRedirectHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hhvat.HOMEPAGE_URL,
    hhvat.LANDER_URL,
    ...hhvat.PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('HHVAT Industrial fails closed when the homepage, parked lander, or likely public job routes drift', async () => {
  const hhvat = await loadModule()

  await assert.rejects(
    hhvat.createHhvatIndustrialScraper().run({
      fetchPage: async (url) => {
        if (url === hhvat.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        return { status: 200, url, html: parkedLanderHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    hhvat.createHhvatIndustrialScraper().run({
      fetchPage: async (url) => {
        if (url === hhvat.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageRedirectHtml }
        }

        if (url === hhvat.LANDER_URL) {
          return { status: 200, url, html: '<html><body>Real company website</body></html>' }
        }

        return { status: 200, url, html: homepageRedirectHtml }
      },
    }),
    /verified parked landing page/i,
  )

  await assert.rejects(
    hhvat.createHhvatIndustrialScraper().run({
      fetchPage: async (url) => {
        if (url === hhvat.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageRedirectHtml }
        }

        if (url === hhvat.LANDER_URL) {
          return { status: 200, url, html: parkedLanderHtml }
        }

        return { status: 200, url, html: '<html><body><h1>Current Openings</h1></body></html>' }
      },
    }),
    /public jobs route/i,
  )
})
