import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {canRecoverSoftRecruitmentFailure,recoverSoftFailedRecruitment} from '../scraper-support/utils/softFailureRecruitmentRecovery.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const provider=getScraperCatalog().find(row=>row.source==='aapkapainter')
const root=provider.companyCareerPage
const roleURL=new URL('/careers/software-engineer',root).href
const description='<p>Develop and maintain production software services. Review API contracts, investigate distributed system failures, and collaborate with the engineering team on reliable delivery.</p>'
const record=changes=>({'@type':'JobPosting',title:'Software Engineer',identifier:{value:'native-role-1'},
 hiringOrganization:{name:provider.companyName},url:roleURL,description,datePosted:'2026-11-09',
 jobLocation:{address:{addressCountry:'IN',addressLocality:'Bengaluru'}},...changes})
const failure=()=>Object.assign(Error('Legacy careers declaration changed'),{softFailure:true,failureKind:'surface_drift_or_fail_closed',abortRetries:true})
const options=changes=>({softFailureRecovery:{now:()=> '2026-11-10T15:00:00Z',sourceTimeoutMs:2000,
 fetchPage:async url=>({status:200,url,html:url===roleURL?'<h1>Software Engineer</h1>'+description+'<script type="application/ld+json">'+JSON.stringify(record(changes))+'</script>'
 :'<title>'+provider.companyName+' Careers</title><h1>'+provider.companyName+'</h1><a href="'+roleURL+'">Open job</a>'})}})
test.beforeEach(t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Recovery tests must remain offline')))

test('a changed source can recover a current declared India role with exact employer and original criteria',async()=>{
 const jobs=await recoverSoftFailedRecruitment(failure(),provider,options())
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].nativeSourceRecord.hiringOrganization.name,provider.companyName)
 assert.equal(jobs[0].sourceDescription,description)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.softFailureRecruitmentRecovery.originalFailureKind,'surface_drift_or_fail_closed')
})

for(const[title,change]of[
 ['a different employer',{hiringOrganization:{name:'Other Corporation'}}],
 ['a missing country',{jobLocation:{address:{addressLocality:'Bengaluru'}}}],
 ['a foreign country',{jobLocation:{address:{addressCountry:'US'}}}],
 ['an incomplete description',{description:'Apply now'}],
])test('recovery keeps the original failure for '+title,async()=>{
 const error=failure()
 assert.equal(await recoverSoftFailedRecruitment(error,provider,options(change)),null)
 assert.notEqual(error.softFailureRecruitmentRecovery.status,'observed-india-roles')
})

for(const error of [Error('HTTP 403'),Error('fetch failed'),Error('certificate has expired'),
 Object.assign(Error('HTTP 403'),{softFailure:true,failureKind:'coverage_gap'}),
 Object.assign(Error('Invalid parser'),{failureKind:'parser_or_contract_error'}),
 Object.assign(Error('Source deadline exceeded'),{localTimeout:true}),
 Object.assign(Error('Missing module'),{code:'ENOENT'}),
 Object.assign(Error('Current inventory unavailable'),{softFailure:true,failureKind:'coverage_gap',status:403}),
 Object.assign(Error('Current inventory unavailable'),{softFailure:true,failureKind:'coverage_gap',code:'CERT_HAS_EXPIRED'}),
 Object.assign(Error('Current inventory unavailable'),{softFailure:true,failureKind:'coverage_gap',name:'TimeoutError'}),
 Object.assign(Error('Current inventory unavailable',{cause:{status:403}}),{softFailure:true,failureKind:'coverage_gap'}),
])test('access, transport and hard failures do not authorize alternate acquisition: '+error.message,async()=>{
 assert.equal(canRecoverSoftRecruitmentFailure(error),false)
 assert.equal(await recoverSoftFailedRecruitment(error,provider,options()),null)
})

test('injected source transports remain isolated unless a separate recovery transport is supplied',async()=>{
 assert.equal(await recoverSoftFailedRecruitment(failure(),provider,{fetchPage:async()=>assert.fail('No implicit recovery')}),null)
})

test('zero budgets and an explicit opt-out never issue recovery requests',async()=>{
 for(const settings of [{softFailureRecovery:false},{softFailureRecovery:{maxRequests:0}},{softFailureRecovery:{sourceTimeoutMs:0}}]){
  assert.equal(await recoverSoftFailedRecruitment(failure(),provider,settings),null)
 }
})

test('caller cancellation preserves the exact reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancelled:true});controller.abort(reason)
 await assert.rejects(recoverSoftFailedRecruitment(failure(),provider,{signal:controller.signal}),error=>error===reason)
})

test('opaque primitive failures are preserved without attempting recovery',async()=>{
 for(const error of [null,undefined,42,'Failure',Symbol('failure')]){
  assert.equal(canRecoverSoftRecruitmentFailure(error),false)
  assert.equal(await recoverSoftFailedRecruitment(error,provider,options()),null)
 }
})

test('the registered source wrapper invokes recovery after its original contract fails',async()=>{
 const jobs=await createCatalogScraper(provider).run({fetchPage:async url=>({status:200,url,html:'<html>Changed corporate page</html>'}),...options()})
 assert.equal(jobs.length,1)
 assert.equal(jobs.softFailureRecruitmentRecovery.status,'observed-india-roles')
})

test('unavailable recovery retains bounded actionable transport diagnostics',async()=>{
 const error=failure()
 const result=await recoverSoftFailedRecruitment(error,provider,{softFailureRecovery:{sourceTimeoutMs:2000,
  fetchPage:async()=>{throw Object.assign(Error('HTTP 403 https://publisher.invalid/careers?token=private-value authorization=private-value'),{status:403})}}})
 assert.equal(result,null)
 const recovery=error.softFailureRecruitmentRecovery
 assert.equal(recovery.status,'unavailable')
 assert.ok(recovery.failures.some(value=>value.status===403&&value.stage==='official-page'))
 assert.ok(recovery.failures.some(value=>value.requestUrl===new URL(root).origin+new URL(root).pathname))
 assert.ok(!JSON.stringify(recovery).includes('private-value'))
 assert.ok(recovery.failures.length<=8)
 assert.equal(recovery.sourceScopeComplete,false)
 assert.equal(recovery.lifecycleCleanupAllowed,false)
})

test('unqualified recovered records retain the reason they were excluded',async()=>{
 const error=failure()
 assert.equal(await recoverSoftFailedRecruitment(error,provider,options({hiringOrganization:{name:'Other Corporation'}})),null)
 assert.ok(error.softFailureRecruitmentRecovery.unresolved.includes('native-employer-mismatch'))
 assert.ok(error.softFailureRecruitmentRecovery.receipts.length>0)
 assert.ok(error.softFailureRecruitmentRecovery.receipts.every(receipt=>/^[a-f0-9]{64}$/.test(receipt.bodySHA256)))
})
