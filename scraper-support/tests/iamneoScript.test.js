import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'iamneo')

const loadFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const careersShellHtml = loadFixture('careers-shell.html')
const careersWithFirstPartyJobRecordHtml = loadFixture('careers-with-first-party-job-record.html')

const loadIamneoModule = async () => {
  try {
    return await import('../../scraper/iamneo/script.js')
  } catch {
    assert.fail('Expected iamneo scraper module at ../../scraper/iamneo/script.js')
  }
}

test('iamneo validates the verified first-party careers shell and external Keka handoff', async () => {
  const iamneo = await loadIamneoModule()

  assert.equal(iamneo.SOURCE, 'iamneo')
  assert.equal(iamneo.COMPANY, 'iamneo')
  assert.equal(iamneo.CAREERS_URL, 'https://iamneo.ai/careers/')
  assert.equal(iamneo.EXTERNAL_HANDOFF_URL, 'https://iamneo.keka.com/careers')
  assert.equal(iamneo.hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(iamneo.extractExternalHandoffUrl(careersShellHtml), iamneo.EXTERNAL_HANDOFF_URL)
  assert.deepEqual(iamneo.extractFirstPartyJobRecordUrls(careersShellHtml), [])
})

// The current first-party Keka handoff has an enumerable SSR/API inventory.
test('iamneo traverses the November 6 native board instead of treating its handoff as empty', async () => {
  const iamneo = await loadIamneoModule()
  const { transport } = await import('../../scraper/iamneo/native.fixture.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const jobs = await iamneo.createIamneoScraper().run({ fetchImpl: transport() })
  assert.equal(jobs.length, 5)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.ok(jobs.every(job => job.sourceDetailComplete))
})
test('iamneo rejects legacy text transport without HTTP metadata', async () => {
  const iamneo = await loadIamneoModule()
  await assert.rejects(iamneo.createIamneoScraper().run({ fetchText: async () => careersShellHtml }), /unsupported legacy transport/)
})
