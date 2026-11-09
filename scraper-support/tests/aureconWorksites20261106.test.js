import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {runWorkdayScraper,validateWorkdayAdditionalWorksiteProof,WORKDAY_ADDITIONAL_WORKSITE_PROOF} from '../myworkday/engine.js'
import {currentWorkdayBoardReceipt,WORKDAY_COUNTRY_INVENTORY_PROOF} from '../myworkday/countryInventoryProof.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/aureconWorksites20261106/capture.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex')
const careers='https://www.aurecongroup.com/careers/experienced-professionals',contact='https://www.aurecongroup.com/contact-us',board='https://aurecongroup.wd3.myworkdayjobs.com/en-US/aurecon',api='https://aurecongroup.wd3.myworkdayjobs.com/wday/cxs/aurecongroup/aurecon/jobs'
const captured=url=>{
 const row=fixture.responses.find(r=>r.receipt.requestedUrl===url);assert.ok(row,url)
 const body=row.bodyBase64===null?null:Buffer.from(row.bodyBase64,'base64')
 if(body){assert.equal(body.length,row.receipt.bytes);assert.equal(sha(body),row.receipt.sha256)}
 return{...row,body}
}
// Bytes and original receipts remain genuine. Fresh clocks and repeated contact
// envelopes below are explicitly synthetic replay controls, not live snapshots.
const proof=()=>{
 const now=Date.now(),fetchedAt=new Date(now-500).toISOString()
 const response=url=>{const r=captured(url);return{url,status:r.receipt.status,contentType:r.receipt.contentType,
  body:r.body?.toString('utf8')??null,sha256:r.receipt.sha256??null,location:r.receipt.location??null,fetchedAt,originalReceipt:r.receipt}}
 return{version:'aurecon-native-worksites-v2',source:'aurecon',boardUrl:board,jobsApiUrl:api,officialCareersUrl:careers,directoryUrl:contact,
  attemptStartedAt:new Date(now-2000).toISOString(),attemptDeadlineAt:new Date(now+60000).toISOString(),verifiedAt:new Date(now-100).toISOString(),
  corporateResponse:response(careers),clientResponses:[response('https://www.aurecongroup.com/content/static/index.20261009.1.js'),response('https://www.aurecongroup.com/content/static/indexBQdjKFCm.js'),response('https://www.aurecongroup.com/content/static/indexbqdjkfcm.js')],
  contactSnapshots:[response(contact),response(contact)]}
}
const context={source:'aurecon',baseUrl:board,jobsApiUrl:api,officialCareersUrl:careers,countryProof:true}
const nativeRow=fixture.responses.find(r=>r.receipt.requestedUrl.includes('/wday/cxs/'))
const native=captured(nativeRow.receipt.requestedUrl),payload=JSON.parse(native.body),info=payload.jobPostingInfo
const exercise=async(t,{input=null,countryProof=false,nativePayload=payload,additionalRole=null}={})=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aurecon-worksites-'))
 fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify({listingStrategy:'jobs-api',jobsApiUrl:api,detailUrlBase:board,
  locationCountry:null,searchText:'',workdayMaxPages:2,...(countryProof?{inventoryScope:'complete-board-country-proof',officialCareersUrl:careers}:{})}))
 t.after(()=>{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('aurecon-worksites-'));fs.rmSync(directory,{recursive:true,force:true})})
 const requests=[]
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  url=String(url);requests.push({url,method:init.method||'GET'})
  const response=(body,type)=>{const r=new Response(body,{headers:{'content-type':type}});Object.defineProperty(r,'url',{value:url});return r}
  if(url===careers)return response(captured(careers).body,'text/html; charset=utf-8')
  if(url===board)return response('<html>Synthetic anonymous bootstrap control</html>','text/html')
  if(url===api){assert.equal(init.method,'POST');const request=JSON.parse(init.body);assert.deepEqual(request.appliedFacets,{});assert.equal(request.searchText,'');assert.equal(request.offset,0)
   const rows=[{title:info.title,externalPath:new URL(info.externalUrl).pathname.replace('/aurecon',''),locationsText:'4 Locations',bulletFields:[info.jobReqId],postedOn:'Posted Today'}]
   if(additionalRole)rows.push(additionalRole.listing)
   return response(JSON.stringify({total:rows.length,jobPostings:rows}),'application/json')}
  if(additionalRole&&url===additionalRole.url)return response(JSON.stringify(additionalRole.payload),'application/json')
  assert.equal(url,nativeRow.receipt.requestedUrl,'No implicit network or HTML fallback')
  return response(JSON.stringify(nativePayload),'application/json')
 })
 const jobs=await runWorkdayScraper({source:'aurecon',company:'Aurecon',baseUrl:board,scraperDir:directory,sourceWorksiteCountryProof:input,
  requestTimeoutMs:2000,retryBaseDelayMs:0,nativeDetailRecovery:false,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}}})
 return{jobs,requests}
}

test('Original genuine R33797 retains the unresolved secondary labels without source office proof',async t=>{
 await assert.rejects(exercise(t),error=>error.name==='WorkdayIncompleteScopeError'&&/Maroochydore|Mackay|Gladstone/.test(error.cause?.message||error.message))
})
test('Aurecon current native cards resolve all R33797 secondary offices through their explicit Australia tag',async t=>{
 const {jobs,requests}=await exercise(t,{input:proof(),countryProof:true})
 assert.equal(jobs.length,0,'The genuine role is wholly foreign, not an India vacancy')
 const p=jobs[WORKDAY_COUNTRY_INVENTORY_PROOF],w=jobs[WORKDAY_ADDITIONAL_WORKSITE_PROOF]
 assert.equal(p.initial.count,1);assert.equal(p.closing.count,1)
 assert.deepEqual(p.roles[0].countryScopes,['foreign','foreign','foreign','foreign'])
 assert.deepEqual(w.roles[0].additionalWorksiteCountryBindings.map(r=>r.label),['Maroochydore','Mackay','Gladstone'])
 for(const r of w.roles[0].additionalWorksiteCountryBindings){assert.equal(r.country.alpha2Code,'AU');assert.equal(r.worksiteRecords[0].publisherCardId,null);assert.ok(r.worksiteRecords[0].publisherLabel.endsWith(' office'));assert.equal(r.snapshots[0].reportedTotal,null)}
 assert.equal(requests.filter(r=>r.url===api).length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true,'Only the labeled synthetic one-role envelope is complete')
})
test('Aurecon corporate handoff is qualified from the current declared client/model, with original HTML hash',()=>{
 const input=proof(),validated=validateWorkdayAdditionalWorksiteProof(input,context),r=new Response(input.corporateResponse.body,{headers:{'content-type':'text/html'}})
 Object.defineProperty(r,'url',{value:careers})
 const receipt=currentWorkdayBoardReceipt({officialCareersUrl:careers,boardUrl:board,response:r,html:input.corporateResponse.body,renderProof:validated.corporateRenderProof})
 assert.equal(receipt.board,'https://aurecongroup.wd3.myworkdayjobs.com/aurecon');assert.equal(receipt.sha256,input.corporateResponse.sha256)
 assert.equal(receipt.bindingMethod,'reviewed-aurecon-header-model');assert.equal(receipt.syntheticAnchor,false)
})

const mutateModel=(row,id,change)=>{
 const doc=readNativeDocument(row.body),parent=doc.nodes(n=>n.attrs.id===id)[0],script=parent.children.find(n=>n.tag==='script')
 const m=JSON.parse(script.raw);change(m);row.body=row.body.replace(script.raw,JSON.stringify(m));row.sha256=sha(row.body)
}
for(const[name,change]of [
 ['stale attempt',p=>{p.attemptDeadlineAt=new Date(Date.now()-1).toISOString()}],
 ['another source',p=>{p.source='other-employer'}],
 ['another board',p=>{p.boardUrl=board.replace('/aurecon','/OtherBoard')}],
 ['changed reviewed main program',p=>{p.clientResponses[0].body+='\n/* synthetic changed program */';p.clientResponses[0].sha256=sha(p.clientResponses[0].body)}],
 ['invented original module 200',p=>{p.clientResponses[1]={...p.clientResponses[2],url:p.clientResponses[1].url}}],
 ['wrong client MIME',p=>{p.clientResponses[0].contentType='text/html'}],
 ['inactive mount',p=>{p.corporateResponse.body=p.corporateResponse.body.replace('<div id="subpage"','<div hidden id="subpage"');p.corporateResponse.sha256=sha(p.corporateResponse.body)}],
 ['restricted careers handoff',p=>mutateModel(p.corporateResponse,'header-links-data',m=>{m.HeaderLinks[4].SecondaryLinks[1].TertiaryLinks1[4].RestrictLocation=[{Name:'Synthetic restricted location'}]})],
])test('Aurecon rejects synthetic '+name,()=>{const p=proof();change(p);assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,context))})

test('Aurecon rejects a hidden duplicate model which document.querySelector would select first',()=>{
 const p=proof(),r=p.contactSnapshots[0];r.body=r.body.replace('<div id="contact-page-data">','<div hidden id="contact-page-data"><script type="application/json">{}</script></div><div id="contact-page-data">');r.sha256=sha(r.body)
 assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,context),/single native contact-page-data model/)
})
for(const[name,change]of [
 ['unknown country GUID',m=>{m.ContactCards.find(c=>c.LocationName==='Mackay office').RelatedLocations[0].ID.Guid='11111111-1111-4111-8111-111111111111'}],
 ['multiple countries',m=>{m.ContactCards.find(c=>c.LocationName==='Mackay office').RelatedLocations.push({ID:m.LocationsTags[1].ID,Name:m.LocationsTags[1].Name})}],
 ['non-office contact',m=>{m.ContactCards.find(c=>c.LocationName==='Mackay office').ContactUsTabs=[m.Tabs[1]]}],
 ['ambiguous duplicate label',m=>{const card=structuredClone(m.ContactCards.find(c=>c.LocationName==='Mackay office'));card.RelatedLocations=[{ID:m.LocationsTags[1].ID,Name:m.LocationsTags[1].Name}];m.ContactCards.push(card)}],
])test('Aurecon leaves synthetic '+name+' unresolved and retains independent office evidence',()=>{
 const p=proof();for(const r of p.contactSnapshots)mutateModel(r,'contact-page-data',change)
 const v=validateWorkdayAdditionalWorksiteProof(p,context);assert.equal(v.byLabel.has('mackay'),false);assert.equal(v.byLabel.get('gladstone').country.alpha2Code,'AU')
})
test('Aurecon closing card change removes only that label from current office proof',()=>{
 const p=proof();mutateModel(p.contactSnapshots[1],'contact-page-data',m=>{m.ContactCards.find(c=>c.LocationName==='Mackay office').Address='Synthetic changed address'})
 const v=validateWorkdayAdditionalWorksiteProof(p,context);assert.equal(v.byLabel.has('mackay'),false);assert.equal(v.byLabel.get('maroochydore').country.alpha2Code,'AU')
})
const registeredMock=(t,change=()=>{})=>{
 const requests=[],counts=new Map()
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  url=String(url);requests.push({url,method:init.method||'GET'})
  const count=(counts.get(url)||0)+1;counts.set(url,count)
  let body,status=200,headers={}
  if(url===board){body='<html>Synthetic anonymous bootstrap</html>';headers['content-type']='text/html'}
  else if(url===api){assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body).appliedFacets,{});body=JSON.stringify({total:1,jobPostings:[{title:info.title,externalPath:new URL(info.externalUrl).pathname.replace('/aurecon',''),locationsText:'4 Locations',bulletFields:[info.jobReqId],postedOn:'Posted Today'}]});headers['content-type']='application/json'}
  else{const row=captured(url);body=row.body;status=row.receipt.status;headers['content-type']=row.receipt.contentType;if(row.receipt.location)headers.location=row.receipt.location}
  const row={url,body,status,headers};change(row,count)
  const r=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(r,'url',{value:url});return r
 })
 return requests
}
const registered=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='aurecon'))
test('The real Aurecon provider invokes its current native office-proof collector',async t=>{
 const provider=getScraperCatalog().find(p=>p.source==='aurecon')
 assert.equal(provider.adapter,'script');assert.ok(provider.modulePath.endsWith(path.join('aurecon.workday','script.js')))
 let audit;const requests=registeredMock(t)
 const jobs=await createCatalogScraper(provider).run({onAudit:r=>{audit=r},requestTimeoutMs:2000,timeoutMs:30000,nativeDetailRecovery:false,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}}})
 assert.equal(jobs.length,0);assert.equal(audit.configuredBoardScopeComplete,true);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.directorySnapshots.length,3);assert.equal(requests.filter(r=>r.url===contact).length,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(jobs[WORKDAY_COUNTRY_INVENTORY_PROOF].initial.count,1)
})

test('Aurecon never overrides a conflicting current typed CXS country for a secondary worksite',async t=>{
 const native=structuredClone(payload),i=native.jobPostingInfo;i.title='Synthetic typed India worksite control';i.jobReqId='SYNTHETIC-CONTROL';i.jobPostingId='Synthetic-typed-India-worksite-control_SYNTHETIC-CONTROL';i.externalUrl='https://aurecongroup.wd3.myworkdayjobs.com/aurecon/job/Mackay/'+i.jobPostingId;i.location='Mackay';i.country={descriptor:'India',alpha2Code:'IN'};i.additionalLocations=[];delete i.jobRequisitionLocation
 const url=api.replace(/\/jobs$/,'')+'/job/Mackay/'+i.jobPostingId
 const listing={title:i.title,externalPath:'/job/Mackay/'+i.jobPostingId,locationsText:'Mackay',bulletFields:[i.jobReqId],postedOn:'Posted Today'}
 await assert.rejects(exercise(t,{input:proof(),countryProof:true,additionalRole:{url,listing,payload:native}}),error=>error.name==='WorkdayIncompleteScopeError'&&/typed country conflicts/.test(error.cause?.message||''))
})
test('Aurecon registered collector rejects a changed closing native office model',async t=>{
 registeredMock(t,(r,count)=>{if(r.url===contact&&count===3){const row={body:r.body.toString('utf8')};mutateModel(row,'contact-page-data',m=>{m.ContactCards.find(c=>c.LocationName==='Mackay office').Address='Synthetic changed closing address'});r.body=row.body}})
 await assert.rejects(registered().run({timeoutMs:30000,requestTimeoutMs:2000,nativeDetailRecovery:false,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}}}),error=>error.failureKind==='coverage_gap'&&error.lifecycleCleanupAllowed===false)
})
for(const[name,change,expected]of [
 ['missing current module declaration',r=>{if(r.url===careers)r.body=r.body.toString('utf8').replaceAll('/content/static/index.20261009.1.js','/content/static/unreviewed.js')},1],
 ['changed current main program',r=>{if(r.url.endsWith('/index.20261009.1.js'))r.body=Buffer.concat([r.body,Buffer.from('\n/* synthetic unreviewed program */')])},2],
])test('Aurecon stops before requesting undeclared assets after '+name,async t=>{
 const requests=registeredMock(t,change)
 await assert.rejects(registered().run({timeoutMs:30000,requestTimeoutMs:2000}),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(requests.length,expected)
})
test('Aurecon registered collector stops at the original HTTP 403 and cancels its body',async t=>{
 let calls=0,cancelled=false
 t.mock.method(globalThis,'fetch',async url=>{calls++;const r=new Response(new ReadableStream({cancel(){cancelled=true}}),{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:String(url)});return r})
 await assert.rejects(registered().run({timeoutMs:30000,requestTimeoutMs:2000}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied'&&error.nativeEvidence.responses[0].status===403)
 assert.equal(calls,1);assert.equal(cancelled,true)
})
test('Aurecon registered collector bounds a locked public response body',async t=>{
 let calls=0,cancelled=false
 t.mock.method(globalThis,'fetch',async url=>{calls++;const r=new Response(new ReadableStream({cancel(){cancelled=true}}),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:String(url)});return r})
 await assert.rejects(registered().run({timeoutMs:30000,requestTimeoutMs:20}),error=>error.failureKind==='network_or_timeout'&&/request deadline/.test(error.message))
 assert.equal(calls,1);assert.equal(cancelled,true)
})
test('Aurecon registered collector preserves exact opaque caller cancellation',async t=>{
 const controller=new AbortController(),reason=Object.freeze({syntheticOpaqueCancellation:true});let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;controller.abort(reason);return new Promise(()=>{})})
 await assert.rejects(registered().run({signal:controller.signal,timeoutMs:30000,requestTimeoutMs:2000}),error=>error===reason)
 assert.equal(calls,1)
})
const authoredIntegrity=(row,metadata)=>{
 row.body=row.body.replace(/<script\b[^>]*\bsrc="\/content\/static\/index\.20261009\.1\.js"[^>]*>/,tag=>tag.replace('<script','<script integrity="'+metadata+'"'))
 row.sha256=sha(row.body)
}
for(const page of ['careers','closing contact'])test('Aurecon refuses renderer authority when '+page+' declares mismatching strongest integrity',()=>{
 const p=proof(),valid=createHash('sha256').update(p.clientResponses[0].body).digest('base64')
 authoredIntegrity(page==='careers'?p.corporateResponse:p.contactSnapshots[1],'sha256-'+valid+' sha512-'+Buffer.alloc(64).toString('base64'))
 assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,context),/integrity/)
})
test('Aurecon accepts matching strongest authored integrity on the exact retained main program',()=>{
 const p=proof(),valid=createHash('sha512').update(p.clientResponses[0].body).digest('base64')
 for(const row of [p.corporateResponse,...p.contactSnapshots])authoredIntegrity(row,'sha256-'+Buffer.alloc(32).toString('base64')+' sha512-'+valid)
 assert.equal(validateWorkdayAdditionalWorksiteProof(p,context).byLabel.get('mackay').country.alpha2Code,'AU')
})
test('Aurecon rejects an oversized genuine byte stream chunk before copying it',async t=>{
 const {createCurrentAureconScraper}=await import('../../scraper/aurecon.workday/currentNative.js')
 const value=new Uint8Array(5*1024*1024),original=Buffer.from;let copied=0,cancelled=false
 t.mock.method(Buffer,'from',function(input,...args){if(input===value)copied+=value.byteLength;return original.call(this,input,...args)})
 await assert.rejects(createCurrentAureconScraper({fetchImpl:async url=>{const r=new Response(new ReadableStream({start(c){c.enqueue(value)},cancel(){cancelled=true}}),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}).run({timeoutMs:30000,requestTimeoutMs:2000}),/byte bound/)
 assert.equal(copied,0);assert.equal(cancelled,true)
})
