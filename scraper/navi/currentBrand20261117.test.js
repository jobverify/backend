import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,hasOfficialBoardSignal} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-brand-20261117.json.gz',import.meta.url)))),board=fixture.responses.find(p=>p.url.includes('/dashboardv2?'))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
const replay=(change=(p,b)=>b)=>{
 const counts=new Map()
 return{now:()=>fixture.now,requestIntervalMs:0,maxJobs:3,fetchImpl:async(input,init={})=>{
  const url=String(input),method=init.method??'GET',key=method+' '+url,sequence=(counts.get(key)||0)+1;counts.set(key,sequence)
  const token=url.endsWith('/api/token/noauth'),p=token?{url,method,status:200,finalUrl:url,contentType:'application/json'}:fixture.responses.find(p=>p.url===url&&p.method===method)
  assert.ok(p,'Only captured declared public reads '+key)
  if(!token)assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.sha256)
  if(method==='POST')assert.equal(init.body,p.requestBody)
  const raw=token?Buffer.from(JSON.stringify({access_token:'synthetic-Navi-fixture-only-token'})):Buffer.from(p.bodyBase64,'base64')
  return Object.defineProperty(new Response(change(p,raw,sequence),{status:p.status,headers:{'content-type':p.contentType}}),'url',{value:p.finalUrl})
 }}
}
test('Navi exact current display-brand shell retains native organization and full criteria under scope holds',async()=>{
 assert.equal(hasOfficialBoardSignal(text(board)),true)
 const jobs=await run(replay())
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleClosingReconciled&&j.nativeSourceRecord.nativeDetail.OrgDetails.OrgName==='Navi'))
 assert.equal(readSourceObservationEvidence(jobs,'navi').observedRecordCount,44)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.Result.length,44)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessed=assessSoftFailureAcquisition({source:'navi',companyName:'Navi'},jobs)
 assert.equal(assessed.runnerOutcome.rawRecords,44);assert.equal(assessed.cleanupOptions.replaceExisting,false)
})
test('Navi current label cannot admit edited title, organization-logo binding or extra programs',()=>{
 for(const edit of [s=>s.replace('<title>Navi</title>','<title>Another Employer</title>'),s=>s.replaceAll('3e818601-0baa-429c-b6f8-4b21903ae0e6','11111111-1111-4111-8111-111111111111'),s=>s.replace('</body>','<script>window.unreviewed=true</script></body>')])assert.equal(hasOfficialBoardSignal(edit(text(board))),false)
})
test('Navi current native organization contradiction and full unselected closing-row drift remain rejected',async()=>{
 for(const mode of ['employer','unselected-raw-field','root-native-model'])await assert.rejects(run(replay((packet,raw,sequence)=>{
  if(packet.method!=='POST')return raw
  const payload=JSON.parse(raw)
  if(mode==='employer')payload.Result[0].OrgDetails.OrgName='Another Employer'
  if(mode==='unselected-raw-field'&&sequence===2)payload.Result.at(-1).NewAuthoredField='changed-current-native-requirement'
  if(mode==='root-native-model'&&sequence===2)payload.NewAuthoredPortalNotice='changed-current-native-requirement'
  return Buffer.from(JSON.stringify(payload))
 })),/employer|closing.*(?:snapshot|model)/i)
})
