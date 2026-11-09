import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createBrainvireScraper, CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const opening = fs.readFileSync(new URL('./fixtures/opening-20261026.html', import.meta.url), 'utf8')
const closing = fs.readFileSync(new URL('./fixtures/closing-20261026.html', import.meta.url), 'utf8')
const now = () => '2026-10-26T20:45:00.000Z'
const run = (html = opening, last = html, defaults = {}) => {
  let calls = 0
  const body = () => calls++ ? last : html
  // Intercept the retired fetchText as well: the failing old factory must not
  // escape to the network when it ignores the new response-aware fetchPage.
  return createBrainvireScraper({now, requestIntervalMs:0, ...defaults}).run({
    fetchText: async () => body(),
    fetchPage: async url => ({status:200, url, text:async () => body()}),
  })
}

test('current native runtime returns four role-owned India candidates from all six visible roles', async () => {
  const jobs = await run(opening, closing)
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.country === 'India'))
  assert.equal(jobs.nativeInventoryEvidence.records.length, 6)
  const managers = jobs.nativeInventoryEvidence.records.filter(job => job.title === 'Business Development Manager')
  assert.equal(managers.length, 2)
  assert.notEqual(managers[0].jobId, managers[1].jobId)
  assert.deepEqual(managers.map(job => job.countryCode).sort(), ['AE', 'US'])
})

test('native application labels remain distinct posting keys without inventing requisition IDs or anchors', async () => {
  const jobs = await run()
  assert.equal(jobs[0].jobId, 'Application: Team Lead Odoo')
  assert.equal(jobs[0].nativePostingKeyType, 'native-application-label')
  assert.equal(jobs[0].nativePostingId, null)
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].sourceUrl, CAREERS_URL)
  assert.equal(jobs[0].applyUrl, CAREERS_URL)
  assert.equal(jobs[0].nativeApplicationPosition, 'Team Lead Odoo')
  assert.equal(jobs[0].applicationIsJobSpecific, true)
})

test('native briefs, every shared benefit and date-only role publication are retained without claiming full criteria', async () => {
  const jobs = await run()
  assert.match(jobs[0].jobDescription, /^Team Lead Odoo role at Brainvire/)
  assert.equal(jobs[0].department, 'Open Source')
  assert.equal(jobs[0].experienceRequired, '6+ Years')
  assert.deepEqual(jobs[0].locations, ['Ahmedabad', 'Mumbai'])
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].remoteStatus, null)
  assert.equal(jobs[0].numberOfOpenings, 1)
  assert.equal(jobs[0].sharedEmployerBenefits.length, 8)
  assert.match(jobs[0].sharedEmployerBenefits.join(' '), /Annual health, dental and eye check-ups/)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].nativeReportedPostingDate, '2026-09-16')
  assert.equal(jobs[0].postingDate, '2026-09-16')
  assert.equal(jobs[0].postedAt, '2026-09-16')
  assert.equal(jobs[0].postingDatePrecision, 'date')
  assert.equal(jobs[0].sourcePostingDateIsExact, false)
  assert.equal(jobs[0].requisitionId, null)
  assert.deepEqual(jobs[0].requiredSkills, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [name, change] of [
  ['canonical employer', s => s.replace('rel="canonical" href="https://www.brainvire.com/careers/"', 'rel="canonical" href="https://other.example/careers/"')],
  ['role employer', s => s.replaceAll('"name":"Brainvire Infotech"', '"name":"Other Employer"')],
  ['role organization domain', s => s.replaceAll('"sameAs":"https://www.brainvire.com"', '"sameAs":"https://other.example"')],
  ['card and country contradiction', s => s.replace('Location <b>Ahmedabad, Mumbai</b>', 'Location <b>Ahmedabad, Mumbai, United States</b>')],
  ['native card versus locality', s => s.replace('Location <b>Ahmedabad, Mumbai</b>', 'Location <b>London</b>')],
  ['duplicate native application identity', s => s.replace('data-ms="Application: Business Analyst (Presales) Odoo"', 'data-ms="Application: Team Lead Odoo"')],
  ['schema cardinality mismatch', s => s.replace('"@type":"JobPosting","title":"Team Lead Odoo"', '"@type":"Thing","title":"Team Lead Odoo"')],
  ['inert structured data', s => s.replaceAll('type="application/ld+json"', 'type="text/plain"')],
  ['hidden native role', s => s.replace('class="role reveal"', 'class="role reveal" hidden')],
  ['inert native role', s => s.replace('class="role reveal"', 'class="role reveal" inert')],
  ['invisible native role', s => s.replace('class="role reveal"', 'class="role reveal" style="opacity:0"')],
  ['CSS hidden roles', s => s.replace('</head>', '<style>.role{display:none!important}</style></head>')],
  ['CSS transparent roles', s => s.replace('</head>', '<style>.role{opacity:0!important}</style></head>')],
]) test('current native contract rejects ' + name, async () => {
  await assert.rejects(run(change(opening)), /Brainvire/)
})

test('typed unknown native country stays unresolved and cannot establish foreign exclusion', async () => {
  const jobs = await run(opening.replaceAll('"addressCountry":"IN"', '"addressCountry":"Unknown"'))
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeInventoryEvidence.unresolvedCountryRecords, 4)
  assert.equal(jobs.nativeInventoryEvidence.confirmedForeignRecords, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('caps are applied after every global identity and closing content have reconciled', async () => {
  const jobs = await run(opening, closing, {maxJobs:1})
  assert.equal(jobs.length, 1)
  assert.equal(jobs.nativeInventoryEvidence.records.length, 6)
  assert.equal(jobs.nativeInventoryEvidence.closingReconciled, true)
  assert.equal(jobs.nativeInventoryEvidence.confirmedIndiaRecords, 4)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, change] of [
  ['experience', s => s.replaceAll('6+ Years', '7+ Years')],
  ['date', s => s.replaceAll('2026-09-16', '2026-09-17')],
  ['foreign role application identity', s => s.replaceAll('Business Development Manager (Dubai)', 'Business Development Manager (United Arab Emirates)')],
  ['shared benefits', s => s.replace('Annual health, dental and eye check-ups', 'Annual health and dental check-ups')],
]) test('closing reconciliation rejects changed native ' + name, async () => {
  await assert.rejects(run(opening, change(closing)), /Brainvire.*changed/)
})

test('an expired native role is retained in global reconciliation and excluded from current India candidates', async () => {
  const jobs = await run(opening.replace('"datePosted":"2026-09-16"', '"datePosted":"2026-09-16","validThrough":"2026-10-20"'))
  assert.equal(jobs.length, 3)
  assert.equal(jobs.nativeInventoryEvidence.records.length, 6)
  assert.equal(jobs.nativeInventoryEvidence.records[0].expired, true)
})

test('unreviewed application JavaScript cannot claim job-specific application binding', async () => {
  const jobs = await run(opening.replace('if(pos) pos.value=clean;', 'if(pos) pos.value="Future opportunities";'))
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.applicationIsJobSpecific === false))
  assert.equal(jobs.nativeInventoryEvidence.fullEligibleIndiaRecords, 0)
})

test('additional hiring frames, loading, paths and native clients are retained as unresolved coverage', async () => {
  const jobs = await run(opening.replace('</body>', '<iframe src="https://jobs.example/brainvire"></iframe><a href="/jobs/extra/">More jobs</a><div aria-busy="true">Loading jobs</div><script src="/careers-new.js"></script></body>'))
  assert.equal(jobs.length, 4)
  assert.ok(jobs.nativeInventoryEvidence.reasons.includes('unprocessed-additional-hiring-surface'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('HTTP denial stops immediately without a retry or closing request', async () => {
  let requests = 0
  await assert.rejects(createBrainvireScraper({requestIntervalMs:0, now}).run({
    fetchText: async () => { throw Error('Retired transport must not be used') },
    fetchPage: async url => { requests++; return {status:403,url,text:async () => 'Access denied'} },
  }), /403/)
  assert.equal(requests, 1)
})

test('caller abort prevents any public request', async () => {
  let requests = 0
  const controller = new AbortController(); controller.abort(Error('Caller stopped'))
  await assert.rejects(createBrainvireScraper({requestIntervalMs:0, now}).run({signal:controller.signal,
    fetchPage: async () => { requests++; throw Error('Unexpected request') },
    fetchText: async () => { requests++; throw Error('Unexpected legacy request') },
  }), /Caller stopped/)
  assert.equal(requests, 0)
})

for (const [name, change] of [
  ['CSS hidden heading', s => s.replace('</head>', '<style>.role h3{visibility:hidden}</style></head>')],
  ['CSS hidden attribute selector', s => s.replace('</head>', '<style>[data-ms]{display:none!important}</style></head>')],
  ['zero-opacity ancestor', s => s.replace('<section id="openings">', '<section id="openings" style="opacity:0">')],
  ['template role content', s => s.replace('class="role reveal"', 'class="role reveal"><template').replace('</h3>', '</h3></template>')],
  ['custom country conflict', s => s.replace('"employmentType":"FULL_TIME"', '"employmentType":"FULL_TIME","jobCountry":"US"')],
  ['custom fields scope', s => s.replace('"employmentType":"FULL_TIME"', '"employmentType":"FULL_TIME","customFields":[{"label":"Country","value":"US"}]')],
  ['impossible publication date', s => s.replaceAll('2026-09-16','2026-02-30')],
  ['future publication date', s => s.replaceAll('2026-09-16','2099-09-16')],
]) test('native field and visibility evidence rejects ' + name, async () => {
  await assert.rejects(run(change(opening)), /Brainvire/)
})

test('closed role remains an observed identity and is excluded from active candidates', async () => {
  const jobs = await run(opening.replace('Apply now</a>', 'Apply now</a><p>Position closed</p>'))
  assert.equal(jobs.length, 3)
  assert.equal(jobs.nativeInventoryEvidence.records.length, 6)
  assert.equal(jobs.nativeInventoryEvidence.records[0].closed, true)
})

test('a hidden modal submit cannot establish a usable role-specific application', async () => {
  const jobs = await run(opening.replace('type="submit" value="Submit application"', 'type="submit" style="opacity:0" value="Submit application"'))
  assert.ok(jobs.every(job => !job.applicationIsJobSpecific && job.applyUrl === null))
})

test('zero caller cap still reconciles all six native records', async () => {
  const jobs = await run(opening,closing,{maxJobs:0})
  assert.equal(jobs.length,0)
  assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords,6)
  assert.equal(jobs.nativeInventoryEvidence.confirmedIndiaRecords,4)
  assert.equal(jobs.nativeInventoryEvidence.closingReconciled,true)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})

for (const [name,response] of [
  ['foreign redirect',{status:200,url:'https://other.example/careers/',text:async()=>opening}],
  ['non HTML response',{status:200,url:CAREERS_URL,headers:{get:()=> 'application/json'},text:async()=>opening}],
]) test('response-aware transport rejects ' + name,async()=>{
  await assert.rejects(createBrainvireScraper({now,requestIntervalMs:0}).run({fetchPage:async()=>response}),/Brainvire/)
})

test('a bounded deadline interrupts an unresponsive injected transport',async()=>{
  await assert.rejects(createBrainvireScraper({now,timeoutMs:20,requestIntervalMs:0}).run({fetchPage:()=>new Promise(()=>{})}),/deadline/)
})

for (const control of ['nomodule', 'type="module"', 'language="VBScript"']) test('ignored or incompatible ' + control + ' application/reveal script cannot bind active native roles',async()=>{
  const html=opening.replace('<script>\n(function(){\nvar root=document.currentScript.parentElement;', '<script '+control+'>\n(function(){\nvar root=document.currentScript.parentElement;')
  assert.notEqual(html,opening)
  await assert.rejects(run(html),/Brainvire/)
})

test('an explicit classic JavaScript type takes precedence over the legacy language attribute',async()=>{
  const html=opening.replace('<script>\n(function(){\nvar root=document.currentScript.parentElement;', '<script type="text/javascript" language="VBScript">\n(function(){\nvar root=document.currentScript.parentElement;')
  assert.equal((await run(html)).length,4)
})

for (const [field,value] of [['country','Unknown'],['jobCountry',{countryCode:'US'}],['country',null],['jobCountry',[]]]) test('supplied unrecognized '+field+' '+JSON.stringify(value)+' cannot be discarded in favor of India',async()=>{
  const html=opening.replace('"employmentType":"FULL_TIME"','"employmentType":"FULL_TIME",'+JSON.stringify(field)+':'+JSON.stringify(value))
  await assert.rejects(run(html),/Brainvire/)
})

test('explicit recognized agreeing role country fields retain native India classification',async()=>{
  const html=opening.replace('"employmentType":"FULL_TIME"','"employmentType":"FULL_TIME","country":"India","jobCountry":"IN"')
  const jobs=await run(html)
  assert.equal(jobs.length,4)
  assert.equal(jobs[0].countryCode,'IN')
})

for(const [name,change] of [
  ['visible country field',s=>s.replace('Openings <b>1</b>','Country <b>Unknown</b></span><span>Openings <b>1</b>')],
  ['native card country attribute',s=>s.replace('class="role reveal"','class="role reveal" data-country="Unknown"')],
])test('unknown supplied '+name+' cannot be silently removed',async()=>{
  await assert.rejects(run(change(opening)),/Brainvire/)
})
