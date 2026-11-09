import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jaidka Power Systems Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>Jaidka Power Systems Pvt. Ltd.</h1>
      <a href="/BecomeDealer">Become a Dealer</a>
      <section>
        <h2>Our Products</h2>
        <p>JPS Arjun</p>
        <p>JPS Fateh</p>
      </section>
      <footer>
        <p>info@jaidka.in</p>
      </footer>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jaidka Power Systems Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>About Company</h1>
      <p>Jaidka Power Systems Pvt. Ltd. is part of the Jaidka Group.</p>
      <p>Since 2017, we are manufacturing electric 3-wheeler under the brand name of Arjun.</p>
      <p>You may also visit our website www.stellamoto.com.</p>
    </main>
  </body>
</html>
`

const teamHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jaidka Power Systems Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>Our Team</h1>
      <p>GOPAL K JAIDKA</p>
      <p>RACHNA JAIDKA</p>
      <p>Head of Human Resources &amp; Administrative operations at Jaidka Power Systems Pvt. Ltd.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a href="/careers/sales-manager">Current Openings</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Sales Manager" }
    </script>
  </body>
</html>
`

const loadJaidkaModule = async () => {
  try {
    return await import('../../scraper/jaidka/script.js')
  } catch {
    assert.fail('Expected Jaidka scraper module at ../../scraper/jaidka/script.js')
  }
}

test('Jaidka pins the verified homepage, about page, and team page sentinel surfaces', async () => {
  const jaidka = await loadJaidkaModule()

  assert.equal(jaidka.SOURCE, 'jaidka')
  assert.equal(jaidka.COMPANY_NAME, 'Jaidka')
  assert.equal(jaidka.OFFICIAL_BRAND_NAME, 'Jaidka Power Systems Pvt. Ltd.')
  assert.equal(jaidka.HOMEPAGE_URL, 'https://jaidka.in/')
  assert.equal(jaidka.ABOUT_PAGE_URL, 'https://jaidka.in/About_Company')
  assert.equal(jaidka.TEAM_PAGE_URL, 'https://jaidka.in/Team')
  assert.equal(jaidka.VERIFIED_ON, '2026-07-16')
  assert.equal(jaidka.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(jaidka.hasVerifiedAboutPageSignal(aboutHtml), true)
  assert.equal(jaidka.hasVerifiedTeamPageSignal(teamHtml), true)
  assert.equal(jaidka.hasPublicJobSignals(homepageHtml), false)
  assert.equal(jaidka.hasPublicJobSignals(aboutHtml), false)
  assert.equal(jaidka.hasPublicJobSignals(teamHtml), false)
  assert.equal(jaidka.hasPublicJobSignals(publicJobsHtml), true)
})

test('Jaidka returns [] only while the verified official surfaces stay product and dealer pages without public jobs', async () => {
  const jaidka = await loadJaidkaModule()
  const requestedUrls = []

  const jobs = await jaidka.createJaidkaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === jaidka.HOMEPAGE_URL) return homepageHtml
      if (url === jaidka.ABOUT_PAGE_URL) return aboutHtml
      if (url === jaidka.TEAM_PAGE_URL) return teamHtml
      throw new Error(`Unexpected Jaidka URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://jaidka.in/',
    'https://jaidka.in/About_Company',
    'https://jaidka.in/Team',
  ])
  assert.deepEqual(jobs, [])
})

test('Jaidka fails closed when the verified pages drift or a public jobs surface appears', async () => {
  const jaidka = await loadJaidkaModule()

  await assert.rejects(
    jaidka.createJaidkaScraper().run({
      fetchText: async (url) => {
        if (url === jaidka.HOMEPAGE_URL) {
          return homepageHtml.replace('Become a Dealer', 'Authorized Dealer Network')
        }
        throw new Error(`Unexpected Jaidka URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    jaidka.createJaidkaScraper().run({
      fetchText: async (url) => {
        if (url === jaidka.HOMEPAGE_URL) return homepageHtml
        if (url === jaidka.ABOUT_PAGE_URL) return publicJobsHtml
        if (url === jaidka.TEAM_PAGE_URL) return teamHtml
        throw new Error(`Unexpected Jaidka URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    jaidka.createJaidkaScraper().run({
      fetchText: async (url) => {
        if (url === jaidka.HOMEPAGE_URL) return homepageHtml
        if (url === jaidka.ABOUT_PAGE_URL) return aboutHtml
        if (url === jaidka.TEAM_PAGE_URL) {
          return teamHtml.replace('RACHNA JAIDKA', 'Leadership')
        }
        throw new Error(`Unexpected Jaidka URL: ${url}`)
      },
    }),
    /verified team page/i,
  )
})
