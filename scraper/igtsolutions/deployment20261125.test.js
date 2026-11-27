import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeTree} from './currentModels20261117.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261125/native-capture.json.gz',import.meta.url))))
const home='https://atain.com/',careers=home+'careers/',join=home+'join-the-squad/'
const currentPrivacy='https://atain.com/corporate-governance/privacy-policy-global/'
const content=packet=>{
 const body=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256);return body.toString()
}
function replay(change=(_url,body)=>body){
 const reads=[],counts=new Map()
 return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  url=String(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const count=(counts.get(url)??0)+1;counts.set(url,count)
  const packet=fixture.responses.filter(packet=>packet.requestedUrl===url)[count-1]
  assert.ok(packet,'Only retained current public GET response '+url+' observation '+count);reads.push(url)
  return Object.defineProperty(new Response(change(url,content(packet),count),{status:packet.status,headers:packet.headers}),'url',{value:packet.responseUrl})
 }}}
}
const contract=error=>error.failureKind==='parser_or_contract_error'

test('IGT current exact public intake retains the complete real form and keeps all vacancy/India/eligibility authority unknown',async()=>{
 const{reads,options}=replay()
 await assert.rejects(run(options),error=>{
  assert.equal(error.failureKind,'source_inventory_unavailable');assert.equal(error.softFailure,true)
  const evidence=error.nativeCollectionEvidence
  assert.equal(fixture.synthetic,false);assert.equal(evidence.retainedResponses.length,6)
  assert.deepEqual(evidence.nativeOpeningModel,evidence.nativeClosingModel)
  const original=content(fixture.responses.find(packet=>packet.requestedUrl===join)),forms=readNativeDocument(original).nodes(node=>node.tag==='form')
  assert.equal(forms.length,1);assert.deepEqual(evidence.nativeOpeningModel.nativeApplicationForm.nativeDOM,nativeTree(forms[0]))
  const model=evidence.nativeOpeningModel.nativeApplicationForm
  assert.equal(model.attrs.action,'/join-the-squad/#wpcf7-f3916-p3868-o1')
  assert.equal(model.attrs.method,'post');assert.ok(JSON.stringify(model).includes(currentPrivacy))
  assert.ok(model.controls.some(control=>control.attrs.name==='career-consent'))
  assert.ok(model.controls.some(control=>control.attrs.name==='country'))
  assert.equal(evidence.companyIndiaTotal,null);assert.equal(evidence.companyGlobalTotal,null);assert.equal(evidence.observedVacancyCount,null)
  assert.equal(evidence.roleEmployerBindingsProven,false);assert.equal(evidence.verifiedEmpty,false)
  assert.equal(evidence.applicationSubmitted,false);assert.equal(evidence.applicationValidationComplete,false)
  assert.equal(evidence.browserEquivalenceComplete,false);assert.equal(evidence.sourceScopeComplete,false)
  assert.equal(evidence.lifecycleCleanupAllowed,false);return true
 })
 assert.deepEqual(reads,[home,careers,join,home,careers,join])
})

test('IGT current declaration admission rejects an unreviewed program or changed external declaration',async()=>{
 for(const mode of['inline','external','attribute']){
  let changed=false
  const{options}=replay((url,body)=>{
   if(url!==home)return body
   changed=true
   if(mode==='inline')return body.replace('</body>','<script>window.unreviewedRecruitment=true</script></body>')
   if(mode==='external')return body.replace('jquery.min.js?ver=3.7.1','jquery.unreviewed.js?ver=3.7.1')
   return body.replace('id="jquery-core-js"','id="jquery-core-js" crossorigin="anonymous"')
  })
  await assert.rejects(run(options),contract,mode);assert.equal(changed,true,mode)
 }
})

test('IGT current whole intake profile rejects changed consent destination, extra questions and country controls',async()=>{
 for(const mode of['privacy','question','country']){
  let changed=false
  const{options}=replay((url,body)=>{
   if(url!==join)return body
   const next=mode==='privacy'?body.replace(currentPrivacy,'https://unreviewed.example/required-policy/')
    :mode==='question'?body.replace('</form>','<input name="unreviewed-required-condition" required></form>')
     :body.replace('name="country"','name="unknown-country"')
   changed=next!==body;return next
  })
  await assert.rejects(run(options),/whole current generic form/);assert.equal(changed,true,mode)
 }
})

test('IGT current first-party recruitment handoffs cannot be replaced by foreign or inert intake links',async()=>{
 for(const mode of['foreign','inert']){
  let changed=false
  const{options}=replay((url,body)=>{
   if(url!==careers)return body
   const next=mode==='foreign'?body.replaceAll(join,'https://foreign.invalid/join-the-squad/')
    :body.replaceAll('href="'+join+'"','hidden href="'+join+'"')
   changed=next!==body;return next
  })
  await assert.rejects(run(options),contract);assert.equal(changed,true,mode)
 }
})

test('IGT current closing proof retains passive recruitment context instead of qualifying a changed intake observation',async()=>{
 let changed=false
 const{options}=replay((url,body,count)=>{
  if(url!==home||count!==2)return body
  changed=true;return body.replace('</body>','<p>Additional current recruitment restriction</p></body>')
 })
 await assert.rejects(run(options),/complete current HTML/);assert.equal(changed,true)
})
