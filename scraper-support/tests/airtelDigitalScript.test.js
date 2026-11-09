import assert from 'node:assert/strict'
import test from 'node:test'

const loadAirtelDigitalModule = async () => {
  try {
    return await import('../../scraper/airteldigital/script.js')
  } catch {
    assert.fail('Expected Airtel Digital scraper module at ../../scraper/airteldigital/script.js')
  }
}

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="description" content="Airtel Careers"/>
    <title>Airtel Careers</title>
    <script defer="defer" src="/static/js/main.57023176.js"></script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const verifiedBundleText = `
!function(){var e={145:function(e){"use strict";e.exports=JSON.parse('{"baseURL":"","darwinboxURL":"https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs","imagePath":"/images/UploadFile/","apiUrl":"https://careersapi.airtel.com/"}')}};var marketing="Airtel Payments Bank";var headline="Pioneers of Digital Transformations";}();
`

const bundleWithDistinctAirtelDigitalSignal = `
!function(){var e={145:function(e){"use strict";e.exports=JSON.parse('{"baseURL":"","darwinboxURL":"https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs","apiUrl":"https://careersapi.airtel.com/"}')}};var companyLabel="Airtel Digital";}();
`

const darwinboxShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <base href="/ms/candidatev2/">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
    <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

test('Airtel Digital validates the shared Airtel careers shell, live bundle handoff, and shared Darwinbox shell', async () => {
  const airtelDigital = await loadAirtelDigitalModule()

  assert.equal(airtelDigital.SOURCE, 'airteldigital')
  assert.equal(airtelDigital.COMPANY, 'Airtel Digital')
  assert.equal(airtelDigital.OFFICIAL_BRAND_NAME, 'Airtel')
  assert.equal(airtelDigital.VERIFIED_AT, '2026-07-15')
  assert.equal(airtelDigital.CAREERS_URL, 'https://careers.airtel.com/')
  assert.equal(
    airtelDigital.SHARED_DARWINBOX_URL,
    'https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    airtelDigital.SHARED_CAREERS_API_URL,
    'https://careersapi.airtel.com/',
  )
  assert.equal(
    airtelDigital.extractMainBundleUrl(careersShellHtml),
    'https://careers.airtel.com/static/js/main.57023176.js',
  )
  assert.equal(airtelDigital.hasOfficialCareersShellSignal(careersShellHtml), true)
  assert.equal(
    airtelDigital.hasVerifiedBundleSignal(verifiedBundleText),
    true,
  )
  assert.equal(
    airtelDigital.hasDistinctAirtelDigitalSignal(verifiedBundleText),
    false,
  )
  assert.equal(
    airtelDigital.hasDistinctAirtelDigitalSignal(bundleWithDistinctAirtelDigitalSignal),
    true,
  )
  assert.equal(
    airtelDigital.hasSharedDarwinboxShellSignal(darwinboxShellHtml),
    true,
  )
})

test('Airtel Digital returns no jobs while the only trustworthy public surface is the shared Airtel careers handoff', async () => {
  const airtelDigital = await loadAirtelDigitalModule()
  const requestedUrls = []

  const jobs = await airtelDigital.createAirtelDigitalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === airtelDigital.CAREERS_URL) {
        return careersShellHtml
      }

      if (url === 'https://careers.airtel.com/static/js/main.57023176.js') {
        return verifiedBundleText
      }

      if (url === airtelDigital.SHARED_DARWINBOX_URL) {
        return darwinboxShellHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    airtelDigital.CAREERS_URL,
    'https://careers.airtel.com/static/js/main.57023176.js',
    airtelDigital.SHARED_DARWINBOX_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Airtel Digital can recover with browser-backed shared Airtel surfaces when direct requests fail', async () => {
  const airtelDigital = await loadAirtelDigitalModule()
  const attempts = []

  const jobs = await airtelDigital.createAirtelDigitalScraper().run({
    fetchText: async (url) => {
      attempts.push(`http:${url}`)
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      attempts.push(`browser:${url}`)

      if (url === airtelDigital.CAREERS_URL) return careersShellHtml
      if (url === 'https://careers.airtel.com/static/js/main.57023176.js') return verifiedBundleText
      if (url === airtelDigital.SHARED_DARWINBOX_URL) return darwinboxShellHtml

      throw new Error(`Unexpected browser URL: ${url}`)
    },
  })

  assert.deepEqual(attempts, [
    `http:${airtelDigital.CAREERS_URL}`,
    `browser:${airtelDigital.CAREERS_URL}`,
    'http:https://careers.airtel.com/static/js/main.57023176.js',
    'browser:https://careers.airtel.com/static/js/main.57023176.js',
    `http:${airtelDigital.SHARED_DARWINBOX_URL}`,
    `browser:${airtelDigital.SHARED_DARWINBOX_URL}`,
  ])
  assert.deepEqual(jobs, [])
})

test('Airtel Digital fails closed when the shared Airtel surface drifts or becomes distinct', async () => {
  const airtelDigital = await loadAirtelDigitalModule()

  await assert.rejects(
    airtelDigital.createAirtelDigitalScraper().run({
      fetchText: async (url) => {
        if (url === airtelDigital.CAREERS_URL) {
          return careersShellHtml
        }

        if (url === 'https://careers.airtel.com/static/js/main.57023176.js') {
          return verifiedBundleText.replace(
            'https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
            'https://example.com/jobs',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Airtel careers bundle/i,
  )

  await assert.rejects(
    airtelDigital.createAirtelDigitalScraper().run({
      fetchText: async (url) => {
        if (url === airtelDigital.CAREERS_URL) {
          return careersShellHtml
        }

        if (url === 'https://careers.airtel.com/static/js/main.57023176.js') {
          return bundleWithDistinctAirtelDigitalSignal
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /distinct Airtel Digital public surface/i,
  )

  await assert.rejects(
    airtelDigital.createAirtelDigitalScraper().run({
      fetchText: async (url) => {
        if (url === airtelDigital.CAREERS_URL) {
          return careersShellHtml
        }

        if (url === 'https://careers.airtel.com/static/js/main.57023176.js') {
          return verifiedBundleText
        }

        if (url === airtelDigital.SHARED_DARWINBOX_URL) {
          return '<html><body>not the darwinbox shell</body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /shared Darwinbox shell/i,
  )
})
