import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>eCommerce Logistics and Shipping Solutions for D2C brands and businesses | Ship your business order with Delhivery</title>
  </head>
  <body>
    <h1>eCommerce Logistics and Shipping Solutions for D2C brands and businesses</h1>
    <p>Start shipping within 5 minutes of sign up.</p>
  </body>
</html>
`

const accessibleLegacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Primaseller Careers</title>
  </head>
  <body>
    <h1>Careers at Primaseller</h1>
    <article>
      <h2>Senior Product Manager</h2>
      <a href="/jobs/senior-product-manager">Apply</a>
    </article>
  </body>
</html>
`

const loadPrimasellerModule = async () => {
  try {
    return await import('../../scraper/primaseller/script.js')
  } catch {
    assert.fail('Expected Primaseller scraper module at ../../scraper/primaseller/script.js')
  }
}

test('Primaseller sentinel pins the verified exact-name redirect and expired TLS legacy surfaces', async () => {
  const primaseller = await loadPrimasellerModule()

  assert.equal(primaseller.SOURCE, 'primaseller')
  assert.equal(primaseller.COMPANY, 'Primaseller')
  assert.equal(primaseller.VERIFIED_AT, '2026-07-17')
  assert.equal(primaseller.HOMEPAGE_URL, 'https://www.primaseller.com/')
  assert.equal(primaseller.LEGACY_ABOUT_PAGE_URL, 'https://help.primaseller.com/about-us')
  assert.equal(primaseller.LEGACY_FSLINK_URL, 'https://fslink.primaseller.com/')
  assert.equal(
    primaseller.REDIRECT_TARGET_URL,
    'https://www.delhivery.com/solutions/d2c-brands',
  )

  assert.equal(
    primaseller.hasRedirectedDelhiverySignal({
      status: 200,
      url: 'https://www.delhivery.com/solutions/d2c-brands',
      html: redirectedHomepageHtml,
    }),
    true,
  )
  assert.equal(
    primaseller.isExpiredLegacyTlsSurface({
      error:
        'curl: (35) schannel: next InitializeSecurityContext failed: SEC_E_CERT_EXPIRED (0x80090328) - The received certificate has expired.',
    }),
    true,
  )
  assert.equal(
    primaseller.isExpiredLegacyTlsSurface({
      status: 200,
      url: 'https://help.primaseller.com/about-us',
      html: accessibleLegacyHtml,
    }),
    false,
  )
  assert.equal(
    primaseller.isExpiredLegacyTlsSurface({
      error: 'TypeError: fetch failed',
      causeMessage: 'certificate has expired',
      causeCode: 'CERT_HAS_EXPIRED',
    }),
    true,
  )
  assert.equal(
    primaseller.hasRedirectedDelhiverySignal({
      status: 200,
      url: 'http://www.delhivery.com/solutions/d2c-brands',
      html: redirectedHomepageHtml,
    }),
    false,
  )
})

test('Primaseller keeps the verified redirect target independent of mutable catalog metadata', async () => {
  const catalog = await import('../../scraper/primaseller/catalog.js')
  const originalTarget = catalog.PRIMASELLER_CATALOG.redirectTargetUrl

  catalog.PRIMASELLER_CATALOG.redirectTargetUrl = 'https://example.com/untrusted-target'

  try {
    const primaseller = await import(`../../scraper/primaseller/script.js?redirect-target-test=${Date.now()}`)
    assert.equal(primaseller.REDIRECT_TARGET_URL, 'https://www.delhivery.com/solutions/d2c-brands')
  } finally {
    catalog.PRIMASELLER_CATALOG.redirectTargetUrl = originalTarget
  }
})

test('Primaseller sentinel returns [] only while the exact-name redirect and expired legacy surfaces remain unchanged', async () => {
  const primaseller = await loadPrimasellerModule()
  const requestedUrls = []

  const jobs = await primaseller.createPrimasellerScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === primaseller.HOMEPAGE_URL) {
        return {
          status: 200,
          url: primaseller.REDIRECT_TARGET_URL,
          html: redirectedHomepageHtml,
        }
      }

      if (url === primaseller.LEGACY_ABOUT_PAGE_URL || url === primaseller.LEGACY_FSLINK_URL) {
        return {
          error:
            'curl: (35) schannel: next InitializeSecurityContext failed: SEC_E_CERT_EXPIRED (0x80090328) - The received certificate has expired.',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    primaseller.HOMEPAGE_URL,
    primaseller.LEGACY_ABOUT_PAGE_URL,
    primaseller.LEGACY_FSLINK_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Primaseller sentinel treats the current fetch-failed-plus-expired-certificate legacy shape as unchanged', async () => {
  const primaseller = await loadPrimasellerModule()

  const jobs = await primaseller.createPrimasellerScraper().run({
    fetchPage: async (url) => {
      if (url === primaseller.HOMEPAGE_URL) {
        return {
          status: 200,
          url: primaseller.REDIRECT_TARGET_URL,
          html: redirectedHomepageHtml,
        }
      }

      if (url === primaseller.LEGACY_ABOUT_PAGE_URL || url === primaseller.LEGACY_FSLINK_URL) {
        return {
          error: 'TypeError: fetch failed',
          causeMessage: 'certificate has expired',
          causeCode: 'CERT_HAS_EXPIRED',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Primaseller sentinel fails closed when the redirect changes or a legacy surface becomes reachable', async () => {
  const primaseller = await loadPrimasellerModule()

  await assert.rejects(
    primaseller.createPrimasellerScraper().run({
      fetchPage: async (url) => {
        if (url === primaseller.HOMEPAGE_URL) {
          return { status: 200, url, html: accessibleLegacyHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /exact-name homepage redirect changed materially/i,
  )

  await assert.rejects(
    primaseller.createPrimasellerScraper().run({
      fetchPage: async (url) => {
        if (url === primaseller.HOMEPAGE_URL) {
          return {
            status: 200,
            url: primaseller.REDIRECT_TARGET_URL,
            html: redirectedHomepageHtml,
          }
        }

        return {
          status: 200,
          url,
          html: accessibleLegacyHtml,
        }
      },
    }),
    /legacy exact-name surfaces changed materially or now expose a reachable public surface/i,
  )
})
