import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadInnsparkModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Innspark scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const careersHtml = fs.readFileSync(
  path.join(currentDir, '../../scraper-support/tests/fixtures/innspark/careers.html'),
  'utf8',
)
const applyHtml = fs.readFileSync(
  path.join(currentDir, '../../scraper-support/tests/fixtures/innspark/apply.html'),
  'utf8',
)

test('Innspark scraper validates the verified first-party careers page and apply form', async () => {
  const innspark = await loadInnsparkModule()

  assert.equal(innspark.SOURCE, 'innspark')
  assert.equal(innspark.COMPANY, 'Innspark')
  assert.equal(innspark.CAREERS_URL, 'https://innspark.in/careers/')
  assert.equal(innspark.APPLY_URL, 'https://innspark.in/apply/')
  assert.equal(innspark.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(innspark.hasOfficialApplySignal(applyHtml), true)
  assert.deepEqual(innspark.extractApplyRoleOptions(applyHtml), [
    'Embedded Systems Engineer (Drone / UAS development)',
    'C++ Engineer Qt-based Application Development (Drone / UAS development)',
    'Computer Vision Engineer (Drone / UAS development)',
    'SOC Analyst (L1 / L2)',
    'Security Analyst',
    'Flutter Developer',
    'Technical Support Executive',
    'Technical Content Writer',
    'Sales Manager',
    'Video Editor & Animation',
    'Digital Marketing Expert',
    'Others',
  ])
})

test('historical Innspark cards retain source observations without invented country, IDs or complete criteria',async()=>{
 const source=await loadInnsparkModule(),rows=source.extractCareerJobs(careersHtml);assert.equal(rows.length,11)
 assert.ok(rows.every(r=>r.country===null&&r.city===null&&r.location===null&&r.jobId===null&&r.requisitionId===null&&r.jobDescription===null&&r.sourceDetailComplete===false))
 assert.equal(rows[0].nativePublishedLocation,'Kerala');assert.ok(rows.find(r=>r.title==='Flutter Developer').nativePublishedDescription.includes('Firebase/GCP/AWS'))
 assert.doesNotThrow(()=>source.assertApplyFormMatchesJobs(rows,applyHtml))
 assert.throws(()=>source.assertApplyFormMatchesJobs(rows,applyHtml.replace('Digital Marketing Expert','Other')),/no longer matches/)
})
test('Innspark body-only historical fixture cannot publish jobs',async()=>{
 const source=await loadInnsparkModule();await assert.rejects(source.run({fetchText:async()=>careersHtml}),/unsupported metadata-free/)
})
