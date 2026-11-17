import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as source from '../../scraper/acsia/script.js'
import {readCurrentAcsiaModel} from '../../scraper/acsia/currentNative20261117.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
const capture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/acsia/fixtures/native-20261117.json.gz',import.meta.url)))),original=capture.requests[0],bytes=Buffer.from(original.bodyBase64,'base64'),body=bytes.toString('utf8')
function replay(change=(_count,text)=>text){let calls=0;return {get calls(){return calls},read:async(url,init)=>{
 assert.equal(url,source.CAREER_PAGE_URL);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.body,undefined)
 const response=new Response(change(++calls,body),{status:original.status,headers:original.headers});Object.defineProperty(response,'url',{value:original.url});return response
}}}
test('ACSIA parser retains all16 actual current native card originals without class-order assumptions',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),original.sha256)
 const rows=source.extractSearchResults(body);assert.equal(rows.length,16)
 assert.equal(rows[0].title,'Android AOSP Integration');assert.equal(rows.at(-1).title,'Financial Specialist')
 assert.ok(rows.every(row=>row.jobDescription.length>100&&row.nativeContent&&row.wholeNativeCard&&row.nativeApplicationDeclaration.attrs.href==='/careers/#apply-form'))
 assert.ok(rows.every(row=>row.nativeParagraphs.every(text=>row.jobDescription.includes(text))))
 const modified=body.replaceAll('brxe-tnyabu brxe-text-basic','brxe-tnyabu brxe-text-basic additional-modifier bricks-lazy-hidden');assert.notEqual(modified,body)
 assert.equal(source.extractSearchResults(modified).length,16)
})
test('ACSIA exact literal sites, experience and notice text never create India, On-site or synthetic requisition IDs',()=>{
 const rows=source.extractSearchResults(body)
 assert.ok(rows.every(row=>row.country===null&&row.city===null&&row.remoteStatus===null&&row.jobId===null&&row.requisitionId===null))
 assert.ok(rows.every(row=>!row.location||!/\bIndia\b/i.test(row.location)))
 assert.equal(rows[0].location,'Bangalore');assert.equal(rows[0].experienceRequired,'6–10 Years')
 assert.equal(rows.find(row=>row.title==='Software Developer Lead').location,'Trivandrum or Remote')
 const architect=rows.find(row=>row.title==='AUTOSAR Architect');assert.equal(architect.experienceRequired,'8 to 12 years');assert.equal(architect.noticePeriod,'30- 45 days')
 assert.ok(rows.every(row=>row.sourceCountryScopeUnresolved&&row.fullOwnRoleCriteriaQualified===false&&row.publicApplicationEligibilityQualified===false))
})
test('ACSIA retains all14 native intake fields including the hidden control without interpreting applicant visibility or eligibility',()=>{
 const model=readCurrentAcsiaModel(body)
 assert.equal(model.applicationForm.attrs.method,'post');assert.equal(model.applicationForm.attrs.action,undefined);assert.equal(model.nativeApplicationFields.length,14)
 assert.ok(model.nativeApplicationFields.some(node=>node.attrs.placeholder==='Placeholder'))
 assert.ok(model.nativeApplicationFields.some(node=>node.attrs.type==='file'&&node.attrs.accept==='.pdf,.doc,.docx'&&node.attrs['data-maxsize']==='2 MB'))
 assert.equal(model.roleSpecificApplicationBindingQualified,false);assert.equal(model.applicantFieldVisibilityAndValidationUnverified,true);assert.equal(model.publicApplicationEligibilityQualified,false)
})
test('ACSIA full current acquisition observes16 cards despite maxJobs1 and retains unknown company inventory and cleanup hold',async()=>{
 const transport=replay(),jobs=await source.createAcsiaScraper({maxJobs:1}).run({fetchImpl:transport.read})
 assert.equal(transport.calls,2);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,16)
 assert.equal(jobs.nativeCollectionEvidence.wholeObservedNativeCareerModelClosingReconciled,true)
 assert.equal(readSourceObservationEvidence(jobs,'acsia').observedVacancyCount,16);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const [label,change]of [
 ['full own role criteria',text=>text.replace('30- 45 days','60- 90 days')],
 ['native file validation field',text=>text.replace('data-maxsize="2 MB"','data-maxsize="4 MB"')],
 ['inline publisher program',text=>text.replace('</body>','<script>window.newNativeProgramme=true;</script></body>')],
])test('ACSIA closing '+label+' changes cannot reconcile an unchanged native cohort',async()=>{
 const transport=replay((count,text)=>{if(count!==2)return text;const changed=change(text);assert.notEqual(changed,text);return changed})
 await assert.rejects(source.run({fetchImpl:transport.read}),/Closing whole native cards\/criteria\/intake\/program declarations changed/)
 assert.equal(transport.calls,2)
})
test('ACSIA foreign employer canonical, application link and unbound extra apply anchor fail closed',()=>{
 for(const change of [text=>text.replace('rel="canonical" href="https://www.acsiatech.com/careers/"','rel="canonical" href="https://foreign.example/careers"'),text=>text.replace('href="/careers/#apply-form"','href="https://foreign.example/apply"'),text=>text.replace('</main>','<a href="/careers/#apply-form">Apply</a></main>')]){
  const changed=change(body);assert.notEqual(changed,body);assert.throws(()=>source.extractSearchResults(changed),/canonical|application|cohort|identity/i)
 }
})
test('ACSIA body-only metadata callbacks cannot publish unsupported country or criteria',async()=>{
 let calls=0
 await assert.rejects(source.run({fetchText:async()=>{calls++;return body}}),/Original HTTP metadata/);assert.equal(calls,0)
})
for(const mode of ['pre-abort','fulfilled','rejected'])test('ACSIA frozen opaque caller '+mode+' retains exact reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,mode});let calls=0
 if(mode==='pre-abort')controller.abort(reason)
 await assert.rejects(source.run({signal:controller.signal,maxJobs:mode==='pre-abort'?0:1,fetchImpl:async()=>{calls++;controller.abort(reason);if(mode==='rejected')throw Object.freeze(Error('replacement'));const response=new Response(body,{status:200,headers:original.headers});Object.defineProperty(response,'url',{value:original.url});return response}}),error=>error===reason)
 assert.equal(calls,mode==='pre-abort'?0:1)
})
test('ACSIA exact HTTP denial retains early status without reading a broken body or using browser fallback',async()=>{
 let reads=0,browser=0
 await assert.rejects(source.run({fetchImpl:async()=>({status:403,url:source.CAREER_PAGE_URL,headers:new Headers({'content-type':'text/html'}),body:{getReader(){reads++;throw Error('Broken entity')},cancel(){}}}),fetchBrowserText:async()=>{browser++;return body}}),error=>{
  assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.recruitmentObservations.originalResponses[0].status,403);assert.equal(error.recruitmentObservations.originalResponses[0].bodyComplete,false);return true
 })
 assert.equal(reads,0);assert.equal(browser,0)
})
