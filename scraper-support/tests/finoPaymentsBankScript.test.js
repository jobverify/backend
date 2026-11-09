import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <nav>
      <a href="https://www.fino.bank.in/company/about-us">About Us</a>
      <a href="https://www.fino.bank.in/company/careers">Careers</a>
      <a href="https://www.fino.bank.in/investor-relations">Investor Relations</a>
    </nav>
    <main>
      <h1>Open your FinoPay Account now</h1>
      <p>FinoPay</p>
      <p>Savings Account</p>
      <p>Company</p>
    </main>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>We Empower Our People to Shape the Future of Digital Banking</h1>
    <a href="https://www.fino.bank.in/company/careers#:~:text=achieve%20their%20goals.-,Open%20Roles,-Search%20by%20role">View Open Positions</a>
    <section>
      <h2>Open Roles</h2>
      <p>Search by role</p>
      <p>Select Location</p>
      <p>Select Department</p>
      <p>No Roles Found</p>
    </section>
    <section>
      <h2>Can’t Find A Suitable Role?</h2>
      <a href="https://www.fino.bank.in/support/contact-us">Get In Touch</a>
    </section>
    <script type="application/json">
      {"form_schema":{"name":"Apply Now","description":"Enter your details below to apply for this position."}}
    </script>
  </body>
</html>
`

const alternate404Html = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>404</h1>
    </main>
  </body>
</html>
`

const publicJobPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>We Empower Our People to Shape the Future of Digital Banking</h1>
    <section>
      <h2>Open Roles</h2>
      <a href="https://www.fino.bank.in/company/careers/jobs/senior-manager-risk">Apply Now</a>
    </section>
  </body>
</html>
`

const loadFinoPaymentsBankModule = async () => {
  try {
    return await import('../../scraper/finopaymentsbank/script.js')
  } catch {
    assert.fail('Expected Fino Payments Bank scraper module at ../../scraper/finopaymentsbank/script.js')
  }
}

const createVerifiedFetchPage = (overrides = {}) => async (url) => {
  if (url === 'https://www.finobank.com/') {
    return overrides.legacyHomepage ?? {
      status: 200,
      url: 'https://www.fino.bank.in/',
      html: homepageHtml,
    }
  }

  if (url === 'https://www.fino.bank.in/') {
    return overrides.homepage ?? {
      status: 200,
      url,
      html: homepageHtml,
    }
  }

  if (url === 'https://www.fino.bank.in/company/careers') {
    return overrides.careersPage ?? {
      status: 200,
      url,
      html: careersPageHtml,
    }
  }

  if ([
    'https://www.fino.bank.in/careers',
    'https://www.fino.bank.in/career',
    'https://www.fino.bank.in/jobs',
    'https://www.fino.bank.in/join-us',
    'https://www.fino.bank.in/work-with-us',
    'https://www.fino.bank.in/current-openings',
  ].includes(url)) {
    return overrides.alternateRoute?.(url) ?? {
      status: 404,
      url,
      html: alternate404Html,
    }
  }

  throw new Error(`Unexpected URL: ${url}`)
}

test('Fino Payments Bank pins the verified homepage handoff, non-listing careers page, and 404 alternate routes', async () => {
  const finoPaymentsBank = await loadFinoPaymentsBankModule()

  assert.equal(finoPaymentsBank.SOURCE, 'finopaymentsbank')
  assert.equal(finoPaymentsBank.COMPANY, 'Fino Payments Bank')
  assert.equal(finoPaymentsBank.OFFICIAL_BRAND_NAME, 'Fino Payments Bank')
  assert.equal(finoPaymentsBank.VERIFIED_ON, '2026-10-03')
  assert.equal(finoPaymentsBank.LEGACY_HOMEPAGE_URL, 'https://www.finobank.com/')
  assert.equal(finoPaymentsBank.HOMEPAGE_URL, 'https://www.fino.bank.in/')
  assert.equal(finoPaymentsBank.CAREERS_URL, 'https://www.fino.bank.in/company/careers')
  assert.deepEqual(finoPaymentsBank.ALTERNATE_ROUTE_URLS, [
    'https://www.fino.bank.in/careers',
    'https://www.fino.bank.in/career',
    'https://www.fino.bank.in/jobs',
    'https://www.fino.bank.in/join-us',
    'https://www.fino.bank.in/work-with-us',
    'https://www.fino.bank.in/current-openings',
  ])
  assert.match(finoPaymentsBank.VERIFIED_SURFACE_SUMMARY, /No Roles Found/i)
  assert.match(finoPaymentsBank.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(finoPaymentsBank.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    finoPaymentsBank.extractHomepageCareerUrl(homepageHtml),
    'https://www.fino.bank.in/company/careers',
  )
  assert.deepEqual(finoPaymentsBank.extractPublicJobLinks(careersPageHtml), [])
  assert.equal(finoPaymentsBank.hasPublicJobListingSignal(careersPageHtml), false)
  assert.equal(finoPaymentsBank.hasVerifiedNonListingCareersPageSignal(careersPageHtml), true)
  assert.equal(
    finoPaymentsBank.isVerifiedLegacyHomepageRedirect({
      status: 200,
      url: finoPaymentsBank.HOMEPAGE_URL,
      html: homepageHtml,
    }),
    true,
  )
  assert.equal(
    finoPaymentsBank.isVerifiedAlternateRoute404(
      {
        status: 404,
        url: finoPaymentsBank.ALTERNATE_ROUTE_URLS[0],
        html: alternate404Html,
      },
      finoPaymentsBank.ALTERNATE_ROUTE_URLS[0],
    ),
    true,
  )
})

test('Fino Payments Bank sentinel returns [] only while the verified no-listing surface remains unchanged', async () => {
  const finoPaymentsBank = await loadFinoPaymentsBankModule()
  const requestedUrls = []

  const jobs = await finoPaymentsBank.createFinoPaymentsBankScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === finoPaymentsBank.LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: finoPaymentsBank.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === finoPaymentsBank.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === finoPaymentsBank.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: careersPageHtml,
        }
      }

      if (finoPaymentsBank.ALTERNATE_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: alternate404Html,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    finoPaymentsBank.LEGACY_HOMEPAGE_URL,
    finoPaymentsBank.HOMEPAGE_URL,
    finoPaymentsBank.CAREERS_URL,
    ...finoPaymentsBank.ALTERNATE_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Fino Payments Bank sentinel fails closed when the homepage handoff, careers page, or alternate routes drift', async () => {
  const finoPaymentsBank = await loadFinoPaymentsBankModule()

  await assert.rejects(
    finoPaymentsBank.createFinoPaymentsBankScraper().run({
      fetchPage: createVerifiedFetchPage({
        legacyHomepage: {
          status: 200,
          url: finoPaymentsBank.LEGACY_HOMEPAGE_URL,
          html: homepageHtml,
        },
      }),
    }),
    /legacy homepage redirect/i,
  )

  await assert.rejects(
    finoPaymentsBank.createFinoPaymentsBankScraper().run({
      fetchPage: createVerifiedFetchPage({
        homepage: {
          status: 200,
          url: finoPaymentsBank.HOMEPAGE_URL,
          html: homepageHtml.replace('https://www.fino.bank.in/company/careers', 'https://example.com/jobs'),
        },
      }),
    }),
    /homepage Careers link changed materially/i,
  )

  await assert.rejects(
    finoPaymentsBank.createFinoPaymentsBankScraper().run({
      fetchPage: createVerifiedFetchPage({
        careersPage: {
          status: 200,
          url: finoPaymentsBank.CAREERS_URL,
          html: publicJobPageHtml,
        },
      }),
    }),
    /careers page now exposes public jobs/i,
  )

  await assert.rejects(
    finoPaymentsBank.createFinoPaymentsBankScraper().run({
      fetchPage: createVerifiedFetchPage({
        alternateRoute: (url) => (
          url === finoPaymentsBank.ALTERNATE_ROUTE_URLS[0]
            ? {
                status: 200,
                url,
                html: homepageHtml,
              }
            : {
                status: 404,
                url,
                html: alternate404Html,
              }
        ),
      }),
    }),
    /alternate careers route changed materially or now exposes public jobs/i,
  )
})
