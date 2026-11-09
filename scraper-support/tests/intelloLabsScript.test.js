import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

const careersHtml = `
<!doctype html>
<html>
  <head><title>Careers | Intello Labs</title></head>
  <body>
    <h1>Careers</h1>
    <p>Intello Labs has some of the most curious minds in the field.</p>
    <h3>Open Positions</h3>
    <p>Select from the departments below to see our openings.</p>
    <h5>Department</h5>
    <h5>Location</h5>
    <p>Didn't find positions? We'd love to hear from you.</p>
    <p>contact@intellolabs.com</p>
  </body>
</html>
`

test('Intello Labs is registered as an exact-name fail-closed provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intellolabs')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Intello Labs')
  assert.equal(provider.companyCareerPage, 'https://www.intellolabs.com/careers')
  assert.equal(provider.companyDomain, 'intellolabs.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /intellolabs[\\/]script\.js$/i)
  assert.equal(provider.verifiedOn, '2026-07-26')
})

test('Intello Labs returns no inferred jobs from its unstructured official openings surface', async () => {
  const intelloLabs = await import('../../scraper/intellolabs/script.js')

  assert.equal(intelloLabs.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(intelloLabs.extractJobs(careersHtml), [])
  assert.deepEqual(
    await intelloLabs.createIntelloLabsScraper().run({
      fetchText: async () => ({ status: 200, url: intelloLabs.CAREERS_URL, html: careersHtml }),
    }),
    [],
  )
})

test('Intello Labs fails closed when the verified careers contract drifts', async () => {
  const intelloLabs = await import('../../scraper/intellolabs/script.js')

  assert.deepEqual(
    await intelloLabs.createIntelloLabsScraper().run({
      fetchText: async () => '<html><body>Unexpected company page</body></html>',
    }),
    [],
  )
})
