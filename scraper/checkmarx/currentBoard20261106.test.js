import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeData} from './nativeData.js'
import {parseCheckmarxBoard,BOARD} from './nativeContract.js'
import {run} from './script.js'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-board-20261106.json.gz',import.meta.url))))
for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256)}
const packet=fixture.packets.find(p=>p.requestedUrl===BOARD),html=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const now=packet.sourceCompletedAt,rows=readNativeData(html,'COMPANY_POSITIONS_DATA')
// All mutations below are synthetic isolations/adversarial controls. The full
// original40-row positive retains the exact original response bytes and clock.
function withRows(next){
 const re=/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/
 return html.replace(re,(_match,prefix,line)=>prefix+JSON.stringify(next).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||''))
}
const single=row=>parseCheckmarxBoard(withRows([row]),{now})

test('original current native board preserves all40 location-specific UIDs, seven typed countries and no India projection',()=>{
 const parsed=parseCheckmarxBoard(html,{now})
 assert.equal(parsed.rows.length,40)
 assert.deepEqual(parsed.rows,rows)
 assert.deepEqual([...new Set(rows.map(r=>r.location.country))].sort(),['BR','GB','IL','MX','PH','PT','US'])
 assert.equal(rows.filter(r=>r.location.country==='IN').length,0)
 assert.equal(parsed.companyGlobalTotal,null);assert.equal(parsed.companyIndiaTotal,null)
})

for(const [name,id] of [['search tracking','04.274'],['native referral identifier','CC.475'],['employee share tracking','35.27F'],['typed GB country','B3.475']]){
 test('synthetic one-row isolation accepts the observed '+name+' without changing public identity',()=>{
  const row=rows.find(r=>r.uid===id),parsed=single(row)
  assert.deepEqual(parsed.rows,[row])
  assert.equal(parsed.rows[0].url_active_page,row.url_active_page)
  assert.equal(new URL(parsed.rows[0].url_comeet_hosted_page).search,'')
  assert.notEqual(row.location.country,'IN')
 })
}

test('synthetic repeated current body closes an observed zero India projection while retaining40 observations and incomplete company scope',async()=>{
 const urls=[]
 const jobs=await run({now,fetchImpl:async(url,options)=>{
  urls.push(url);assert.equal(url,BOARD);assert.ok(options.method==null||options.method==='GET');assert.equal(options.body,undefined)
  return{url,status:200,text:async()=>html}
 }})
 assert.equal(jobs.length,0);assert.deepEqual(urls,[BOARD,BOARD])
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.pagesFetched,2);assert.equal(isFreshCompleteInventoryEvidence(evidence,{now}),false)
 assert.deepEqual(readSourceObservationEvidence(jobs,'checkmarx'),{source:'checkmarx',recordKind:'vacancy-rows',observedRecordCount:40,observedVacancyCount:40,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})

for(const [name,query]of [
 ['unknown redirect','redirect=https%3A%2F%2Fexample.com'],
 ['duplicate query key','jr_id=6aeb77cbf40efa43f4a17ab3&jr_id=6aeb77cbf40efa43f4a17ab3'],
 ['malformed native referral identifier','jr_id=OTHER'],
 ['employee flag value','Share&employee=true&t=1792871230423'],
 ['unpaired employee flag','employee'],
 ['share clock without employee flag','Share&t=1792871230423'],
 ['malformed share clock','Share&employee&t=not-a-clock'],
 ['empty search tracker','utm_search_query='],
 ['markup in search tracker','utm_search_query=%3Cscript%3E']
])test('synthetic official tracking rejects '+name,()=>{
 const row=structuredClone(rows.find(r=>r.uid==='04.274'))
 row.url_active_page='https://checkmarx.com/job-openings/position/04.274/?'+query;row.url_detected_page=row.url_active_page
 assert.throws(()=>single(row),/tracking/)
})

test('typed GB still rejects unknown country and an India-label contradiction',()=>{
 const row=structuredClone(rows.find(r=>r.uid==='B3.475'))
 row.location.country='ZZ';assert.throws(()=>single(row),/country/)
 row.location.country='GB';row.location.name='London, India';assert.throws(()=>single(row),/India/)
})

test('zero India projection still requires unchanged closing native records',async()=>{
 let requests=0
 const changed=structuredClone(rows);changed[0].name+=' changed'
 await assert.rejects(()=>run({now,fetchImpl:async url=>({url,status:200,text:async()=>++requests===1?html:withRows(changed)})}),/changed during extraction/)
 assert.equal(requests,2)
})

test('zero India projection cannot swallow exact caller cancellation during closing',async()=>{
 const c=new AbortController(),reason=Object.freeze({message:'caller stop'});let requests=0
 await assert.rejects(()=>run({now,signal:c.signal,fetchImpl:async url=>({url,status:200,text:async()=>{if(++requests===2)c.abort(reason);return html}})}),e=>e===reason)
 assert.equal(requests,2)
})
