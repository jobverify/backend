import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {extractJobCards,extractNextPageUrl,extractJobDescription,isIndiaLocation,run} from './script.js'
import {reducedBoard} from './test-data/reducedNativeHarness.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {BOARD,CORPORATE,detailModel} from './nativeModels.js'

globalThis.fetch=()=>{throw Error('Offline Akulaku fixture network tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const page=url=>structuredClone(packets.find(row=>row.requestedUrl===url||row.url===url))

test('Akulaku next-page reader binds the active next anchor rather than an earlier home link',()=>{
 const url='https://akulaku.zhiye.com/alljob/?o=1&PageIndex=2'
 assert.equal(extractNextPageUrl(page(url).html,url),'https://akulaku.zhiye.com/alljob/?o=1&PageIndex=3')
})

test('Akulaku actual terminal disabled next element without href is not a continuation URL',()=>{
 const url='https://akulaku.zhiye.com/alljob/?o=1&PageIndex=14'
 assert.equal(extractNextPageUrl(page(url).html,url),null)
})

test('Akulaku preserves original full responsibilities including nested colons and markup',()=>{
 const html=page('https://akulaku.zhiye.com/zpdetail/311197705?o=1').html
 const changed=html.replace('1. 负责 AI','<strong>Native scope: criterionAfterNestedColon</strong> 1. 负责 AI')
 assert.notEqual(changed,html)
 const description=extractJobDescription(changed)
 assert.ok(description.includes('criterionAfterNestedColon'))
 assert.ok(description.includes('英语具备良好的听说能力'))
})

test('Akulaku does not turn unqualified city names into native India countries',()=>{
 assert.equal(isIndiaLocation('Bengaluru'),false)
 assert.equal(isIndiaLocation('广东省-深圳市'),false)
 assert.equal(isIndiaLocation('国外-印度尼西亚'),false)
 assert.equal(isIndiaLocation('India-Bengaluru'),true)
})

test('Akulaku retains distinct numeric native postings even when their published requisition repeats',()=>{
 const cards=extractJobCards(page('https://akulaku.zhiye.com/alljob/?o=1').html)
 assert.equal(cards.length,15)
 const sameReq=cards.filter(row=>row.requisitionId==='J12409')
 assert.equal(sameReq.length,2)
 assert.deepEqual(sameReq.map(row=>row.detailId),['311197705','311197580'])
})

test('Akulaku transport errors are preserved rather than being successful empty output',async()=>{
 const reason=new TypeError('fetch failed')
 await assert.rejects(run({fetchPage:async()=>{throw reason}}),error=>error===reason)
})

test('Akulaku caller cancellation makes no read and preserves its exact original reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'akulaku-stop'});controller.abort(reason);let calls=0
 await assert.rejects(run({signal:controller.signal,fetchPage:async()=>{calls++;return{status:403,url:'https://www.akulaku.com/staff-life',html:'Denied'}}}),error=>error===reason)
 assert.equal(calls,0)
})

test('Akulaku complete native reads retain full public criteria and unresolved role workplaces',async()=>{
 const fixture=reducedBoard();let audit
 const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0)
 assert.equal(audit.observedDetails.length,2)
 assert.ok(audit.observedDetails.every(row=>row.sourceDetailComplete&&row.jobDescription.includes('任职资格')))
 assert.equal(audit.countryGaps.length,2)
 assert.equal(audit.closingInventoryMatches,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(!fixture.calls.some(row=>/Account|Login|apply|User\//i.test(row.url)))
 const lastDetail=fixture.calls.findLastIndex(row=>row.url.includes('/zpdetail/'))
 assert.ok(fixture.calls.findLastIndex(row=>row.url.includes('/alljob/'))>lastDetail)
})

test('Akulaku explicitly mutated future India workplaces qualify all identities with zero-unbounded or a partial positive cap',async()=>{
 const fixture=reducedBoard({india:true}),jobs=await run({fetchPage:fixture.fetchPage,maxJobs:0})
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceIndiaWorksiteQualified))
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 const limited=reducedBoard({india:true}),capped=await run({fetchPage:limited.fetchPage,maxJobs:1})
 assert.equal(capped.length,1)
 assert.equal(readInventoryEvidence(capped).listingComplete,false)
})

test('Akulaku closing detail removal cannot survive the final active native inventories',async()=>{
 const fixture=reducedBoard({india:true}),removed=fixture.cards[1].detailId;let audit
 const jobs=await run({fetchPage:async(url,request)=>{const packet=await fixture.fetchPage(url,request);if(url.includes('/zpdetail/'+removed)&&fixture.visits.get(url)===2)fixture.remove(removed);return packet},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,1)
 assert.ok(jobs.every(row=>row.jobId!==removed))
 assert.equal(audit.closingInventoryMatches,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Akulaku first public denial stays typed and stops without browser or private fallback',async()=>{
 let reads=0,browser=0
 await assert.rejects(run({fetchPage:async url=>{reads++;return{status:403,url,html:'Denied'}},fetchBrowserText:()=>{browser++;return''}}),error=>error.status===403&&error.abortRetries&&!error.abortPipeline)
 assert.equal(reads,1);assert.equal(browser,0)
})

test('Akulaku ignoring reader is bounded and preserves caller cancellation during the read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'mid-read-stop'})
 const work=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(Error('unbounded ignored reader')),250))]),error=>error===reason)
})

test('Akulaku unlisted active public card retains its full criteria but cannot qualify complete inventory',async()=>{
 const fixture=reducedBoard({india:true}),id='311197580',url=BOARD+'zpdetail/'+id+'?o=2',first=structuredClone(fixture.pages.get(fixture.cards[0].detailUrl));first.url=url;first.requestedUrl=url;first.html=first.html.replace('adid='+fixture.cards[0].detailId,'adid='+id);fixture.pages.set(url,first)
 const home=fixture.pages.get(BOARD);home.html=home.html.replace('</body>','<a href="/zpdetail/'+id+'?o=2">'+fixture.cards[0].title+'</a></body>');let audit
 const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(audit.unmatchedPublicCards.length,1)
 assert.equal(audit.observedDetails.length,3)
 const extra=audit.observedDetails.find(row=>row.jobId===id);assert.equal(extra.sourceDetailComplete,true);assert.equal(extra.sourceNativeActiveMembershipUnresolved,true)
})

test('Akulaku newly observed final-only posting is retained as an unqualified candidate',async()=>{
 const fixture=reducedBoard({india:true}),last=fixture.cards[1].detailId;let added,audit
 const jobs=await run({fetchPage:async(url,request)=>{const result=await fixture.fetchPage(url,request);if(url.includes('/zpdetail/'+last)&&fixture.visits.get(url)===2)added=fixture.addThirdOriginal();return result},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,2)
 assert.equal(audit.observedDetails.length,3)
 const extra=audit.observedDetails.find(row=>row.jobId===added.detailId);assert.equal(extra.sourceDetailComplete,false);assert.equal(extra.sourceCurrentNativeRoleQualified,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Akulaku preserves differing explicit foreign countries while proving their configured India exclusion',async()=>{
 const fixture=reducedBoard();for(const[url,packet]of fixture.pages)if(url.includes('/alljob/')||url.includes('/zpdetail/'))packet.html=packet.html.replaceAll('广东省-深圳市',url.includes('/alljob/')?'United States':'France');let audit
 const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0)
 assert.equal(audit.observedDetails.length,2)
 assert.ok(audit.observedDetails.every(row=>row.sourceNativeLocationConflict&&row.sourceNativeAllInterpretationsNonIndia))
 assert.equal(audit.countryGaps.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(audit.sourceCompanyWideScopeComplete,false)
})

test('Akulaku rejects invalid UTF8 before native parsing or a further default request',async()=>{
 const original=Buffer.from(page(CORPORATE).html),invalid=Buffer.concat([original,Buffer.from([0xc3,0x28])]);let reads=0
 await assert.rejects(run({fetchImpl:async()=>{reads++;if(reads>1)throw Error('invalid encoding was accepted');const response=new Response(invalid,{status:200});Object.defineProperty(response,'url',{value:CORPORATE});return response}}),error=>error instanceof TypeError&&/encoded data|encoding/i.test(error.message))
 assert.equal(reads,1)
})

test('Akulaku mismatching default final URL cancels the rejected body and request lifetime',async()=>{
 let cancelled=0,requestSignal
 await assert.rejects(run({fetchImpl:async(_url,request)=>{requestSignal=request.signal;return{status:200,url:'https://example.com/',body:{cancel:()=>{cancelled++}}}}}),error=>error.code==='AKULAKU_NATIVE_MODEL')
 assert.equal(cancelled,1);assert.equal(requestSignal.aborted,true)
})

test('Akulaku an audit observer that ignores cancellation is bounded after the complete native reads',async()=>{
 const fixture=reducedBoard();let observed=false
 await assert.rejects(run({collectionBudgetMs:250,fetchPage:fixture.fetchPage,onAudit:()=>{observed=true;return new Promise(()=>{})}}),error=>error.code==='AKULAKU_COLLECTION_TIMEOUT')
 assert.equal(observed,true)
})

test('Akulaku native response provenance hashes the received bytes including an optional UTF8 BOM',async()=>{
 const bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(page(CORPORATE).html)]),stop=Error('stop after original corporate receipt');let reads=0,receipt
 await assert.rejects(run({fetchImpl:async()=>{if(++reads>1)throw stop;const response=new Response(bytes,{status:200});Object.defineProperty(response,'url',{value:CORPORATE});return response},onResponse:value=>{receipt=value}}),error=>error===stop)
 assert.equal(receipt.sha256,createHash('sha256').update(bytes).digest('hex'))
 assert.equal(Buffer.from(receipt.bodyBase64,'base64').compare(bytes),0)
})

test('Akulaku actual Singapore tooltip and full detail resolve their own exact clipped listing prefix',()=>{
 const listing=packets.filter(packet=>packet.url.includes('/alljob/?o=1')).flatMap(packet=>extractJobCards(packet.html)).find(row=>row.detailId==='310592263')
 assert.ok(listing.visibleLocation.endsWith('...'));assert.ok(listing.location.startsWith(listing.visibleLocation.slice(0,-3)))
 const job=detailModel(page(listing.detailUrl).html,listing)
 assert.equal(job.country,'Singapore');assert.equal(job.sourceCountryScopeUnresolved,false);assert.equal(job.sourceNativeListingWorkplaceRendering.kind,'verified-own-field-prefix-truncation')
 const conflict=detailModel(page(listing.detailUrl).html,{...listing,visibleLocation:'India...'})
 assert.equal(conflict.country,null);assert.equal(conflict.sourceCountryScopeUnresolved,true)
})

test('Akulaku additional standalone native country alternatives cannot disappear from India exclusion',async()=>{
 for(const label of['国家','Region','Company workplace country']){
  const fixture=reducedBoard();for(const[url,packet]of fixture.pages)if(url.includes('/alljob/')||url.includes('/zpdetail/'))packet.html=packet.html.replaceAll('广东省-深圳市','France')
  const extra=fixture.pages.get(fixture.cards[0].detailUrl),before=extra.html;extra.html=extra.html.replace('<div class="xiangqingtext">','<ul class="xiangqinglist"><li class="ntitle">'+label+'：</li><li class="nvalue">India</li></ul><div class="xiangqingtext">');assert.notEqual(extra.html,before);let audit
  const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
  assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.countryGaps.length,1)
  assert.ok(audit.observedDetails.find(row=>row.jobId===fixture.cards[0].detailId).sourceNativePublicRoleFields.some(row=>row.label===label&&row.value==='India'))
 }
})

test('Akulaku actual native position category is preserved without relabelling it as a department',()=>{
 const listing=packets.filter(packet=>packet.url.includes('/alljob/?o=1')).flatMap(packet=>extractJobCards(packet.html)).find(row=>row.sourceNativePositionType||row.department)
 assert.ok(listing,'original current typed position cell required')
 const value=listing.sourceNativePositionType||listing.department,job=detailModel(page(listing.detailUrl).html,listing)
 assert.equal(job.department,null);assert.equal(job.sourceNativeListingPositionType,value);assert.ok(job.sourceNativeListingFields.some(row=>row.label==='职位类型'&&row.value===value))
})

test('Akulaku headquarters and qualification countries remain public criteria rather than workplace eligibility gates',async()=>{
 const fixture=reducedBoard();for(const[url,packet]of fixture.pages)if(url.includes('/alljob/')||url.includes('/zpdetail/')){packet.html=packet.html.replaceAll('广东省-深圳市','France');if(url.includes('/zpdetail/'))packet.html=packet.html.replace('<div class="xiangqingtext">','<ul class="xiangqinglist"><li class="ntitle">Company headquarters country：</li><li class="nvalue">India</li><li class="ntitle">Certificate country：</li><li class="nvalue">India</li></ul><div class="xiangqingtext">')}
 let audit;const jobs=await run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(audit.countryGaps.length,0)
 assert.ok(audit.observedDetails.every(row=>row.jobDescription.includes('Company headquarters country：India')&&row.sourceNativeAdditionalWorkplaceFields.length===0))
})
