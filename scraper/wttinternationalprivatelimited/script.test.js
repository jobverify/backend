import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected WTT International Private Limited scraper module at ./script.js')
  }
}

const redirectShellHtml = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>'

const publicJobsHtml = `
  <!doctype html>
  <html>
    <head>
      <title>WTT International Careers</title>
    </head>
    <body>
      <main>
        <h1>Current Openings</h1>
        <a href="/careers/backend-engineer">Apply now</a>
      </main>
    </body>
  </html>
`

const rootLanderPage = {
  status: 307,
  url: 'https://wttinternational.com/lander',
  html: '<a href="https://forsale.godaddy.com/forsale/wttinternational.com?utm_source=TDFS_BINNS&amp;utm_medium=parkedpages&amp;utm_campaign=x_corp_tdfs-binns_base&amp;traffic_type=TDFS_BINNS&amp;traffic_id=binns&amp;">Temporary Redirect</a>.',
  errorMessage: '',
}

const wwwLanderPage = {
  status: 307,
  url: 'https://www.wttinternational.com/lander',
  html: '<a href="https://forsale.godaddy.com/forsale/www.wttinternational.com?utm_source=TDFS_BINNS&amp;utm_medium=parkedpages&amp;utm_campaign=x_corp_tdfs-binns_base&amp;traffic_type=TDFS_BINNS&amp;traffic_id=binns&amp;">Temporary Redirect</a>.',
  errorMessage: '',
}

const unresolvedPage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `The remote name could not be resolved: '${new URL(url).hostname}'`,
})

const timeoutPage = (url) => ({
  status: 'FETCH_ERROR',
  url,
  html: '',
  errorMessage: 'Connect Timeout Error (attempted addresses: 76.223.54.146:443, 13.248.169.48:443, timeout: 10000ms)',
})

test('WTT International Private Limited sentinel pins the Friday, August 14, 2026 unreachable-or-unresolved first-party contract', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'wttinternationalprivatelimited')
  assert.equal(scraper.COMPANY, 'WTT International Private Limited')
  assert.equal(scraper.VERIFIED_AT, '2026-08-14')
  assert.deepEqual(scraper.PARKED_ROUTE_URLS, [
    'https://wttinternational.com/',
    'https://www.wttinternational.com/',
    'https://wttinternational.com/careers',
    'https://wttinternational.com/careers/',
    'https://wttinternational.com/jobs',
    'https://wttinternational.com/join-us',
    'https://www.wttinternational.com/careers',
  ])
  assert.deepEqual(scraper.LANDER_URLS, [
    'https://wttinternational.com/lander',
    'https://www.wttinternational.com/lander',
  ])
  assert.deepEqual(scraper.UNRESOLVED_DOMAIN_URLS, [
    'https://wttinternational.in/',
    'https://www.wttinternational.in/',
    'https://wttinternational.co.in/',
    'https://www.wttinternational.co.in/',
    'https://wttipl.com/',
    'https://www.wttipl.com/',
    'https://wttipl.in/',
    'https://www.wttipl.in/',
  ])

  assert.equal(scraper.hasVerifiedRedirectShell(redirectShellHtml), true)
  assert.equal(scraper.hasPublicJobsSignal(redirectShellHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(scraper.hasVerifiedGoDaddyLanderRedirect(rootLanderPage, 'wttinternational.com'), true)
  assert.equal(scraper.hasVerifiedGoDaddyLanderRedirect(wwwLanderPage, 'www.wttinternational.com'), true)
  assert.equal(scraper.hasVerifiedUnavailableFirstPartySurface(timeoutPage('https://wttinternational.com/')), true)
  assert.equal(
    scraper.isVerifiedUnresolvedFirstPartySurface(unresolvedPage('https://wttinternational.in/')),
    true,
  )
})

test('run returns [] while verified WTT International candidate surfaces stay parked, unreachable, or unresolved', async () => {
  const scraper = await loadModule()
  const requestedParkedUrls = []

  const parkedJobs = await scraper.createWttInternationalPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedParkedUrls.push(url)

      if (scraper.PARKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: redirectShellHtml,
          errorMessage: '',
        }
      }

      if (url === scraper.LANDER_URLS[0]) {
        return rootLanderPage
      }

      if (url === scraper.LANDER_URLS[1]) {
        return wwwLanderPage
      }

      if (scraper.UNRESOLVED_DOMAIN_URLS.includes(url)) {
        return unresolvedPage(url)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedParkedUrls, [
    ...scraper.PARKED_ROUTE_URLS,
    ...scraper.LANDER_URLS,
    ...scraper.UNRESOLVED_DOMAIN_URLS,
  ])
  assert.deepEqual(parkedJobs, [])

  const requestedUnreachableUrls = []

  const jobs = await scraper.createWttInternationalPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUnreachableUrls.push(url)

      if (scraper.PARKED_ROUTE_URLS.includes(url)) {
        return timeoutPage(url)
      }

      if (scraper.LANDER_URLS.includes(url)) {
        return timeoutPage(url)
      }

      if (scraper.UNRESOLVED_DOMAIN_URLS.includes(url)) {
        return unresolvedPage(url)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUnreachableUrls, [
    ...scraper.PARKED_ROUTE_URLS,
    ...scraper.LANDER_URLS,
    ...scraper.UNRESOLVED_DOMAIN_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when a parked WTT International route changes shape or exposes jobs', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createWttInternationalPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.PARKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>WTT International</h1></body></html>',
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified parked first-party route changed/i,
  )

  await assert.rejects(
    scraper.createWttInternationalPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.PARKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /candidate parked route now appears to expose public jobs/i,
  )
})

test('run fails closed when the WTT International lander or unresolved-domain contract drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createWttInternationalPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (scraper.PARKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
            errorMessage: '',
          }
        }

        if (url === scraper.LANDER_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body>Not parked anymore</body></html>',
            errorMessage: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified lander redirect changed/i,
  )

  await assert.rejects(
    scraper.createWttInternationalPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (scraper.PARKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: redirectShellHtml,
            errorMessage: '',
          }
        }

        if (url === scraper.LANDER_URLS[0]) {
          return rootLanderPage
        }

        if (url === scraper.LANDER_URLS[1]) {
          return wwwLanderPage
        }

        if (url === scraper.UNRESOLVED_DOMAIN_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><a href="/careers">Careers</a></body></html>',
            errorMessage: '',
          }
        }

        if (scraper.UNRESOLVED_DOMAIN_URLS.includes(url)) {
          return unresolvedPage(url)
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified unresolved first-party surface changed/i,
  )
})
