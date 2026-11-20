import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {canRecoverSoftRecruitmentFailure,recoverSoftFailedRecruitment} from '../utils/softFailureRecruitmentRecovery.js'
import {recoverEmptyOnlyRecruitment} from '../utils/emptyOnlyRecruitmentRecovery.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../utils/inventoryEvidence.js'

const provider=getScraperCatalog().find(row=>row.source==='acceleroisa')
const clock='2026-11-20T00:00:00.000Z',home='https://www.accelero-corp.com/',url=home+'careers/jobs/fixture-india-1'
const description='<p>Develop production software services, investigate distributed system failures, review API contracts and collaborate with the engineering team.</p>'
const publisher='<title>Accelero Corporation Careers</title><h1>Accelero Corporation</h1><a href="'+url+'">Open job</a>'
const posting={'@type':'JobPosting',identifier:{value:'fixture-india-1'},title:'Software Engineer',url,hiringOrganization:{name:'Accelero Corporation'},description,datePosted:'2026-11-19',jobLocation:{address:{addressCountry:'IN',addressLocality:'Bengaluru'}}}
const role='<h1>Software Engineer</h1>'+description+'<script type="application/ld+json">'+JSON.stringify(posting)+'</script>'
const limits={now:()=>clock,maxRequests:8,maxPages:4,maxDetails:3,sourceTimeoutMs:3000}
const originalError=()=>Object.assign(Error('Current native publication coverage gap'),{softFailure:true,failureKind:'coverage_gap',abortRetries:true})
const blocked=()=>assert.fail('An authoritative current reader must not make generic recovery requests')

test('an authoritative current parser failure preserves its original error without generic recovery, including explicit transports',async()=>{
  const error=originalError();assert.equal(canRecoverSoftRecruitmentFailure(error),true)
  assert.equal(await recoverSoftFailedRecruitment(error,{...provider,authoritativeCurrentPublication:true},{softFailureRecovery:{...limits,fetchPage:blocked}}),null)
  assert.equal(Object.hasOwn(error,'softFailureRecruitmentRecovery'),false)
})

test('an authoritative all-held collection keeps its original native audit and coverage hold without generic acquisition',async()=>{
  const jobs=attachInventoryEvidence([],{status:'coverage-gap',surface:home,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:2,verifiedAt:clock,reason:'current-native-role-contradictions'})
  const audit={source:provider.source,heldNativeRoles:[{reason:'native foreign country'}],companyIndiaTotal:null}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
  const returned=await recoverEmptyOnlyRecruitment(jobs,{...provider,authoritativeCurrentPublication:true},{emptyOnlyRecovery:{...limits,fetchPage:blocked}})
  assert.equal(returned,jobs);assert.equal(returned.nativeCollectionEvidence,audit)
  assert.equal(returned.emptyOnlyRecruitmentRecovery,undefined)
  assert.equal(readInventoryEvidence(returned).reason,'current-native-role-contradictions')
})

test('the registered script adapter honors the authoritative provider declaration after its original empty reader',async t=>{
  let originalReads=0
  t.mock.method(globalThis,'fetch',async request=>{
    originalReads++;assert.ok([home,home+'careers',home+'jobs'].includes(request))
    return Object.defineProperty(new Response(publisher,{headers:{'content-type':'text/html'}}),'url',{value:request})
  })
  const jobs=await createCatalogScraper({...provider,authoritativeCurrentPublication:true}).run({...limits,emptyOnlyRecovery:{...limits,fetchPage:blocked}})
  assert.equal(jobs.length,0);assert.ok(originalReads>0)
  assert.equal(jobs.emptyOnlyRecruitmentRecovery,undefined)
  assert.notEqual(readInventoryEvidence(jobs)?.status,'verified-empty')
})

test('legacy source recovery remains available when the current-authority declaration is absent or false',async()=>{
  for(const flag of [undefined,false]){
    const jobs=await recoverSoftFailedRecruitment(originalError(),{...provider,authoritativeCurrentPublication:flag},{softFailureRecovery:{...limits,fetchPage:async request=>({status:200,url:request,html:request===url?role:publisher})}})
    assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
    assert.equal(jobs.softFailureRecruitmentRecovery.status,'observed-india-roles')
  }
})
