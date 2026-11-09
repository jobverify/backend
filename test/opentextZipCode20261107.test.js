import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {extractActiveDescription} from '../scraper-support/utils/activeNativeHtml.js'
import {fileURLToPath} from 'node:url'
import {createPhenomScraper,extractPhAppDdo} from '../scraper-support/phenom/engine.js'
import * as defaultOpenText from '../scraper/opentext/script.js'
import {loadOpenTextZipFixture,replayOpenTextZip,assertOpenTextWholeOutput,assertIndependentOpenTextClosing,encodeOpenTextOutput} from './helpers/replayOpenTextZipCode20261107.js'

const scraperDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scraper/opentext')
const base={companyName:'OpenText',source:'opentext',baseUrl:'https://careers.opentext.com',searchPath:'/us/en/search-results',scraperDir,nativeIsoAlpha3CountryCodes:true}
const factory=(options={})=>createPhenomScraper({...base,...options})
const enabled=()=>factory({nativeCountryBeforeZipCode:true})
const fixture=loadOpenTextZipFixture()
const byID=(jobs,id)=>jobs.find(j=>j.jobId===id)
function assertControlledResult(r){
 assert.equal(r.error,undefined);assert.equal(r.requestCount,29);assert.equal(r.sourceClockCount,55);assert.equal(r.networkAttempts,0);assert.equal(r.databaseAttempts,0)
 assert.equal(r.jobs.length,27);assert.equal(r.jobs.filter(j=>j.sourceDetailComplete).length,26)
 assert.deepEqual(r.jobs.filter(j=>!j.sourceDetailComplete).map(j=>[j.jobId,j.sourceDetailFailureKind]),[['51919','identity-mismatch']])
 assertOpenTextWholeOutput(r.jobs)
}

test('genuine C2 packet preserves all30 responses, original2-detail output and a distinct controlled26-detail expectation',()=>{
 assert.equal(fixture.provenance.defaultRunHTTP,29);assert.equal(fixture.provenance.separateDiagnosticClosingHTTP,1)
 assert.equal(fixture.controlledExpectedQualification.liveCandidateCapture,false)
 assert.equal(fixture.originalJobs.filter(j=>j.sourceDetailComplete).length,2)
 assert.equal(fixture.controlledExpectedQualification.expectedCompleteDetails,26)
 assert.equal(fixture.controlledExpectedQualification.evidenceJobs,24);assert.equal(fixture.controlledExpectedQualification.evidenceOffices,25)
 assert.deepEqual(fixture.controlledExpectedQualification.omittedBusinessFields,[])
 const closing=assertIndependentOpenTextClosing();assert.equal(closing.rawJobModels,27);assert.equal(closing.entireResponseEqual,false)
})

test('source-opted OpenText reader qualifies only the fully bound51919 detail beyond the unchanged26-detail factory oracle',async()=>{
 const strict=await replayOpenTextZip({scraper:enabled()});assertControlledResult(strict)
 const r=await replayOpenTextZip({scraper:defaultOpenText})
 assert.equal(r.error,undefined);assert.equal(r.requestCount,29);assert.equal(r.sourceClockCount,55);assert.equal(r.networkAttempts,0);assert.equal(r.databaseAttempts,0)
 assert.equal(r.jobs.length,27);assert.equal(r.jobs.filter(j=>j.sourceDetailComplete).length,27)
 // Preserve the immutable full oracle for every unopted factory and all other
 // source roles. Only the explicitly source-opted, fully bound carrier changes.
 for(const job of r.jobs)if(job.jobId!=='51919')assert.deepEqual(encodeOpenTextOutput(job),encodeOpenTextOutput(byID(strict.jobs,job.jobId)))
 assert.deepEqual(Reflect.ownKeys(r.jobs),Reflect.ownKeys(strict.jobs))
 for(const key of Reflect.ownKeys(r.jobs))if(typeof key==='symbol')assert.deepEqual(Object.getOwnPropertyDescriptor(r.jobs,key),Object.getOwnPropertyDescriptor(strict.jobs,key))
 const packet=fixture.responses.find(row=>row.requestedURL.includes('/job/51919/'))
 const html=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),native=extractPhAppDdo(html).jobDetail.data.job,job=byID(r.jobs,'51919')
 assert.equal(native.jobId,'51919');assert.equal(native.reqId,'51919');assert.equal(native.jobSeqNo,'OPJOPEUS51919EXTERNALENUS')
 assert.equal(createHash('sha256').update(native.ml_Description).digest('hex'),'a531ca95020a52f50bf33217e80c29d20c504899ac91c184da3bd2e6a0cdf646')
 assert.equal(job.jobId,'51919');assert.equal(job.title,'Premium Support Specialist ( SMAX)');assert.equal(job.sourceUrl,packet.finalURL)
 assert.equal(job.jobDescription,extractActiveDescription(native.ml_Description))
 const {reviewedTitleBindingSha256,...identity}=job.sourceNativeDetailEvidence
 assert.match(reviewedTitleBindingSha256,/^[a-f\d]{64}$/)
 assert.deepEqual(identity,{reason:'full-native-model-exact-role-sequence-title-and-canonical-identity',
  nativeTitle:'Premium Support Specialist ( SMAX)',jsonLdTitle:'Premium Support Developer ( SMAX)',jobSeqNo:'OPJOPEUS51919EXTERNALENUS',canonical:packet.finalURL})
})

test('explicit zip profile validates26 genuine full details with exact requests, clocks and whole own-property/symbol output',async()=>{
 assertControlledResult(await replayOpenTextZip({scraper:enabled()}))
})

for(const [name,options]of [['omitted flag',{}],['explicit false',{nativeCountryBeforeZipCode:false}],['old postal flag alone',{nativeCountryBeforePostalCode:true}]]){
 test(`${name} preserves the entire original C2 two-detail result`,async()=>{
  const r=await replayOpenTextZip({scraper:factory(options)});assert.equal(r.error,undefined);assert.equal(r.jobs.filter(j=>j.sourceDetailComplete).length,2);assertOpenTextWholeOutput(r.jobs,{original:true})
 })
}

test('new zip evidence contains only original used-office objects and leaves both empty-zip Virtual roles unchanged',async()=>{
 const r=await replayOpenTextZip({scraper:enabled()});assertControlledResult(r)
 let offices=0,roles=0
 for(const job of r.jobs){
  const expected=fixture.nativeOfficesByID[job.jobId].filter(o=>o.zipCode.trim())
  const evidence=job.sourceNativeCountryEvidence?.nativeOfficePostalCodeEvidence
  if(job.sourceDetailComplete&&expected.length){roles++;offices+=expected.length;assert.deepEqual(evidence,{field:'zipCode',offices:expected})}
  else assert.equal(evidence,undefined)
  assert.equal(job.sourceNativeCountryEvidence.listingCountry,'IND')
 }
 assert.equal(roles,24);assert.equal(offices,25)
 const original=await replayOpenTextZip({scraper:factory({nativeCountryBeforeZipCode:false})})
 assert.equal(original.error,undefined);assertOpenTextWholeOutput(original.jobs,{original:true})
 for(const id of ['53602','53601'])assert.deepEqual(byID(r.jobs,id),byID(original.jobs,id))
})

test('matching controlled postalCode and zipCode remain usable while retaining both actual controlled fields in evidence',async()=>{
 const r=await replayOpenTextZip({scraper:enabled(),mutateJob:job=>{for(const o of job.multi_location)o.postalCode=o.zipCode}})
 assert.equal(r.error,undefined);assert.equal(r.jobs.filter(j=>j.sourceDetailComplete).length,26)
 const job=byID(r.jobs,'54296');assert.equal(job.sourceDetailComplete,true)
 const expected=structuredClone(fixture.nativeOfficesByID['54296']);for(const o of expected)o.postalCode=o.zipCode
 assert.deepEqual(job.sourceNativeCountryEvidence.nativeOfficePostalCodeEvidence,{field:'zipCode',offices:expected})
})

const officeMutations=[
 ['missing zipCode',o=>{delete o.zipCode}],
 ['empty zipCode',o=>{o.zipCode=''}],
 ['numeric zipCode',o=>{o.zipCode=560017}],
 ['mismatched zipCode',o=>{o.zipCode='999999'}],
 ['conflicting postalCode',o=>{o.postalCode='999999'}],
 ['foreign typed country',o=>{o.country='USA'}],
 ['missing typed country',o=>{delete o.country}],
 ['conflicting typed city',o=>{o.city='Hyderabad'}],
 ['conflicting typed state',o=>{o.state='Telangana'}],
 ['conflicting full office label',o=>{o.cityStateCountry='Bangalore, Karnataka, USA'}],
 ['conflicting short office label',o=>{o.location='Hyderabad, Karnataka, IND, 560017'}],
 ['conflicting cityCountry',o=>{o.cityCountry='Bangalore, USA'}],
 ['conflicting stateCountry',o=>{o.stateCountry='Karnataka, USA'}],
 ['foreign country disguised as postal suffix',o=>{o.zipCode='USA';o.location='Bangalore, Karnataka, IND, USA'}],
 ['conflicting cityStateZipCode',o=>{o.cityStateZipCode='Bangalore, Karnataka, USA, 560017'}],
 ['conflicting cityStatePostalCode',o=>{o.cityStatePostalCode='Bangalore, Karnataka, USA, 560017'}],
]
for(const [name,mutate]of officeMutations){
 test(`controlled genuine-office mutation is held: ${name}`,async()=>{
  const r=await replayOpenTextZip({scraper:enabled(),mutateJob:job=>{for(const o of job.multi_location)mutate(o)}})
  assert.equal(r.error,undefined);const job=byID(r.jobs,'54296');assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailFailureKind,'identity-mismatch');assert.equal(job.jobDescription,null)
  assert.equal(job.sourceNativeCountryEvidence.nativeOfficePostalCodeEvidence,undefined)
 })
}

for(const [name,mutate]of [
 ['native title',job=>{job.title='Controlled conflicting title'}],
 ['native sequence',job=>{job.jobSeqNo='OPJOPEUS99999EXTERNALENUS'}],
 ['native application URL',job=>{job.applyUrl+='?controlled=wrong'}],
]){
 test(`controlled ${name} conflict remains held under the zip profile`,async()=>{
  const r=await replayOpenTextZip({scraper:enabled(),mutateJob:mutate});assert.equal(r.error,undefined);const job=byID(r.jobs,'54296');assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailFailureKind,'identity-mismatch')
 })
}

test('controlled foreign canonical remains held under the zip profile',async()=>{
 const r=await replayOpenTextZip({scraper:enabled(),mutateHTML:html=>{
  const canonical=/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i
  assert.match(html,canonical)
  return html.replace(canonical,tag=>tag.replace(/\bhref\s*=\s*(["'])[^"']+\1/i,'href="https://unrelated.invalid/job/54296"'))
 }})
 assert.equal(r.error,undefined);assert.equal(byID(r.jobs,'54296').sourceDetailComplete,false);assert.equal(byID(r.jobs,'54296').sourceDetailFailureKind,'identity-mismatch')
})

test('controlled first403 retains its fatal original numeric cause with no invented empty result',async()=>{
 const r=await replayOpenTextZip({scraper:enabled(),denyFirst:true});assert.equal(r.jobs,undefined);assert.equal((r.error?.cause??r.error)?.status,403);assert.match(r.error?.message??'',/HTTP 403/);assert.equal(r.error?.abortRetries,true);assert.equal(r.requestCount,1)
})

for(const value of [null,0,1,'true',{},[]])test(`invalid zip-profile option rejects instead of enabling or silently ignoring it: ${JSON.stringify(value)}`,()=>{
 assert.throws(()=>factory({nativeCountryBeforeZipCode:value}),/nativeCountryBeforeZipCode|boolean/i)
})
