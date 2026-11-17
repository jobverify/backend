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
  assert.equal(SCIOMS_CATALOG.companyCareerPage, 'https://scioms.com/careers')
  assert.equal(SCIOMS_CATALOG.applyUrl, 'https://scioms.com/apply-now.php')
  assert.equal(SCIOMS_CATALOG.atsPlatform, 'current-own-angular-native-placeholder-role-records')
  assert.equal(SCIOMS_CATALOG.countryFilter, 'India')
  assert.equal(SCIOMS_CATALOG.verifiedOn, '2026-08-14')
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /Request a Consultation/i)
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /canonical/i)
  assert.match(SCIOMS_CATALOG.verifiedSurfaceSummary, /no trustworthy public job detail surface/i)
})





test('Current acquisition rejects historical body-only fetchText fixtures without returning an empty inventory',async()=>{const source=await loadScript();let calls=0;await assert.rejects(source.createScioManagementSolutionsScraper().run({fetchText:async()=>{calls++;return verifiedPlaceholderShellHtml}}),/metadata-aware fetchImpl/);assert.equal(calls,0)})
