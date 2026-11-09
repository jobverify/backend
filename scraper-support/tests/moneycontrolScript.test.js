import assert from 'node:assert/strict'
import test from 'node:test'

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - Moneycontrol</title>
  </head>
  <body>
    <section class="contactPanel">
      <div class="contLft">Careers</div>
      <div class="contRgt">
        <p>Looking for a job?</p>
        <a target="_blank" href="https://www.moneycontrol.com/career/?classic=true" title="Current jobs at Moneycontrol">
          Current jobs at Moneycontrol
        </a>
      </div>
    </section>
  </body>
</html>
`

const blockedCareersHtml = `
<HTML>
  <HEAD>
    <TITLE>Error</TITLE>
  </HEAD>
  <BODY>
    An error occurred while processing your request.
    <p>Reference&#32;&#35;30&#46;b66c917&#46;1784470914&#46;b7dc5f0</p>
    <p>https&#58;&#47;&#47;errors&#46;edgesuite&#46;net&#47;30&#46;b66c917&#46;1784470914&#46;b7dc5f0</p>
  </BODY>
</HTML>
`

const accessibleCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <article>
      <h2>Senior Reporter</h2>
      <a href="/career/jobs/senior-reporter">Apply</a>
    </article>
  </body>
</html>
`

const loadMoneycontrolModule = async () => {
  try {
    return await import('../../scraper/moneycontrol/script.js')
  } catch {
    assert.fail('Expected Moneycontrol scraper module at ../../scraper/moneycontrol/script.js')
  }
}

test('Moneycontrol sentinel pins the verified official contact page and the blocked careers routes', async () => {
  const moneycontrol = await loadMoneycontrolModule()

  assert.equal(moneycontrol.SOURCE, 'moneycontrol')
  assert.equal(moneycontrol.COMPANY, 'Moneycontrol')
  assert.equal(moneycontrol.VERIFIED_AT, '2026-07-19')
  assert.equal(
    moneycontrol.CONTACT_PAGE_URL,
    'https://www.moneycontrol.com/cdata/contact.php?classic=true',
  )
  assert.deepEqual(moneycontrol.BLOCKED_CAREERS_ROUTE_URLS, [
    'https://www.moneycontrol.com/career/?classic=true',
    'https://www.moneycontrol.com/career/',
  ])

  assert.equal(moneycontrol.hasOfficialContactCareersSignal(contactPageHtml), true)
  assert.equal(moneycontrol.hasPublicJobBoardSignal(contactPageHtml), false)
  assert.equal(moneycontrol.hasPublicJobBoardSignal(accessibleCareersHtml), true)
  assert.equal(
    moneycontrol.isVerifiedBlockedCareersRoute({ status: 503, html: blockedCareersHtml }),
    true,
  )
  assert.equal(
    moneycontrol.isVerifiedBlockedCareersRoute({ status: 200, html: accessibleCareersHtml }),
    false,
  )
})

test('Moneycontrol sentinel returns [] only while the verified contact-page-plus-blocked-route surface remains unchanged', async () => {
  const moneycontrol = await loadMoneycontrolModule()
  const requestedUrls = []

  const jobs = await moneycontrol.createMoneycontrolScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === moneycontrol.CONTACT_PAGE_URL) {
        return { status: 200, url, html: contactPageHtml }
      }

      if (moneycontrol.BLOCKED_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 503, url, html: blockedCareersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    moneycontrol.CONTACT_PAGE_URL,
    ...moneycontrol.BLOCKED_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Moneycontrol sentinel fails closed when the contact page drifts or the careers route becomes accessible', async () => {
  const moneycontrol = await loadMoneycontrolModule()

  await assert.rejects(
    moneycontrol.createMoneycontrolScraper().run({
      fetchPage: async (url) => {
        if (url === moneycontrol.CONTACT_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official contact page/i,
  )

  await assert.rejects(
    moneycontrol.createMoneycontrolScraper().run({
      fetchPage: async (url) => {
        if (url === moneycontrol.CONTACT_PAGE_URL) {
          return { status: 200, url, html: contactPageHtml }
        }

        return { status: 200, url, html: accessibleCareersHtml }
      },
    }),
    /careers route changed materially or now exposes a public jobs surface/i,
  )
})
