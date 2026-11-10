import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {HOME,CAREERS,parseListing,parseRoleHTML,parseMarkdown,parseNativeMarkdown,roleCode,sha} from './parser.js'
import {collect,runNative} from './native.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden,isFreshCompleteInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {jobIdentityHashes} from '../../scraper-support/utils/jobYield.js'
import {readInventoryDelegationEvidence} from '../../scraper-support/utils/inventoryDelegationEvidence.js'

const gzip=fs.readFileSync(new URL('./test-data/native-observations-20261109.json.gz',import.meta.url))
assert.equal(sha(gzip),'b0e2d269177e20bb395ebf925f3727f411d9ba67f9103e51249e9d32ecc6a233')
const capture=JSON.parse(gunzipSync(gzip)),packets=new Map()
for(const p of capture.packets){
 if(p.rawBodyBase64!==null)assert.equal(sha(Buffer.from(p.rawBodyBase64,'base64')),p.bodySHA256)
 const queue=packets.get(p.requestedURL)??[];queue.push(p);packets.set(p.requestedURL,queue)
}
const raw=url=>Buffer.from(packets.get(url)[0].rawBodyBase64,'base64').toString('utf8')
const listing=parseListing(raw(HOME),raw(CAREERS)),account='071d270e-7d0d-4d5e-8d48-1187c51ab6f6'
const board='https://apply.workable.com/imtf/jobs.md',llms='https://apply.workable.com/imtf/llms.txt'
const html=code=>'https://apply.workable.com/imtf/j/'+code
const md=code=>'https://apply.workable.com/imtf/jobs/view/'+code+'.md'
const own=code=>'https://apply.workable.com/api/v2/accounts/imtf/jobs/'+code
const stale='https://apply.workable.com/imtf/j/E90526054F/'
const nativeOnly='A2C3F4DE30',apprentice='F92BA9812C'
const disputedFirst=s=>{const row=listing.candidates.find(c=>c.shortcode===apprentice);return s.replace(row.rawHTML,'').replace(listing.candidates[0].rawHTML,row.rawHTML+listing.candidates[0].rawHTML)}
const replay=(changes={},calls=[])=>{
 const counts=new Map()
 return async(url,init)=>{
  calls.push({url,init});const n=counts.get(url)??0;counts.set(url,n+1)
  const queue=packets.get(url),p=queue?.[Math.min(n,queue.length-1)]
  if(!p)throw Object.assign(Error('Unretained original public response'),{code:'FIXTURE_UNRETAINED'})
  const base=p.rawBodyBase64===null?null:Buffer.from(p.rawBodyBase64,'base64')
  const response={...p,url:p.url,body:base,provenance:{fixture:'native-observations-20261109',originalBodySHA256:p.bodySHA256}}
  if(changes[url]){
   const value=changes[url](base?.toString('utf8')??'',n+1,response)
   if(value instanceof Error)throw value
   if(value&&typeof value==='object'&&!Buffer.isBuffer(value))return {...response,...value,provenance:{...response.provenance,derivedForTest:true}}
   response.body=Buffer.from(value);response.receivedBodyBytes=response.body.length;response.provenance.derivedForTest=true
  }
  return response
 }
}
const provider=()=>getScraperCatalog().find(row=>row.source==='imtf')
const registered=()=>createCatalogScraper(provider())
const compactError=e=>({code:e?.code??null,message:e?.message??null})
const result=async changes=>{
 const calls=[]
 try{return {jobs:await registered().run({transport:replay(changes,calls)}),calls}}
 catch(error){return {error:compactError(error),evidence:error.nativeEvidence,calls}}
}
// Evaluate only the actual runner's exported pure functions. Importing runner.js
// loads dotenv and persistence modules; this check performs neither operation.
const runner=fs.readFileSync(new URL('../../scraper-support/runner.js',import.meta.url),'utf8')
const expression=(name,next)=>runner.slice(runner.indexOf('export const '+name),runner.indexOf(next,runner.indexOf('export const '+name))).replace(/^export /,'')
const resolveZeroJobOutcome=new Function('readInventoryEvidence','isFreshCompleteInventoryEvidence','isVerifiedEmptyEvidence',expression('resolveZeroJobOutcome','export const getZeroJobEvidence')+';return resolveZeroJobOutcome')(readInventoryEvidence,isFreshCompleteInventoryEvidence,isVerifiedEmptyEvidence)
const buildScraperAttemptDiagnostics=new Function('analyzePublishableJobs','extractionRawJobMetrics','readInventoryEvidence','jobIdentityHashes','extractionDetailHealth','readInventoryDelegationEvidence','readSourceObservationEvidence',expression('buildScraperAttemptDiagnostics','const resolveExecutionPath')+';return buildScraperAttemptDiagnostics')(analyzePublishableJobs,extractionRawJobMetrics,readInventoryEvidence,jobIdentityHashes,extractionDetailHealth,readInventoryDelegationEvidence,readSourceObservationEvidence)

test('fresh original native cohort is retained through the actual factory without qualifying the corporate gaps or India absence',async()=>{
 const {jobs,error,calls}=await result()
 assert.equal(error,undefined,JSON.stringify(error))
 assert.equal(jobs.length,0)
 assert.deepEqual(readSourceObservationEvidence(jobs,'imtf'),{source:'imtf',recordKind:'vacancy-rows',observedRecordCount:9,observedVacancyCount:9,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 const r=jobs.nativeCollectionEvidence
 assert.equal(r.nativeObservations.length,9);assert.equal(r.primaryFacts.length,6)
 assert.equal(r.failures.length,0);assert.equal(r.status,'retained-native-partial-observations')
 assert.equal(r.sourceScopeComplete,false);assert.equal(r.wholeCompanyScope,false);assert.equal(r.cleanupAllowed,false);assert.equal(r.verifiedZeroInventory,false)
 assert.equal(r.companyGlobalTotal,null);assert.equal(r.companyIndiaTotal,null)
 assert.equal(r.nativeObservationInventory.opening.length,9);assert.equal(r.nativeObservationInventory.closingConsistent,true)
 assert.equal(r.advertisedIdentityUnion.length,10)
 assert.deepEqual(r.unavailableCorporateReferences.map(ref=>({shortcode:ref.shortcode,status:ref.status,closureVerified:ref.closureVerified})),[{shortcode:'E90526054F',status:'unavailable',closureVerified:false}])
 const f=r.nativeObservations.find(row=>row.nativePublicURLShortcode===apprentice)
 assert.equal(f.nativeNumericJobId,'4729261');assert.equal(f.nativeAccountId,account)
 assert.equal(f.title,'Lehrstelle Kaufleute EFZ / Employé·e de commerce CFC (Profil E/M)')
 assert.equal(f.employmentRaw,'Temporary');assert.equal(f.listing.employmentRaw,'Full time')
 assert.equal(f.listing.title,'Commercial Apprentice (Fed. VET Diploma – EFZ/CFC)')
 assert.equal(f.membership,'corporate-and-native');assert.equal(f.qualification,'quarantined-corporate-alignment')
 assert.ok(f.corporateAlignmentGaps.some(g=>g.field==='employment'));assert.ok(f.corporateAlignmentGaps.some(g=>g.field==='title'))
 assert.equal(f.nativeOwnJSONSHA256,sha(raw(own(apprentice))))
 const only=r.nativeObservations.find(row=>row.nativePublicURLShortcode===nativeOnly)
 assert.equal(only.country,'Morocco');assert.equal(only.listing,null);assert.equal(only.membership,'native-only')
 for(const observation of r.nativeObservations){
  assert.equal(observation.eligibleForPublication,false);assert.equal(observation.publicEligibility,null);assert.equal(observation.applicationVisited,false)
  assert.equal(observation.closingConsistent,true);assert.ok(observation.nativeFullMarkdown.length>1000);assert.ok(observation.rawNativeOwnJSON.length>1000)
  assert.equal(calls.filter(c=>roleCode(c.url)===observation.nativePublicURLShortcode).length,2,observation.canonicalURL)
  for(const url of [observation.markdownURL,own(observation.nativePublicURLShortcode)])assert.equal(calls.filter(c=>c.url===url).length,2,url)
 }
 assert.equal(calls.length,62);assert.equal(r.requestCount,62)
 assert.equal(calls.filter(c=>c.url===stale).length,1)
 assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'&&!c.url.endsWith('/apply')))
 assert.ok(calls.some(c=>c.init.headers['Cache-Control']==='no-cache'))
 assert.equal(r.retainedResponses.length,62)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const analysis=analyzePublishableJobs(jobs),diagnostics=buildScraperAttemptDiagnostics(jobs,analysis,provider())
 assert.equal(diagnostics.jobs,0);assert.equal(diagnostics.eligibleJobs,0);assert.equal(diagnostics.sourceObservations.observedVacancyCount,9)
 assert.equal(resolveZeroJobOutcome(registered(),jobs,analysis.indiaJobs),'coverage-gap')
 assert.deepEqual(inventoryCleanupOptions({...diagnostics,zeroJobEvidence:'coverage-gap'}),{replaceExisting:false})
})

test('strict corporate Markdown entry point still rejects original substantive apprenticeship title and employment disagreements',()=>{
 const candidate=listing.candidates.find(c=>c.shortcode===apprentice),identity=parseRoleHTML(raw(candidate.url),candidate)
 assert.throws(()=>parseMarkdown(raw(identity.markdownURL),candidate,identity),/title\/employment\/header mismatch/)
})

test('the pure native Markdown contract rejects a macroregion without relying on later own JSON validation',()=>{
 const candidate=listing.candidates.find(c=>c.shortcode===apprentice),identity=parseRoleHTML(raw(candidate.url),candidate)
 assert.throws(()=>parseNativeMarkdown(raw(identity.markdownURL).replace('Givisiez, Switzerland','Givisiez, European Union'),identity),/Unrecognized explicit native country/)
})

test('DERIVED first-row corporate disagreement can use its independently validated native identity as the observation anchor',async()=>{
 const {jobs,error}=await result({[CAREERS]:disputedFirst})
 assert.equal(error,undefined,JSON.stringify(error));assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeObservations.length,9)
 assert.equal(jobs.nativeCollectionEvidence.primaryFacts.length,0)
 assert.equal(jobs.nativeCollectionEvidence.recoveryTrigger.candidate.shortcode,apprentice)
 assert.equal(jobs.nativeCollectionEvidence.verifiedZeroInventory,false)
})

test('DERIVED corporate title and employment repaired later still recover native observations after a recorded unavailable corporate reference',async()=>{
 const candidate=listing.candidates.find(c=>c.shortcode===apprentice)
 const changed=candidate.rawHTML.replaceAll(candidate.title,'Lehrstelle Kaufleute EFZ / Employé·e de commerce CFC (Profil E/M)').replace('Full time','Temporary').replace('Finances and Administration','Finance and Administration')
 const {jobs,error,calls}=await result({[CAREERS]:s=>s.replace(candidate.rawHTML,changed)})
 assert.equal(error,undefined,JSON.stringify(error));assert.equal(jobs.nativeCollectionEvidence.nativeObservations.length,9)
 assert.equal(jobs.nativeCollectionEvidence.recoveryTrigger.code,'IMTF_ROLE_NOT_FOUND');assert.equal(calls.length,62)
 assert.equal(calls.filter(c=>c.url===stale).length,1)
 assert.equal(jobs.nativeCollectionEvidence.unavailableCorporateReferences[0].closureVerified,false)
})

const modifyJSON=change=>s=>{const n=JSON.parse(s);change(n);return JSON.stringify(n)}
for(const [label,url,change]of[
 ['HTML numeric',html(nativeOnly),s=>s.replace(/(<meta name="job" content=")\d+/,(_,prefix)=>prefix+'999999')],
 ['HTML account',html(nativeOnly),s=>s.replace('name="account" content="'+account+'"','name="account" content="071d270e-7d0d-4d5e-8d48-1187c51ab6f0"')],
 ['HTML canonical',html(nativeOnly),s=>s.replace('rel="canonical" href="'+html(nativeOnly)+'"','rel="canonical" href="'+html('40AEB306B4')+'"')],
 ['HTML OG title',html(nativeOnly),s=>s.replace(/(property="og:title" content=")[^"]+/,(_,p)=>p+'Different role - IMTF')],
 ['HTML missing OG title',html(nativeOnly),s=>s.replace(/<meta property="og:title"[^>]+>/,'')],
 ['HTML duplicate OG title',html(nativeOnly),s=>s.replace(/(<meta property="og:title"[^>]+>)/,'$1$1')],
 ['Markdown title',md(nativeOnly),s=>s.replace('# Business Consultant - Compliance & RegTech','# Different Role')],
 ['Markdown employment',md(nativeOnly),s=>s.replace('Full-time','Temporary')],
 ['Markdown country',md(nativeOnly),s=>s.replace('Casablanca, Morocco','Casablanca, India')],
 ['own numeric',own(nativeOnly),modifyJSON(n=>{n.id=999999})],
 ['own account',own(nativeOnly),modifyJSON(n=>{n.accountUid='different-account'})],
 ['own shortcode',own(nativeOnly),modifyJSON(n=>{n.shortcode='40AEB306B4'})],
 ['own title',own(nativeOnly),modifyJSON(n=>{n.title='Different role'})],
 ['own employment',own(nativeOnly),modifyJSON(n=>{n.type='temporary'})],
 ['own country',own(nativeOnly),modifyJSON(n=>{n.locations[0].countryCode='IN'})],
 ['own secondary macroregion',own(nativeOnly),modifyJSON(n=>{n.locations.push({city:null,country:'European Union',countryCode:'EU',hidden:false})})],
 ['own unknown secondary country',own(nativeOnly),modifyJSON(n=>{n.locations.push({city:null,country:null,countryCode:'ZZ',hidden:false})})],
 ['own hidden',own(nativeOnly),modifyJSON(n=>{n.locations[0].hidden=true})],
 ['own primary hidden',own(nativeOnly),modifyJSON(n=>{n.location.hidden=true})],
 ['own primary unknown location schema',own(nativeOnly),modifyJSON(n=>{n.location.alternativeCountry='India'})],
 ['own all-location unknown schema',own(nativeOnly),modifyJSON(n=>{n.locations[0].alternativeCountry='India'})],
 ['own nonpublic',own(nativeOnly),modifyJSON(n=>{n.isInternal=true})],
 ['own unknown schema',own(nativeOnly),modifyJSON(n=>{n.alternativeWorksites=['India']})],
 ['own criteria conflict',own(nativeOnly),modifyJSON(n=>{n.requirements+='<p>Uncorroborated material qualification.</p>'})],
 ['own incomplete criteria',own(nativeOnly),modifyJSON(n=>{n.description='<p>Short.</p>'})],
 ['own unknown employment',own(nativeOnly),modifyJSON(n=>{n.type='unreviewed'})],
 ['own unpublished',own(nativeOnly),modifyJSON(n=>{n.state='draft'})],
 ['own unapproved',own(nativeOnly),modifyJSON(n=>{n.approvalStatus='pending'})],
 ['own malformed JSON',own(nativeOnly),s=>s.slice(0,-10)],
 ['incomplete native entity',own(nativeOnly),(s,n,p)=>({body:Buffer.from(s),bodyComplete:false})],
])test('DERIVED real native '+label+' failure remains hard and stops new native admission',async()=>{
 const changed=change(raw(url),1,{})
 assert.notEqual(typeof changed==='string'?changed:JSON.stringify(changed),raw(url),'Test mutation must change the retained source')
 const {error,evidence,calls}=await result({[url]:change})
 assert.equal(error?.code,'IMTF_NATIVE_INCOMPLETE',JSON.stringify(error))
 assert.ok(evidence.nativeObservations?.length>0,'Previously validated observations remain reviewable')
 assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.cleanupAllowed,false);assert.equal(evidence.verifiedZeroInventory,false)
 assert.equal(evidence.failures[0].stage,'native-observations')
 assert.equal(calls.some(c=>c.url===own('7752672F96')),false,'No role after the rejected native-only row is admitted')
})

for(const [label,url,change]of[
 ['wrong tenant',html(apprentice),s=>s.replace('name="subdomain" content="imtf"','name="subdomain" content="other"')],
 ['wrong account',html(apprentice),s=>s.replace('name="account" content="'+account+'"','name="account" content="071d270e-7d0d-4d5e-8d48-1187c51ab6f0"')],
 ['wrong canonical',html(apprentice),s=>s.replace('rel="canonical" href="'+html(apprentice)+'"','rel="canonical" href="'+html(nativeOnly)+'"')],
 ['country contradiction',md(apprentice),s=>s.replace('Givisiez, Switzerland','Givisiez, India')],
 ['unknown native employment',md(apprentice),s=>s.replace('Temporary','Unreviewed')],
 ['own employment contradiction',own(apprentice),modifyJSON(n=>{n.type='full'})],
 ['own hidden',own(apprentice),modifyJSON(n=>{n.locations[0].hidden=true})],
 ['own schema',own(apprentice),modifyJSON(n=>{n.alternativeWorksites=['India']})],
])test('DERIVED first-row disputed role still rejects '+label,async()=>{
 const {error,evidence}=await result({[CAREERS]:disputedFirst,[url]:change})
 assert.equal(error?.code,'IMTF_NATIVE_INCOMPLETE',JSON.stringify(error))
 assert.equal(evidence.cleanupAllowed,false);assert.equal(evidence.verifiedZeroInventory,false)
})

for(const [label,url,change]of[
 ['closing native HTML identity',html(nativeOnly),s=>s.replace(/(<meta name="job" content=")\d+/,(_,prefix)=>prefix+'999999')],
 ['closing native Markdown criteria',md(nativeOnly),s=>s.replace('## Requirements\n','## Requirements\n\nDifferent material requirement.\n')],
 ['closing own criteria',own(nativeOnly),modifyJSON(n=>{n.benefits+='<p>A different benefit.</p>'})],
 ['closing board membership',board,s=>s.replace('Business Consultant - Compliance & RegTech','Different role')],
 ['closing corporate employment',CAREERS,s=>s.replace('Full time','Temporary')],
])test('DERIVED '+label+' is reread without cache and remains hard',async()=>{
 const {error,evidence,calls}=await result({[url]:(s,n)=>n===1?s:change(s)})
 assert.equal(error?.code,'IMTF_NATIVE_INCOMPLETE',JSON.stringify(error));assert.equal(evidence.cleanupAllowed,false)
 assert.ok(calls.filter(c=>c.url===url).length>=2)
})

test('a spoofed role-unavailable error without an actual recognized canonical redirect cannot start observations',async()=>{
 const calls=[],reason=Object.assign(Error('Spoofed unavailable transport'),{code:'IMTF_ROLE_NOT_FOUND'})
 const r=await collect({transport:replay({[listing.candidates[1].url]:()=>reason},calls)})
 assert.equal(r.failures.length,1);assert.equal(r.notFoundCareersShortcodes.length,0)
 assert.equal(calls.some(c=>c.url===llms),false);assert.equal(r.facts.length,1)
})

test('DERIVED semantic decimal and language punctuation conflicts cannot count as reconciled full criteria',async()=>{
 const {error,evidence}=await result({
  [md(nativeOnly)]:s=>s.replace('## Benefits','Required threshold is 30% with C# experience.\n\n## Benefits'),
  [own(nativeOnly)]:modifyJSON(n=>{n.requirements+='<p>Required threshold is 3.0% with C++ experience.</p>'}),
 })
 assert.equal(error?.code,'IMTF_NATIVE_INCOMPLETE',JSON.stringify(error))
 assert.equal(evidence.failures[0].stage,'native-observations');assert.equal(evidence.nativeObservations.length,4)
})

for(const [label,markdownValue,jsonValue]of[['decimal','30%','3.0%'],['language','C#','C++']])test('DERIVED semantic '+label+' punctuation alone is preserved by criteria reconciliation',async()=>{
 const {error,evidence}=await result({
  [md(nativeOnly)]:s=>s.replace('## Benefits','Required experience threshold is '+markdownValue+'.\n\n## Benefits'),
  [own(nativeOnly)]:modifyJSON(n=>{n.requirements+='<p>Required experience threshold is '+jsonValue+'.</p>'}),
 })
 assert.equal(error?.code,'IMTF_NATIVE_INCOMPLETE',JSON.stringify(error));assert.equal(evidence.nativeObservations.length,4)
})

test('observation recovery shares the request and page budgets and preserves opaque cancellation',async()=>{
 for(const caps of [{maxRequests:20},{maxPages:20}]){
  const calls=[];await assert.rejects(runNative({...caps,transport:replay({},calls)}),error=>error.code==='IMTF_NATIVE_INCOMPLETE'&&error.nativeEvidence.cleanupAllowed===false)
  assert.equal(calls.length,20)
 }
 const controller=new AbortController(),reason={opaque:'native-observation-caller'},io=replay(),calls=[]
 await assert.rejects(runNative({signal:controller.signal,transport:async(url,init)=>{calls.push(url);if(url===own(nativeOnly))controller.abort(reason);return io(url,init)}}),error=>error===reason)
 assert.equal(calls.at(-1),own(nativeOnly))
})

for(const [label,options,code]of[
 ['read',{readTimeoutMs:15},'IMTF_READ_TIMEOUT'],
 ['source',{sourceTimeoutMs:150},'IMTF_SOURCE_TIMEOUT'],
])test('signal-ignoring native observation acquisition remains bounded by the existing '+label+' deadline',async t=>{
 // This case isolates the timer interrupting a signal-ignoring transport.
 // Parsing the preceding captured pages must not consume its deliberately
 // tiny monotonic budget when other test files contend for the CPU.
 t.mock.method(performance,'now',()=>0)
 const io=replay(),calls=[]
 await assert.rejects(runNative({...options,transport:async(url,init)=>{calls.push(url);if(url===own(nativeOnly))return new Promise(()=>{});return io(url,init)}}),error=>{
  assert.equal(error.code,code);assert.equal(error.nativeEvidence.cleanupAllowed,false)
  assert.equal(error.nativeEvidence.nativeObservations.length,4);return true
 })
 assert.equal(calls.at(-1),own(nativeOnly))
})

test('an unrecognized redirect after the validated primary anchor cannot invoke the native board',async()=>{
 const calls=[],r=await collect({transport:replay({[listing.candidates[1].url]:(s,n,p)=>({...p,status:302,headers:{location:'/imtf/'}})},calls)})
 assert.equal(r.failures.length,1);assert.equal(r.failures[0].stage,'role-html')
 assert.equal(r.notFoundCareersShortcodes.length,0);assert.equal(calls.some(c=>c.url===llms),false)
})

for(const code of [apprentice,nativeOnly])test('DERIVED internally corroborated India '+(code===apprentice?'quarantined corporate':'native-only')+' observation remains unqualified and unpublished',async()=>{
 const city=code===apprentice?'Givisiez':'Casablanca',country=code===apprentice?'Switzerland':'Morocco'
 const location=s=>s.replaceAll(city+', '+country,'Bengaluru, India')
 const changes={[board]:s=>s.split('\n').map(line=>line.includes('/'+code+'.md')?location(line):line).join('\n'),[md(code)]:location,[own(code)]:modifyJSON(n=>{
  for(const l of [n.location,...n.locations])if(l){l.city='Bengaluru';l.country='India';l.countryCode='IN';l.region='Karnataka'}
 })}
 if(code===apprentice){const candidate=listing.candidates.find(c=>c.shortcode===code);changes[CAREERS]=s=>s.replace(candidate.rawHTML,candidate.rawHTML.replace(candidate.locationRaw,'Bengaluru, India'))}
 const {jobs,error}=await result(changes)
 assert.equal(error,undefined,JSON.stringify(error));assert.equal(jobs.length,0)
 const observation=jobs.nativeCollectionEvidence.nativeObservations.find(row=>row.nativePublicURLShortcode===code)
 assert.equal(observation.country,'India');assert.equal(observation.eligibleForPublication,false);assert.equal(observation.publicEligibility,null)
 assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,0);assert.equal(jobs.nativeCollectionEvidence.verifiedZeroInventory,false)
 assert.equal(resolveZeroJobOutcome(registered(),jobs,[]),'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
