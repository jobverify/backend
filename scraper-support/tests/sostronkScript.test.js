import assert from 'node:assert/strict'
import test from 'node:test'

const changelogHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SoStronk release notes</title>
  </head>
  <body>
    <h1>SoStronk release notes</h1>
    <a href="https://www.sostronk.com/">www.sostronk.com</a>
    <h2>Release 1.0.1</h2>
    <p>Big news today, we're starting a public changelog so you're always up to date with all the updates, improvements and fixes that are made in Sostronk-com.</p>
    <p>Even though we work on Sostronk-com all the time, sometimes it may seem that not much is happening.</p>
    <p>Karan, Co-Founder &amp; CTO</p>
  </body>
</html>
`

const parkingRedirectHtml = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>'
const parkingLanderHtml = `
<!doctype html><html><head>
  <script>window.LANDER_SYSTEM="PW"</script>
  <script defer src="https://img1.wsimg.com/parking-lander/static/js/main.b227b566.js"></script>
  <link href="https://img1.wsimg.com/parking-lander/static/css/main.52c56e7a.css" rel="stylesheet">
</head><body><div id="root"></div></body></html>
`

const loadSostronkModule = async () => {
  try {
    return await import('../../scraper/sostronk/script.js')
  } catch {
    assert.fail('Expected Sostronk scraper module at ../../scraper/sostronk/script.js')
  }
}

test('Sostronk sentinel helpers stay pinned to the verified branded changelog and timeout-only exact-name routes', async () => {
  const sostronk = await loadSostronkModule()

  assert.equal(sostronk.SOURCE, 'sostronk')
  assert.equal(sostronk.COMPANY, 'Sostronk')
  assert.equal(sostronk.COMPANY_DOMAIN, 'sostronk.com')
  assert.equal(sostronk.CHANGELOG_URL, 'https://changelog.sostronk.com/')
  assert.equal(sostronk.VERIFIED_AT, '2026-07-27')
  assert.deepEqual(sostronk.FIRST_PARTY_TIMEOUT_URLS, [
    'https://www.sostronk.com/',
    'https://www.sostronk.com/about',
    'https://www.sostronk.com/careers',
    'https://www.sostronk.com/jobs',
    'https://www.sostronk.com/contact',
    'https://changelog.sostronk.com/',
  ])
  assert.equal(sostronk.hasOfficialChangelogSignal(changelogHtml), true)
  assert.equal(
    sostronk.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }),
    true,
  )
  assert.equal(
    sostronk.isExpectedBlockedSurface({ errorKind: 'tls', status: null, html: null }),
    true,
  )
  assert.equal(
    sostronk.isUnexpectedReachableSurface({
      status: 200,
      html: '<html><body><h1>Careers</h1><a href="/apply">Apply now</a></body></html>',
    }),
    true,
  )
})

test('Sostronk run verifies the exact-name timeout routes before returning []', async () => {
  const sostronk = await loadSostronkModule()
  const requestedUrls = []

  const jobs = await sostronk.createSostronkScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      if (url === sostronk.CHANGELOG_URL) {
        return {
          url,
          finalUrl: url,
          status: 200,
          html: changelogHtml,
          errorKind: null,
        }
      }

      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'tls',
      }
    },
  })

  assert.deepEqual(requestedUrls, sostronk.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])
})

test('Sostronk fails closed when a first-party route becomes reachable or changes away from the verified timeout state', async () => {
  const sostronk = await loadSostronkModule()

  await assert.rejects(
    sostronk.createSostronkScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://www.sostronk.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>SoStronk</title><body>Homepage now responds.</body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'tls',
        }
      },
    }),
    /official first-party route/i,
  )

  await assert.rejects(
    sostronk.createSostronkScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://www.sostronk.com/careers') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>Current openings</h1><a href="/apply">Apply now</a></body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'tls',
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    sostronk.createSostronkScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }),
    }),
    /verified blocked first-party surface changed materially/i,
  )

  await assert.rejects(
    sostronk.createSostronkScraper().run({
      probeUrl: async (url) => {
        if (url === sostronk.CHANGELOG_URL) {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>Unexpected changelog shell</h1></body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'tls',
        }
      },
    }),
    /verified branded changelog surface changed materially/i,
  )
})

test('Sostronk accepts the current exact-domain parking handoff only after verifying its lander', async () => {
  const sostronk = await loadSostronkModule()
  const requestedUrls = []

  assert.equal(sostronk.hasVerifiedParkingRedirectShell(parkingRedirectHtml), true)
  assert.equal(sostronk.hasVerifiedParkingLander(parkingLanderHtml), true)

  const jobs = await sostronk.run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      if (url === sostronk.PARKING_URL) {
        return { url, finalUrl: url, status: 200, html: parkingLanderHtml, errorKind: null }
      }
      if (url === sostronk.CHANGELOG_URL) {
        return { url, finalUrl: url, status: null, html: null, errorKind: 'dns' }
      }
      return { url, finalUrl: url, status: 200, html: parkingRedirectHtml, errorKind: null }
    },
  })

  assert.deepEqual(requestedUrls, [
    sostronk.FIRST_PARTY_TIMEOUT_URLS[0],
    sostronk.PARKING_URL,
    ...sostronk.FIRST_PARTY_TIMEOUT_URLS.slice(1),
  ])
  assert.deepEqual(jobs, [])
})
