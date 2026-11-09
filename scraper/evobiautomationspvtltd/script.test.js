import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Evobi Automations Pvt. Ltd scraper module at ./script.js')
  }
}

const parkedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Parked Domain name on Hostinger DNS system</title>
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  </head>
  <body>
    <div class="container">
      <div class="header-content">
        <div class="domain-info">
          <h1 class="domain-title" id="pathName"><i></i></h1>
          <span class="registered-text">Registered at</span>
        </div>
        <p class="description">If this is your domain, you can manage it in your Hostinger account.</p>
        <a href="https://hpanel.hostinger.com/domains?utm_source=parked-domain&utm_medium=referral">Manage domain</a>
      </div>
      <div class="services">
        <h2 class="services-title">Start your online journey</h2>
        <h3 class="service-title">Build your website today</h3>
        <h3 class="service-title">Prompt your website</h3>
        <h3 class="service-title">Power your projects with VPS</h3>
      </div>
    </div>
    <script>
      var pathName = window.location.hostname;
      var account = document.getElementById("pathName");
      account.innerHTML = pathName;
    </script>
  </body>
</html>
`

const disallowAllRobotsTxt = `
User-agent: *
Disallow: /
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Evobi Automations Pvt. Ltd</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/jobs/plc-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Evobi Automations Pvt. Ltd sentinel pins the verified parked-domain first-party surface from July 13, 2026', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'evobiautomationspvtltd')
  assert.equal(scraper.COMPANY, 'Evobi Automations Pvt. Ltd')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://evobi.in/')
  assert.equal(scraper.WWW_HOMEPAGE_URL, 'https://www.evobi.in/')
  assert.equal(scraper.ROBOTS_URL, 'https://evobi.in/robots.txt')
  assert.deepEqual(scraper.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://evobi.in/career',
    'https://evobi.in/careers',
    'https://evobi.in/careers/',
    'https://evobi.in/jobs',
    'https://evobi.in/openings',
    'https://evobi.in/current-openings',
  ])

  assert.equal(scraper.hasVerifiedParkedDomainSignal(parkedHomepageHtml), true)
  assert.equal(scraper.hasPublicJobsSignal(parkedHomepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(scraper.hasDisallowAllRobotsSignal(disallowAllRobotsTxt), true)
})

test('Evobi Automations Pvt. Ltd sentinel returns [] only while the verified parked-domain surface remains unchanged', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createEvobiAutomationsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL || url === scraper.WWW_HOMEPAGE_URL) {
        return parkedHomepageHtml
      }

      if (url === scraper.ROBOTS_URL) {
        return disallowAllRobotsTxt
      }

      if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return parkedHomepageHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.WWW_HOMEPAGE_URL,
    scraper.ROBOTS_URL,
    ...scraper.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Evobi Automations Pvt. Ltd sentinel fails closed when the parked domain or route contract drifts into a public jobs surface', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createEvobiAutomationsScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return '<html><head><title>Evobi</title></head><body><h1>Evobi</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified parked-domain surface/i,
  )

  await assert.rejects(
    scraper.createEvobiAutomationsScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL || url === scraper.WWW_HOMEPAGE_URL) {
          return publicJobsHtml
        }

        if (url === scraper.ROBOTS_URL) {
          return disallowAllRobotsTxt
        }

        if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return parkedHomepageHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /appears to expose public jobs/i,
  )

  await assert.rejects(
    scraper.createEvobiAutomationsScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL || url === scraper.WWW_HOMEPAGE_URL) {
          return parkedHomepageHtml
        }

        if (url === scraper.ROBOTS_URL) {
          return 'User-agent: *\nAllow: /'
        }

        if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return parkedHomepageHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots\.txt no longer matches the verified parked-domain surface/i,
  )

  await assert.rejects(
    scraper.createEvobiAutomationsScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL || url === scraper.WWW_HOMEPAGE_URL) {
          return parkedHomepageHtml
        }

        if (url === scraper.ROBOTS_URL) {
          return disallowAllRobotsTxt
        }

        if (url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return publicJobsHtml
        }

        if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return parkedHomepageHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
