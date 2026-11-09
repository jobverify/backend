import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => import('../../scraper/infibeamavenues/catalog.js')
const loadScript = async () => import('../../scraper/infibeamavenues/script.js')

const careersHtml = `
<!doctype html>
<html>
  <head><title>Career Opportunities - AvenuesAI</title></head>
  <body>
    <h1>Come Build The Future With Us</h1>
    <p>What it's like to work at Infibeam Avenues</p>
    <footer>AvenuesAI Limited</footer>
  </body>
</html>
`

test('Infibeam Avenues catalog captures the verified AvenuesAI fail-closed contract', async () => {
  const { INFIBEAM_AVENUES_CATALOG } = await loadCatalog()

  assert.equal(INFIBEAM_AVENUES_CATALOG.source, 'infibeamavenues')
  assert.equal(INFIBEAM_AVENUES_CATALOG.atsPlatform, 'official-careers-page-no-public-job-listings')
  assert.match(INFIBEAM_AVENUES_CATALOG.verifiedSurfaceSummary, /formerly known as Infibeam Avenues Limited/i)
})

test('Infibeam Avenues stays fail-closed while the AvenuesAI page exposes no public jobs', async () => {
  const infibeam = await loadScript()

  assert.equal(infibeam.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(infibeam.pageExposesPublicJobListings(careersHtml), false)
  assert.deepEqual(await infibeam.run({ fetchText: async () => careersHtml }), [])

  await assert.rejects(
    infibeam.run({
      fetchText: async () => '<html><body><h1>Current Openings</h1></body></html>',
    }),
    /verified avenuesai career opportunities page/i,
  )
})
