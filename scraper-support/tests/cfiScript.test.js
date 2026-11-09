import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careersHtml = `
  <html>
    <head><title>Careers at CFI | Corporate Finance Institute</title></head>
    <body>
      <div id="BambooHR" data-domain="corporatefinanceinstituteinc.bamboohr.com" data-version="1.0.0"></div>
      <script src="https://corporatefinanceinstituteinc.bamboohr.com/js/embed.js"></script>
      <p>Build your career with CFI.</p>
    </body>
  </html>
`

const emptyEmbedHtml = '<div>We currently have no open positions.</div>'

const loadCfiModule = async () => {
  try {
    return await import('../../scraper/cfi/script.js')
  } catch {
    assert.fail('Expected CFI scraper module at ../../scraper/scraper/cfi/script.js')
  }
}

test('CFI verifies the official careers page and BambooHR handoff', async () => {
  const cfi = await loadCfiModule()

  assert.equal(cfi.SOURCE, 'cfi')
  assert.equal(cfi.COMPANY, 'CFI')
  assert.equal(cfi.CAREERS_URL, 'https://corporatefinanceinstitute.com/about-cfi/careers-at-cfi/')
  assert.equal(
    cfi.BAMBOOHR_EMBED_URL,
    'https://corporatefinanceinstituteinc.bamboohr.com/jobs/embed2.php?version=1.0.0',
  )
  assert.equal(cfi.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(cfi.hasBambooHrHandoff(careersHtml), true)
  assert.equal(cfi.hasEmptyOpeningsSignal(emptyEmbedHtml), true)
})

test('run returns an empty list while the verified BambooHR no-openings state is present', async () => {
  const cfi = await loadCfiModule()
  const scraper = cfi.createCfiScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  })
  const requested = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === cfi.CAREERS_URL) return careersHtml
      if (url === cfi.BAMBOOHR_EMBED_URL) return emptyEmbedHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    cfi.CAREERS_URL,
    cfi.BAMBOOHR_EMBED_URL,
  ])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, '2026-09-14T00:00:00.000Z')
})
