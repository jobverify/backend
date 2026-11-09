import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crowdfire is evolving</title>
  </head>
  <body>
    <header>
      <img src="favicon.ico" alt="Logo">
      <h1>Crowdfire is evolving</h1>
    </header>
    <main>
      <p>
        After 15 years helping creators manage social media, we're becoming something new,
        a media platform dedicated to covering the intersection of social media, Web3, and AI.
      </p>
      <p>
        So we're doubling down on our mission: helping creators like you build, monetize,
        and own your digital future.
      </p>
      <section>
        <h2>What's changing:</h2>
        <ul>
          <li>Daily news &amp; insights</li>
          <li>Covering bigger topics: social media, Web3, AI</li>
          <li>Same real talk, broader focus</li>
        </ul>
      </section>
      <section>
        <h2>What's staying the same:</h2>
        <ul>
          <li>This community</li>
          <li>Our commitment to creators</li>
          <li>No BS approach</li>
        </ul>
      </section>
      <p>The next chapter starts now. Are you in?</p>
    </main>
  </body>
</html>
`

const loadCrowdfireModule = async () => {
  try {
    return await import('../../scraper/crowdfire/script.js')
  } catch {
    assert.fail('Expected Crowdfire scraper module at ../../scraper/crowdfire/script.js')
  }
}

test('Crowdfire validates the verified official shell and common careers-like fallback routes', async () => {
  const crowdfire = await loadCrowdfireModule()

  assert.equal(crowdfire.SOURCE, 'crowdfire')
  assert.equal(crowdfire.COMPANY, 'Crowdfire')
  assert.equal(crowdfire.HOMEPAGE_URL, 'https://www.crowdfireapp.com/')
  assert.deepEqual(crowdfire.CHECKED_ROUTE_URLS, [
    'https://www.crowdfireapp.com/careers',
    'https://www.crowdfireapp.com/careers/',
    'https://www.crowdfireapp.com/jobs',
    'https://www.crowdfireapp.com/jobs/',
    'https://www.crowdfireapp.com/join-us',
    'https://www.crowdfireapp.com/join-us/',
    'https://www.crowdfireapp.com/career',
    'https://www.crowdfireapp.com/career/',
  ])
  assert.equal(crowdfire.hasOfficialHomepageSignal(verifiedShellHtml), true)
  assert.equal(crowdfire.hasOfficialHomepageSignal('<html><body><h1>Unexpected shell</h1></body></html>'), false)
  assert.equal(crowdfire.hasPublicJobsSignal(verifiedShellHtml), false)
  assert.equal(
    crowdfire.hasPublicJobsSignal('<html><body><section><h2>Current Openings</h2><a href="/jobs/backend-engineer">Apply now</a></section></body></html>'),
    true,
  )
  assert.equal(crowdfire.isVerifiedRouteFallbackShell(verifiedShellHtml, verifiedShellHtml), true)
})

test('Crowdfire returns no jobs only while the verified official shell stays unchanged across checked routes', async () => {
  const crowdfire = await loadCrowdfireModule()
  const requestedUrls = []

  const jobs = await crowdfire.createCrowdfireScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: verifiedShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    crowdfire.HOMEPAGE_URL,
    ...crowdfire.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Crowdfire fails closed when the homepage shell changes or a checked route starts exposing public jobs', async () => {
  const crowdfire = await loadCrowdfireModule()

  await assert.rejects(
    crowdfire.createCrowdfireScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === crowdfire.HOMEPAGE_URL
          ? '<html><body><h1>Unexpected shell</h1></body></html>'
          : verifiedShellHtml,
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    crowdfire.createCrowdfireScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === crowdfire.CHECKED_ROUTE_URLS[0]
          ? `${verifiedShellHtml}<section><h2>Current Openings</h2><a href="https://jobs.ashbyhq.com/crowdfire/backend-engineer">Apply now</a></section>`
          : verifiedShellHtml,
      }),
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
