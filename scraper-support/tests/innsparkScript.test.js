import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'innspark',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const careersHtml = readFixture('careers.html')
const applyHtml = readFixture('apply.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/innspark/script.js')
  } catch {
    assert.fail('Expected Innspark scraper module at ../../scraper/innspark/script.js')
  }
}

test('Innspark helpers recognize the verified careers and apply surfaces', async () => {
  const innspark = await loadModule()

  assert.equal(innspark.SOURCE, 'innspark')
  assert.equal(innspark.COMPANY, 'Innspark')
  assert.equal(innspark.CAREERS_URL, 'https://innspark.in/careers/')
  assert.equal(innspark.APPLY_URL, 'https://innspark.in/apply/')
  assert.equal(innspark.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(innspark.hasOfficialApplySignal(applyHtml), true)
  assert.equal(innspark.extractCareerJobs(careersHtml).length, 11)
  assert.deepEqual(innspark.extractCareerJobs(careersHtml).slice(0, 4).map((job) => job.title), [
    'Embedded Systems Engineer (Drone / UAS development)',
    'C++ Engineer Qt-based Application Development (Drone / UAS development)',
    'Computer Vision Engineer (Drone / UAS development)',
    'SOC Analyst (L1 / L2)',
  ])
})

test('Innspark legacy callbacks cannot establish current HTTP or vacancy authority',async()=>{
 const source=await loadModule();let calls=0
 await assert.rejects(source.run({fetchText:async()=>{calls++;return careersHtml},fetchProtocolTolerantText:async()=>applyHtml}),/unsupported metadata-free/);assert.equal(calls,0)
})
test('Innspark frozen caller cancellation precedes all transports',async()=>{
 const source=await loadModule(),owner=new AbortController(),reason=Object.freeze({owner:'innspark'});owner.abort(reason)
 await assert.rejects(source.run({signal:owner.signal,fetchImpl:async()=>assert.fail('unexpected fetch')}),e=>e===reason)
})
