import assert from 'node:assert/strict'
import test from 'node:test'

const loadBankBazaarModule = async () => {
  try {
    return await import('../../scraper/bankbazaar/script.js')
  } catch {
    assert.fail('Expected BankBazaar scraper module at ../../scraper/bankbazaar/script.js')
  }
}

const homepageHtml = `
  <html>
    <head><title>BankBazaar</title></head>
    <body>
      <a href="/careers.html">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers at BankBazaar</title>
      <meta name="description" content="Join 1,000+ professionals disrupting personal finance at BankBazaar. Open roles in engineering, data, credit &amp; ops. Apply now and grow your career with us.">
      <link rel="canonical" href="https://www.bankbazaar.com/careers.html">
    </head>
    <body>
      <h1>Careers at BankBazaar</h1>
      <p>Join our team and help people access financial products.</p>
      <a href="/careers.html">Careers</a>
    </body>
  </html>
`

const publicListingsHtml = careersHtml.replace(
  '</body>',
  '<section><h2>Open Positions</h2><a href="https://jobs.lever.co/bankbazaar/senior-engineer">Senior Engineer - Bengaluru</a></section></body>',
)

test('BankBazaar scraper pins the verified homepage and nonlisting careers surface', async () => {
  const bankBazaar = await loadBankBazaarModule()

  assert.equal(bankBazaar.HOMEPAGE_URL, 'https://www.bankbazaar.com/')
  assert.equal(bankBazaar.CAREERS_PAGE_URL, 'https://www.bankbazaar.com/careers.html')
  assert.equal(bankBazaar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bankBazaar.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(bankBazaar.hasPublicJobListingSignal(careersHtml), false)
  assert.equal(bankBazaar.hasPublicJobListingSignal(publicListingsHtml), true)
})

test('BankBazaar run returns no jobs when the verified careers page remains nonlisting', async () => {
  const bankBazaar = await loadBankBazaarModule()
  const requestedUrls = []

  const jobs = await bankBazaar.createBankBazaarScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bankBazaar.HOMEPAGE_URL) return homepageHtml
      if (url === bankBazaar.CAREERS_PAGE_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    bankBazaar.HOMEPAGE_URL,
    bankBazaar.CAREERS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('BankBazaar run fails closed when the careers page starts exposing public listings', async () => {
  const bankBazaar = await loadBankBazaarModule()

  await assert.rejects(
    bankBazaar.createBankBazaarScraper().run({
      fetchText: async (url) => {
        if (url === bankBazaar.HOMEPAGE_URL) return homepageHtml
        return publicListingsHtml
      },
    }),
    /nonlisting careers surface/i,
  )
})
