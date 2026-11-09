import assert from 'node:assert/strict'
import test from 'node:test'

const acquisitionHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>InfoWorks | Uniphore</title>
  </head>
  <body>
    <nav>
      <a href="https://www.uniphore.com/about-us/">About us</a>
      <a href="https://www.uniphore.com/careers/">Careers</a>
      <a href="https://www.uniphore.com/contact/">Contact us</a>
    </nav>
    <h1>Uniphore Acquired InfoWorks</h1>
    <p>
      Uniphore has acquired Infoworks, which significantly expands its AI-powered offerings to
      extend Uniphore’s comprehensive end-to-end Enterprise AI platform.
    </p>
    <p>By combining Uniphore’s AI expertise with Infoworks’ enterprise AI data agents platform.</p>
  </body>
</html>
`

const loadInfoworksModule = async () => {
  try {
    return await import('../../scraper/infoworks/script.js')
  } catch {
    assert.fail('Expected Infoworks scraper module at ../../scraper/infoworks/script.js')
  }
}

test('Infoworks scraper helpers stay pinned to the verified acquisition landing-page redirect contract', async () => {
  const infoworks = await loadInfoworksModule()

  assert.equal(infoworks.SOURCE, 'infoworks')
  assert.equal(infoworks.COMPANY, 'Infoworks')
  assert.equal(infoworks.COMPANY_DOMAIN, 'infoworks.io')
  assert.equal(infoworks.ACQUISITION_URL, 'https://www.uniphore.com/infoworks/')
  assert.equal(infoworks.PARENT_CAREERS_URL, 'https://www.uniphore.com/careers/')
  assert.equal(infoworks.VERIFIED_AT, '2026-07-17')
  assert.deepEqual(infoworks.FIRST_PARTY_REDIRECT_ROUTES, [
    'https://www.infoworks.io/',
    'https://www.infoworks.io/careers',
    'https://www.infoworks.io/jobs',
    'https://www.infoworks.io/about',
  ])
  assert.equal(infoworks.extractParentCareersUrl(acquisitionHtml), 'https://www.uniphore.com/careers/')
  assert.equal(infoworks.hasOfficialAcquisitionSignal(acquisitionHtml), true)
  assert.equal(
    infoworks.isExpectedInfoworksRedirectSurface({
      url: 'https://www.infoworks.io/jobs',
      finalUrl: 'https://www.uniphore.com/infoworks/',
      status: 200,
      html: acquisitionHtml,
    }),
    true,
  )
})

test('Infoworks run returns [] only while the exact-name domain keeps redirecting to the verified acquisition page', async () => {
  const infoworks = await loadInfoworksModule()
  const requestedUrls = []

  const jobs = await infoworks.createInfoworksScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return {
        url,
        finalUrl: 'https://www.uniphore.com/infoworks/',
        status: 200,
        html: acquisitionHtml,
        errorKind: null,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.uniphore.com/infoworks/',
    ...infoworks.FIRST_PARTY_REDIRECT_ROUTES,
  ])
  assert.deepEqual(jobs, [])
})

test('Infoworks fails closed when the acquisition page drifts or an exact-name public jobs surface becomes reachable', async () => {
  const infoworks = await loadInfoworksModule()

  await assert.rejects(
    infoworks.createInfoworksScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url === 'https://www.uniphore.com/infoworks/' ? 'https://www.uniphore.com/infoworks/' : url,
        status: 200,
        html: '<html><title>Unexpected</title></html>',
        errorKind: null,
      }),
    }),
    /acquisition page/i,
  )

  await assert.rejects(
    infoworks.createInfoworksScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://www.infoworks.io/careers') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>Open Positions</h1><a href="/apply">Apply now</a></body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: 'https://www.uniphore.com/infoworks/',
          status: 200,
          html: acquisitionHtml,
          errorKind: null,
        }
      },
    }),
    /public jobs surface/i,
  )
})
