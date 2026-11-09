import assert from 'node:assert/strict'
import test from 'node:test'

const loadZivameModule = async () => {
  try {
    return await import('../../scraper/zivame/script.js')
  } catch {
    assert.fail('Expected Zivame scraper module at ../../scraper/zivame/script.js')
  }
}

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zivame</title>
  </head>
  <body>
    <a href="/careers">Careers</a>
    <p>Brands on Zivame</p>
    <p>Track/Return Order</p>
    <p>Own a Franchise</p>
    <p>Find Your Fit</p>
  </body>
</html>
`

const blockedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <h1>Cloudflare</h1>
    <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>
  </body>
</html>
`

const blockedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <h1>Cloudflare</h1>
    <p>Please enable cookies.</p>
    <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>
  </body>
</html>
`

test('Zivame pins the verified homepage, blocked careers route, and unavailable legacy careers host', async () => {
  const zivame = await loadZivameModule()

  assert.equal(zivame.SOURCE, 'zivame')
  assert.equal(zivame.COMPANY, 'Zivame')
  assert.equal(zivame.VERIFIED_ON, '2026-08-13')
  assert.equal(zivame.HOMEPAGE_URL, 'https://www.zivame.com/')
  assert.equal(zivame.CAREERS_URL, 'https://www.zivame.com/careers')
  assert.equal(zivame.LEGACY_CAREERS_URL, 'https://careers.zivame.com/')
  assert.equal(zivame.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(
    zivame.isBlockedHomepageRoute({
      status: 403,
      html: blockedHomepageHtml,
    }),
    true,
  )
  assert.equal(
    zivame.isBlockedCareersRoute({
      status: 403,
      html: blockedCareersHtml,
    }),
    true,
  )
  assert.equal(
    zivame.isUnavailableLegacyCareersHost({
      status: 'ERROR',
      errorMessage: 'getaddrinfo ENOTFOUND careers.zivame.com',
    }),
    true,
  )
})

test('Zivame run validates the current official surfaces before returning no jobs', async () => {
  const zivame = await loadZivameModule()
  const requestedUrls = []

  const jobs = await zivame.createZivameScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zivame.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml, errorMessage: '' }
      }

      if (url === zivame.CAREERS_URL) {
        return { status: 403, url, html: blockedCareersHtml, errorMessage: '' }
      }

      if (url === zivame.LEGACY_CAREERS_URL) {
        return {
          status: 'ERROR',
          url,
          html: '',
          errorMessage: 'getaddrinfo ENOTFOUND careers.zivame.com',
        }
      }

      throw new Error(`Unexpected Zivame fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zivame.HOMEPAGE_URL,
    zivame.CAREERS_URL,
    zivame.LEGACY_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Zivame run also stays empty when the homepage itself is now Cloudflare-challenged', async () => {
  const zivame = await loadZivameModule()
  const requestedUrls = []

  const jobs = await zivame.createZivameScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zivame.HOMEPAGE_URL) {
        return { status: 403, url, html: blockedHomepageHtml, errorMessage: '' }
      }

      if (url === zivame.CAREERS_URL) {
        return { status: 403, url, html: blockedCareersHtml, errorMessage: '' }
      }

      if (url === zivame.LEGACY_CAREERS_URL) {
        return {
          status: 'ERROR',
          url,
          html: '',
          errorMessage: 'getaddrinfo ENOTFOUND careers.zivame.com',
        }
      }

      throw new Error(`Unexpected Zivame fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zivame.HOMEPAGE_URL,
    zivame.CAREERS_URL,
    zivame.LEGACY_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})
