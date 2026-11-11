import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createBrigadeGroupScraper,qualifyBrigadeDescriptions} from './script.js'
import {hasSourceDescription,getSourceDescription} from '../../src/utils/jobSourceContent.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence,readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(readFileSync(new URL('./fixtures/retained20261111.json',import.meta.url),'utf8'))
const job=fixture.jobs.find(job=>job.jobId==='a65c0ceb8c45e7')
const corporate=fixture.corporateResponse
const observedAt='2026-11-11T00:00:00.000Z'
// The job is retained authentic registered output. This explicit projection is
// a controlled existing-adapter input, never represented as captured native JSON.
const run=description=>createBrigadeGroupScraper({now:()=>observedAt}).run({
 fetchText:async()=>Buffer.from(corporate.bodyBase64,'base64').toString('utf8'),
 fetchListingPage:async()=>({job_counts:1,data:[{id:job.jobId,title:job.title,department_name:job.department,locations:job.location,country:job.country,emp_type_name:job.employmentType,experience:job.experienceRequired,jd:description}]}),
 fetchJobDetail:()=>assert.fail('placeholder fix must not add a native detail request'),
})
test('retained genuine test-only content is currently nonempty to shared health checks',()=>{
 assert.equal(job.jobDescription,'<p>test</p>');assert.equal(hasSourceDescription(job),true);assert.equal(extractionDetailHealth([job]).complete,true);assert.equal(fixture.provenance.currentNativeFieldConfirmed,false)
})
test('Brigade wrapper holds the retained whole placeholder as missing criteria while retaining the vacancy',async()=>{
 const jobs=await run(job.jobDescription);assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,job.jobId);assert.equal(jobs[0].title,job.title);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceNativeDescriptionPlaceholder,'<p>test</p>');assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceDetailFailureKind,'missing-content');assert.equal(hasSourceDescription(jobs[0]),false);assert.equal(extractionDetailHealth(jobs).missingDescriptions,1);assert.equal(readInventoryEvidence(jobs).reportedTotal,1)
})
for(const description of ['test',' TEST ','<p>test.</p>','<div>&nbsp;Test!&nbsp;</div>','<p>t&#101;st</p>','<!-- native comment --><p>test</p>','<p>test</p><script>ignored sample text</script>'])test('only whole placeholder content is held verbatim at the wrapper boundary: '+description,()=>{
 const jobs=qualifyBrigadeDescriptions([{...job,jobDescription:description}],observedAt);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceNativeDescriptionPlaceholder,description);assert.equal(jobs[0].sourceDetailComplete,false)
})
for(const description of ['<p>Develop and test automation for purchase and store reconciliation.</p>','<p>Test procurement workflows and report discrepancies to the project manager.</p>','<p>Lead testing of enterprise inventory integrations.</p>','<p>Maintain test-driven development standards for procurement services.</p>','<p>Coordinate testing, training, and implementation of purchase controls.</p>'])test('meaningful native duties containing test remain verbatim: '+description,async()=>{
 const jobs=await run(description);assert.equal(jobs[0].jobDescription,description);assert.equal(jobs[0].sourceNativeDescriptionPlaceholder,undefined);assert.equal(hasSourceDescription(jobs[0]),true)
})
test('full retained39-row cohort changes only the exact placeholder health and observation time',()=>{
 const jobs=structuredClone(fixture.jobs),original=structuredClone(jobs),result=qualifyBrigadeDescriptions(jobs,observedAt)
 assert.equal(result,jobs);assert.equal(result.length,39);assert.equal(extractionDetailHealth(original).missingDescriptions,8);assert.equal(extractionDetailHealth(result).missingDescriptions,9)
 for(let index=0;index<original.length;index++){
  const before=original[index],after=result[index];assert.equal(after.jobId,before.jobId)
  if(before.jobId===job.jobId){const identity={...before};delete identity.jobDescription;for(const[key,value]of Object.entries(identity))assert.deepEqual(after[key],key==='scrapedAt'?observedAt:value);assert.equal(after.jobDescription,null);assert.equal(after.sourceNativeDescriptionPlaceholder,before.jobDescription)}
  else assert.deepEqual(after,{...before,scrapedAt:observedAt})
 }
 assert.equal(fixture.jobs.find(row=>row.jobId===job.jobId).jobDescription,'<p>test</p>')
})
test('inventory, source observations, arbitrary audit descriptors and WeakMap bindings retain the exact array',()=>{
 const jobs=structuredClone(fixture.jobs),audit={originalClock:fixture.provenance.originalCompletedAt,observedNativeCount:39},tag=Symbol('native-audit'),weak=new WeakMap([[jobs,audit]])
 attachInventoryEvidence(jobs,fixture.inventoryEvidence);attachSourceObservationEvidence(jobs,{source:'brigadegroup',recordKind:'vacancy-rows',observedRecordCount:39,observedVacancyCount:39,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 let reads=0;Object.defineProperty(jobs,'sourceAudit',{value:audit});Object.defineProperty(jobs,tag,{value:audit});Object.defineProperty(jobs,'unreadAudit',{get(){reads++;throw Error('Audit accessor must not run')}})
 const keys=Reflect.ownKeys(jobs),metadata=keys.filter(key=>typeof key==='symbol'||!/^\d+$/.test(key)).map(key=>[key,Object.getOwnPropertyDescriptor(jobs,key)]),inventory=readInventoryEvidence(jobs),observations=readSourceObservationEvidence(jobs,'brigadegroup')
 const result=qualifyBrigadeDescriptions(jobs,observedAt);assert.equal(result,jobs);assert.deepEqual(Reflect.ownKeys(result),keys);for(const[key,descriptor]of metadata)assert.deepEqual(Object.getOwnPropertyDescriptor(result,key),descriptor)
 assert.equal(reads,0);assert.equal(weak.get(result),audit);assert.equal(result.sourceAudit,audit);assert.equal(result[tag],audit);assert.equal(readInventoryEvidence(result),inventory);assert.deepEqual(readSourceObservationEvidence(result,'brigadegroup'),observations)
})
test('repeat qualification preserves raw placeholder and existing native role observations',()=>{
 const jobs=[{...job,sourceNativeListingDescription:'original listing value',sourceNativeDetailDescription:'original detail value'}]
 qualifyBrigadeDescriptions(jobs,observedAt);qualifyBrigadeDescriptions(jobs,observedAt);assert.equal(jobs[0].sourceNativeDescriptionPlaceholder,'<p>test</p>');assert.equal(jobs[0].sourceNativeListingDescription,'original listing value');assert.equal(jobs[0].sourceNativeDetailDescription,'original detail value');assert.equal(jobs[0].jobDescription,null)
})
test('a preexisting upstream detail failure remains explicit alongside the placeholder hold',()=>{
 const jobs=[{...job,sourceDetailComplete:false,sourceDetailFailureKind:'upstream'}];qualifyBrigadeDescriptions(jobs,observedAt);assert.equal(jobs[0].sourceDetailFailureKind,'upstream');assert.equal(jobs[0].sourceNativeDescriptionPlaceholder,'<p>test</p>');assert.equal(jobs[0].jobDescription,null)
})
for(const field of ['sourceDescription','sourceDescriptionHTML','description'])test('inherited '+field+' cannot restore the same whole placeholder in health or source input',()=>{
 const raw='<p> TEST </p>',jobs=[{...job,[field]:raw}];qualifyBrigadeDescriptions(jobs,observedAt)
 assert.equal(jobs[0][field],null);assert.equal(getSourceDescription(jobs[0]),'');assert.equal(hasSourceDescription(jobs[0]),false);assert.equal(extractionDetailHealth(jobs).missingDescriptions,1);assert.equal(extractionDetailHealth(jobs).complete,false);assert.equal(jobs[0].sourceNativeDescriptionPlaceholderFields[field],raw);assert.equal(jobs[0].sourceNativeDescriptionPlaceholderFields.jobDescription,job.jobDescription)
})
test('all inherited whole-placeholder aliases retain raw evidence and cannot restore usable content together',()=>{
 const jobs=[{...job,sourceDescription:'test',sourceDescriptionHTML:'<p>test.</p>',description:'TEST!'}];qualifyBrigadeDescriptions(jobs,observedAt);assert.equal(getSourceDescription(jobs[0]),'');assert.equal(jobs[0].sourceDescriptionHTML,null);assert.equal(jobs[0].description,null);assert.equal(extractionDetailHealth(jobs).complete,false);assert.deepEqual(jobs[0].sourceNativeDescriptionPlaceholderFields,{sourceDescription:'test',sourceDescriptionHTML:'<p>test.</p>',jobDescription:'<p>test</p>',description:'TEST!'})
})
for(const field of ['sourceDescription','sourceDescriptionHTML','description'])test('meaningful inherited '+field+' duties containing test remain verbatim',()=>{
 const meaningful='<p>Develop and test enterprise systems for purchase operations.</p>',jobs=[{...job,[field]:meaningful}];qualifyBrigadeDescriptions(jobs,observedAt);assert.equal(jobs[0][field],meaningful)
 if(field==='sourceDescription'){assert.equal(hasSourceDescription(jobs[0]),true);assert.equal(extractionDetailHealth(jobs).complete,true)}
})
