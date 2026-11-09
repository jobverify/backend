import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { CAREERS_URL, createBharatFinancialInclusionLimitedScraper, extractRoleListings } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const html = gunzipSync(fs.readFileSync(new URL('./test-data/careers-20261102.html.gz', import.meta.url))).toString('utf8')

test('BFIL native support departments are not six additional vacancy titles', () => {
  const roles = extractRoleListings(html)
  assert.equal(roles.length, 24)
  assert.ok(!roles.some(row => /^(?:Accounts & Finance|Administration|Human Resources \(HR\)|Information Technology \(IT\)|Internal Audit|Training)$/.test(row.title)))
})

test('BFIL email application instructions cannot become a role description or establish a workplace', () => {
  const roles = extractRoleListings(html)
  assert.ok(roles.every(row => row.jobDescription === null && !hasSourceDescription(row)))
  assert.ok(roles.every(row => row.country === null && row.location === null && row.requisitionId === null))
  assert.ok(roles.every(row => row.sourceDetailComplete === false))
  assert.ok(roles.every(row => /\[Vertical Name\]/.test(row.nativeApplicationInstructions)))
})

test('BFIL retains24 unqualified role briefs and6 department observations outside persistence candidates', async () => {
  let audit
  const jobs = await createBharatFinancialInclusionLimitedScraper().run({
    fetchText: async url => { assert.equal(url, CAREERS_URL); return html }, onAudit: value => { audit = value },
  })
  assert.equal(jobs.length, 0)
  assert.equal(audit.roleBriefs.length, 24)
  assert.equal(audit.departments.length, 6)
  const observations = readSourceObservationEvidence(jobs, 'bharatfinancialinclusionlimited')
  assert.equal(observations?.observedRecordCount, 30)
  assert.equal(observations?.observedVacancyCount, 24)
  assert.equal(observations?.sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

test('BFIL caller cancellation reaches the HTTP request and propagates unchanged', async () => {
  const controller = new AbortController(), reason = new Error('stop BFIL')
  await assert.rejects(createBharatFinancialInclusionLimitedScraper().run({ signal: controller.signal,
    fetchText: async (url, options) => { assert.equal(options?.signal, controller.signal); controller.abort(reason); return html },
  }), error => error === reason)
})

test('BFIL an inert copied opportunities section cannot supply native role observations', async () => {
  const inert = html.replaceAll('<div class="opportunities-list">', '<div class="opportunities-list" hidden>')
  assert.notEqual(inert, html)
  assert.equal(extractRoleListings(inert).length, 0)
})
