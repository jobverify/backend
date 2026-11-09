import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, replay, mutateJSON, mutateHTML } from './fixtureReplay.js'
import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES as profiles } from './nativeCareers.js'
import { geography, literalFields } from './nativeData.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
globalThis.fetch = async () => { throw Error('Offline boundary tests prohibit network') }
const run = (source, r, options = {}) => createDeclaredJobFeedScraper(profiles[source]).run({ ...r.options, ...options })
const ashbyRole = fixture.oracle.datafold.records[0], roleURL = ashbyRole.originalFeedRecord.jobUrl

test('closing own-post failure retains earlier complete model and all raw entities without qualifying a current candidate', async () => {
  const r = replay((url, page, visit) => url === roleURL && visit === 2 ? { ...page, status: 502 } : page)
  await run('datafold', r)
  const a = r.audits[0], job = a.observations.find(job => job.jobId === ashbyRole.id)
  assert.ok(job.jobDescription.includes(ashbyRole.bodyText))
  assert.deepEqual(job.sourceNativePosting, ashbyRole.originalOwnPosting)
  assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.equal(job.sourceNativeClosingObservation.sourceNativeIssues.length > 0, true)
  assert.equal(a.observationHistory.length, 5)
  assert.doesNotThrow(() => JSON.stringify(a))
  assert.ok(a.rawPages.some(page => page.url === roleURL && page.status === 502 && page.bodyBase64))
})
test('changed closing native organization keeps earlier complete positives and holds the role', async () => {
  const r = replay((url, page, visit) => url === roleURL && visit === 2 ? mutateHTML(page, data => { data.organization.organizationId = '00000000-0000-4000-8000-000000000000' }) : page)
  await run('datafold', r)
  const job = r.audits[0].observations.find(row => row.jobId === ashbyRole.id)
  assert.equal(job.sourceCurrentNativeRoleQualified, false);assert.ok(job.jobDescription.includes(ashbyRole.bodyText))
  assert.deepEqual(job.sourceNativeOrganization, ashbyRole.originalOwnOrganization)
})
test('changed closing primary declaration holds all earlier full native posts', async () => {
  const r = replay((url, page, visit) => url === profiles.datafold.primaryURL && visit === 2
    ? { ...page, bodyBase64: Buffer.from('<title>Other employer careers</title>').toString('base64') } : page)
  const jobs = await run('datafold', r)
  assert.equal(jobs.length, 0);assert.equal(r.audits[0].observations.length, 5)
  assert.ok(r.audits[0].observations.every(row => row.jobDescription && !row.sourceCurrentNativeRoleQualified))
})
test('closing feed error envelope retains every earlier complete positive; source counts never become zero authority', async () => {
  const r = replay((url, page, visit) => url === profiles.datafold.publicAPIURL && visit === 2
    ? mutateJSON(page, data => { data.success = false }) : page)
  const jobs = await run('datafold', r)
  assert.equal(jobs.length, 0);assert.equal(r.audits[0].observations.length, 5)
  assert.ok(r.audits[0].observations.every(row => row.jobDescription && !row.sourceCurrentNativeRoleQualified))
  assert.equal(r.audits[0].authoritativeSourceTotal, null)
})
test('unlisted Ashby vacancy is retained in audit and held from candidates', async () => {
  const r = replay((url, page) => url === profiles.datafold.publicAPIURL ? mutateJSON(page, data => { data.jobs[0].isListed = false }) : page)
  const jobs = await run('datafold', r), row = r.audits[0].observations.find(row => row.jobId === ashbyRole.id)
  assert.equal(row.sourceNativeListingRecord.isListed, false)
  assert.equal(row.sourceCurrentNativeRoleQualified, false)
  assert.ok(!jobs.some(row => row.jobId === ashbyRole.id))
})
test('invalid limits and parsed-only injections fail before any GET', async () => {
  for (const source of ['datafold', 'asapp', 'affirm']) {
    const r = replay()
    for (const maxJobs of [-1, 1.1, Infinity, '1']) await assert.rejects(run(source, r, { maxJobs }), /maxJobs/)
    await assert.rejects(createDeclaredJobFeedScraper(profiles[source]).run({ fetchJson: r.options.fetchJson }), /original HTTP/)
    assert.equal(r.requests.length, 0)
  }
})
test('observers are awaited, receive detached serializable full observations, and failures propagate', async () => {
  const r = replay(), events = []
  await run('datafold', r, { maxJobs: 0, onAudit: async audit => { await Promise.resolve();events.push('audit');audit.observations[0].title = 'sink edit' },
    onRecords: async rows => { await Promise.resolve();assert.equal(rows.length, 5);assert.notEqual(rows[0].title, 'sink edit');events.push('records') } })
  assert.deepEqual(events, ['audit', 'records'])
  const e = Error('sink failed')
  await assert.rejects(run('plivo', replay(), { onRecords: async () => { throw e } }), error => error === e)
})
test('Greenhouse audit observers cannot change the independent complete-record sink', async () => {
  const r = replay();let received
  await run('cymulate', r, { onAudit: audit => { audit.observations[0].title = 'sink mutation' }, onRecords: rows => { received = rows } })
  assert.equal(received[0].title, fixture.oracle.cymulate.records[0].originalOwnRecord.title)
})
test('schema employment conflict is retained and held rather than choosing one hours claim', async () => {
  const r = replay((url, page) => url === roleURL ? mutateHTML(page, (data, schemas) => { schemas[0].employmentType = 'PART_TIME' }) : page)
  const jobs = await run('datafold', r), row = r.audits[0].observations.find(row => row.jobId === ashbyRole.id)
  assert.equal(row.sourceNativeJobPosting.employmentType, 'PART_TIME')
  assert.equal(row.sourceCurrentNativeRoleQualified, false)
  assert.ok(!jobs.some(job => job.jobId === ashbyRole.id))
})
test('abort drains in-flight work and rejects without releasing background GETs or callbacks', async () => {
  const controller = new AbortController();let completed = 0
  const r = replay(async (url, page) => { if (url === roleURL) controller.abort(Error('stop'));await Promise.resolve();completed++;return page })
  await assert.rejects(run('datafold', r, { signal: controller.signal }), /stop/)
  const count = completed;await new Promise(resolve => setTimeout(resolve, 5));assert.equal(completed, count)
})
test('denied native hosts are held for the remaining run without aliases or repeated requests', async () => {
  const r = replay((url, page) => new URL(url).hostname === 'jobs.ashbyhq.com' ? { ...page, status: 403 } : page)
  await run('datafold', r)
  assert.equal(r.requests.filter(url => new URL(url).hostname === 'jobs.ashbyhq.com').length, 1)
  assert.equal(r.audits[0].observations.length, 5)
})
test('unknown regions remain unresolved and Minnesota state labels are not country codes', () => {
  const eu = fixture.oracle.datafold.records.find(row => row.originalFeedRecord.location === 'Europe')
  const unresolved = geography(profiles.datafold, eu.originalFeedRecord, eu.originalSchema)
  assert.equal(unresolved.country, null);assert.equal(unresolved.sourceCountryScopeUnresolved, true)
  assert.equal(unresolved.sourceNativeCountryConflict, false)
  const us = fixture.oracle.delphixindia.records.find(row => row.originalFeedRecord.categories.location === 'Minneapolis, MN')
  const known = geography(profiles.delphixindia, us.originalFeedRecord, us.originalSchema)
  assert.equal(known.country, 'United States');assert.equal(known.sourceNativeCountryConflict, false)
})
test('R1: untyped state/country codes cannot invent India and visible multi-country scopes cannot collapse to a typed country', () => {
  for (const location of ['IN','CA','Georgia']) {
    const geo=geography(profiles.datafold,{location,address:null,secondaryLocations:[]},{})
    assert.equal(geo.country,null,location);assert.equal(geo.sourceCountryScopeUnresolved,true)
    assert.equal(isIndiaJob(normalizeScrapedJob({source:'datafold',title:'Software Engineer',company:'Datafold',jobDescription:'Published criteria.',...geo},{countryFilter:'India'})),false)
  }
  for(const location of ['US/Canada','United States and Canada','United States or Canada']){
    const geo=geography(profiles.datafold,{location,address:{postalAddress:{addressCountry:'IN'}},secondaryLocations:[]},{})
    assert.equal(geo.country,null);assert.equal(geo.sourceNativeCountryConflict,true);assert.deepEqual(geo.locations,[])
  }
  const native=fixture.oracle.redpanda.records.find(row=>row.originalFeedRecord.location==='US/Canada - Eastern Region')
  const geo=geography(profiles.redpanda,native.originalFeedRecord,native.originalSchema)
  assert.equal(geo.country,null);assert.equal(geo.sourceCountryScopeUnresolved,true)
  assert.ok(geo.sourceNativeCountries.includes('Canada'))
})
test('R4: Lever board failure and changed Delphix brand handoff remain visible and hold source qualification', async()=>{
  for(const source of ['plivo','delphixindia']){
    const r=replay((url,page)=>url===profiles[source].boardURL?{...page,status:502}:page)
    await run(source,r)
    assert.ok(r.requests.includes(profiles[source].boardURL))
    assert.equal(r.audits[0].opening.qualified,false)
    assert.equal(r.audits[0].closing.qualified,false)
  }
  const r=replay((url,page)=>url==='https://www.delphix.com/'?{...page,status:302,headers:{location:'https://www.perforce.com/other'}}:page)
  await run('delphixindia',r)
  assert.ok(r.requests.includes('https://www.delphix.com/'))
  assert.equal(r.audits[0].opening.publisherQualified,false)
})
test('R4: a Lever board-only role retains independently supported identity while wider inventory remains held',async()=>{
  const source='delphixindia',first=fixture.oracle[source].records[0]
  const r=replay((url,page)=>url===profiles[source].publicAPIURL?mutateJSON(page,rows=>{rows.splice(0,1)}):page)
  const jobs=await run(source,r),audit=r.audits[0],row=audit.observations.find(j=>j.jobId===first.id)
  assert.equal(audit.observations.length,8);assert.equal(audit.opening.nativeListingComplete,false)
  assert.equal(row.sourceNativeListingRecord,null);assert.deepEqual(row.sourceNativeRecord,first.originalOwnRecord)
  assert.ok(row.jobDescription.includes(first.bodyText));assert.equal(row.sourceCurrentNativeRoleQualified,true)
  assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.authoritativeSourceTotal,null)
  assert.equal(jobs.length,0)
})
test('R2/R3: a changed closing Greenhouse title cannot keep the earlier temporal identity qualification',async()=>{
  const source='cymulate',first=fixture.oracle[source].records[0],p=profiles[source]
  const r=replay((url,page,visit)=>visit===2&&url===p.publicAPIURL?mutateJSON(page,value=>{value.jobs[0].title+=' (Updated)'})
    :visit===2&&url===p.publicAPIBase+'/jobs/'+first.id+'?pay_transparency=true'?mutateJSON(page,value=>{value.title+=' (Updated)'}):page)
  await run(source,r)
  const row=r.audits[0].observations.find(j=>j.jobId===first.id)
  assert.equal(row.title,first.originalOwnRecord.title+' (Updated)');assert.equal(row.sourceCurrentNativeRoleQualified,false)
  assert.ok(row.jobDescription.includes(first.bodyText));assert.equal(r.audits[0].observationHistory.length,14)
})
test('known India worksite survives other unknown sites; same-worksite and visible country contradictions hold the public projection', () => {
  const record = { location:'Bengaluru, India', address:{ postalAddress:{ addressCountry:'IN', addressLocality:'Bengaluru' } }, secondaryLocations:[] }
  const schema = { jobLocation:{ address:{ addressCountry:'IN', addressLocality:'Bengaluru' } } }
  let geo = geography(profiles.datafold, { ...record, secondaryLocations:[{location:'Remote',address:null}] }, schema)
  assert.equal(geo.country, 'India');assert.equal(geo.sourceNativeCountryConflict, false)
  const conflict = { ...record, secondaryLocations:[{location:'Bengaluru',address:{postalAddress:{addressCountry:'US',addressLocality:'Bengaluru'}}}] }
  geo = geography(profiles.datafold, conflict, schema)
  assert.equal(geo.country, null);assert.equal(geo.sourceNativeCountryConflict, true);assert.deepEqual(geo.locations, [])
  geo = geography(profiles.datafold, { ...record, location:'United States' }, schema)
  assert.equal(geo.country, null);assert.equal(geo.sourceNativeCountryConflict, true)
})
test('literal Part-time, unknown hours/workplace and native date semantics survive real normalization', () => {
  const original = fixture.oracle.asapp.records[0].originalFeedRecord
  for (const commitment of ['Part-time', null]) {
    const record = { ...original, categories:{ ...original.categories, commitment }, workplaceType:null }
    const fields = literalFields(profiles.asapp, record, null, {})
    const normalized = normalizeScrapedJob({ source:'asapp', title:original.text, company:'ASAPP', country:null, jobDescription:'Explicit test criteria.', ...fields })
    assert.notEqual(normalized.employmentType, 'Full-time');assert.notEqual(normalized.remoteStatus, 'On-site')
    assert.equal(fields.sourcePostingDate, original.createdAt)
    assert.equal(isIndiaJob(normalized), false)
  }
})
test('Lever documented pagination consumes a later short page; malformed synthetic own IDs remain retained and held', async () => {
  const r = replay(), first = fixture.oracle.asapp.records[0].originalFeedRecord
  const synthetic = Array.from({length:100}, (_,index) => ({ ...structuredClone(first), id:'00000000-0000-4000-8000-' + String(index).padStart(12,'0') }))
  const originalFetch = r.options.fetchPage, seen = []
  r.options.fetchPage = async url => {
    if (url.startsWith('https://api.lever.co/v0/postings/asapp-2?')) {
      seen.push(url)
      return { url, status:200, headers:{'content-type':'application/json'},bodyBase64:Buffer.from(JSON.stringify(new URL(url).searchParams.get('skip')==='0'?synthetic:[])).toString('base64') }
    }
    return originalFetch(url)
  }
  await run('asapp', r)
  assert.equal(seen.length, 4);assert.ok(seen.some(url => new URL(url).searchParams.get('skip')==='100'))
  assert.equal(r.audits[0].observations.length, 113, 'All13 real board-only roles also remain in the audit')
  const syntheticIds=new Set(synthetic.map(row=>row.id)),observations=r.audits[0].observations
  assert.ok(observations.filter(row=>syntheticIds.has(row.jobId)).every(row=>!row.sourceCurrentNativeRoleQualified))
  assert.ok(observations.filter(row=>!syntheticIds.has(row.jobId)).every(row=>row.sourceNativeDetailQualified&&row.sourceCurrentNativePostingIdentityQualified))
  assert.equal(r.audits[0].sourceScopeComplete,false)
})
