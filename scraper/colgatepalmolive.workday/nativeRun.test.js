import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url))))
async function replay(change,options={}){
 const{packets}=fixture(),original=globalThis.fetch;let requestCount=0
 globalThis.fetch=async(url,init={})=>{
  const originalPacket=packets.find(p=>p.url===String(url)&&p.method===(init.method??'GET')&&(p.requestBody??null)===(init.body??null));assert.ok(originalPacket,'Uncaptured public native contract request '+url)
  const p=structuredClone(originalPacket);change?.(p,++requestCount)
  // Public nonce redaction is the sole fixture substitution; never a credential.
  const body=p.body.replaceAll('[REDACTED_PUBLIC_CSRF]','00000000-0000-4000-8000-000000000000'),headers={'Content-Type':p.url.includes('/services/')?'application/json':'text/html'}
  if(p.url==='https://jobs.colgate.com/search/')headers['Set-Cookie']='synthetic_public_session=fixture; Path=/; Secure'
  const r=new Response(body,{status:p.status,headers});Object.defineProperty(r,'url',{value:p.finalURL});return r
 }
 try{return await run({now:'2026-10-21T14:00:00.000Z',...options})}finally{globalThis.fetch=original}
}
function replaceMain(body,value){
 const starts=[...body.matchAll(/<span\b[^>]*itemprop="description"[^>]*>/g)];assert.equal(starts.length,3)
 const start=starts[1].index+starts[1][0].length,tags=/<\/?span\b[^>]*>/g;tags.lastIndex=start;let depth=1,m
 while((m=tags.exec(body))){depth+=m[0].startsWith('</')?-1:1;if(!depth)return body.slice(0,start)+value+body.slice(m.index)}
 throw Error('Actual native main description has no balanced end')
}
for(const description of ['<p>Sample</p>','<p>The full job description is currently unavailable. Please check back later for details about this position.</p>','<p>Please click Apply now to learn more about this opportunity and submit your application for this position.</p>','<div hidden>Build reliable services for our enterprise customers and collaborate with product engineering stakeholders to deliver resilient production platforms.</div>','<div inert>Build reliable services for our enterprise customers and collaborate with product engineering stakeholders to deliver resilient production platforms.</div>'])test('full main JD cannot be replaced by inactive, placeholder or instruction-only content '+description.slice(0,55),async()=>{await assert.rejects(()=>replay(p=>{if(p.url.includes('/job/'))p.body=replaceMain(p.body,description)}),/description missing/)})
test('meaningful native role with a trailing Apply now footer stays complete',async()=>{const jobs=await replay(p=>{if(p.url.includes('/job/'))p.body=replaceMain(p.body,'<p>Build reliable services for enterprise customers and collaborate with product engineering stakeholders to deliver resilient production platforms. Design scalable software systems, review code, write automated tests, and improve observability of business applications.</p><p>Apply now to learn more about this opportunity.</p>')});assert.equal(jobs.length,17)})
test('final full page recheck drift rejects the entire attempt',async()=>{await assert.rejects(()=>replay((p,count)=>{if(count===29){const d=JSON.parse(p.body);d.totalJobs=18;p.body=JSON.stringify(d)}}),/changed during extraction/)})
test('final response caller abort rejects even when transport ignores cancellation',async()=>{const controller=new AbortController();await assert.rejects(()=>replay((p,count)=>{if(count===29)controller.abort(Error('final caller cancelled'))},{signal:controller.signal}),/final caller cancelled/)})
test('deadline bounds an uncooperative native transport',async()=>{const original=globalThis.fetch;globalThis.fetch=()=>new Promise(()=>{});try{await assert.rejects(()=>run({timeoutMs:15}),/deadline exceeded/)}finally{globalThis.fetch=original}})
test('actual advertised SAP public widget and17 distinct currentIndia roles replace the sentinel, retaining dates and partial scope',async()=>{
 const jobs=await replay();assert.equal(jobs.length,17);assert.equal(new Set(jobs.map(j=>j.jobId)).size,17)
 assert.ok(jobs.every(j=>j.source==='colgatepalmolive'&&j.country==='India'&&j.city==='Mumbai'&&j.nativeCompanyBrand==='Colgate-Palmolive'&&j.nativeLegalEmployer===null&&j.sourceDetailComplete===true&&j.sourceListingComplete===false))
 assert.equal(jobs.find(j=>j.jobId==='167261').postedAt,'2025-05-23T00:00:00.000Z');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const [name,change]of[
 ['commented native identity and bootstrap',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,open,js,close)=>/ssoCompanyId|CSRFToken/.test(js)?open+'/*'+js.replaceAll('*/','* /')+'*/'+close:all)}],
 ['archived template-string bootstrap is not active identity',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,open,js,close)=>/ssoCompanyId|CSRFToken/.test(js)?open+'const archivedNativeBootstrap = '+String.fromCharCode(96)+js.replaceAll('\\','\\\\').replaceAll(String.fromCharCode(96),'\\'+String.fromCharCode(96)).replaceAll('${','\\${')+String.fromCharCode(96)+';'+close:all)}],
 ['uncalled function bootstrap is not active identity',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,open,js,close)=>/ssoCompanyId|CSRFToken/.test(js)?open+'function archivedNativeBootstrapNeverCalled(){'+js+'}'+close:all)}],
 ['uncalled widget declaration is not current bootstrap',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,open,js,close)=>/unifyBuildVersion/.test(js)?open+'function unusedWidget(){'+js+'}'+close:all)}],
 ['archived property strings cannot replace actual wrong tenant expressions',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/\bcompanyId\s*:\s*'colgate'/g,()=>`companyId: ("differenttenant"), archivedIdentity: "companyId: 'colgate'"`).replace(/"ssoCompanyId"\s*:\s*'colgate'/g,()=>`"ssoCompanyId": ("differenttenant"), archivedIdentity: '\"ssoCompanyId\": \"colgate\"'`)}],
 ['duplicate direct identity property',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/\bcompanyId\s*:\s*'colgate'/g,"companyId:'colgate', companyId:'differenttenant'")}],
 ['computed native identity property',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/\bcompanyId\s*:\s*'colgate'/g,"['companyId']:'colgate'")}],
 ['spread native identity property',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/\bcompanyId\s*:\s*'colgate'/g,"...{companyId:'colgate'}")}],
 ['expression rather than observed literal identity',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/\bcompanyId\s*:\s*'colgate'/g,"companyId:('colgate')")}],
 ['commented public nonce alone',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replace(/var\s+CSRFToken\s*=\s*(["'])[^"']+\1\s*;/g,m=>'/*'+m+'*/')}],
 ['duplicate conflicting corporate canonical',p=>{if(p.url==='https://www.colgatepalmolive.co.in/')p.body=p.body.replace('</head>','<link rel="canonical" href="https://unrelated.invalid/"></head>')}],
 ['duplicate identical corporate canonical',p=>{if(p.url==='https://www.colgatepalmolive.co.in/')p.body=p.body.replace('</head>','<link rel="canonical" href="https://www.colgatepalmolive.co.in/"></head>')}],
 ['inert corporate handoff',p=>{if(p.url.includes('colgatepalmolive.co.in'))p.body='<div inert>'+p.body+'</div>'}],
 ['changed widget version',p=>{if(p.url.endsWith('/search/'))p.body=p.body.replaceAll('b2605.31','b9999.99')}],
 ['changed advertised JS',p=>{if(p.url.includes('main.d01aeea5.js'))p.body+='/*changed*/'}],
 ['HTTP202',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs'))p.status=202}],
 ['HTTP200 error envelope',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);d.meta={ERROR:'failure'};p.body=JSON.stringify(d)}}],
 ['invalid typed total',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);d.totalJobs=[17];p.body=JSON.stringify(d)}}],
 ['duplicated page identity',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);if(d.jobSearchResult?.length>1)d.jobSearchResult[1]=d.jobSearchResult[0];p.body=JSON.stringify(d)}}],
 ['foreign native country',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);if(d.jobSearchResult)d.jobSearchResult[0].response.jobLocationShort=['Mumbai, MH, USA, '];p.body=JSON.stringify(d)}}],
 ['wrong native brand',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);if(d.jobSearchResult)d.jobSearchResult[0].response.filter5=["Hill's Pet Nutrition"];p.body=JSON.stringify(d)}}],
 ['future native posting date',p=>{if(p.url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(p.body);if(d.jobSearchResult)d.jobSearchResult[0].response.unifiedStandardStart='1/1/99';p.body=JSON.stringify(d)}}],
 ['inert fullrole body',p=>{if(p.url.includes('/job/'))p.body='<div inert>'+p.body+'</div>'}],
 ['wrong native apply id',p=>{if(p.url.includes('/job/'))p.body=p.body.replaceAll('/talentcommunity/apply/','/talentcommunity/apply/999')}],
 ['conflicting detail posting date',p=>{if(p.url.includes('/job/'))p.body=p.body.replace(/(Posting Start Date:[\s\S]{0,160}?)\d{1,2}\/\d{1,2}\/26/,'$11/1/99')}]
])test('ordinary runtime rejects '+name,async()=>{await assert.rejects(()=>replay(change))})
test('long application-instruction-only native middle section is not a full JD',async()=>{await assert.rejects(()=>replay(p=>{if(p.url.includes('/job/'))p.body=replaceMain(p.body,'<p>Please click the Apply now button to access the complete details about this position, the requirements, the application instructions and the recruitment process. Please submit your application to view further information.</p>')}),/description missing/)})
test('caps,zero timeout andcallerabort cannot certifyempty',async()=>{await assert.rejects(()=>run({maxJobs:0}));await assert.rejects(()=>run({timeoutMs:0}));await assert.rejects(()=>run({signal:AbortSignal.abort(Error('caller cancelled'))}),/cancelled/)})
