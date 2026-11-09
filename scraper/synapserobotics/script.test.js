import assert from 'node:assert/strict'
import test from 'node:test'

const loadSynapseRoboticsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Synapse Robotics &amp; AI - AI-Powered K-College Coding Education | California, USA</title>
  </head>
  <body>
    <main>
      <p>CMU Robotics Academy Partner</p>
      <p>VEX Certified</p>
      <h1>Build. Code. Explore!</h1>
      <p>AI-Powered Robotics and Coding</p>
      <p>K through College</p>
      <p>Trusted by schools, families, and partners across the Bay Area.</p>
      <section>
        <h2>The People Behind It</h2>
        <p>Jyothsna J</p>
        <p>Founder &amp; Director</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>(925) 819-3960</p>
        <p>jyothsnaj@synapserobotics.net</p>
        <p>San Ramon, California, USA</p>
      </section>
    </main>
  </body>
</html>
`

const verifiedFallbackRouteHtml = officialHomepageHtml

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Synapse Robotics</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Join our team.</p>
      <a href="https://synapserobotics.ai/careers/stem-mentor">Apply Now</a>
    </main>
  </body>
</html>
`

test('Synapse Robotics sentinel recognizes the verified homepage shell and route fallback shell', async () => {
  const synapseRobotics = await loadSynapseRoboticsModule()
  assert.ok(synapseRobotics, 'Expected Synapse Robotics scraper module at ./script.js')

  assert.equal(synapseRobotics.SOURCE, 'synapserobotics')
  assert.equal(synapseRobotics.COMPANY, 'Synapse Robotics')
  assert.equal(synapseRobotics.HOMEPAGE_URL, 'https://synapserobotics.ai/')
  assert.deepEqual(synapseRobotics.CHECKED_ROUTE_URLS, [
    'https://synapserobotics.ai/careers',
    'https://synapserobotics.ai/careers/',
    'https://synapserobotics.ai/jobs',
    'https://synapserobotics.ai/jobs/',
    'https://synapserobotics.ai/join-us',
    'https://synapserobotics.ai/join-us/',
    'https://synapserobotics.ai/work-with-us',
    'https://synapserobotics.ai/openings',
  ])
  assert.equal(synapseRobotics.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(synapseRobotics.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(
    synapseRobotics.isVerifiedRouteFallbackShell(verifiedFallbackRouteHtml, officialHomepageHtml),
    true,
  )
})

test('Synapse Robotics sentinel returns no jobs while career-like routes stay on the verified homepage shell', async () => {
  const synapseRobotics = await loadSynapseRoboticsModule()
  assert.ok(synapseRobotics, 'Expected Synapse Robotics scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await synapseRobotics.createSynapseRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === synapseRobotics.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (synapseRobotics.CHECKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: verifiedFallbackRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    synapseRobotics.HOMEPAGE_URL,
    ...synapseRobotics.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Synapse Robotics sentinel fails closed when the homepage or route drifts into a public jobs surface', async () => {
  const synapseRobotics = await loadSynapseRoboticsModule()
  assert.ok(synapseRobotics, 'Expected Synapse Robotics scraper module at ./script.js')

  await assert.rejects(
    synapseRobotics.createSynapseRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === synapseRobotics.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body><main>Unexpected</main></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    synapseRobotics.createSynapseRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === synapseRobotics.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === synapseRobotics.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        if (synapseRobotics.CHECKED_ROUTE_URLS.slice(1).includes(url)) {
          return {
            status: 200,
            url,
            html: verifiedFallbackRouteHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /checked first-party route changed materially or now exposes public jobs/i,
  )
})
