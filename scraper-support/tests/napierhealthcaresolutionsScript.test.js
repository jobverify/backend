import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Napier</title>
  </head>
  <body>
    <h1>Careers at Napier</h1>
    <p>VIEW ALL OPENINGS</p>
    <p>Explore our current openings and submit your resume.</p>
    <a href="https://www.linkedin.com/company/napier-healthcare/">LinkedIn</a>
  </body>
</html>
`

const PUBLIC_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Napier</title>
  </head>
  <body>
    <h1>Careers at Napier</h1>
    <p>VIEW ALL OPENINGS</p>
    <p>Explore our current openings and submit your resume.</p>
    <a href="http://www.napierhealthcare.com/v2/openings/senior-analyst">Open position</a>
    <a href="https://www.linkedin.com/company/napier-healthcare/">LinkedIn</a>
  </body>
</html>
`

const loadNapierModule = async () => {
  try {
    return await import('../../scraper/napierhealthcaresolutions/script.js')
  } catch {
    assert.fail('Expected Napier Healthcare Solutions scraper module at ../../scraper/napierhealthcaresolutions/script.js')
  }
}

test('Napier constants preserve the last verified first-party careers parser while the route is unavailable', async () => {
  const napier = await loadNapierModule()

  assert.equal(napier.SOURCE, 'napierhealthcaresolutions')
  assert.equal(napier.COMPANY, 'Napier Healthcare Solutions')
  assert.equal(napier.CAREERS_URL, 'http://www.napierhealthcare.com/v2/careers/')
  assert.equal(napier.PROVIDER_METADATA.homepageUrl, 'http://www.napierhealthcare.com/v2/')
  assert.equal(napier.PROVIDER_METADATA.verifiedOn, '2026-09-13')
  assert.equal(napier.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(napier.extractSameDomainJobLinks(CAREERS_HTML), [])
})

test('Napier returns discovery-only evidence when the verified careers route returns HTTP 404', async () => {
  const napier = await loadNapierModule()
  const missingRouteError = Object.assign(
    new Error(`HTTP 404 for ${napier.CAREERS_URL}`),
    { status: 404 },
  )
  const requestedUrls = []

  const jobs = await napier.run({
      fetchText: async (url) => {
        requestedUrls.push(url)
        throw missingRouteError
      },
    },
  )

  assert.deepEqual(requestedUrls, [napier.CAREERS_URL])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, napier.CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Napier returns [] when the reachable first-party careers page is still marketing-only with no same-domain opening links', async () => {
  const napier = await loadNapierModule()
  const requestedUrls = []

  const jobs = await napier.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === napier.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected Napier URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, ['http://www.napierhealthcare.com/v2/careers/'])
  assert.deepEqual(jobs, [])
})

test('Napier fails closed when the reachable first-party careers page starts exposing same-domain public opening links', async () => {
  const napier = await loadNapierModule()

  await assert.rejects(
    napier.run({
      fetchText: async () => PUBLIC_OPENINGS_HTML,
    }),
    /public jobs surface changed materially/i,
  )
})
