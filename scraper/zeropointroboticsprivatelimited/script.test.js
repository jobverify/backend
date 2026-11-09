import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Zeropoint Robotics Private Limited scraper module at ./script.js')
  }
}

const parkedPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ZeropointRobotics.com is for sale | HugeDomains</title>
  </head>
  <body>
    <main>
      <h1>ZeropointRobotics.com is for sale</h1>
      <p>Own this domain today.</p>
      <a href="/domain_profile.cfm?d=ZeropointRobotics.com">Buy Now</a>
      <p>HugeDomains helps you secure premium domains.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Zeropoint Robotics</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/zeropointrobotics/founding-robotics-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const parkedPage = {
  status: 200,
  url: 'https://www.hugedomains.com/domain_profile.cfm?d=zeropointrobotics.com',
  html: parkedPageHtml,
}

test('Zeropoint Robotics Private Limited sentinel pins the verified HugeDomains parked first-party surface from July 13, 2026', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'zeropointroboticsprivatelimited')
  assert.equal(scraper.COMPANY, 'Zeropoint Robotics Private Limited')
  assert.equal(scraper.VERIFIED_ON, '2026-07-13')
  assert.equal(
    scraper.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026; the verified Zeropoint Robotics first-party homepage and careers-like routes all redirected to the same HugeDomains parked page for zeropointrobotics.com.',
  )
  assert.equal(
    scraper.PARKED_TARGET_URL,
    'https://www.hugedomains.com/domain_profile.cfm?d=zeropointrobotics.com',
  )
  assert.deepEqual(scraper.CHECKED_ROUTE_URLS, [
    'http://zeropointrobotics.com/',
    'http://www.zeropointrobotics.com/',
    'http://zeropointrobotics.com/careers',
    'http://www.zeropointrobotics.com/careers',
    'http://zeropointrobotics.com/jobs',
    'http://www.zeropointrobotics.com/jobs',
  ])
  assert.equal(scraper.hasVerifiedParkedPageSignal(parkedPage), true)
  assert.equal(scraper.hasVerifiedParkedPageSignal({
    ...parkedPage,
    url: 'https://example.com/domain_profile.cfm?d=zeropointrobotics.com',
  }), false)
  assert.equal(scraper.hasPublicJobsSignal(parkedPageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Zeropoint Robotics Private Limited sentinel returns [] only while every verified route stays on the same parked page', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createZeropointRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return parkedPage
    },
  })

  assert.deepEqual(requestedUrls, scraper.CHECKED_ROUTE_URLS)
  assert.deepEqual(jobs, [])
})

test('Zeropoint Robotics Private Limited sentinel fails closed when any verified route drifts or exposes jobs', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createZeropointRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Zeropoint Robotics</h1></body></html>',
          }
        }

        return parkedPage
      },
    }),
    /verified parked-domain route changed materially/i,
  )

  await assert.rejects(
    scraper.createZeropointRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CHECKED_ROUTE_URLS[2]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        return parkedPage
      },
    }),
    /appears to expose public jobs/i,
  )
})
