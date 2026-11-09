import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {BOARD,detailModel,jobCards} from './nativeModels.js'
import {reducedBoard} from './test-data/reducedNativeHarness.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch=()=>{throw Error('Offline Akulaku peer-regression network tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const page=url=>structuredClone(packets.find(row=>row.requestedUrl===url||row.url===url))
const originals=packets.filter(row=>row.url?.includes('/alljob/?o=1')).flatMap(row=>jobCards(row.html))
const card=originals.find(row=>row.detailId==='311197705')
const styleOptions={stylesheets:packets.filter(row=>row.kind==='stylesheet').map(row=>({url:row.url,body:row.html}))}

test('Akulaku binds the public alternate posting ID even when two originals share title requisition and date',()=>{
 const other=originals.find(row=>row.detailId==='311197580')
 assert.equal(card.title,other.title);assert.equal(card.postingDate,other.postingDate)
 assert.throws(()=>detailModel(page(other.detailUrl).html,card),error=>error.code==='AKULAKU_NATIVE_MODEL'&&/posting.*identity|identity.*posting/i.test(error.message))
 const correct=detailModel(page(card.detailUrl).html,card,styleOptions)
 assert.ok(correct.sourceNativePublicPostingIdentity.some(row=>row.postingId===card.detailId))
})

test('Akulaku hidden or clipped public criteria never qualify as complete',()=>{
 const transforms=[
  html=>html.replace('</head>','<style>.xiangqingtext{display:none}</style></head>'),
  html=>html.replace('<div class="xiangqingtext">','<div class="xiangqingtext" style="opacity:0">'),
  html=>html.replace('<div class="xiangqingtext">','<div class="xiangqingtext" style="height:0;max-height:0;overflow:hidden">'),
  html=>html.replace('<div class="xiangqingcontain">','<div class="xiangqingcontain" style="height:0;overflow:hidden">')
 ]
 for(const transform of transforms){const before=page(card.detailUrl).html,html=transform(before);assert.notEqual(html,before);const model=detailModel(html,card,styleOptions);assert.equal(model.sourceDetailComplete,false);assert.ok(model.sourceNativeCriteriaIssues.length)}
})

test('Akulaku current declared stylesheet rules qualify criteria visibility without an unrelated private CSS gate',async()=>{
 const fixture=reducedBoard({india:true}),sheet=fixture.pages.get(styleOptions.stylesheets[1].url);assert.ok(sheet)
 sheet.html+='\n.xiangqingtext{display:none !important}'
 let audit;const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.ok(audit.observedDetails.every(row=>row.sourceDetailComplete===false));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const unrelated=reducedBoard({india:true}),result=await run({fetchPage:async(url,request)=>{const packet=await unrelated.fetchPage(url,request);if(packet.kind==='stylesheet')packet.html+='\n.private-application-consent{display:none !important}';return packet}})
 assert.equal(result.length,2);assert.equal(readInventoryEvidence(result).listingComplete,true)
})

test('Akulaku final public styles follow closing details and cannot leave newly hidden criteria current',async()=>{
 const fixture=reducedBoard({india:true}),last=fixture.cards[1].detailId;let audit
 const jobs=await run({fetchPage:async(url,request)=>{const packet=await fixture.fetchPage(url,request);if(url.includes('/zpdetail/'+last)&&fixture.visits.get(url)===2)fixture.pages.get(styleOptions.stylesheets[1].url).html+='\n.xiangqingtext{opacity:0}';return packet},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(fixture.calls.findLastIndex(row=>row.url===styleOptions.stylesheets[1].url)>fixture.calls.findLastIndex(row=>row.url.includes('/zpdetail/')))
 assert.ok(audit.observedDetails.every(row=>row.sourceCurrentNativeRoleQualified===false))
})

test('Akulaku preserves public criteria asset provenance without claiming a text-only full extraction',async()=>{
 const fixture=reducedBoard({india:true}),id=fixture.cards[0].detailId,packet=fixture.pages.get(fixture.cards[0].detailUrl)
 packet.html=packet.html.replace('<div class="xiangqingtext">','<div class="xiangqingtext"><img src="https://akulaku.zhiye.com/public-criteria.png" alt="Mandatory certification matrix">')
 let audit;const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}}),row=audit.observedDetails.find(value=>value.jobId===id)
 assert.equal(jobs.some(value=>value.jobId===id),false);assert.equal(row.sourceDetailComplete,false)
 assert.ok(row.sourceNativeCriteriaAssets.some(asset=>asset.src==='https://akulaku.zhiye.com/public-criteria.png'&&asset.alt==='Mandatory certification matrix'))
 assert.ok(row.jobDescription.includes('Mandatory certification matrix'));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Akulaku an inert image template and an effective visible CSS override do not veto full public criteria',async()=>{
 const fixture=reducedBoard({india:true})
 for(const[url,packet]of fixture.pages)if(url.includes('/zpdetail/'))packet.html=packet.html.replace('<div class="xiangqingtext">','<div class="xiangqingtext"><template><img alt="Unrendered application illustration" src="/unrendered.png"></template>').replace('</head>','<style>.xiangqingtext{display:none}.xiangqingtext{display:block}</style></head>')
 const jobs=await run({fetchPage:fixture.fetchPage});assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('Akulaku a fixed nonzero clipping height cannot certify a complete long public description',()=>{
 const before=page(card.detailUrl).html,html=before.replace('<div class="xiangqingtext">','<div class="xiangqingtext" style="height:24px;overflow:hidden">');assert.notEqual(html,before)
 const row=detailModel(html,card,styleOptions);assert.equal(row.sourceDetailComplete,false);assert.ok(row.sourceNativeCriteriaIssues.length)
})

test('Akulaku horizontal nowrap clipping and native line clamps hold incomplete public criteria',async()=>{
 for(const style of['width:1px;overflow:hidden;white-space:nowrap','display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden']){
  const fixture=reducedBoard({india:true}),id=fixture.cards[0].detailId,packet=fixture.pages.get(fixture.cards[0].detailUrl),before=packet.html;packet.html=before.replace('<div class="xiangqingtext">','<div class="xiangqingtext" style="'+style+'">');assert.notEqual(packet.html,before)
  let audit;const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}}),row=audit.observedDetails.find(value=>value.jobId===id)
  assert.equal(row.sourceDetailComplete,false);assert.equal(jobs.some(value=>value.jobId===id),false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})

test('Akulaku applies actual published stylesheet order',()=>{
 const before=page(card.detailUrl).html,hiddenStyles={stylesheets:styleOptions.stylesheets.map((row,index)=>({...row,body:row.body+(index===1?'\n.xiangqingtext{display:none}':'')}))},earlier=before.replace('<head>','<head><style>.xiangqingtext{display:block}</style>');assert.notEqual(earlier,before)
 assert.equal(detailModel(earlier,card,hiddenStyles).sourceDetailComplete,false)
})

for(const condition of['@supports not (display: block)','@media not screen'])test('Akulaku unreachable visible override does not qualify hidden criteria: '+condition,()=>{
 const html=page(card.detailUrl).html.replace('</head>','<style>.xiangqingtext{display:none}'+condition+'{.xiangqingtext{display:block}}</style></head>')
 assert.equal(detailModel(html,card,styleOptions).sourceDetailComplete,false)
})

test('Akulaku an initially disabled alternate stylesheet is outside current public criteria qualification',async()=>{
 const fixture=reducedBoard({india:true})
 for(const[url,packet]of fixture.pages)if(url.includes('/zpdetail/'))packet.html=packet.html.replace('</head>','<link rel="alternate stylesheet" title="Unused application appearance" href="/unused-application.css"></head>')
 const jobs=await run({fetchPage:fixture.fetchPage});assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.ok(fixture.calls.every(row=>!row.url.includes('unused-application.css')))
})

test('Akulaku unused conditional private style variables do not become public criteria gates',async()=>{
 const fixture=reducedBoard({india:true})
 for(const[url,packet]of fixture.pages)if(url.includes('/zpdetail/'))packet.html=packet.html.replace('</head>','<style>@supports (unreviewed-private-condition: yes){:root{--private-application-label:"Account password"}}</style></head>')
 const jobs=await run({fetchPage:fixture.fetchPage});assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('Akulaku generated public criteria text is retained as a gap rather than silently omitted',()=>{
 const html=page(card.detailUrl).html.replace('</head>','<style>.xiangqingtext::before{content:"Additional mandatory certification"}</style></head>'),row=detailModel(html,card,styleOptions)
 assert.equal(row.sourceDetailComplete,false);assert.ok(row.sourceNativeCriteriaVisibility.generatedCriteria.some(value=>value.content.includes('Additional mandatory certification')))
})

test('Akulaku first denied published stylesheet stops without private or browser fallback',async()=>{
 const fixture=reducedBoard({india:true});let denied=0,browser=0
 await assert.rejects(run({fetchPage:async(url,request)=>{if(url===styleOptions.stylesheets[0].url){denied++;return{url,status:403,html:'Denied'}}return fixture.fetchPage(url,request)},fetchBrowserText:()=>{browser++}}),error=>error.status===403&&error.abortRetries&&!error.abortPipeline)
 assert.equal(denied,1);assert.equal(browser,0)
})

test('Akulaku standalone role city and work-province alternatives retain their unknown countries',async()=>{
 for(const[label,value]of[['City','Bengaluru'],['工作省份','Unpublished province']]){
  const fixture=reducedBoard();for(const[url,packet]of fixture.pages)if(url.includes('/alljob/')||url.includes('/zpdetail/'))packet.html=packet.html.replaceAll('广东省-深圳市','France')
  const packet=fixture.pages.get(fixture.cards[0].detailUrl);packet.html=packet.html.replace('<div class="xiangqingtext">','<ul class="xiangqinglist"><li class="ntitle">'+label+'：</li><li class="nvalue">'+value+'</li></ul><div class="xiangqingtext">')
  let audit;const jobs=await run({fetchPage:fixture.fetchPage,onAudit:next=>{audit=next}}),row=audit.observedDetails.find(value=>value.jobId===fixture.cards[0].detailId)
  assert.equal(row.sourceCountryScopeUnresolved,true);assert.ok(row.sourceNativeAdditionalWorkplaceFields.some(field=>field.label===label&&field.value===value));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})

test('Akulaku supplied signal-honoring transport is aborted when the owned collection deadline expires',async()=>{
 const caller=new AbortController();let transportSignal,transportAborted=false
 await assert.rejects(run({signal:caller.signal,collectionBudgetMs:30,fetchPage:(_url,request)=>{transportSignal=request.signal;return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>{transportAborted=true;reject(request.signal.reason)},{once:true}))}}),error=>error.code==='AKULAKU_COLLECTION_TIMEOUT')
 assert.equal(transportAborted,true);assert.equal(transportSignal.aborted,true);assert.equal(caller.signal.aborted,false)
})

test('Akulaku composed transport lifetime preserves the exact caller cancellation reason',async()=>{
 const caller=new AbortController(),reason=Object.freeze({peer:'caller-reason'});let transportSignal,started
 const entered=new Promise(resolve=>{started=resolve}),work=run({signal:caller.signal,fetchPage:(_url,request)=>{transportSignal=request.signal;started();return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true}))}})
 await entered;caller.abort(reason);await assert.rejects(work,error=>error===reason);assert.equal(transportSignal.reason,reason)
})
