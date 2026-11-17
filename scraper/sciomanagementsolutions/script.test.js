import assert from 'node:assert/strict'
import test from 'node:test'

const loadScioModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SCIO Management Solutions scraper module at ./script.js')
  }
}

const placeholderShellHtml = `
<!DOCTYPE html>
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

test('SCIO sentinel pins the current canonical placeholder shells', async () => {
  const scio = await loadScioModule()

  assert.equal(scio.SOURCE, 'sciomanagementsolutions')
  assert.equal(scio.COMPANY, 'SCIO Management Solutions')
  assert.equal(scio.CAREERS_URL, 'https://scioms.com/careers')
  assert.equal(scio.APPLY_URL, 'https://scioms.com/apply-now.php')
  assert.equal(scio.VERIFIED_ON, '2026-08-14')

  assert.equal(scio.hasVerifiedPlaceholderShellSignal(placeholderShellHtml), true)
  assert.equal(scio.hasVerifiedCareersSignal(placeholderShellHtml), true)
  assert.equal(scio.hasVerifiedApplyFormSignal(placeholderShellHtml), true)
  assert.deepEqual(scio.extractPositionOptions(placeholderShellHtml), [])
  assert.equal(scio.hasPublicJobListingsSignal(placeholderShellHtml), false)
})

test('SCIO sentinel detects real public job signals once positions or job routes appear', async () => {
  const scio = await loadScioModule()

  assert.equal(
    scio.hasPublicJobListingsSignal(
      '<main><h1>Current Openings</h1><a href="/job/senior-analyst-rcm">Senior Analyst - RCM</a></main>',
    ),
    true,
  )
  assert.equal(scio.hasPublicJobListingsSignal('<div>Job ID: SCIO-101</div>'), true)
})







test('Current acquisition rejects historical body-only fetchText fixtures without returning an empty inventory',async()=>{const source=await loadScioModule();let calls=0;await assert.rejects(source.createScioManagementSolutionsScraper().run({fetchText:async()=>{calls++;return placeholderShellHtml}}),/metadata-aware fetchImpl/);assert.equal(calls,0)})
