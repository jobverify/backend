import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - ZebPay</title>
    <link rel="canonical" href="https://zebpay.com/careers" />
  </head>
  <body>
    <main>
      <h1>Welcome</h1>
      <h2>to the Ohana</h2>
      <a href="#openings">Explore Opportunities</a>
      <section>
        <h2>Benefits at Zebpay</h2>
        <p>Work with experts</p>
      </section>
      <section id="openings">
        <h2>Dear all visitors, we don't have any openings currently. Please come back soon for exciting opportunities!</h2>
      </section>
      <section>
        <h2>Hiring Process</h2>
        <p>
          Application: Want to be the part of the growing team, send us your application by
          applying to the relevant role from our current open position or write to us at
          <a href="mailto:careers@zebpay.com">careers@zebpay.com</a>
        </p>
      </section>
    </main>
  </body>
</html>
`

const openingsHtml = careersHtml.replace(
  "Dear all visitors, we don't have any openings currently. Please come back soon for exciting opportunities!",
  'Senior Backend Engineer',
)

const loadZebPayModule = async () => {
  try {
    return await import('../../scraper/zebpay/script.js')
  } catch {
    assert.fail('Expected ZebPay scraper module at ../../scraper/zebpay/script.js')
  }
}

test('ZebPay pins the verified first-party careers zero-openings surface from Saturday, July 25, 2026', async () => {
  const zebpay = await loadZebPayModule()

  assert.equal(zebpay.SOURCE, 'zebpay')
  assert.equal(zebpay.COMPANY, 'ZebPay')
  assert.equal(zebpay.VERIFIED_ON, '2026-07-25')
  assert.equal(zebpay.HOMEPAGE_URL, 'https://zebpay.com/')
  assert.equal(zebpay.CAREERS_URL, 'https://zebpay.com/careers')
  assert.equal(zebpay.CAREERS_EMAIL, 'careers@zebpay.com')
  assert.equal(zebpay.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(zebpay.hasVerifiedZeroOpeningsSignal(careersHtml), true)
  assert.equal(zebpay.hasPublicOpeningSignal(careersHtml), false)
  assert.equal(zebpay.hasPublicOpeningSignal(openingsHtml), true)
})

test('ZebPay run returns no jobs while the verified first-party careers page remains in its zero-openings state', async () => {
  const zebpay = await loadZebPayModule()
  const requestedUrls = []

  const jobs = await zebpay.createZebPayScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [zebpay.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('ZebPay fails closed when the verified first-party careers surface drifts or starts exposing openings', async () => {
  const zebpay = await loadZebPayModule()

  await assert.rejects(
    zebpay.createZebPayScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified zebpay careers page/i,
  )

  await assert.rejects(
    zebpay.createZebPayScraper().run({
      fetchText: async () => openingsHtml,
    }),
    /zebpay careers surface now exposes public openings/i,
  )
})
