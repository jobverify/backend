import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readOriginalNativeCriteria} from '../native-sources/currentNativeCriteria20261106.js'
import {readCurrentGoodnotesBoard,readCurrentGoodnotesDetail} from '../../scraper/goodnotes/currentNative.js'
import {run as runFinolex} from '../../scraper/finolexindustrieslimited/script.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {decorateJobsWithProviderMetadata} from '../providers/index.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/capture.json.gz',import.meta.url))))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/expectations.json',import.meta.url),'utf8'))
const original=url=>capture.responses.find(row=>row.requestedUrl===url),listing='https://www.finolexpipes.com/apis/joblist/'
function finolexTransport(summary){return async(url,init)=>{
 const row=original(url);assert.ok(row,'Unexpected original URL '+url)
 assert.equal(init.method,url===listing?'POST':'GET');if(url===listing)assert.equal(init.body,'Activity=joblist')
 let body=row.body
 if(url===listing&&summary!==undefined){const records=JSON.parse(body);records[0].summary=summary;body=JSON.stringify(records)}
 return {status:row.status,finalUrl:row.finalUrl,headers:row.headers,body}
}}
for(const [name,summary] of [['zero-width-only','&#8203;'],['editor placeholder','Enter job description'],['loading error','Error loading job details. Please try again later.']]){
 test('C27-R1 Finolex holds a '+name+' instead of publishing a complete vacancy',async()=>{
  const jobs=await runFinolex({fetchPage:finolexTransport(summary)})
  assert.equal(jobs.length,13);assert.equal(jobs.some(row=>row.jobId==='43'),false)
  assert.equal(jobs.nativeCollectionEvidence.incompleteCriteriaCount,1)
  assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.nativeId==='43'&&row.reason==='native-full-criteria-unavailable'))
 })
}
test('C27-R1 criteria qualification excludes invisible and placeholder text at an explicitly low minimum',()=>{
 for(const value of ['&#8203;','&ZeroWidthSpace;','Enter job description','Error loading job details. Please try again later.']){
  assert.equal(readOriginalNativeCriteria(value,message=>new Error(message),{minimumChars:1}).sourceDetailComplete,false,value)
 }
 const full=readOriginalNativeCriteria(expected.finolex.find(row=>row.id==='55').html,message=>new Error(message),{minimumChars:1})
 assert.equal(full.sourceDetailComplete,true)
})
test('C27-R2 complete native criteria cannot retain executable URL programs',()=>{
 for(const url of ['javascript:void(0)','java&#x09;script:void(0)','&NewLine;javascript:void(0)','data:text/html,delegate']){
  assert.throws(()=>readOriginalNativeCriteria('<a href="'+url+'">'+expected.finolex[0].html+'</a>',message=>new Error(message)),/program|executable|delegated/i,url)
 }
 assert.equal(readOriginalNativeCriteria('<a href="https://www.finolexpipes.com/">'+expected.finolex[0].html+'</a>',message=>new Error(message)).sourceDetailComplete,true)
})
test('C27-R3 Finolex observations survive the evidence schema rather than silently disappearing',async()=>{
 const jobs=await runFinolex({fetchPage:finolexTransport()}),evidence=readSourceObservationEvidence(jobs,'finolexindustrieslimited')
 assert.ok(evidence);assert.equal(evidence.recordKind,'vacancy-rows');assert.equal(evidence.observedRecordCount,14);assert.equal(evidence.observedVacancyCount,14)
})
test('C27-R4 valid source observations and full closing evidence coexist after provider decoration',()=>{
 const jobs=[{jobId:'observed',title:'Observed role',country:null}],native={source:'goodnotes',recordKind:'vacancy-rows',observedRecordCount:1,observedVacancyCount:1,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
  holds:[{nativeId:'gone',reason:'native-record-missing-unpublished-or-changed-at-closing'}],originalOpeningRecords:[{id:'observed'}],originalClosingRecords:[{id:'observed'}],reader:{receipts:[{method:'GET',requestedUrl:'https://example.test/original'}]}}
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:native,configurable:true})
 const decorated=decorateJobsWithProviderMetadata(jobs,{source:'goodnotes',companyName:'Goodnotes'})
 assert.equal(decorated.nativeCollectionEvidence,native)
 assert.equal(decorated.nativeCollectionEvidence.holds[0].nativeId,'gone')
 assert.equal(decorated.nativeCollectionEvidence.reader.receipts.length,1)
 assert.equal(readSourceObservationEvidence(decorated,'goodnotes').observedVacancyCount,1)
})
test('C27-live title accepts the genuine normal title as well as the earlier publisher placeholder',()=>{
 const board=readCurrentGoodnotesBoard(original('https://job-boards.greenhouse.io/goodnotes').body),record=board.records.find(row=>row.id===6127461004)
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/goodnotes-live-title.json.gz',import.meta.url))))
 assert.equal(current.response.sha256,'4506b49e47369dcfe6d21428168d8818ffed02303edf218c8aa86ddad75d4315')
 assert.equal(readCurrentGoodnotesDetail(current.response.body,record).criteria.sourceDetailComplete,true)
 assert.equal(readCurrentGoodnotesDetail(original(record.absolute_url).body,record).criteria.sourceDetailComplete,true)
})
