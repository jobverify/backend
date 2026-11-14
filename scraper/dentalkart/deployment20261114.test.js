import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readCurrentBoard,normalizeCurrentDentalkartRecord,BOARD_URL} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261114.json.gz',import.meta.url))))
const board=fixture.responses[1].body,sha=value=>createHash('sha256').update(value).digest('hex')
const ids=['178824000004695061','178824000004738296','178824000004847952','178824000004871513','178824000004532005','178824000004534003','178824000004696459','178824000005977025','178824000006260157']
const descriptions=['4464425fad95467ae1768013c3846fc312ee3eb7886395c2c099cbdbf0525d5f','de7f474082d166b95402180c3efa60455f6eaa3d48ced47865d16016db794e12','e40ca0c949abf0acc7fa7fcd2bf7e0a265b8ceed5f5f15c28dabfffa86d80adc','c791446ab1dc9e43906f717b195ebba12a5709fb26609ee1229b6fdd9d586af0','2b23631d3ec847aeac9dfe4ae4cdd2637f2b8dbfc145ac253518f7e06f8feccd','c4dfdf4ef3def452cf5c83db3195df057ed2437e5c8a5a36da722c75e41913e8','6acf58a65998669beaf690a46ae51e74e5abd480540c63667d15f0b95040544b','b7225ef5b51257e7162f954febe84009b44a7c762938a2e7dffa8cb058579b02','f2f74068a625cdd490b4dd2baee2b2e9ae83a323c39dbb8af8d40e5d2f802995']
const scraper=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='dentalkart'))
const replay=(change=(_url,row)=>row)=>{
 const counts=new Map()
 return async url=>{const row=fixture.responses.find(row=>row.url===url);assert.ok(row,'Undeclared request '+url);const count=(counts.get(url)||0)+1;counts.set(url,count);return change(url,{...row},count)}
}
const changeJobs=(html,mutate)=>html.replace(/<input\b[^>]*>/g,tag=>/\bid="jobs"/.test(tag)?tag.replace(/(\bvalue=")([^"]*)(")/,(_,prefix,value,suffix)=>{const rows=JSON.parse(decodeHTML(value));mutate(rows);return prefix+JSON.stringify(rows).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')+suffix}):tag)

test('Dentalkart Nov14 declared deployment returns nine recorded native India roles with original criteria and scope holds',async()=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const jobs=await scraper().run({fetchPage:replay()})
 assert.deepEqual(jobs.map(job=>job.jobId),ids)
 assert.deepEqual(jobs.map(job=>sha(job.sourceDescriptionHTML)),descriptions)
 assert.ok(jobs.every(job=>job.country==='India'&&job.legalEmployer==='VASA Denticity Limited'&&job.sourceDetailComplete&&job.sourceClosingReconciled&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.applyUrl===BOARD_URL&&job.applicationUrlIsGeneric&&job.postingDate===null))
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,28)
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,9)
 assert.equal(jobs.nativeCollectionEvidence.closedOrLockedCount,19)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

for(const[name,edit]of[
 ['an unknown CDN map',html=>html.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unexpected.js":"unexpected.js",')],
 ['a declaration from another deployment paired with the current map',html=>html.replace('career-website-common.e098b32b8e59c3522a0599bd2176f5cc.js','career-website-common.d5910bf420e6656b66157906f08fbee8.js')],
 ['an extra active program',html=>html+'<script>window.extra=true</script>'],
])test('Dentalkart current profile rejects '+name,()=>{
 const changed=edit(board);assert.notEqual(changed,board)
 assert.throws(()=>readCurrentBoard(changed),/program.*review/)
})

test('Dentalkart current records keep native country and hidden criteria controls',()=>{
 const record=readCurrentBoard(board).records.find(row=>row.id===ids[0])
 assert.equal(normalizeCurrentDentalkartRecord({...record,Country:''}).country,null)
 assert.throws(()=>normalizeCurrentDentalkartRecord({...record,Job_Description:'<p hidden>Hidden condition</p>'+record.Job_Description}),/hidden or incomplete/)
})

test('Dentalkart current deployment withholds an unpublished closing record and retains cleanup holds',async()=>{
 const jobs=await scraper().run({fetchPage:replay((url,row,count)=>url===BOARD_URL&&count===2?{...row,body:changeJobs(row.body,rows=>{rows.find(job=>job.id===ids[0]).Publish=false})}:row)})
 assert.equal(jobs.length,8);assert.ok(jobs.every(job=>job.jobId!==ids[0]&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
