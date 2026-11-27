import assert from 'node:assert/strict'
import test,{beforeEach} from 'node:test'
import fs from 'node:fs'
import {createOfficialAtsRecoveryScraper,OFFICIAL_ATS_DISCOVERY} from '../scraper-support/utils/officialAtsRecovery.js'
import {discoverOfficialAtsBoards} from '../scraper-support/utils/officialAtsDiscovery.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {withRetry,getRetryMetadata} from '../scraper-support/utils/retry.js'
import {run as runFront} from '../scraper/front/script.js'

beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>assert.fail('Offline diagnosis forbids uncontrolled HTTP')))

const provider={source:'transport-fixture',companyName:'Fixture Employer',companyDomain:'employer.test',companyCareerPage:'https://employer.test/careers'}
const run=options=>createOfficialAtsRecoveryScraper(provider).run({fetchJson:async()=>assert.fail('Unverified employer must never authorize an ATS feed'),...options})
const timeout=message=>new DOMException(message,'TimeoutError')
const rejection=async operation=>{try{await operation()}catch(error){return error}assert.fail('Expected a failed acquisition')}

test('Front two genuine saved no-response timeouts remain a transport outage with both original causes',async()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/officialAtsTransport20261125/front-timeouts.json',import.meta.url),'utf8'))
 assert.equal(fixture.source,'front');assert.equal(fixture.transportReceipts.length,2)
 assert.ok(fixture.transportReceipts.every(receipt=>receipt.error?.name==='TimeoutError'&&receipt.status===undefined))
 const causes=[],requests=[]
 const error=await rejection(()=>runFront({fetchPage:async url=>{
  const receipt=fixture.transportReceipts[requests.length];assert.ok(receipt);assert.equal(url,receipt.url);requests.push(url)
  const cause=timeout(receipt.error.message);causes.push(cause);throw cause
 },fetchJson:async()=>assert.fail('No unavailable official surface can bind an ATS')}))
 assert.equal(error.failureKind,'network_or_timeout');assert.equal(error.softFailure,true);assert.equal(error.upstreamOutage,true)
 assert.equal(error.abortRetries,true);assert.equal(error.cause,causes[0]);assert.deepEqual(error.errors,causes)
 assert.deepEqual(requests,fixture.transportReceipts.map(receipt=>receipt.url))
 assert.equal(error.discoveryEvidence.reason,'official-company-transport-unavailable')
 assert.equal(error.discoveryEvidence.boards.length,0)
 assert.deepEqual(error.discoveryEvidence.checks.map(check=>check.error.name),['TimeoutError','TimeoutError'])
 assert.ok(!error.message.includes('no-verified-supported-ats-binding'))
 assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
})

test('all-failed official reads retain frozen network causes and their exact nested native codes without mutation',async()=>{
 const causes=[Object.freeze(Object.assign(new TypeError('fetch failed'),{cause:Object.freeze(Object.assign(new Error('connect failed'),{code:'ENETUNREACH'}))})),Object.freeze(Object.assign(new Error('connection reset'),{code:'ECONNRESET'}))]
 const original=causes.map(cause=>Object.getOwnPropertyDescriptors(cause));let count=0
 const error=await rejection(()=>run({fetchPage:async()=>{throw causes[count++]}}))
 assert.equal(count,2);assert.equal(error.failureKind,'network_or_timeout');assert.equal(error.cause,causes[0]);assert.deepEqual(error.errors,causes)
 assert.deepEqual(causes.map(cause=>Object.getOwnPropertyDescriptors(cause)),original)
 assert.deepEqual(error.discoveryEvidence.checks.map(check=>check.error.code),['ENETUNREACH','ECONNRESET'])
})

test('a successful official no-binding response retains a genuine coverage gap despite another unavailable root',async()=>{
 const error=await rejection(()=>run({fetchPage:async url=>{
  if(url===provider.companyCareerPage)return{status:200,url,html:'<p>Official company information only.</p>'}
  throw timeout('Homepage unavailable')
 }}))
 assert.equal(error.failureKind,'coverage_gap');assert.equal(error.upstreamOutage,false)
 assert.equal(error.discoveryEvidence.reason,'no-verified-supported-ats-binding')
 assert.equal(error.discoveryEvidence.checks.at(-1).error.name,'TimeoutError')
})

test('an actual HTTP response prevents a claim that every official request failed without a response',async()=>{
 const error=await rejection(()=>run({fetchPage:async url=>{
  if(url===provider.companyCareerPage)return{status:404,url,html:''}
  throw timeout('Other route unavailable')
 }}))
 assert.equal(error.failureKind,'coverage_gap');assert.equal(error.upstreamOutage,false)
 assert.equal(error.discoveryEvidence.checks[0].httpStatus,404)
})

test('valid status and httpStatus on an error or its cause preserve the observed HTTP response',async()=>{
 for(const field of['status','httpStatus'])for(const nested of[false,true]){
  const native=Object.freeze(Object.assign(timeout('Body unavailable after an observed HTTP503'),{[field]:503}))
  const cause=nested?Object.freeze(new TypeError('fetch failed',{cause:native})):native
  const error=await rejection(()=>run({fetchPage:async()=>{throw cause}}))
  assert.equal(error.failureKind,'coverage_gap');assert.equal(error.upstreamOutage,false)
  assert.equal(error.discoveryEvidence.reason,'no-verified-supported-ats-binding')
  assert.deepEqual(error.discoveryEvidence.checks.map(check=>check.httpStatus),[503,503])
 }
})

test('a later currently bound official page can still recover after an earlier connection error without guessed board tokens',async()=>{
 const reads=[],cause=Object.assign(new Error('DNS lookup failed'),{code:'ENOTFOUND'})
 const jobs=await run({fetchPage:async url=>{
  reads.push(url);if(url===provider.companyCareerPage)throw cause
  return{status:200,url,html:'<a href="https://jobs.ashbyhq.com/actual-current-board">Open roles</a>'}
 },fetchJson:async url=>{assert.equal(url,'https://api.ashbyhq.com/posting-api/job-board/actual-current-board');return{apiVersion:'1',jobs:[]}}})
 assert.equal(reads.length,2);assert.equal(jobs.length,0)
 assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].checks[0].error.code,'ENOTFOUND')
 assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].bindingEvidence.verified,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})

test('nested declared script connection failures remain recorded while a successful official page retains unknown binding scope',async()=>{
 const script='https://employer.test/careers-route.js',reads=[]
 const error=await rejection(()=>run({fetchPage:async url=>{
  reads.push(url);if(url===script)throw timeout('Declared route unavailable')
  return{status:200,url,html:url===provider.companyCareerPage?'<script src="/careers-route.js"></script>':'<p>Official company</p>'}
 }}))
 assert.equal(error.failureKind,'coverage_gap');assert.deepEqual(reads,[provider.companyCareerPage,script,'https://employer.test/'])
 const check=error.discoveryEvidence.checks.find(check=>check.requestedURL===script)
 assert.ok(check);assert.equal(check.httpStatus,null);assert.equal(check.error.name,'TimeoutError')
})

for(const [label,kind,status]of[['denial','blocked_or_access_denied',403],['rate limit','blocked_or_access_denied',429],['hard contract','parser_or_contract_error',null]])test('an explicitly typed terminal '+label+' remains the original failure without any fallback read',async()=>{
 const cause=Object.freeze(Object.assign(new Error('Native terminal '+label),{failureKind:kind,httpStatus:status,abortRetries:true}));let reads=0
 const error=await rejection(()=>run({fetchPage:async()=>{reads++;throw cause}}))
 assert.equal(error,cause);assert.equal(reads,1)
})

for(const [label,kind,status]of[['denial','blocked_or_access_denied',403],['rate limit','blocked_or_access_denied',429],['hard contract','parser_or_contract_error',null]])test('a wrapped terminal '+label+' stops discovery and preserves the full original immutable chain',async()=>{
 const native=Object.freeze(Object.assign(new Error('Native terminal '+label),{failureKind:kind,status,abortRetries:true}))
 const outer=Object.freeze(new TypeError('fetch failed',{cause:native})),descriptors=Object.getOwnPropertyDescriptors(outer);let reads=0
 const error=await rejection(()=>run({fetchPage:async()=>{reads++;throw outer}}))
 assert.equal(error.failureKind,kind);assert.equal(error.abortRetries,true);assert.equal(reads,1)
 assert.equal(error.cause,outer);assert.equal(error.cause.cause,native)
 assert.equal(error.httpStatus,status);assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
 assert.deepEqual(Object.getOwnPropertyDescriptors(outer),descriptors)
})

test('a wrapped terminal denial suppresses the actual four-attempt retry boundary',async t=>{
 t.mock.method(console,'warn',()=>{})
 const native=Object.freeze(Object.assign(new Error('Denied native read'),{failureKind:'blocked_or_access_denied',httpStatus:403,abortRetries:true}))
 const outer=Object.freeze(new TypeError('fetch failed',{cause:native}));let reads=0
 const error=await rejection(()=>withRetry(()=>run({fetchPage:async()=>{reads++;throw outer}}),{attempts:4,baseDelayMs:0,label:'official-transport-control'}))
 assert.equal(reads,1);assert.equal(getRetryMetadata(error).attemptsUsed,1)
 assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.httpStatus,403)
 assert.equal(error.cause.cause,outer);assert.equal(error.cause.cause.cause,native)
})

test('a parser exception without positive network evidence cannot become an all-network outage',async()=>{
 const error=await rejection(()=>run({fetchPage:async()=>{throw new SyntaxError('Invalid source document')}}))
 assert.equal(error.failureKind,'coverage_gap');assert.equal(error.upstreamOutage,false)
})

test('an explicit nested nonnetwork diagnosis overrides an outer fetch-error label',async()=>{
 const native=Object.freeze(Object.assign(new Error('Native document model changed'),{failureKind:'parser_or_contract_error'}))
 const cause=Object.freeze(new TypeError('fetch failed',{cause:native}))
 const error=await rejection(()=>run({fetchPage:async()=>{throw cause}}))
 assert.equal(error.failureKind,'coverage_gap');assert.equal(error.upstreamOutage,false)
 assert.equal(error.discoveryEvidence.checks[0].error.failureKind,'parser_or_contract_error')
})

test('a typed terminal denial during a declared script read preserves its original object and stops the remaining discovery queue',async()=>{
 const cause=Object.freeze(Object.assign(new Error('Native declared-script denial'),{failureKind:'blocked_or_access_denied',httpStatus:403,abortRetries:true})),reads=[]
 const error=await rejection(()=>run({fetchPage:async url=>{
  reads.push(url)
  if(url.endsWith('.js'))throw cause
  return{status:200,url,html:'<script src="/careers-route.js"></script><script src="/other-careers.js"></script>'}
 }}))
 assert.equal(error,cause);assert.deepEqual(reads,[provider.companyCareerPage,'https://employer.test/careers-route.js'])
})

test('a wrapped terminal denial in a declared script stops remaining scripts and root fallbacks',async()=>{
 const native=Object.freeze(Object.assign(new Error('Native script denial'),{failureKind:'blocked_or_access_denied',httpStatus:403,abortRetries:true}))
 const cause=Object.freeze(new TypeError('fetch failed',{cause:native})),reads=[]
 const error=await rejection(()=>run({fetchPage:async url=>{
  reads.push(url);if(url.endsWith('.js'))throw cause
  return{status:200,url,html:'<script src="/careers-route.js"></script><script src="/other-careers.js"></script>'}
 }}))
 assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.httpStatus,403)
 assert.equal(error.cause,cause);assert.equal(error.cause.cause,native)
 assert.deepEqual(reads,[provider.companyCareerPage,'https://employer.test/careers-route.js'])
})

test('opaque caller cancellation has priority before and immediately after an otherwise successful official read',async()=>{
 for(const reason of[Object.freeze({cancel:'official-read'}),null,0,undefined]){
  const before=new AbortController();before.abort(reason)
  assert.equal(await rejection(()=>run({signal:before.signal,fetchPage:async()=>assert.fail('No cancelled request')})),before.signal.reason)
  const during=new AbortController()
  const error=await rejection(()=>discoverOfficialAtsBoards(provider,{signal:during.signal,fetchPage:async url=>{
   during.abort(reason);return{status:200,url,html:'<a href="https://jobs.ashbyhq.com/actual-current-board">Open roles</a>'}
  }}))
  assert.equal(error,during.signal.reason)
 }
})

test('caller cancellation while a declared script resolves preserves its exact reason and admits no other request',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'declared-script'}),reads=[]
 const error=await rejection(()=>run({signal:controller.signal,fetchPage:async url=>{
  reads.push(url)
  if(url.endsWith('.js')){controller.abort(reason);return{status:200,url,html:'const example="https://jobs.ashbyhq.com/other-board"'}}
  return{status:200,url,html:'<script src="/careers-route.js"></script>'}
 }}))
 assert.equal(error,reason);assert.equal(reads.length,2)
})
