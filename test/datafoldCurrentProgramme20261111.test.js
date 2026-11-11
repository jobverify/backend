import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentDatafoldProgramme,runCurrentDatafoldProgramme} from '../scraper/datafold/currentProgramme.js'
import {HOME,BOARD,API} from '../scraper/datafold/currentProgrammeData.js'
import {ENTRY,MANIFEST} from '../scraper/datafold/currentProgrammeRenderer.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const bytes=fs.readFileSync(new URL('./fixtures/datafold-current-programme-07dd-20261111.json.gz',import.meta.url))
const sha=value=>createHash('sha256').update(value).digest('hex')
assert.equal(sha(bytes),'ad010dc522eefab6f38c1bb5bc6f151f80fac84612d8068205cd36e5d3382841')
const fixture=JSON.parse(gunzipSync(bytes)),now=()=>fixture.capturedAtLast
function replay(change=h=>h,options={}){
 const counts=new Map(),calls=[],changed=[],groups=new Map()
 for(const row of fixture.responses){const values=groups.get(row.requestedURL)||[];values.push(row);groups.set(row.requestedURL,values)}
 const readPage=async(url,init)=>{
  const occurrence=counts.get(url)||0,packet=groups.get(url)?.[occurrence]
  assert.ok(packet,'Only exact actual captures may be read: '+url+' phase'+occurrence)
  counts.set(url,occurrence+1);calls.push({url,init,occurrence})
  const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(body),packet.bodySHA256)
  const original=body.toString('utf8'),text=change(original,{url,occurrence,packet,calls})
  if(text!==original)changed.push({url,occurrence})
  const result={url:packet.finalURL,status:packet.status,headers:packet.headers,text}
  return options.responseChange?options.responseChange(result,{url,occurrence,packet,calls}):result
 }
 return {calls,changed,readPage,run:()=>readCurrentDatafoldProgramme({readPage,now,...options})}
}
test('fourteen actual same-version packets prove the complete two-role foreign programme without global or screening claims',async()=>{
 const r=replay(),jobs=await r.run(),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(r.calls.length,14)
 assert.equal(e.status,'complete-inventory');assert.equal(e.reportedTotal,2);assert.equal(e.indiaFacetCount,0)
 assert.equal(e.listingComplete,true);assert.equal(e.lifecycleCleanupAllowed,false)
 assert.equal(readSourceObservationEvidence(jobs,'datafold').observedVacancyCount,2)
 assert.equal(a.currentDeclaredSourceProgramComplete,true);assert.equal(a.sourceScopeComplete,false)
 assert.equal(a.companyGlobalScopeQualified,false);assert.equal(a.companyGlobalTotal,null)
 assert.equal(a.applicationVisited,false);assert.equal(a.screeningCriteriaAcquired,false)
 assert.equal(a.publisherLegalNameRegistryVerified,false);assert.equal(a.roles.length,2)
 assert.equal(a.roles[0].country,'United States');assert.equal(a.roles[0].nativeEmployer.name,'Datafold')
 assert.equal(a.roles[0].nativeDatePosted,'2026-10-02T19:44:13.100+00:00')
 assert.equal(a.roles[1].descriptionHTMLSHA256,'3a15898ba87d6256748c8456b9a785ffcb9e7b87958cd521069002aa428b4a9a')
 assert.match(a.roles[1].nativeCompensationTiers[0].tierSummary,/OTE \$300K–\$400K, uncapped commission/)
 assert.equal(a.allOpeningRolesBeforeClosingRoles,true);assert.equal(a.currentRendererRechecked,true)
 assert.equal(a.renderer.version,'07ddf247e844137b3955a192112a7970230c6ccf')
 assert.equal(a.renderer.entrySHA256,'68315c039b15ae6e77fb1a91e06305229c7bd371e649488757a02e43b1050b3f')
})

// Each control changes complete original acquired packets. Mutations are never
// treated as publisher evidence, and an uncaptured request cannot pass a guard.
function modelRange(html){
 const marker='window.__appData = ',start=html.indexOf(marker)+marker.length
 assert.ok(start>=marker.length&&html[start]==='{','Actual native initializer exists')
 let depth=0,quoted=false,escaped=false
 for(let at=start;at<html.length;at++){
  const char=html[at]
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
  if(char==='"')quoted=true
  else if(char==='{'||char==='[')depth++
  else if((char==='}'||char===']')&&!--depth)return {start,end:at+1}
 }
 assert.fail('Actual JSON initializer is bounded')
}
function model(html,change){const r=modelRange(html),data=JSON.parse(html.slice(r.start,r.end));change(data);return html.slice(0,r.start)+JSON.stringify(data)+html.slice(r.end)}
function schema(html,change){return html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const data=JSON.parse(b);change(data);return a+JSON.stringify(data)+c})}
function json(text,change){const data=JSON.parse(text);change(data);return JSON.stringify(data)}
function replace(text,from,to){assert.ok(text.includes(from),'Mutation must target actual original text');return text.replace(from,to)}
async function holds(name,change,expected){
 const r=replay(change)
 await assert.rejects(r.run(),error=>{
  assert.equal(error.softFailure,true,name+' must reach a native qualification guard')
  assert.match(error.message,expected,name+' must fail at its intended boundary');return true
 })
 assert.ok(r.changed.length>0,name+' changed real acquired bytes')
 return r
}
const firstID='5d341aa7-6bc2-4ba2-99d0-10eac34f0335',firstURL=BOARD+'/'+firstID
const secondURL=BOARD+'/40ff3cd0-aac1-4215-b308-cc22bc6f9e07'

test('historical reviewed c14 board cannot close a current07dd transaction',async()=>{
 const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/datafold-current-programme-20261111.json.gz',import.meta.url))))
 const packet=historical.responses.find(row=>row.requestedURL===BOARD&&row.phase==='closing')
 const oldBody=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(oldBody),packet.bodySHA256)
 // The text-only historical substitution also carries its old nonce while
 // the replay retains current original headers; either binding must hold.
 const r=await holds('mixed reviewed deployments',(html,c)=>c.url===BOARD&&c.occurrence===1?oldBody.toString('utf8'):html,/renderer\/bootstrap|CSP nonce/)
 assert.equal(r.calls.length,10);assert.equal(r.changed.length,1)
 assert.equal(r.calls.some(c=>c.url.includes('c14a5462a0f9a6d4e4cb75a1ddefdd12fb964972')),false)
})

test('historical byte-different entry is held despite identical reviewed recruitment consumers',async()=>{
 const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/datafold-current-programme-20261111.json.gz',import.meta.url))))
 const packet=historical.responses.find(row=>row.kind==='entry'&&row.phase==='opening')
 const oldBody=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(oldBody),packet.bodySHA256)
 const r=await holds('historical current-entry substitution',(html,c)=>c.url===ENTRY?oldBody.toString('utf8'):html,/renderer bytes\/SRI/)
 assert.equal(r.calls.length,5);assert.equal(r.changed.length,1)
})

test('retains original native/API objects, full bytes, dates, legal wording, tiers and terminal cleanup holds',async()=>{
 const r=replay(),jobs=await r.run(),a=jobs.nativeCollectionEvidence
 const raw=Buffer.from(fixture.responses[2].bodyBase64,'base64').toString('utf8')
 assert.deepEqual(a.nativePayload,JSON.parse(raw));assert.equal(a.originalNativeFeedJSON,raw)
 assert.equal(a.totalDecodedBytes,8894144);assert.equal(a.noNonceComparisonExceptionApplied,true)
 assert.equal(a.nativeProgrammeIsEmpty,false);assert.equal(a.nativeReportedTotal,2)
 assert.match(a.roles[0].descriptionHTML,/Datafold, Inc\./);assert.match(a.roles[0].descriptionHTML,/At least 2 years/)
 assert.equal(a.roles[0].nativeDeadline,null);assert.equal(a.roles[0].nativeSchemaDatePosted,'2026-10-02')
 assert.equal(a.roles[1].nativeTextingConsentLegalName,'Datafold');assert.equal(a.roles[1].nativeSalary.value.minValue,150000)
 assert.match(a.roles[1].descriptionHTML,/300K/);assert.match(a.roles[1].nativeCompensationTiers[0].tierSummary,/300K/)
 assert.equal(a.renderer.criticalFunctions.length,16);assert.equal(a.renderer.completeQueryDefinitions.length,3)
 assert.equal(a.renderer.stylesheetBytesAcquired,false);assert.equal(a.renderer.untrustedJavaScriptExecuted,false)
 const firstClosing=r.calls.findIndex(c=>c.url===firstURL&&c.occurrence===1),lastOpening=r.calls.findIndex(c=>c.url===secondURL&&c.occurrence===0)
 assert.ok(firstClosing>lastOpening)
 assert.equal(JSON.parse(JSON.stringify(readInventoryEvidence(jobs))).lifecycleCleanupAllowed,false)
 for(const receipt of a.receipts){assert.equal(sha(receipt.bodyText),receipt.bodySHA256);assert.equal(receipt.finalURL,receipt.requestedURL)}
})

for(const[title,change,reason]of[
 ['changed corporate account',(h,c)=>c.url===HOME?replace(h,'const ASHBY_ORG = "datafold"','const ASHBY_ORG = "foreign"'):h,/corporate programme/],
 ['additional corporate careers programme',(h,c)=>c.url===HOME?replace(h,'</body>','<a href="https://careers.datafold.com/">Engineering</a></body>'):h,/corporate programme/],
 ['corporate additional active JobPosting',(h,c)=>c.url===HOME?replace(h,'</head>','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"address":{"addressCountry":"India"}}}</script></head>'):h,/corporate programme/],
 ['duplicate raw boot JSON key',(h,c)=>c.url===BOARD?replace(h,'"environment":"production"','"environment":"foreign","environment":"production"'):h,/duplicate/],
 ['duplicate raw feed JSON key',(h,c)=>c.url===API?replace(h,'"apiVersion":"1"','"apiVersion":"other","apiVersion":"1"'):h,/duplicate/],
 ['duplicate decoded JSON key',(h,c)=>c.url===API?replace(h,'"apiVersion":"1"','"apiVersion":"other","apiVer\\u0073ion":"1"'):h,/duplicate/],
 ['boot empty src attribute',(h,c)=>c.url===BOARD?replace(h,'<script nonce=','<script src="" nonce='):h,/attributes/],
 ['boot nomodule attribute',(h,c)=>c.url===BOARD?replace(h,'<script nonce=','<script nomodule nonce='):h,/attributes/],
 ['conditional boot initializer',(h,c)=>c.url===BOARD?replace(h,'window.__appData = ','if (false) window.__appData = '):h,/initializer/],
 ['boot subsequent mutation',(h,c)=>c.url===BOARD?replace(h,'const ENTRY_KEY = "index.html";','window.__appData.jobBoard=null; const ENTRY_KEY = "index.html";'):h,/renderer\/bootstrap/],
 ['boot template carrier',(h,c)=>c.url===BOARD?replace(replace(h,'<script nonce=','<template><script nonce='),'</script>','</script></template>'):h,/boot carrier/],
 ['boot foreign namespace',(h,c)=>c.url===BOARD?replace(replace(h,'<script nonce=','<svg><script nonce='),'</script>','</script></svg>'):h,/boot carrier|foreign-namespace/],
 ['duplicate hidden boot shadow',(h,c)=>c.url===BOARD?replace(h,'</body>','<template><script>window.__appData = {};</script></template></body>'):h,/boot carrier/],
 ['CSS-hidden native mount',(h,c)=>c.url===BOARD?replace(h,'</head>','<style>#root{display:none!important}</style></head>'):h,/visible native mount/],
 ['duplicate mount identity',(h,c)=>c.url===BOARD?replace(h,'</body>','<div id="root"></div></body>'):h,/visible native mount/],
 ['native additional visible India card',(h,c)=>c.url===BOARD?replace(h,'</body>','<a href="/datafold/extra">India engineer</a></body>'):h,/visible native role/],
 ['native pagination envelope',(h,c)=>c.url===API?json(h,d=>{d.nextPage='next'}):h,/feed envelope/],
 ['native failed empty model',(h,c)=>c.url===BOARD?model(h,d=>{d.jobBoard=null}):h,/board\/termination/],
 ['native unlisted role',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].isListed=false}):h,/unlisted/],
 ['native duplicate ID',(h,c)=>c.url===API?json(h,d=>{d.jobs[1].id=d.jobs[0].id}):h,/Duplicate\/malformed/],
 ['native mismatched inventory ID',(h,c)=>c.url===BOARD?model(h,d=>{d.jobBoard.jobPostings.pop()}):h,/board count/],
 ['native orphan team',(h,c)=>c.url===BOARD?model(h,d=>{d.jobBoard.jobPostings[0].teamId='00000000-0000-0000-0000-000000000000'}):h,/orphan native card/],
 ['native cyclic team forest',(h,c)=>c.url===BOARD?model(h,d=>{d.jobBoard.teams[0].parentTeamId=d.jobBoard.teams[1].id;d.jobBoard.teams[1].parentTeamId=d.jobBoard.teams[0].id}):h,/cyclic team/],
 ['native country object disagreement',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].address.postalAddress.addressCountry={name:'USA',identifier:'IN'}}):h,/country/],
 ['native secondary India',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].secondaryLocations=[{location:'India'}]}):h,/Additional or unknown/],
 ['native applicant India',(h,c)=>c.url===firstURL?schema(h,d=>{d.applicantLocationRequirements.name='India'}):h,/Applicant-country/],
 ['native applicant unknown array',(h,c)=>c.url===firstURL?schema(h,d=>{d.applicantLocationRequirements=[{name:'USA'},{name:'India'}]}):h,/applicant-country/],
 ['native written locality India',(h,c)=>c.url===firstURL?schema(h,d=>{d.jobLocation.address.addressLocality='New York / India'}):h,/written address country/],
 ['native unknown address object',(h,c)=>c.url===firstURL?schema(h,d=>{d.jobLocation.address.addressRegion={country:'India'}}):h,/nested country/],
 ['native unknown country',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].address.postalAddress.addressCountry='ZZ'}):h,/country/],
 ['own employer conflict',(h,c)=>c.url===firstURL?schema(h,d=>{d.hiringOrganization.name='Foreign Employer'}):h,/employer/],
 ['own title punctuation conflict',(h,c)=>c.url===firstURL?schema(h,d=>{d.title=d.title.trim()}):h,/title identity/],
 ['own criteria punctuation conflict',(h,c)=>c.url===firstURL?schema(h,d=>{d.description=d.description.replace('At least 2 years','At least 20 years')}):h,/description disagreement/],
 ['own criteria word-boundary conflict',(h,c)=>c.url===firstURL?schema(h,d=>{d.description=d.description.replace('At least 2 years','At least 2 0 years')}):h,/description disagreement/],
 ['own unknown new applicant model',(h,c)=>c.url===firstURL?model(h,d=>{d.posting.eligibilityCountries=['IN']}):h,/own-role fields/],
 ['own application deadline changed',(h,c)=>c.url===firstURL?model(h,d=>{d.posting.applicationDeadline='2026-12-01T00:00:00Z'}):h,/deadline/],
 ['own contradictory work mode',(h,c)=>c.url===firstURL?model(h,d=>{d.posting.workplaceType='OnSite'}):h,/work-mode/],
 ['own nonexistent calendar date',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].publishedAt='2026-02-30T19:44:13.100+00:00'}):h,/publication date/],
 ['own fabricated date offset',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].publishedAt='2026-10-02T19:44:13.100+05:30'}):h,/publication date/],
 ['own salary currency mismatch',(h,c)=>c.url===secondURL?schema(h,d=>{d.baseSalary.currency='INR'}):h,/salary interval/],
 ['own salary endpoint mismatch',(h,c)=>c.url===secondURL?schema(h,d=>{d.baseSalary.value.minValue=15000}):h,/salary summary/],
 ['own new tier notice',(h,c)=>c.url===secondURL?model(h,d=>{d.posting.compensationTiers[0].eligibility='India'}):h,/tier fields/],
 ['native current deployment drift',(h,c)=>c.url===BOARD?replace(h,'07ddf247e844137b3955a192112a7970230c6ccf','d178689c37e84f77a4158c88f884c0ffb8913a10'):h,/renderer\/bootstrap/],
 ['manifest dependency drift',(h,c)=>c.url===MANIFEST?json(h,d=>{d['index.html'].imports=['extra.js']}):h,/manifest\/dependency/],
 ['entry exact SRI drift',(h,c)=>c.url===ENTRY?h+'\n/* changed */':h,/renderer bytes\/SRI/],
 ['closing corporate authority loss',(h,c)=>c.url===HOME&&c.occurrence===1?h+'\n<!-- changed -->':h,/corporate programme/],
 ['closing native board raw change',(h,c)=>c.url===BOARD&&c.occurrence===1?h+'\n<!-- changed -->':h,/Native board whole original/],
 ['closing exact role raw change',(h,c)=>c.url===firstURL&&c.occurrence===1?h+'\n<!-- changed -->':h,/Own role whole original/],
 ['closing full feed drift',(h,c)=>c.url===API&&c.occurrence===1?json(h,d=>{d.jobs[0].descriptionPlain+=' changed'}):h,/Native full feed whole original/],
])test(title,()=>holds(title,change,reason))

// These adjacent controls expose genuine missing guards in the first baseline
// implementation, independently of the already enforced closing byte checks.
for(const[title,change,reason]of[
 ['duplicate boot nonce attribute',(h,c)=>c.url===BOARD?h.replace(/<script nonce="([^"]+)"/,'<script nonce="$1" nonce="$1"'):h,/duplicate.*attribute/i],
 ['duplicate mount ID attribute',(h,c)=>c.url===BOARD?replace(h,'id="root"','id="root" id="root"'):h,/duplicate.*attribute/i],
 ['CSP nonce metadata outside head',(h,c)=>c.url===BOARD?h.replace(/(<meta name="csp-nonce"[^>]*>)/,'').replace('</body>',h.match(/<meta name="csp-nonce"[^>]*>/)[0]+'</body>'):h,/head\/meta/],
 ['hidden successful native filter',(h,c)=>c.url===BOARD?replace(h,'</body>','<form hidden><input name="country" value="US"></form></body>'):h,/programme\/filter/],
 ['CSS-hidden successful native filter',(h,c)=>c.url===BOARD?replace(h,'</body>','<form style="display:none"><input name="country" value="US"></form></body>'):h,/programme\/filter/],
 ['written address India without separator',(h,c)=>c.url===firstURL?schema(h,d=>{d.jobLocation.address.addressRegion='Remote India'}):h,/written address country/],
 ['written address Canada without separator',(h,c)=>c.url===firstURL?schema(h,d=>{d.jobLocation.address.addressRegion='Remote Canada'}):h,/written.*country|eligibility/],
 ['consistent authored Canadian applicant contradiction',(h,c)=>{
  const add=s=>s+'<p>Applicants must be located in Canada.</p>'
  if(c.url===API)return json(h,d=>{d.jobs[0].descriptionHtml=add(d.jobs[0].descriptionHtml);d.jobs[0].descriptionPlain+=' Applicants must be located in Canada.'})
  if(c.url===firstURL)return schema(model(h,d=>{d.posting.descriptionHtml=add(d.posting.descriptionHtml)}),d=>{d.description=add(d.description)})
  return h
 },/written.*country|eligibility/],
])test(title,()=>holds(title,change,reason))

test('dynamic current single-role inventory is exhausted without freezing two IDs or totals',async()=>{
 const r=replay((h,c)=>c.url===API?json(h,d=>{d.jobs=d.jobs.slice(0,1)}):c.url===BOARD?model(h,d=>{d.jobBoard.jobPostings=d.jobBoard.jobPostings.slice(0,1)}):h)
 const jobs=await r.run();assert.equal(r.calls.length,12);assert.equal(readInventoryEvidence(jobs).reportedTotal,1)
 assert.equal(jobs.nativeCollectionEvidence.roles.length,1);assert.ok(r.changed.length>=4)
})

test('a later role acquisition changing the first role is detected by all-open then all-close ordering',async()=>{
 let later=false
 const r=replay((h,c)=>{
  if(c.url===secondURL&&c.occurrence===0)later=true
  return later&&c.url===firstURL?h+'\n<!-- first changed after later opening -->':h
 })
 await assert.rejects(r.run(),/Own role whole original body changed/)
 assert.equal(r.changed.length,1);assert.equal(r.calls.at(-1).occurrence,1)
})

test('closing reserve and maximum detail bounds withhold before any selected own role is acquired',async()=>{
 for(const options of[{maxRequests:13},{maxDetails:1}]){
  const r=replay(h=>h,options);await assert.rejects(r.run(),/Reserve|detail bound/)
  assert.equal(r.calls.length,3);assert.equal(r.calls.some(c=>c.url===firstURL),false)
 }
})

for(const[title,edit,reason]of[
 ['missing original URL',p=>{delete p.url;return p},/URL identity/],
 ['foreign final URL',p=>({...p,url:'https://foreign.example/'}),/URL identity/],
 ['wrong original MIME',p=>({...p,headers:{...p.headers,'content-type':'text/plain'}}),/MIME/],
 ['native access denial',p=>({...p,status:403}),/HTTP 403/],
 ['missing original headers',p=>({...p,headers:undefined}),/headers/],
 ['missing original raw body',p=>({...p,text:undefined}),/raw response/],
])test(title,async()=>{const r=replay(h=>h,{responseChange:edit});await assert.rejects(r.run(),reason);assert.equal(r.calls.length,1)})

test('CSP header contradiction and closing CSP drift with unchanged bodies cannot qualify zero',async()=>{
 for(const closingOnly of[false,true]){
  const r=replay(h=>h,{responseChange:(p,c)=>c.url===BOARD&&(!closingOnly||c.occurrence===1)?{...p,headers:{...p.headers,'content-security-policy':p.headers['content-security-policy'].replace(/'nonce-[^']+'/g,"'nonce-foreign'")}}:p})
  await assert.rejects(r.run(),/CSP nonce/)
 }
})

test('pre-abort performs no reads and aborting detached audit cannot release zero',async()=>{
 const cancelled=new AbortController();cancelled.abort(new DOMException('cancelled','AbortError'))
 const r=replay(h=>h,{signal:cancelled.signal});await assert.rejects(r.run(),{name:'AbortError'});assert.equal(r.calls.length,0)
 const controller=new AbortController(),late=replay(h=>h,{signal:controller.signal,onAudit:a=>{a.roles.length=0;controller.abort(new DOMException('cancelled','AbortError'))}})
 await assert.rejects(late.run(),{name:'AbortError'});assert.equal(late.calls.length,14)
})

test('audit observers receive a detached copy of the original full native payload',async()=>{
 const r=replay(h=>h,{onAudit:a=>{a.nativePayload.jobs.length=0;a.roles.length=0;a.receipts.length=0}}),jobs=await r.run()
 assert.equal(jobs.nativeCollectionEvidence.nativePayload.jobs.length,2);assert.equal(jobs.nativeCollectionEvidence.roles.length,2)
 assert.equal(jobs.nativeCollectionEvidence.receipts.length,14)
})

test('raw-hook request and source deadlines bound a stalled injected reader',async()=>{
 const started=performance.now()
 await assert.rejects(readCurrentDatafoldProgramme({readPage:()=>new Promise(()=>{}),requestTimeoutMs:25,sourceTimeoutMs:100,now}),{name:'TimeoutError'})
 assert.ok(performance.now()-started<5000)
})

test('monotonic source bound rejects actual immediate packets when parsing exceeds one millisecond',async()=>{
 const r=replay(h=>h,{sourceTimeoutMs:1})
 await assert.rejects(r.run(),{name:'TimeoutError'})
 assert.ok(r.calls.length<14)
})

test('monotonic request bound rejects a synchronous hook that starves its timer',async()=>{
 const r=replay(h=>h,{requestTimeoutMs:5,responseChange:p=>{const until=performance.now()+20;while(performance.now()<until){/* Intentionally starve the timer to verify the monotonic deadline. */};return p}})
 await assert.rejects(r.run(),{name:'TimeoutError'});assert.equal(r.calls.length,1)
})

for(const[title,url,edit]of[
 ['enforced native script-src-elem denial',BOARD,p=>p+"; script-src-elem 'none'"],
 ['enforced native sandbox',BOARD,p=>p+'; sandbox'],
 ['enforced corporate script denial',HOME,()=>"script-src 'none'"],
])test(title,async()=>{
 let changed=0
 const r=replay(h=>h,{responseChange:(p,c)=>{if(c.url!==url)return p;changed++;return {...p,headers:{...p.headers,'content-security-policy':edit(p.headers['content-security-policy'])}}}})
 await assert.rejects(r.run(),/security.*profile|CSP.*profile/i);assert.ok(changed>0)
})

test('native enforced CSP cannot be supplied through report-only headers',async()=>{
 const r=replay(h=>h,{responseChange:(p,c)=>{
  if(c.url!==BOARD)return p
  const headers={...p.headers,'content-security-policy-report-only':p.headers['content-security-policy']};delete headers['content-security-policy'];return {...p,headers}
 }})
 await assert.rejects(r.run(),/CSP|security/)
})

for(const label of['US','United States'])test('original explicit country alias '+label+' reconciles without city inference',async()=>{
 const r=replay((h,c)=>{
  if(c.url===API)return json(h,d=>{for(const job of d.jobs){job.location=label;job.address.postalAddress.addressCountry=label}})
  if(c.url===BOARD)return model(h,d=>{for(const row of d.jobBoard.jobPostings)row.locationName=label})
  if(c.packet.kind==='role')return schema(model(h,d=>{d.posting.locationName=label}),d=>{d.jobLocation.address.addressCountry=label;d.applicantLocationRequirements.name=label})
  return h
 })
 const jobs=await r.run();assert.equal(jobs.nativeCollectionEvidence.roles.every(role=>role.country==='United States'),true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,2);assert.equal(r.changed.length,8)
})

test('original raw fetchPage transport preserves all fourteen requests and original API payload',async()=>{
 const r=replay(),jobs=await runCurrentDatafoldProgramme({fetchPage:r.readPage,requestIntervalMs:0,now})
 assert.equal(r.calls.length,14);assert.equal(jobs.nativeCollectionEvidence.requests,14)
 assert.equal(jobs.nativeCollectionEvidence.totalDecodedBytes,8894144)
 for(const call of r.calls){assert.equal(call.init.method,'GET');assert.equal(call.init.cache,'no-store');assert.equal(call.init.redirect,'manual');assert.equal(call.init.credentials,'omit')}
 assert.equal(jobs.nativeCollectionEvidence.nativePayload.jobs.length,2)
})

test('original streaming fetchImpl takes precedence over parsed hooks without losing original bytes',async()=>{
 const r=replay(),jobs=await runCurrentDatafoldProgramme({requestIntervalMs:0,now,fetchPage:()=>assert.fail('Only original fetchImpl is used'),fetchJson:()=>assert.fail('Parsed JSON cannot replace originals'),fetchImpl:async(url,init)=>{
  const page=await r.readPage(url,init),response=new Response(page.text,{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.url});return response
 }})
 assert.equal(r.calls.length,14);assert.equal(jobs.nativeCollectionEvidence.totalDecodedBytes,8894144)
})

test('parsed-only transport injection cannot fall back to uncontrolled public fetch',async()=>{
 const original=globalThis.fetch;let network=0
 globalThis.fetch=()=>{network++;throw Error('Uncontrolled network fallback')}
 try{await assert.rejects(runCurrentDatafoldProgramme({fetchJson:()=>({jobs:[]}),requestIntervalMs:0,now}),/parsed-only|raw.*transport/i)}finally{globalThis.fetch=original}
 assert.equal(network,0)
})

test('fetchPage original URL provenance is mandatory and conflicting aliases are rejected',async()=>{
 for(const metadata of[{}, {url:HOME,finalURL:'https://foreign.example/'}]){
  const r=replay()
  await assert.rejects(runCurrentDatafoldProgramme({requestIntervalMs:0,now,fetchPage:async(url,init)=>{
   const p=await r.readPage(url,init);delete p.url;return {...p,...metadata}
  }}),/URL provenance/)
  assert.equal(r.calls.length,1)
 }
})

test('ordinary entity stream exceeds four MiB safely and cancels the original body',async()=>{
 let cancelled=false
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(4*1024*1024+1))},cancel(){cancelled=true}})
 await assert.rejects(runCurrentDatafoldProgramme({requestIntervalMs:0,now,fetchImpl:async()=>({url:HOME,status:200,headers:new Headers(fixture.responses[0].headers),body})}),/stream byte budget/)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true)
})

test('renderer has a separate six MiB stream cap without raising ordinary entity caps',async()=>{
 const r=replay();let cancelled=false
 await assert.rejects(runCurrentDatafoldProgramme({requestIntervalMs:0,now,fetchImpl:async(url,init)=>{
  if(url===ENTRY)return {url,status:200,headers:new Headers(fixture.responses[4].headers),body:new ReadableStream({start(c){c.enqueue(new Uint8Array(6*1024*1024+1))},cancel(){cancelled=true}})}
  const p=await r.readPage(url,init),response=new Response(p.text,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 }}),/stream byte budget/)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);assert.equal(r.calls.length,4)
})

test('original stalled stream is cancelled on request deadline',async()=>{
 let cancelled=false
 await assert.rejects(runCurrentDatafoldProgramme({requestIntervalMs:0,requestTimeoutMs:25,sourceTimeoutMs:500,now,
  fetchImpl:async()=>({url:HOME,status:200,headers:new Headers(fixture.responses[0].headers),body:new ReadableStream({cancel(){cancelled=true}})})}),{name:'TimeoutError'})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true)
})

test('late original fetch body is cancelled after source deadline without releasing zero',async()=>{
 let cancelled=false
 await assert.rejects(runCurrentDatafoldProgramme({requestIntervalMs:0,sourceTimeoutMs:20,now,fetchImpl:async()=>{
  await new Promise(resolve=>setTimeout(resolve,40))
  return {url:HOME,status:200,headers:new Headers(fixture.responses[0].headers),body:new ReadableStream({cancel(){cancelled=true}})}
 }}),{name:'TimeoutError'})
 await new Promise(resolve=>setTimeout(resolve,50));assert.equal(cancelled,true)
})

test('full original opening bytes reserve complete matching closing bytes before release',async()=>{
 const r=replay((h,c)=>c.packet.kind==='role'?h+' '.repeat(4*1024*1024-Buffer.byteLength(h)):h)
 await assert.rejects(r.run(),/closing byte budget/);assert.equal(r.calls.length,7)
})

test('request/detail/deadline bounds and observation type fail before public reads',async()=>{
 for(const options of[{maxRequests:29},{maxDetails:7},{sourceTimeoutMs:180001},{requestTimeoutMs:20001},{now:()=>null}]){
  const r=replay(h=>h,options);await assert.rejects(r.run());assert.equal(r.calls.length,0)
 }
})

test('native OTE supplement contradicting full JD cannot qualify finite zero',()=>holds('native OTE supplement',(h,c)=>c.url===secondURL?model(h,d=>{d.posting.compensationTiers[0].tierSummary=d.posting.compensationTiers[0].tierSummary.replace('$400K','$450K')}):h,/compensation.*description|salary.*description/i))

test('all three full JD originals contradicting separate native base salary cannot qualify finite zero',()=>holds('native base salary',(h,c)=>{
 const change=s=>s.replace('Base $150K–$200K.','Base $150K–$250K.')
 if(c.url===API)return json(h,d=>{d.jobs[1].descriptionHtml=change(d.jobs[1].descriptionHtml);d.jobs[1].descriptionPlain=change(d.jobs[1].descriptionPlain)})
 if(c.url===secondURL)return schema(model(h,d=>{d.posting.descriptionHtml=change(d.posting.descriptionHtml)}),d=>{d.description=change(d.description)})
 return h
},/compensation.*description|salary.*description/i))

for(const[name,value]of[['refresh','0; url=https://foreign.example/careers'],['cf-mitigated','challenge'],['content-disposition','attachment; filename="jobs.html"']])
 test('original same-body native '+name+' authority/denial header cannot qualify finite zero',async()=>{
  let changed=0
  const r=replay(h=>h,{responseChange:(p,c)=>{
   if(c.url!==BOARD)return p
   assert.equal(p.headers[name],undefined);changed++;return {...p,headers:{...p.headers,[name]:value}}
  }})
  await assert.rejects(r.run(),/navigation|challenge|authority.*header/i);assert.ok(changed>0)
 })

for(const kind of['svg','math'])test('active '+kind+' recruitment declaration is unsupported and cannot disappear from programme scope',()=>holds('foreign-namespace programme',(h,c)=>c.url===BOARD?replace(h,'</body>','<'+kind+(kind==='svg'?' xmlns="http://www.w3.org/2000/svg"':' xmlns="http://www.w3.org/1998/Math/MathML"')+'><a href="https://jobs.ashbyhq.com/foreign" aria-label="India openings">'+(kind==='svg'?'<rect width="100" height="50"/>':'<mspace width="100px" height="50px"/>')+'</a></'+kind+'></body>'):h,/foreign-namespace|unsupported.*programme/i))

test('consistently split India in all original HTML descriptions withholds programme zero',()=>holds('split authored India',(h,c)=>{
 const add=s=>s+'<p>Applicants must be based in Ind<span style="display:inline">ia</span>.</p>'
 if(c.url===API)return json(h,d=>{d.jobs[0].descriptionHtml=add(d.jobs[0].descriptionHtml)})
 if(c.url===firstURL)return schema(model(h,d=>{d.posting.descriptionHtml=add(d.posting.descriptionHtml)}),d=>{d.description=add(d.description)})
 return h
},/plain.*criteria|India|eligibility/i))

test('rendered compensation philosophy cannot hide a split India condition from country qualification',()=>holds('split compensation India',(h,c)=>c.url===secondURL?model(h,d=>{d.posting.compensationPhilosophyHtml+='<p>Applicants must be based in Ind<span style="display:inline">ia</span>.</p>'}):h,/India|eligibility/i))

test('entity India in the published compensation philosophy remains a hold',()=>holds('entity compensation India',(h,c)=>c.url===secondURL?model(h,d=>{d.posting.compensationPhilosophyHtml+='<p>Applicants must be based in Ind&#105;a.</p>'}):h,/India|eligibility/i))

test('native title cannot hide split India while every own/card/API identity agrees',()=>holds('split title India',(h,c)=>{
 const title=JSON.parse(Buffer.from(fixture.responses[2].bodyBase64,'base64')).jobs[0].title+' – Ind<span>ia</span>'
 if(c.url===API)return json(h,d=>{d.jobs[0].title=title})
 if(c.url===BOARD)return model(h,d=>{d.jobBoard.jobPostings[0].title=title})
 if(c.url===firstURL){const changed=schema(model(h,d=>{d.posting.title=title}),d=>{d.title=title});return changed.replace(/<title>[\s\S]*?<\/title>/,'<title>'+title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+' @ Datafold</title>')}
 return h
},/India|eligibility/i))

for(const[name,change]of[
 ['numeric material criterion',s=>s.replace('At least 2 years','At least 20 years')],
 ['body case',s=>s.replace('Datafold, Inc.','DataFold, Inc.')],
])test('native plain view '+name+' disagreement cannot qualify zero',()=>holds('native plain criteria',(h,c)=>c.url===API?json(h,d=>{d.jobs[0].descriptionPlain=change(d.jobs[0].descriptionPlain)}):h,/plain.*criteria/i))

test('native plain view link target disagreement cannot qualify zero',()=>holds('native plain criteria link',(h,c)=>c.url===API?json(h,d=>{d.jobs[1].descriptionPlain=d.jobs[1].descriptionPlain.replace('https://www.datafold.com/case-study/chg-healthcare-mysql-to-snowflake-migration','https://foreign.example/altered-criterion')}):h,/plain.*criteria/i))

for(const url of[BOARD,firstURL,API,MANIFEST,ENTRY])test('original '+url+' non-UTF8 declared charset cannot authorize UTF8 native models',async()=>{
 let changed=0
 const r=replay(h=>h,{responseChange:(p,c)=>{if(c.url!==url)return p;changed++;return {...p,headers:{...p.headers,'content-type':p.headers['content-type'].split(';')[0]+'; charset=utf-16le'}}}})
 await assert.rejects(r.run(),/charset|encoding|representation/i);assert.ok(changed>0)
})

test('ambiguous duplicate declared UTF8/nonUTF8 charset is withheld',async()=>{
 const r=replay(h=>h,{responseChange:(p,c)=>c.url===BOARD?{...p,headers:{...p.headers,'content-type':'text/html; charset=utf-8; charset=utf-16le'}}:p})
 await assert.rejects(r.run(),/charset|encoding|representation/i)
})

test('native head charset metadata contradiction cannot be ignored',()=>holds('native charset metadata',(h,c)=>c.url===BOARD?replace(h,'<meta charset="utf-8">','<meta charset="utf-16le">'):h,/charset|encoding/i))

// These consistent mutations preserve API/full-own/schema and both-phase
// agreement. They are adversarial fixtures, never live publisher evidence.
const consistentDescription=(htmlSuffix,plainSuffix)=>(html,context)=>{
 if(context.url===API)return json(html,data=>{
  const role=data.jobs.find(row=>row.id===firstID)
  role.descriptionHtml+=htmlSuffix;role.descriptionPlain+=' '+plainSuffix
 })
 if(context.url===firstURL)return schema(model(html,data=>{data.posting.descriptionHtml+=htmlSuffix}),data=>{data.description+=htmlSuffix})
 return html
}

test('consistent native geography holds font-size zero masking visible India',()=>holds('hidden authored India',
 consistentDescription('<p>Work country: I<span style="font-size:0">X</span>ndia</p>','Work country: IXndia'),/authored|eligibility|India/i))

for(const city of['Bengaluru, Karnataka','Bangalore','Bengaluru'])
 test('consistent native geography holds authored work location '+city,()=>holds('authored Indian work city',
  consistentDescription('<p>Work location: '+city+'</p>','Work location: '+city),/India|eligibility/i))

for(const city of['Bengaluru','Bangalore'])
 test('consistent native geography holds matching API and schema address '+city,()=>holds('Indian address locality',(html,context)=>{
  if(context.url===API)return json(html,data=>{data.jobs.find(row=>row.id===firstID).address.postalAddress.addressLocality=city})
  if(context.url===firstURL)return schema(html,data=>{data.jobLocation.address.addressLocality=city})
  return html
 },/India|eligibility/i))

for(const city of['Bengaluru','Bangalore'])
 test('consistent native geography holds full card API own and schema title '+city,()=>holds('Indian title locality',(html,context)=>{
  const original=JSON.parse(Buffer.from(fixture.responses.find(row=>row.kind==='feed'&&row.phase==='opening').bodyBase64,'base64'))
  const title=original.jobs.find(row=>row.id===firstID).title+' / '+city
  if(context.url===API)return json(html,data=>{data.jobs.find(row=>row.id===firstID).title=title})
  if(context.url===BOARD)return model(html,data=>{data.jobBoard.jobPostings.find(row=>row.id===firstID).title=title})
  if(context.url===firstURL){
   const changed=schema(model(html,data=>{data.posting.title=title}),data=>{data.title=title})
   const escaped=title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
   return changed.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escaped+' @ Datafold</title>')
  }
  return html
 },/India|eligibility/i))
