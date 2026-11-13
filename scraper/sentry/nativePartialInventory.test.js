import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { createSentryScraper } from './script.js'

// Exact saved responses exercise the real reader without treating an archived
// observation as a current publisher inventory.
const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-current-20261110.json.gz', import.meta.url))))
const corporateBody = captured.responses.corporate.body
const nativePayload = JSON.parse(captured.responses.inventory.body)
const CAREERS = 'https://sentry.io/careers/'
const API = 'https://api.ashbyhq.com/posting-api/job-board/sentry'
const MATCHED = '81f09568-da7d-4ed1-8283-614f846c9b00'
const SECOND_MATCHED = '6eb8d5f2-977e-4ff4-bdbe-fccb8747b5d7'
const NATIVE_ONLY = ['2cdc2ba7-8406-452a-b84f-d94d8e7a09bb', '9b759583-60d2-4673-9da6-026731956300']
const UNKNOWN_COUNTRY = '960b966a-849f-421f-8c75-72924f28293e'
const sha = value => createHash('sha256').update(value).digest('hex')

async function collect({ change = () => {}, closingChange = () => {}, maxJobs = null } = {}) {
  const model = { corporate: corporateBody, inventory: structuredClone(nativePayload) }
  change(model)
  let calls = 0
  const fetchImpl = async (url, init = {}) => {
    assert.equal(url, [CAREERS, API, API, CAREERS][calls++ % 4], 'only complete four-request cohorts are admitted')
    assert.ok(init.signal instanceof AbortSignal)
    let body = model.corporate
    if (url === API) {
      const payload = structuredClone(model.inventory)
      if (calls % 4 === 3) closingChange(payload)
      body = JSON.stringify(payload)
    }
    const response = new Response(body, { headers: { 'content-type': url === API ? 'application/json' : 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const jobs = await createSentryScraper({ fetchImpl }).run({ maxJobs, totalBudgetMs: 20000, requestTimeoutMs: 3000 })
  assert.equal(calls, 4, 'an inventory mismatch must still complete both closing observations')
  return jobs
}

function makeMatchedIndia(model) {
  const record = model.inventory.jobs.find(row => row.id === MATCHED)
  record.location = 'Bengaluru, Karnataka, India'
  record.address = { postalAddress: { addressCountry: 'India', addressRegion: 'Karnataka', addressLocality: 'Bengaluru' } }
  model.corporate = model.corporate.replace(/(\bprops=")([^"]*)(")/, (_, before, raw, after) => {
    const props = JSON.parse(decodeNativeEntities(raw))
    const row = props.jobs[1].find(tuple => tuple[1].id[1] === MATCHED)[1]
    row.info[1].locationName = [0, record.location]
    row.info[1].locationIds[1].primaryLocationId = [0, '00000000-0000-4000-8000-000000000001']
    props.jobsByLocation[1].push([0, { id: [0, '00000000-0000-4000-8000-000000000001'], name: [0, record.location] }])
    return before + JSON.stringify(props).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + after
  })
  const visible = new RegExp('(<a\\b[^>]*href="/careers/' + MATCHED + '/"[^>]*>[\\s\\S]*?<span\\b[^>]*class="[^"]*_jobLocation_[^"]*"[^>]*>)([\\s\\S]*?)(</span>)')
  assert.match(model.corporate, visible)
  model.corporate = model.corporate.replace(visible, (_, before, value, after) => before + record.location + after)
}

test('Sentry retains all 41 saved native records when only 39 corporate identities reconcile', async () => {
  assert.equal(sha(corporateBody), '9f6c0a744d2014f7e6bcbc823726211f6aa85f6ce796b1b059dbde4a680b8763')
  assert.equal(sha(captured.responses.inventory.body), '5119ab00266aabeb5f9ff4f855a850d289fdfaf5a002b6997d6d136b2e9e1511')
  const jobs = await collect()
  assert.equal(jobs.length, 0, 'saved observations contain no qualifying India role')
  const audit = jobs.nativeCollectionEvidence
  assert.deepEqual(audit.nativeRecords, nativePayload.jobs, 'unreconciled native records and all original criteria must survive selection')
  assert.deepEqual(audit.opening.payload, nativePayload)
  assert.deepEqual(audit.closing.payload, nativePayload)
  assert.equal(audit.opening.corporate.rows.size, 39)
  assert.equal(audit.closing.corporate.rows.size, 39)
  assert.equal(audit.observedRecordCount, 41)
  assert.equal(audit.observedVacancyCount, 41)
  assert.equal(audit.corporateRoleCount, 39)
  assert.equal(audit.nativeRoleCount, 41)
  assert.equal(audit.corporateNativeCountAgreement, false)
  assert.equal(audit.corporateNativeInventoryAgreement, false)
  assert.equal(audit.reconciledRoleIds.length, 39)
  assert.deepEqual(audit.nativeOnlyRoleIds, NATIVE_ONLY)
  assert.deepEqual(audit.corporateOnlyRoleIds, [])
  assert.deepEqual(audit.unresolvedCountryRoleIds, [UNKNOWN_COUNTRY])
  assert.equal(audit.closingInventoryAndCriteriaMatch, true)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.receipts.length, 4)
  assert.equal(Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence').enumerable, false)
  assert.equal(JSON.stringify(jobs), '[]')
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'discovery-only')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, 41)
  assert.equal(inventory.indiaFacetCount, null)
  assert.match(inventory.reason, /corporate-native-count-disagreement/)
  assert.match(inventory.reason, /corporate-native-inventory-disagreement/)
  assert.match(inventory.reason, /unresolved-own-native-country/)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Sentry can return an independently reconciled India role while retaining held native-only India observations', async () => {
  const jobs = await collect({ maxJobs: 1, change: model => {
    makeMatchedIndia(model)
    const held = model.inventory.jobs.find(row => row.id === NATIVE_ONLY[0])
    held.location = 'Bengaluru, Karnataka, India'
    held.address = { postalAddress: { addressCountry: 'India', addressRegion: 'Karnataka', addressLocality: 'Bengaluru' } }
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, MATCHED, 'a native-only India claim cannot bypass the corporate employer/criteria binding')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.ok(jobs[0].sourceDescription.length > 1000)
  assert.equal(jobs[0].sourceNativeInventory.corporateNativeInventoryAgreement, false)
  assert.deepEqual(jobs[0].sourceNativeInventory.nativeOnlyRoleIds, NATIVE_ONLY)
  assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length, 41, 'caps follow complete opening and closing observations')
  assert.equal(jobs.nativeCollectionEvidence.nativeRecords.find(row => row.id === NATIVE_ONLY[0]).address.postalAddress.addressCountry, 'India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Sentry retains both sets of unmatched identities even when corporate and native counts are equal', async () => {
  const jobs = await collect({ change: model => { model.inventory.jobs = model.inventory.jobs.filter(row => ![MATCHED, SECOND_MATCHED].includes(row.id)) } })
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.corporateNativeCountAgreement, true)
  assert.equal(audit.corporateNativeInventoryAgreement, false)
  assert.deepEqual(audit.nativeOnlyRoleIds, NATIVE_ONLY)
  assert.deepEqual(new Set(audit.corporateOnlyRoleIds), new Set([MATCHED, SECOND_MATCHED]))
  assert.equal(audit.reconciledRoleIds.length, 37)
  assert.equal(audit.opening.corporate.rows.size, 39)
  assert.equal(audit.nativeRecords.length, 39)
  assert.match(readInventoryEvidence(jobs).reason, /corporate-native-inventory-disagreement/)
})

test('Sentry rejects an empty native inventory instead of turning the corporate mismatch into a successful zero', async () => {
  await assert.rejects(collect({ change: model => { model.inventory.jobs = [] } }))
})

test('Sentry rejects a native board with no independently reconciled corporate role', async () => {
  await assert.rejects(collect({ change: model => { model.inventory.jobs = model.inventory.jobs.filter(row => NATIVE_ONLY.includes(row.id)) } }))
})

test('Sentry still rejects foreign employer URLs on native-only records', async () => {
  await assert.rejects(collect({ change: model => {
    model.inventory.jobs.find(row => row.id === NATIVE_ONLY[0]).jobUrl = 'https://jobs.ashbyhq.com/foreign/' + NATIVE_ONLY[0]
  } }))
})

test('Sentry still rejects duplicated native-only identity', async () => {
  await assert.rejects(collect({ change: model => {
    model.inventory.jobs.push(structuredClone(model.inventory.jobs.find(row => row.id === NATIVE_ONLY[0])))
  } }))
})

test('Sentry still rejects changed full criteria on matched corporate/native roles', async () => {
  await assert.rejects(collect({ change: model => {
    model.inventory.jobs.find(row => row.id === MATCHED).descriptionHtml += '<p>New required certificate.</p>'
  } }), /corporate\/API full job criteria disagree/)
})

test('Sentry closes the complete native-only criteria before reporting a stable partial inventory', async () => {
  await assert.rejects(collect({ closingChange: payload => {
    payload.jobs.find(row => row.id === NATIVE_ONLY[0]).newNativeCriterion = { required: true }
  } }), /closing corporate\/native full inventory, criteria, geography or publication changed/)
})
