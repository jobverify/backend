import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Literact Fintech scraper module at ./script.js')
  }
}

const parkedHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Literact.com is for sale</title>
      <meta property="og:site_name" content="Sparkname" />
    </head>
    <body>
      <h1>Literact.com is for sale</h1>
      <p>Acquire this domain name today.</p>
    </body>
  </html>
`

const parkedHtmlWithDomainPricing = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Literact.com is for sale</title>
      <meta property="og:site_name" content="Sparkname" />
    </head>
    <body>
      <script>window.prices = {"careers":{"price":27.3}}</script>
      <h1>Literact.com is for sale</h1>
    </body>
  </html>
`

const unresolvedHostError = () => Object.assign(new Error('getaddrinfo ENOTFOUND'), {
  cause: { code: 'ENOTFOUND' },
})

test('Literact Fintech sentinel exposes the verified no-first-party-surface contract', async () => {
  const literact = await loadModule()

  assert.equal(literact.SOURCE, 'literactfintech')
  assert.equal(literact.COMPANY, 'Literact Fintech')
  assert.equal(literact.VERIFIED_ON, '2026-08-03')
  assert.equal(
    literact.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on August 3, 2026: every canonical literactfintech URL returned the expected unresolved-host error, and literact.com redirected to a parked Sparkname for-sale page.',
  )
  assert.deepEqual(literact.CANONICAL_HOSTS, [
    'literactfintech.com',
    'www.literactfintech.com',
    'literactfintech.in',
    'www.literactfintech.in',
  ])
  assert.deepEqual(literact.CANONICAL_URLS, [
    'https://literactfintech.com/',
    'https://www.literactfintech.com/',
    'https://literactfintech.in/',
    'https://www.literactfintech.in/',
  ])
  assert.equal(literact.PARKED_DOMAIN_URL, 'https://literact.com/')
  assert.equal(literact.PARKED_FINAL_URL, 'https://www.sparkname.com/name/Literact.com')
  assert.equal(literact.isExpectedUnresolvedHostError(unresolvedHostError()), true)
  assert.equal(literact.isExpectedUnresolvedHostError(new Error('network timeout')), false)
  assert.equal(literact.isVerifiedParkedPage({
    finalUrl: literact.PARKED_FINAL_URL,
    html: parkedHtml,
  }), true)
  assert.equal(literact.isVerifiedParkedPage({
    finalUrl: 'https://literact.com/careers',
    html: '<html><body><h1>Careers at Literact Fintech</h1></body></html>',
  }), false)
})

test('Literact Fintech sentinel returns no jobs only while every canonical URL is unresolved and the parked shell remains verified', async () => {
  const literact = await loadModule()
  const fetchCalls = []

  const jobs = await literact.createLiteractFintechScraper().run({
    fetchPage: async (url) => {
      fetchCalls.push(url)

      if (literact.CANONICAL_URLS.includes(url)) {
        throw unresolvedHostError()
      }

      assert.equal(url, literact.PARKED_DOMAIN_URL)

      return {
        finalUrl: literact.PARKED_FINAL_URL,
        html: parkedHtmlWithDomainPricing,
      }
    },
  })

  assert.deepEqual(fetchCalls, [...literact.CANONICAL_URLS, literact.PARKED_DOMAIN_URL])
  assert.deepEqual(jobs, [])
})

test('Literact Fintech sentinel fails closed when a canonical first-party URL responds', async () => {
  const literact = await loadModule()

  await assert.rejects(
    literact.createLiteractFintechScraper().run({
      fetchPage: async (url) => (literact.CANONICAL_URLS.includes(url)
        ? { finalUrl: url, html: '<html><body>Welcome</body></html>' }
        : { finalUrl: literact.PARKED_FINAL_URL, html: parkedHtml }),
    }),
    /canonical URL responded/i,
  )
})

test('Literact Fintech sentinel fails closed when the parked-domain verification drifts', async () => {
  const literact = await loadModule()

  await assert.rejects(
    literact.createLiteractFintechScraper().run({
      fetchPage: async (url) => {
        if (literact.CANONICAL_URLS.includes(url)) {
          throw unresolvedHostError()
        }

        return {
          finalUrl: 'https://literact.com/careers',
          html: '<html><body><h1>Open Roles</h1><a href="/jobs/backend-engineer">Apply now</a></body></html>',
        }
      },
    }),
    /parked domain surface changed|public jobs/i,
  )
})

test('Literact Fintech sentinel fails closed when a canonical URL cannot be authoritatively verified as unresolved', async () => {
  const literact = await loadModule()

  await assert.rejects(
    literact.createLiteractFintechScraper().run({
      fetchPage: async (url) => {
        if (url === literact.CANONICAL_URLS[0]) {
          throw new Error('network timeout')
        }

        throw unresolvedHostError()
      },
    }),
    /canonical URL could not be verified as unresolved/i,
  )
})
