import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C26/capture.json.gz',import.meta.url))))
const original=url=>{const row=capture.documents[url];assert.ok(row);return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body}}
import * as source from '../../scraper/dentalkart/script.js'
import {encodeXML} from 'entities'
import {readCurrentBoard,normalizeCurrentDentalkartRecord} from '../../scraper/dentalkart/currentNative.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const board=original(source.CAREERS_PORTAL_URL).body,model=readCurrentBoard(board)
test('Dentalkart only returns published unlocked records from the complete observed model',async()=>{
 const jobs=await source.run({fetchPage:async url=>original(url)}),ids=new Set(jobs.map(job=>job.jobId))
 assert.equal(ids.size,10);for(const row of model.records)assert.equal(ids.has(row.id),row.Publish===true&&row.Is_Locked===false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Dentalkart source factory keeps output limits after full native inspection',async()=>{
 const jobs=await source.createDentalkartScraper({maxJobs:2}).run({fetchPage:async url=>original(url)})
 assert.equal(jobs.length,2);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,27);assert.equal(jobs.nativeCollectionEvidence.outputLimited,true)
})
test('Dentalkart formal identifiers and posting dates stay unknown beside native original fields',()=>{
 const record=model.records.find(row=>row.Publish&&!row.Is_Locked),job=normalizeCurrentDentalkartRecord(record)
 assert.equal(job.requisitionId,null);assert.equal(job.postingDate,null);assert.equal(job.nativeDateOpened,record.Date_Opened);assert.deepEqual(job.sourceNativeJobRecord,record)
 assert.equal(job.applicationUrlIsGeneric,true);assert.equal(job.sourceNativeJobId,record.id)
})
test('Dentalkart duplicate native IDs fail the original record model',()=>{
 const [a,b]=model.records;assert.notEqual(a.id,b.id)
 assert.throws(()=>readCurrentBoard(board.replaceAll(b.id,a.id)),/duplicate|record/i)
})
test('Dentalkart wrong native employer and missing original country type fail closed',()=>{
 assert.throws(()=>readCurrentBoard(board.replaceAll('VASA Denticity Limited','Other Employer')))
 const tag=board.match(/<input[^>]*id="jobs"(?:[^>"']|"[^"]*"|'[^']*')*>/i)?.[0];assert.ok(tag)
 const altered=structuredClone(model.records);altered[0].Country=null
 const changed=board.replace(tag,'<input type="hidden" id="jobs" value="'+encodeXML(JSON.stringify(altered))+'">')
 assert.throws(()=>readCurrentBoard(changed),/record/)
})
test('Dentalkart cancellation during a closing response propagates the exact caller reason',async()=>{
 const controller=new AbortController(),reason={exact:'closing cancel'};let boardReads=0
 await assert.rejects(()=>source.run({signal:controller.signal,fetchPage:async url=>{if(url===source.CAREERS_PORTAL_URL&&++boardReads===2)controller.abort(reason);return original(url)}}),error=>error===reason)
})
