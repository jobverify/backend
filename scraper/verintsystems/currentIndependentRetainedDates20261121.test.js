// Exact root9 payloads/expectations adopted after the combined review repair handoff.
import test from 'node:test'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createVerintSystemsScraper} from './script.js'
import {currentNativeModel} from './currentModel20261120.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import metadata from './catalog.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const fixtureBytes=fs.readFileSync(new URL('./fixtures/current-native-20261121.json.gz',import.meta.url));assert.equal(sha(fixtureBytes),'5b8b25349e625d205b531c0a1e7c46eb6c4f3c3ac06366960a93a69065dcbda1')
const fixture=JSON.parse(gunzipSync(fixtureBytes)),HOME='https://www.verint.com/careers/',BOARD='https://jobs.ashbyhq.com/27cfd344-670f-4dcd-8b13-0e18005b0d65',FEED='https://api.ashbyhq.com/posting-api/job-board/verint'
const feedOriginal=JSON.parse(Buffer.from(fixture.responses.find(row=>row.requestedUrl===FEED&&row.phase==='opening').bodyBase64,'base64').toString('utf8')),target=feedOriginal.jobs.find(row=>row.address?.postalAddress?.addressCountry==='India');assert(target)
const TARGET=target.id,ROLE='https://jobs.ashbyhq.com/verint/'+TARGET,older='2026-08-01T03:04:05.067+05:30',earlierISO=new Date(older).toISOString(),future=new Date(Date.parse(fixture.capturedAt)+86400000).toISOString()
const exact=(text,old,value)=>{assert.equal(text.split(old).length,2,'one actual original carrier');return text.replace(old,()=>value)}
function native(text,edit){const packet=currentNativeModel(document(text)),model=structuredClone(packet.originalModel);edit(model);return exact(text,packet.originalAssignment,'window.__appData = '+JSON.stringify(model).replaceAll('<','\\u003c')+';')}
const closing=(url,edit)=>(q,current,phase)=>{if(url===current&&phase==='closing')q.text=edit(q.text)}
const board=edit=>closing(BOARD,text=>native(text,m=>edit(m.jobBoard.jobPostings.find(row=>row.id===TARGET),m)))
const full=edit=>closing(ROLE,text=>native(text,m=>edit(m.posting,m)))
const feed=edit=>closing(FEED,text=>{const m=JSON.parse(text);edit(m.jobs.find(row=>row.id===TARGET),m);return JSON.stringify(m)})
const saved={fetch:globalThis.fetch,httpGet:http.get,httpRequest:http.request,httpsGet:https.get,httpsRequest:https.request},fence=()=>{throw Object.assign(Error('Independent Verint replay blocked undeclared network'),{harnessFailure:true})}
let baseline
async function replay(change){
 let phase='opening',ownCount=0,harnessError;const calls=[],mutations=[]
 const fetchImpl=async(input,init)=>{try{const url=String(input?.url??input);if(url===HOME){phase=ownCount++===0?'opening':'closing';assert(ownCount<=2)}const original=fixture.responses.find(row=>row.requestedUrl===url&&row.phase===phase);assert(original,'only an actual same-phase response '+url);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert(!/\/application(?:[/?#]|$)/i.test(url));const q={...original,headers:{...original.headers},text:Buffer.from(original.bodyBase64,'base64').toString('utf8')},before=q.text;change?.(q,url,phase);if(before!==q.text)mutations.push({url,phase,originalSHA256:original.sha256,mutantSHA256:sha(Buffer.from(q.text))});calls.push({url,phase});return Object.defineProperties(new Response(Buffer.from(q.text),{status:q.status,headers:q.headers}),{url:{value:q.url},redirected:{value:q.redirected}})}catch(error){harnessError=error;throw error}}
 let jobs,error;try{jobs=await createVerintSystemsScraper().run({now:fixture.capturedAt,requestIntervalMs:0,fetchImpl})}catch(caught){error=caught}
 if(harnessError)throw Object.assign(harnessError,{harnessFailure:true});if(change)assert(mutations.length>0,'actual original carrier mutation reached')
 return{jobs,error,calls,mutations}
}
const cases=[
 ['genuine actual default factory retains three explicit India partials',null,'baseline'],
 ['coherent complete native state reserialization preserves publication',board(()=>{}),'baseline'],
 ['selected current board brief earlier datePosted is retained',board(row=>row.datePosted=older),'posted'],
 ['selected current board brief future validThrough is retained',board(row=>row.validThrough=future),'expiry'],
 ['selected current board brief nested publication date is retained',board(row=>row.publication={datePosted:older}),'posted'],
 ['current public feed nested publication date is retained',feed(row=>row.publication={datePosted:older}),'posted'],
 ['current public feed nested publication deadline is retained',feed(row=>row.publication={validThrough:future}),'expiry'],
 ['full current native role nested publication date is retained',full(row=>row.publication={datePosted:older}),'posted'],
 ['full current native role nested publication deadline is retained',full(row=>row.publication={validThrough:future}),'expiry']
]
for(const[name,change,want]of cases)test('Verint independent retained dates: '+name,async()=>{
 globalThis.fetch=fence;http.get=fence;http.request=fence;https.get=fence;https.request=fence
 let result
 try{
 result=await replay(change);assert.ifError(result.error);assert.equal(result.jobs.length,3);assert.equal(result.calls.length,12);const job=result.jobs.find(row=>row.jobId===TARGET);assert(job);const assessment=assessSoftFailureAcquisition(metadata,result.jobs);assert.equal(assessment.cleanupOptions.replaceExisting,false);assert.notEqual(assessment.zeroJobEvidence,'fetched-zero');for(const row of result.jobs){assert.equal(row.country,'India');assert.equal(row.nativeLegalEmployer,null);assert.equal(row.requisitionId,null);assert.equal(row.sourceDetailComplete,false);assert.equal(row.sourceScopeComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)}
   if(!baseline)baseline={postingDate:job.postingDate,closingDate:job.closingDate,eligibleJobs:assessment.eligibleJobs}
   if(want==='posted')assert.equal(job.postingDate,earlierISO,'all recognized same-role earlier publication facts must prevent renewal')
   if(want==='expiry'){const expected=baseline.closingDate&&Date.parse(baseline.closingDate)<Date.parse(future)?baseline.closingDate:future;assert.equal(job.closingDate,expected,'all recognized same-role deadlines must be retained')}
 }finally{globalThis.fetch=saved.fetch;http.get=saved.httpGet;http.request=saved.httpRequest;https.get=saved.httpsGet;https.request=saved.httpsRequest}
})
