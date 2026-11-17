import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentDentalkart,readCurrentBoard} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
const board=fixture.responses[1].body
const ids=['178824000004695061','178824000004738296','178824000004847952','178824000004871513','178824000004532005','178824000004534003','178824000004696459','178824000006205008','178824000006260157']
const sha=value=>createHash('sha256').update(value).digest('hex')

test('Dentalkart Nov16 CDN deployment preserves nine original India vacancies and closing holds',async()=>{
 let next=0
 const jobs=await runCurrentDentalkart({fetchPage:async url=>{
  const row=fixture.responses[next++]
  assert.equal(url,row.url)
  assert.equal(sha(Buffer.from(row.bodyBase64,'base64')),row.sha256)
  return row
 }})
 assert.equal(next,4)
 assert.deepEqual(jobs.map(row=>row.jobId),ids)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,28)
 assert.equal(jobs.nativeCollectionEvidence.closedOrLockedCount,19)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,true)
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.sourceClosingReconciled&&row.jobDescription.length>1000&&row.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Dentalkart Nov16 reviewed map cannot authorize a different script declaration or edited map',()=>{
 for(const changed of [
  board.replace('career-website-common.e098b32b8e59c3522a0599bd2176f5cc.js','career-website-common.00000000000000000000000000000000.js'),
  board.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unreviewed.js":"unreviewed.js",'),
 ]){
  assert.notEqual(changed,board)
  assert.throws(()=>readCurrentBoard(changed),/program.*review/)
 }
})
