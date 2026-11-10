import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readCurrentBoard,readCurrentCorporate,normalizeCurrentDentalkartRecord,CAREERS_URL,BOARD_URL} from './currentNative.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-http-20261110.json.gz',import.meta.url))))
const board=capture.responses[1].body,corporate=capture.responses[0].body
const sha=value=>createHash('sha256').update(value).digest('hex')
const ids=['178824000004695061','178824000004738296','178824000004847952','178824000004871513','178824000004534003','178824000004532005','178824000005480520','178824000004696459']
const descriptionHashes=[
 '4464425fad95467ae1768013c3846fc312ee3eb7886395c2c099cbdbf0525d5f',
 'de7f474082d166b95402180c3efa60455f6eaa3d48ced47865d16016db794e12',
 'e40ca0c949abf0acc7fa7fcd2bf7e0a265b8ceed5f5f15c28dabfffa86d80adc',
 'c791446ab1dc9e43906f717b195ebba12a5709fb26609ee1229b6fdd9d586af0',
 'c4dfdf4ef3def452cf5c83db3195df057ed2437e5c8a5a36da722c75e41913e8',
 '2b23631d3ec847aeac9dfe4ae4cdd2637f2b8dbfc145ac253518f7e06f8feccd',
 '8d9fb6462f6d4ec019a9d72b01a9b430caf2295e6be6fc6c0a83e55cae8a051d',
 '6acf58a65998669beaf690a46ae51e74e5abd480540c63667d15f0b95040544b',
]
// Independently derived from the complete captured HTML by removing tags,
// decoding entities and discarding whitespace, without the criteria reader.
const criteriaHashes=[
 '8b8c63bc81632a405a6f8670bcc367cb9017eacd82b853911414f4e154e717f0',
 '9720253495048afbf0f0e03013325d1ca214f0c302a0ce6e64142362438c8b58',
 '63f008ccf2fdad8518bec3b2cbbc2f727c0e81f9dacd306a1a272b380e719de8',
 '4c066c18ce25bb6c38d1c2a948b09a6292e74100f3699444340817fefc76736d',
 'b10f993335a6f2493ff9439b54e5e140d3476d099fe32439dfd4020ce45cd7bf',
 '49a67fcb28c297ee1cb4c73797ece40d3df615547b757a2cd863d2a0b627130d',
 '53f27347f627cd1c144beb68d6980fb6a39de5348b7d122a7c30a698611c6ca7',
 '9b9b9bb22f85f79b918f4297ce37063fc88d4729e22550d89390b46b2e6016b4',
]
const datesOpened=['2026-08-19','2026-08-26','2026-09-02','2026-09-07','2026-09-14','2026-09-14','2026-09-29','2026-10-07']
const scraper=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='dentalkart'))
const replay=(mutate=(row)=>row)=>{
 let index=0
 return async(url,options)=>{
  const row=mutate(capture.responses[index],index++)
  assert.ok(row,'Unexpected excess native request')
  assert.equal(url,row.url)
  assert.equal(options.method,'GET')
  return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body}
 }
}
const changeJobs=(html,mutate)=>{
 const changed=html.replace(/<input\b[^>]*>/g,tag=>/\bid="jobs"/.test(tag)?tag.replace(/(\bvalue=")([^"]*)(")/,(_,prefix,value,suffix)=>{
  const rows=JSON.parse(decodeHTML(value));mutate(rows)
  return prefix+JSON.stringify(rows).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')+suffix
 }):tag)
 assert.notEqual(changed,html,'The closing fault must change the original jobs carrier')
 return changed
}

// Requiring the retired deployment fingerprints must break this test: the
// exact current declared board must yield its eight genuine complete roles.
test('Dentalkart current registered deployment preserves eight native India roles and reconciles closing records',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected live request during native replay')})
 assert.equal(capture.responses.length,4)
 for(const row of capture.responses){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
 const jobs=await scraper().run({now:()=>capture.completedAt,fetchPage:replay()})
 assert.deepEqual(jobs.map(row=>row.jobId),ids)
 for(const [index,job]of jobs.entries()){
  assert.equal(job.company,'Dentalkart');assert.equal(job.legalEmployer,'VASA Denticity Limited')
  assert.equal(job.country,'India');assert.equal(job.sourceCountryScopeUnresolved,false)
  assert.equal(sha(job.sourceDescriptionHTML),descriptionHashes[index])
  assert.equal(sha(job.jobDescription.replace(/\s/g,'')),criteriaHashes[index])
  assert.ok(job.jobDescription.length>1000);assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceNativeJobRecord.Country,'India');assert.equal(job.sourceNativeJobRecord.id,ids[index])
  assert.equal(job.requisitionId,null);assert.equal(job.postingDate,null);assert.equal(job.closingDate,null)
  assert.equal(job.nativeDateOpened,datesOpened[index]);assert.equal(job.sourceNativeJobRecord.Date_Opened,datesOpened[index])
  assert.equal(job.sourceClosingReconciled,true);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applyUrl,BOARD_URL);assert.equal(job.applicationUrlIsGeneric,true)
 }
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,26)
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,8)
 assert.equal(jobs.nativeCollectionEvidence.closedOrLockedCount,18)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const[name,mutate,error]of[
 ['an unreviewed asset map',html=>html.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unexpected.js":"unexpected.js",'),/inline program/],
 ['an unreviewed external declaration',html=>html.replace('career-website-common.d5910bf420e6656b66157906f08fbee8.js','career-website-common.00000000000000000000000000000000.js'),/program declarations/],
 ['an additional active program',html=>html+'<script>window.unreviewed=true</script>',/program declarations/],
 ['a changed native bootstrap',html=>html.replace('initializeJobList();','initializeUnreviewedJobList();'),/bootstrap structure/],
 ['a hidden carrier',html=>html.replace('id="jobs"','hidden id="jobs"'),/hidden attributes/],
 ['a changed employer',html=>html.replaceAll('VASA Denticity Limited','Unrelated Employer Limited'),/title|employer/],
 ['a changed native mount owner',html=>html.replace('id="career-website-main"','hidden id="career-website-main"'),/mount owner/],
])test('Dentalkart still rejects '+name,()=>{
 const changed=mutate(board);assert.notEqual(changed,board)
 assert.throws(()=>readCurrentBoard(changed),error)
})

test('Dentalkart keeps the current corporate declaration bound to the exact native employer board',()=>{
 assert.equal(readCurrentCorporate(corporate).boardURL,BOARD_URL)
 assert.throws(()=>readCurrentCorporate(corporate.replaceAll(BOARD_URL,'https://unrelated.zohorecruit.in/jobs/Careers')),/handoff/)
 assert.throws(()=>readCurrentCorporate(corporate.replaceAll('VASA DENTICITY LIMITED','UNRELATED EMPLOYER LIMITED')),/legal-employer/)
})

test('Dentalkart uses the own native country and retains full-criteria completeness checks',()=>{
 const original=readCurrentBoard(board).records.find(row=>row.id===ids[0])
 const unknown=normalizeCurrentDentalkartRecord({...original,Country:''})
 assert.equal(unknown.country,null);assert.equal(unknown.sourceCountryScopeUnresolved,true)
 assert.equal(unknown.city,'New Delhi')
 const missing=normalizeCurrentDentalkartRecord({...original,Job_Description:'<div>NA</div>'})
 assert.equal(missing.sourceDetailComplete,false);assert.equal(missing.jobDescription,null)
 assert.throws(()=>normalizeCurrentDentalkartRecord({...original,Job_Description:'<p hidden>Unreviewed hidden criteria</p>'+original.Job_Description}),/hidden or incomplete/)
})

test('Dentalkart withholds a role unpublished at closing and keeps coverage incomplete',async()=>{
 const jobs=await scraper().run({now:()=>capture.completedAt,fetchPage:replay((row,index)=>index===2?{...row,body:changeJobs(row.body,rows=>{rows.find(row=>row.id===ids[0]).Publish=false})}:row)})
 assert.equal(jobs.length,7);assert.equal(jobs.some(row=>row.jobId===ids[0]),false)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,false)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.nativeId===ids[0]&&row.reason==='native-record-missing-unpublished-or-changed-at-closing'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(row=>row.lifecycleCleanupAllowed===false))
})

test('Dentalkart rejects a changed final board URL before accepting any native inventory',async()=>{
 await assert.rejects(()=>scraper().run({fetchPage:replay((row,index)=>index===1?{...row,finalUrl:CAREERS_URL}:row)}),/final URL changed/)
})
