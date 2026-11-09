import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/ncsitechnologiespvtltd/script.js')
  } catch {
    assert.fail('Expected NCSI Technologies Pvt Ltd scraper module at ../../scraper/ncsitechnologiespvtltd/script.js')
  }
}

const verifiedCareersHtml = `
<!doctype html>
<html>
  <head><title>NCSI Careers</title></head>
  <body>
    <h1>Join our renowned team</h1>
    <p>Your Career. Our Commitment.</p>
    <p>Culture at NCSI</p>
  </body>
</html>
`

const incapsulaIncidentHtml = 'Request unsuccessful. Incapsula incident ID: 742000230051442402-35943808254739916'
const incapsulaResourceShellHtml = `
<html style="height:100%">
  <head>
    <META NAME="ROBOTS" CONTENT="NOINDEX, NOFOLLOW">
    <script type="text/javascript" src="/_Incapsula_Resource?SWUDNSAI=31"></script>
  </head>
</html>
`

test('NCSI validates the verified generic careers landing', async () => {
  const ncsi = await loadModule()

  assert.equal(ncsi.SOURCE, 'ncsitechnologiespvtltd')
  assert.equal(ncsi.CAREERS_URL, 'https://www.ncsi.us/careers/')
  assert.equal(ncsi.hasVerifiedCareersPageSignal(verifiedCareersHtml), true)

  const jobs = await ncsi.createNcsitechnologiespvtltdScraper().run({
    fetchText: async () => verifiedCareersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('NCSI classifies the current Incapsula incident page as blocked access', async () => {
  const ncsi = await loadModule()

  assert.equal(ncsi.hasIncapsulaIncidentSignal(incapsulaIncidentHtml), true)
  assert.equal(ncsi.hasIncapsulaIncidentSignal(incapsulaResourceShellHtml), true)

  const jobs = await ncsi.createNcsitechnologiespvtltdScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async () => incapsulaResourceShellHtml,
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, ncsi.CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
})
