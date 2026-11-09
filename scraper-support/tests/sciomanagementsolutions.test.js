import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/sciomanagementsolutions/catalog.js')
  } catch {
    assert.fail('Expected SCIO Management Solutions catalog module at ../../scraper/sciomanagementsolutions/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/sciomanagementsolutions/script.js')
  } catch {
    assert.fail('Expected SCIO Management Solutions scraper module at ../../scraper/sciomanagementsolutions/script.js')
  }
}

const verifiedPlaceholderShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SCIO Management Solutions - Intelligent, Automated RCM Services</title>
    <link rel="canonical" href="https://www.scioms.com/index.php" />
  </head>
  <body>
    <main>
      <h1>Request a Consultation</h1>
      <button type="submit">Submit</button>
      <button type="button">Close</button>
    </main>
  </body>
</html>
`

test('SCIO catalog captures the verified canonical placeholder shell with no public jobs surface', async () => {
  const { SCIOMS_CATALOG } = await loadCatalog()

  assert.equal(SCIOMS_CATALOG.source, 'sciomanagementsolutions')
  assert.equal(SCIOMS_CATALOG.companyName, 'SCIO Management Solutions')
  assert.equal(SCIOMS_CATALOG.homepageUrl, 'https://scioms.com/')
  assert.equal(SCIOMS_CATALOG.companyCareerPage, 'https://scioms.com/careers.php')
  assert.equal(SCIOMS_CATALOG.applyUrl, 'https://scioms.com/apply-now.php')
  assert.equal(SCIOMS_CATALOG.atsPlatform, 'official-site-placeholder-shell-no-public-jobs')
  assert.equal(SCIOMS_CATALOG.countryFilter, 'India')
  assert.equal(SCIOMS_CATALOG.verifiedOn, '2026-08-14')
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /Request a Consultation/i)
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /canonical/i)
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /no trustworthy public job detail surface/i)
})

test('SCIO sentinel returns [] only while the canonical careers and apply routes stay on the verified placeholder shell', async () => {
  const scio = await loadScript()

  assert.equal(scio.hasVerifiedPlaceholderShellSignal(verifiedPlaceholderShellHtml), true)
  assert.equal(scio.hasVerifiedCareersSignal(verifiedPlaceholderShellHtml), true)
  assert.equal(scio.hasVerifiedApplyFormSignal(verifiedPlaceholderShellHtml), true)
  assert.equal(
    scio.hasPublicJobListingsSignal('<section><h2>Current Openings</h2><a href="/job/analyst">Revenue Cycle Analyst</a></section>'),
    true,
  )

  const jobs = await scio.run({
    fetchText: async (url) => {
      if (url === scio.CAREERS_URL) return verifiedPlaceholderShellHtml
      if (url === scio.APPLY_URL) return verifiedPlaceholderShellHtml
      assert.fail(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    scio.run({
      fetchText: async (url) => {
        if (url === scio.CAREERS_URL) return verifiedPlaceholderShellHtml
        if (url === scio.APPLY_URL) {
          return '<html><body><h1>Current Openings</h1><a href="/job/revenue-cycle-analyst">Revenue Cycle Analyst</a></body></html>'
        }
        assert.fail(`Unexpected URL: ${url}`)
      },
    }),
    /public positions/i,
  )
})

test('SCIO sentinel can recover from direct HTTP parser failures through the lenient transport', async () => {
  const scio = await loadScript()
  const requested = []

  const jobs = await scio.run({
    fetchText: async () => {
      const error = new TypeError('fetch failed')
      error.cause = new Error(
        'Response does not match the HTTP/1.1 protocol (Invalid header value char)',
      )
      throw error
    },
    fetchLenientText: async (url) => {
      requested.push(url)
      if (url === scio.CAREERS_URL) return verifiedPlaceholderShellHtml
      if (url === scio.APPLY_URL) return verifiedPlaceholderShellHtml
      assert.fail(`Unexpected lenient URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [scio.CAREERS_URL, scio.APPLY_URL])
  assert.deepEqual(jobs, [])
})
