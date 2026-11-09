import assert from 'node:assert/strict'
import test from 'node:test'

const loadTelestoEnergyModule = async () => {
  try {
    return await import('../../scraper/telestoenergy/script.js')
  } catch {
    assert.fail('Expected Telesto Energy scraper module at ../../scraper/telestoenergy/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>STRATA - Global Capability Centre for Subsurface | Telesto Energy</title>
    <meta
      name="description"
      content="STRATA is Telesto Energy's Global Capability Centre for Subsurface."
    >
  </head>
  <body>
    <main>
      <h1>Where Strata Meets Strategy</h1>
      <p>STRATA is Telesto Energy's global hub for AI-driven subsurface intelligence.</p>
    </main>
    <footer>
      <a href="mailto:contact@telestoenergy.com">contact@telestoenergy.com</a>
      <a href="https://sg.linkedin.com/company/telesto-energy">LinkedIn</a>
    </footer>
  </body>
</html>
`

test('Telesto Energy scraper targets the verified official homepage and missing careers routes', async () => {
  const telestoEnergy = await loadTelestoEnergyModule()

  assert.equal(telestoEnergy.SOURCE, 'telestoenergy')
  assert.equal(telestoEnergy.COMPANY, 'Telesto Energy')
  assert.equal(telestoEnergy.HOMEPAGE_URL, 'https://www.telestoenergy.com/')
  assert.deepEqual(telestoEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.telestoenergy.com/careers',
    'https://www.telestoenergy.com/careers/',
    'https://www.telestoenergy.com/career',
    'https://www.telestoenergy.com/career/',
    'https://www.telestoenergy.com/jobs',
    'https://www.telestoenergy.com/jobs/',
  ])
  assert.equal(telestoEnergy.hasOfficialSiteSignal(officialHomepageHtml), true)
  assert.equal(telestoEnergy.isMissingCareerRoute({ status: 404 }), true)
})

test('Telesto Energy returns no jobs while the verified homepage remains live and first-party careers routes stay missing', async () => {
  const telestoEnergy = await loadTelestoEnergyModule()
  const requestedUrls = []

  const jobs = await telestoEnergy.createTelestoEnergyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === telestoEnergy.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (telestoEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    telestoEnergy.HOMEPAGE_URL,
    ...telestoEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Telesto Energy fails closed when the homepage changes or a first-party careers route starts resolving', async () => {
  const telestoEnergy = await loadTelestoEnergyModule()

  await assert.rejects(
    telestoEnergy.createTelestoEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === telestoEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    telestoEnergy.createTelestoEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === telestoEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === telestoEnergy.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open Positions</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers surface/i,
  )
})
