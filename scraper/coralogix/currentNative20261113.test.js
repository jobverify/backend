import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url))))
const replay = async (mutate = () => {}, options = {}) => {
  const visits = new Map()
  return run({ ...options, fetchPage: async (url) => {
    const page = structuredClone(packets.find(row => row.requestedUrl === url))
    assert.ok(page, 'captured current public URL ' + url)
    const visit = (visits.get(url) || 0) + 1
    visits.set(url, visit)
    mutate(page, url, visit)
    return page
  } })
}
test('Coralogix current declared Comeet feed preserves seven India location postings with full criteria', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 7)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 7)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete))
  assert.equal(jobs.find(job => job.jobId === '53.64A').postingDate, null)
  assert.match(jobs.find(job => job.jobId === '53.64A').jobDescription, /7\+ years experience as a new business hunter/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 58)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeCollectionEvidence?.observedDetails.length, 7)
  assert.equal(decorateJobsWithProviderMetadata(jobs, getScraperCatalog().find(row => row.source === 'coralogix')).nativeCollectionEvidence?.observedDetails.length, 7)
})
test('Coralogix native listing country cannot be replaced by an India city label', async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions?')) {
      const rows = JSON.parse(page.html)
      rows.find(row => row.uid === '53.64A').location.country = null
      page.html = JSON.stringify(rows)
    }
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Coralogix an additional contradictory native country field stays unresolved', async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions?')) {
      const rows = JSON.parse(page.html)
      rows.find(row => row.uid === '53.64A').location.countryCode = 'US'
      page.html = JSON.stringify(rows)
    } else if (url.includes('/positions/53.64A?')) {
      const row = JSON.parse(page.html)
      row.location.countryCode = 'US'
      page.html = JSON.stringify(row)
    }
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Coralogix conflicting native experience metadata cannot publish the listing value', async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions/53.64A?')) {
      const row = JSON.parse(page.html)
      row.experience_level = 'Entry-level'
      page.html = JSON.stringify(row)
    }
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Coralogix mismatched native employer or tenant is rejected', async () => {
  await assert.rejects(replay((page, url) => {
    if (url.includes('/positions?')) page.html = page.html.replace('"company_name":"Coralogix"', '"company_name":"Another employer"')
  }), /identity|employer|tenant/i)
})
test('Coralogix missing current full requirements holds affected posting and inventory', async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions/53.64A?')) {
      const row = JSON.parse(page.html)
      row.details = row.details.filter(section => section.name !== 'Requirements')
      page.html = JSON.stringify(row)
    }
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Coralogix concealed authored requirements cannot establish full visible criteria', async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions/53.64A?')) {
      const row = JSON.parse(page.html)
      const requirements = row.details.find(section => section.name === 'Requirements')
      requirements.value = requirements.value.replace('<ul class=', '<ul hidden class=')
      page.html = JSON.stringify(row)
    }
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [scope, style] of [
  ['requirements ancestor', 'opacity:0'],
  ['requirements ancestor', 'position:fixed;left:-9999px'],
  ['individual body text', 'white-space: pre-wrap;opacity:0'],
]) test(`Coralogix ${scope} with ${style} holds the original criteria`, async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions/53.64A?')) {
      const row = JSON.parse(page.html), section = row.details.find(section => section.name === 'Requirements')
      const original = section.value
      section.value = scope === 'requirements ancestor'
        ? original.replace('<ul class=', `<ul style="${style}" class=`)
        : original.replace('white-space: pre-wrap;', style)
      assert.notEqual(section.value, original, 'mutated actual native requirements')
      page.html = JSON.stringify(row)
    }
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(jobs.nativeCollectionEvidence.observedDetails.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})
test('Coralogix changed live client cannot establish complete native enumeration', async () => {
  await assert.rejects(replay((page, url) => {
    if (url.includes('/assets/pages/careers/page.js')) page.html += '\nthrow new Error("changed");'
  }), /client|contract/i)
})
test('Coralogix posting removed after closing details is not published', async () => {
  const jobs = await replay((page, url, visit) => {
    if (url.includes('/positions?') && visit === 3) page.html = JSON.stringify(JSON.parse(page.html).filter(row => row.uid !== '53.64A'))
  })
  assert.equal(jobs.some(job => job.jobId === '53.64A'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Coralogix caller cancellation bounds an ignoring native reader', async () => {
  const controller = new AbortController(), reason = { cancelled: 'coralogix' }
  const task = run({ signal: controller.signal, fetchPage: () => new Promise(() => {}) })
  setTimeout(() => controller.abort(reason), 10)
  await assert.rejects(task, value => value === reason)
})

for (const mode of ['foreign-only', 'empty']) test(`Coralogix decorated ${mode} board keeps the company cleanup hold through runner assessment`, async () => {
  const jobs = await replay((page, url) => {
    if (url.includes('/positions?')) page.html = JSON.stringify(mode === 'empty' ? [] : JSON.parse(page.html).filter(row => row.location.country !== 'IN'))
  })
  const provider = getScraperCatalog().find(row => row.source === 'coralogix')
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  const assessment = assessSoftFailureAcquisition(provider, decorated)
  assert.equal(decorated.length, 0)
  assert.equal(assessment.zeroJobEvidence, 'fetched-zero')
  assert.equal(assessment.runnerOutcome.success, true)
  assert.equal(assessment.inventoryEvidence.lifecycleCleanupAllowed, false)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
  assert.equal(assessment.inventoryEvidence.reportedTotal, mode === 'empty' ? 0 : 51)
})
