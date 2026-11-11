import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {WEATHERFORD_CAREERS,WEATHERFORD_NATIVE_SITE} from './currentPublisher20261110.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime20261110.json.gz',import.meta.url))))
const replay=(change=packet=>packet)=>{
 const occurrences=new Map()
 return{
 now:()=>capture.captureCompletedAt,
 fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit')
  const occurrence=(occurrences.get(url)||0)+1;occurrences.set(url,occurrence)
  const original=capture.captures.filter(packet=>packet.requestedURL===url)[occurrence-1]
  assert.ok(original,'Authentic captured response occurrence required: '+url+' #'+occurrence)
  const packet=change(structuredClone(original),{url,occurrence}),response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  return response
 },
 }}

test('registered Weatherford reader follows the current genuine vanity declaration and recovers four own explicit India roles',async()=>{
 const jobs=await run(replay())
 assert.deepEqual(jobs.map(job=>job.jobId),['108264','108269','108283','106592'])
 for(const job of jobs){
  assert.equal(job.company,'Weatherford');assert.equal(job.country,'India')
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  const detail=JSON.parse(capture.captures.find(packet=>packet.requestedURL.includes('RequisitionDetails')&&JSON.parse(packet.body).items[0].Id===job.jobId).body).items[0]
  assert.ok(job.sourceDescription.includes(detail.ExternalDescriptionStr))
  assert.equal(job.nativeSourceRecord.detail.Id,job.jobId)
  assert.equal(job.nativeLegalEmployer,null)
  assert.equal(job.nativeHiringOrganization,null)
  assert.equal(job.nativeEmployerBinding.method,'current-corporate-delegation-and-native-site-publisher')
  assert.equal(job.nativeEmployerBinding.corporateBinding.bindingMethod,'runtime-current-careers-publisher-declaration')
  assert.equal(job.sourceOfficialBinding.currentHandoffRechecked,true)
  assert.equal(job.sourceOfficialBinding.publisherDeclaration.context.vanityURL,'https://careers.weatherford.com/')
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(jobs,'weatherford').observedVacancyCount,5)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords,5)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeOracleRecords.length,5)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeOracleRecords.find(r=>r.listing.Id==='107236').listing.PrimaryLocationCountry,'MY')
 const receipts=jobs[RECRUITMENT_OBSERVATIONS].receipts
 for(const url of [WEATHERFORD_CAREERS,'https://careers.weatherford.com/',WEATHERFORD_NATIVE_SITE])assert.equal(receipts.filter(r=>r.requestedURL===url).length,2)
})

test('actual Weatherford registered adapter preserves four India roles and all five native observations',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='weatherford')
 assert.ok(provider)
 const jobs=await createCatalogScraper(provider).run(replay())
 assert.equal(jobs.length,4)
 assert.equal(readSourceObservationEvidence(jobs,'weatherford').observedVacancyCount,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

const mutateBody=(url,change)=>(packet,context)=>{if(packet.requestedURL===url)packet.body=change(packet.body,context);return packet}
const vanity='https://careers.weatherford.com/'
const invalidDeclarations=[
 ['missing corporate vanity link',WEATHERFORD_CAREERS,b=>b.replaceAll('href="https://careers.weatherford.com"','href="/careers/"').replaceAll('href="https://Careers.weatherford.com"','href="/careers/"')],
 ['missing corporate site fragment',WEATHERFORD_CAREERS,b=>b.replaceAll('#en/sites/CX_1/join-talent-community','#en/sites/CX_2/join-talent-community')],
 ['inert corporate site fragment',WEATHERFORD_CAREERS,b=>b.replace(/<a\b[^>]*href="https:\/\/careers\.weatherford\.com\/#en\/sites\/CX_1\/join-talent-community"[^>]*>[\s\S]*?<\/a>/gi,m=>'<template>'+m+'</template>')],
 ['different corporate publisher',WEATHERFORD_CAREERS,b=>b.replace(/<title>[\s\S]*?<\/title>/i,'<title>Other Corporation Careers</title>')],
 ['unreviewed corporate base',WEATHERFORD_CAREERS,b=>b.replace('<head>','<head><base href="https://other.example/">')],
 ['different native host',vanity,b=>b.replaceAll('fa-exmi-saasfaprod1.fa.ocs.oraclecloud.com','other.fa.ocs.oraclecloud.com')],
 ['different candidate path',vanity,b=>b.replaceAll('/hcmUI/CandidateExperience/','/hcmUI/OtherExperience/')],
 ['non-GET program',vanity,b=>b.replace("xhr.open('GET'","xhr.open('POST'")],
 ['commented program',vanity,b=>b.replace('function replacecontent() {','/* function replacecontent() {').replace('    </script>',' */ </script>')],
 ['inert program',vanity,b=>b.replace(/<script>[\s\S]*?<\/script>/i,m=>'<template>'+m+'</template>')],
 ['hidden program',vanity,b=>b.replace('<script>','<script hidden>')],
 ['quoted program',vanity,b=>b.replace(/<script>[\s\S]*?<\/script>/i,m=>'<blockquote>'+m+'</blockquote>')],
 ['string program decoy',vanity,b=>b.replace(/<script>[\s\S]*?<\/script>/i,m=>'<script>const sample='+JSON.stringify(m)+';</script>')],
 ['additional active entrypoint override',vanity,b=>b.replace('</head>','<script>replacecontent=function(){location.href="https://other.example/"}</script></head>')],
 ['additional external script',vanity,b=>b.replace('</head>','<script src="https://other.example/override.js"></script></head>')],
 ['additional hidden entrypoint override',vanity,b=>b.replace('</head>','<script hidden>replacecontent=function(){location.href="https://other.example/"}</script></head>')],
 ['changed telemetry executable URL',vanity,b=>b.replace('https://s.go-mpulse.net/boomerang/','https://other.example/')],
 ['additional active event override',vanity,b=>b.replace('</body>',"<img src='broken' onerror=\"replacecontent=function(){location.href='https://other.example/'}\"></body>")],
 ['hidden event override',vanity,b=>b.replace('</body>',"<img hidden src='broken' onerror=\"replacecontent=function(){}\"></body>")],
 ['javascript URL',vanity,b=>b.replace('</body>',"<a href='javascript:replacecontent=function(){}'>sample</a></body>")],
 ['data frame',vanity,b=>b.replace('</body>',"<iframe src='data:text/html,sample'></iframe></body>")],
 ['meta refresh',vanity,b=>b.replace('</head>',"<meta http-equiv='refresh' content='0;url=https://other.example/'></head>")],
 ['missing active entry point',vanity,b=>b.replace('onload="replacecontent()"','onload="sample()"')],
 ['different exact native publisher',WEATHERFORD_NATIVE_SITE,b=>b.replace('<title>Weatherford</title>','<title>Weatherford Other Corporation</title>')],
 ['different native site',WEATHERFORD_NATIVE_SITE,b=>b.replace('data-sitenumber="CX_1"','data-sitenumber="CX_2"')],
 ['different native API',WEATHERFORD_NATIVE_SITE,b=>b.replace('data-apibaseurl="https://fa-exmi-saasfaprod1.fa.ocs.oraclecloud.com:443"','data-apibaseurl="https://other.fa.ocs.oraclecloud.com"')],
]
for(const[name,url,change]of invalidDeclarations)test('Weatherford holds '+name,async()=>{
 await assert.rejects(run(replay(mutateBody(url,change))))
})
test('Weatherford ignores non-executed template and comment override decoys',async()=>{
 const jobs=await run(replay(mutateBody(vanity,body=>body.replace('</head>',
  '<template><script>replacecontent=function(){}</script><img onerror="sample()"><iframe src="https://other.example/"></iframe></template><!-- <script>replacecontent=function(){}</script> --></head>'))))
 assert.equal(jobs.length,4)
})

for(const url of [vanity,WEATHERFORD_NATIVE_SITE])test('Weatherford holds changed actual response authority '+url,async()=>{
 await assert.rejects(run(replay(packet=>{if(packet.requestedURL===url)packet.finalURL='https://other.example/';return packet})))
})
test('Weatherford holds public vanity access denial without trying an alternative native route',async()=>{
 let nativeRequested=false
 await assert.rejects(run(replay(packet=>{
  if(packet.requestedURL===WEATHERFORD_NATIVE_SITE)nativeRequested=true
  if(packet.requestedURL===vanity)packet.status=403
  return packet
 })))
 assert.equal(nativeRequested,false)
})

for(const url of [WEATHERFORD_CAREERS,vanity,WEATHERFORD_NATIVE_SITE])test('Weatherford rolls back roles after a changed closing handoff '+url,async()=>{
 await assert.rejects(run(replay(mutateBody(url,(body,{occurrence})=>occurrence===2?body.replaceAll('Weatherford','Other Corporation').replaceAll('replacecontent','sample').replaceAll('CX_1','CX_2'):body))),error=>{
  assert.equal(error.recruitmentObservations.returnedIndiaJobs,0)
  return true
 })
})

const mutateNative=change=>packet=>{
 if(packet.requestedURL.includes('recruitingCEJobRequisition')){const payload=JSON.parse(packet.body);change(payload,packet.requestedURL);packet.body=JSON.stringify(payload)}
 return packet
}
test('Weatherford never infers India from a city when both own native countries are foreign',async()=>{
 const jobs=await run(replay(mutateNative((payload,url)=>{
  const rows=url.includes('RequisitionDetails')?payload.items:payload.items[0].requisitionList
  for(const row of rows)if(row.Id==='108264'){row.PrimaryLocationCountry='US';row.secondaryLocations=[];row.workLocation=[]}
 })))
 assert.equal(jobs.length,3);assert.ok(!jobs.some(job=>job.jobId==='108264'))
 assert.equal(readSourceObservationEvidence(jobs,'weatherford').observedVacancyCount,5)
})
test('Weatherford holds listing/detail country contradiction and discards preceding roles',async()=>{
 await assert.rejects(run(replay(mutateNative((payload,url)=>{if(url.includes('RequisitionDetails')&&payload.items[0].Id==='108269')payload.items[0].PrimaryLocationCountry='US'}))),error=>{
  assert.equal(error.recruitmentObservations.returnedIndiaJobs,0);return true
 })
})
test('Weatherford holds mismatched own native identity',async()=>{
 await assert.rejects(run(replay(mutateNative((payload,url)=>{if(url.includes('RequisitionDetails'))payload.items[0].Id='999999'}))))
})
test('Weatherford excludes a role lacking its own full criteria',async()=>{
 const jobs=await run(replay(mutateNative((payload,url)=>{if(url.includes('RequisitionDetails')&&payload.items[0].Id==='108264')for(const field of ['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr'])payload.items[0][field]=''})))
 assert.equal(jobs.length,3);assert.ok(!jobs.some(job=>job.jobId==='108264'))
})
test('Weatherford excludes an explicitly conflicting native employer',async()=>{
 const jobs=await run(replay(mutateNative((payload,url)=>{if(url.includes('RequisitionDetails')&&payload.items[0].Id==='108264')payload.items[0].LegalEmployer='Other Corporation'})))
 assert.equal(jobs.length,3);assert.ok(!jobs.some(job=>job.jobId==='108264'))
})
const publicFields=['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr','CorporateDescriptionStr','OrganizationDescriptionStr']
for(const field of publicFields)for(const text of [
 '<p>Employer: Other Corporation</p>',
 'Employer: Other Corporation',
 '<p>Weatherford is not your employer.</p>',
 'Weatherford is not your employer.',
 '<p>You will not be employed by Weatherford.</p>',
 '<div><span>Employer: Other Corporation</span></div>',
 '<aside><p>Employer: Other Corporation</p><p>Weatherford is not your employer.</p></aside>',
 ...['aside','main','address'].map(tag=>'Our corporate overview<'+tag+'>Employer: Other Corporation</'+tag+'>'),
])test('Weatherford holds active employer contradiction in '+field+' '+text,async()=>{
 const jobs=await run(replay(mutateNative((payload,url)=>{
  if(url.includes('RequisitionDetails')&&payload.items[0].Id==='108264')payload.items[0][field]=(payload.items[0][field]||'')+'\n'+text
 })))
 assert.equal(jobs.length,3);assert.ok(!jobs.some(job=>job.jobId==='108264'))
 assert.equal(readSourceObservationEvidence(jobs,'weatherford').observedVacancyCount,5)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeOracleRecords.length,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const field of publicFields)for(const wrap of [
 text=>'<template>'+text+'</template>',text=>'<blockquote>'+text+'</blockquote>',text=>'<q>'+text+'</q>',
 text=>'<code>'+text+'</code>',text=>'<pre>'+text+'</pre>',text=>'<script>'+JSON.stringify(text)+'</script>',
 text=>'<div hidden>'+text+'</div>',text=>'<div aria-hidden="true">'+text+'</div>',text=>'<div style="display:none">'+text+'</div>',
])test('Weatherford ignores inert own-description employer contradiction in '+field+' '+wrap('sample'),async()=>{
 const jobs=await run(replay(mutateNative((payload,url)=>{
  if(url.includes('RequisitionDetails')&&payload.items[0].Id==='108264')payload.items[0][field]=(payload.items[0][field]||'')+wrap('<p>Employer: Other Corporation</p><p>Weatherford is not your employer.</p>')
 })))
 assert.equal(jobs.length,4)
 assert.equal(jobs[0].nativeLegalEmployer,null)
})
for(const limits of [{maxRequests:3},{maxRequests:9},{maxPages:1}])test('Weatherford preserves shared hard budget '+JSON.stringify(limits),async()=>{
 await assert.rejects(run({...replay(),...limits}))
})
test('Weatherford detail cap stays incomplete and never expands scope',async()=>{
 const jobs=await run({...replay(),maxDetails:1})
 assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-detail-budget-reached'))
})
test('Weatherford rejects an invalid observation clock',async()=>{
 await assert.rejects(run({...replay(),now:()=> 'invalid'}),/Invalid observation time/)
})
test('Weatherford respects pre-aborted caller cancellation without requesting anything',async()=>{
 const controller=new AbortController();controller.abort(Error('caller cancelled'))
 await assert.rejects(run({...replay(),signal:controller.signal,fetchImpl:()=>assert.fail('cancelled read')}),/caller cancelled/)
})
test('Weatherford cancels an active vanity read with the exact caller reason',async()=>{
 const controller=new AbortController(),reason=Error('cancel active vanity'),wire=replay()
 await assert.rejects(run({...wire,signal:controller.signal,fetchImpl:async(url,init)=>{
  if(url===vanity){controller.abort(reason);return new Promise(()=>{})}
  return wire.fetchImpl(url,init)
 }}),error=>error===reason)
})
test('Weatherford actively times out a never-settling caller transport',async()=>{
 const keepAlive=setInterval(()=>{},100)
 try{await assert.rejects(run({sourceTimeoutMs:20,fetchImpl:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')}
 finally{clearInterval(keepAlive)}
})
