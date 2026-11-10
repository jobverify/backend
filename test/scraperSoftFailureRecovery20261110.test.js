import assert from 'node:assert/strict'
import test from 'node:test'
import {classifyScraperError} from '../scraper-support/utils/failureClassification.js'
import {extractionFailureReason} from '../scripts/catalogExtractionFailureEvidence.js'
import {recoverEmptyOnlyRecruitment} from '../scraper-support/utils/emptyOnlyRecruitmentRecovery.js'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {buildScraperAttemptDiagnostics} from '../scraper-support/runner.js'

const provider=getScraperCatalog().find(row=>row.source==='acceleroisa')
const options=fetchPage=>({emptyOnlyRecovery:{fetchPage,maxRequests:4,maxPages:2,maxDetails:1,sourceTimeoutMs:1000}})

test('a native DOM request deadline retains a network failure and a useful redacted reason',()=>{
 const error=new DOMException('e2logysoftwaresolutions request deadline exceeded https://example.test/?token=PRIVATE','TimeoutError')
 assert.equal(classifyScraperError(error).failureKind,'network_or_timeout')
 const reason=extractionFailureReason(error)
 assert.equal(reason.name,'TimeoutError')
 assert.match(reason.message,/request deadline exceeded/)
 assert.doesNotMatch(reason.message,/PRIVATE/)
 assert.equal(reason.code,null,'Legacy DOM numeric codes are not transport error codes')
})

test('native timeout causes are understood without making local runner deadlines soft',()=>{
 assert.equal(classifyScraperError(new Error('Source collection failed',{cause:new DOMException('Request budget elapsed','TimeoutError')})).failureKind,'network_or_timeout')
 assert.equal(classifyScraperError({message:'request deadline exceeded',localTimeout:true,failureKind:'runner_timeout'}).softFailure,false)
})

test('diagnostic readers do not invoke custom accessors while supporting native DOM getters',()=>{
 let reads=0
 const error={}
 for(const key of ['name','message','code','cause'])Object.defineProperty(error,key,{get(){reads++;throw Error('Custom accessor executed')}})
 assert.equal(extractionFailureReason(error),null)
 assert.equal(reads,0)
 const disguised=Object.create(DOMException.prototype)
 assert.equal(extractionFailureReason(disguised),null)
})

test('an unavailable empty-only recovery reaches persisted attempt diagnostics with its actual reason',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Fixture must not perform live requests'))
 const jobs=await recoverEmptyOnlyRecruitment([],provider,options(async url=>({status:503,url,html:'Unavailable'})))
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.match(evidence.reason,/503/)
 const diagnostics=buildScraperAttemptDiagnostics(jobs,undefined,provider)
 assert.equal(diagnostics.emptyOnlyRecruitmentRecovery.status,'unavailable')
 assert.equal(diagnostics.emptyOnlyRecruitmentRecovery.failureKind,'network_or_timeout')
 assert.equal(diagnostics.emptyOnlyRecruitmentRecovery.failures[0].status,503)
})

test('a readable empty-only surface without vacancies retains its semantic gap reason',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('Fixture must not perform live requests'))
 const jobs=await recoverEmptyOnlyRecruitment([],provider,options(async url=>({status:200,url,html:'<title>Accelero Corporation</title><h1>Accelero Corporation</h1>'})))
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.firstParty,true)
 assert.equal(evidence.reportedTotal,null)
 assert.match(evidence.reason,/current-native-recruitment-contract-not-discovered/)
 assert.equal(buildScraperAttemptDiagnostics(jobs,undefined,provider).emptyOnlyRecruitmentRecovery.requestCount,2)
})
