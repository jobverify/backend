import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativePlaces,fullCriteria} from './nativeData.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/india-conflict-20261119.json.gz',import.meta.url))))
const job=f.originalNativeObservation,record=job.sourceNativeAPIRecord,schema=job.sourceNativeJobPosting
test('Zapier preserves the full actual India secondary workplace and foreign alternatives while holding the explicit applicant-country conflict',()=>{
 const geo=nativePlaces(record,schema)
 assert.equal(record.location,'NAMER');assert.ok(record.secondaryLocations.some(x=>x.location==='India'))
 assert.ok(geo.countries.includes('India'));assert.ok(geo.countries.includes('United States'));assert.equal(geo.applicantConflict,true)
 assert.equal(geo.unresolved,true);assert.equal(geo.country,null)
 assert.equal(schema.applicantLocationRequirements.name,'United States')
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
test('Zapier authored India eligibility, complete application questions and the linked public country policy are retained as separate original evidence',()=>{
 assert.match(fullCriteria(job.sourceNativePosting),/Americas, Europe, UK, and India/)
 const own=f.originalApplicationReadOnlyResponse.data.jobPosting
 assert.equal(own.id,record.id);assert.equal(own.title,record.title);assert.ok(own.secondaryLocationNames.includes('India'))
 const fields=own.applicationForm.sections.flatMap(s=>s.fieldEntries)
 assert.equal(fields.length,18)
 const work=fields.find(x=>x.field.path==='_systemfield_location');assert.equal(work.field.title,'What city/country will you work from?');assert.deepEqual(work.field.locationTypes,['Country'])
 assert.ok(fields.some(x=>x.field.title==='Are you legally authorized to work in that country without company support?'))
 assert.match(f.originalApplicationReadOnlyQuery.query,/^query ApiJobPosting\(/)
 assert.equal(f.publicCountryPolicyReceipt.status,200)
 const csv=Buffer.from(f.publicCountryPolicyReceipt.bodyBase64,'base64').toString('utf8')
 assert.match(csv,/(?:^|\r?\n)"India","Entity","Entity"(?:\r?\n|$)/)
 assert.equal(job.sourceNativePosting.applicationDeadline,'2026-11-30T08:00:00.000Z')
 assert.equal(record.publishedAt,'2026-08-26T15:46:24.987+00:00')
})
test('Zapier does not replace mixed country evidence with a preferred secondary country',()=>{
 const changed=structuredClone(schema);changed.applicantLocationRequirements={...changed.applicantLocationRequirements,name:'India'}
 const geo=nativePlaces(record,changed);assert.equal(geo.country,null);assert.equal(geo.applicantConflict,true);assert.ok(geo.countries.includes('United States'))
})
