import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedSpaShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#04120b" />
    <meta
      name="description"
      content="IndiEnergy transforms agricultural biomass into advanced Sodium-ion battery materials and intelligent energy-storage systems - sustainable, resilient, and built for generations to come."
    />
    <meta property="og:title" content="IndiEnergy - Desh Ki Battery. Designed for the World." />
    <meta
      property="og:description"
      content="IndiEnergy transforms agricultural biomass into advanced Sodium-ion battery materials and intelligent energy-storage systems."
    />
    <meta property="og:type" content="website" />
    <title>IndiEnergy - Desh Ki Battery. Designed for the World.</title>
    <script type="module" crossorigin src="/assets/index-5cQSROgk.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-Do4Dnj3f.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const loadIndiEnergyModule = async () => {
  try {
    return await import('../../scraper/indienergy/script.js')
  } catch {
    assert.fail('Expected Indi Energy scraper module at ../../scraper/indienergy/script.js')
  }
}

test('Indi Energy sentinels recognize the verified homepage and rebuilt no-public-careers shell', async () => {
  const indiEnergy = await loadIndiEnergyModule()

  assert.equal(indiEnergy.SOURCE, 'indienergy')
  assert.equal(indiEnergy.COMPANY, 'INDI ENERGY')
  assert.equal(indiEnergy.HOMEPAGE_URL, 'https://indienergy.in/')
  assert.equal(indiEnergy.CAREERS_URL, 'https://indienergy.in/careers/')
  assert.equal(indiEnergy.VERIFIED_ON, '2026-08-07')
  assert.match(indiEnergy.VERIFIED_SURFACE_SUMMARY, /Friday, August 7, 2026/i)
  assert.match(indiEnergy.VERIFIED_SURFACE_SUMMARY, /Desh Ki Battery/i)
  assert.match(indiEnergy.VERIFIED_SURFACE_SUMMARY, /Send enquiry/i)
  assert.equal(indiEnergy.hasOfficialHomepageSignal(verifiedSpaShellHtml), true)
  assert.equal(indiEnergy.hasNoPublicCareersShellSignal(verifiedSpaShellHtml), true)
  assert.equal(indiEnergy.hasPublicJobListingsSignal(verifiedSpaShellHtml), false)
  assert.equal(indiEnergy.extractCareersUrl(verifiedSpaShellHtml), null)
})

test('Indi Energy returns no jobs only while the verified first-party no-public-careers shell holds', async () => {
  const indiEnergy = await loadIndiEnergyModule()
  const requestedPages = []

  const jobs = await indiEnergy.createIndiEnergyScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === indiEnergy.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedSpaShellHtml,
        }
      }

      if (url === indiEnergy.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: verifiedSpaShellHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [indiEnergy.HOMEPAGE_URL, indiEnergy.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Indi Energy fails closed when the homepage or no-public-careers shell changes materially', async () => {
  const indiEnergy = await loadIndiEnergyModule()

  await assert.rejects(
    indiEnergy.createIndiEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === indiEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, html: verifiedSpaShellHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    indiEnergy.createIndiEnergyScraper().run({
      fetchPage: async (url) => {
        if (url === indiEnergy.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedSpaShellHtml }
        }

        return {
          status: 200,
          url,
          html: verifiedSpaShellHtml.replace(
            '<div id="root"></div>',
            '<div id="root"></div><section>Current Openings Senior Battery Engineer</section>',
          ),
        }
      },
    }),
    /public job listings/i,
  )

  await assert.rejects(
    indiEnergy.createIndiEnergyScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === indiEnergy.HOMEPAGE_URL
          ? verifiedSpaShellHtml
          : verifiedSpaShellHtml.replace('Desh Ki Battery. Designed for the World.', 'Unexpected Careers'),
      }),
    }),
    /no-public-careers shell/i,
  )
})
