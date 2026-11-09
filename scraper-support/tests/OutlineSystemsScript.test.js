import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/outlinesystems/script.js')
  } catch {
    assert.fail('Expected Outline Systems scraper module at ../../scraper/outlinesystems/script.js')
  }
}

test('Outline Systems reports unavailable coverage instead of a false empty inventory', async () => {
  const outline = await loadModule()

  assert.equal(outline.SOURCE, 'outlinesystems')
  assert.equal(outline.COMPANY, 'Outline Systems')
  assert.equal(outline.CAREERS_URL, 'https://www.linkedin.com/company/outline-systems')
  await assert.rejects(outline.run({fetchImpl:async()=>{throw Error('offline')}}),e=>e.code==='OUTLINESYSTEMS_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&e.lifecycleCleanupAllowed===false)
})
