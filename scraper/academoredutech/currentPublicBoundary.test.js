import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as academor} from './script.js'
import {run as amaze} from '../amazecodes/script.js'
import {inspectConfiguredLinkedInSearch} from './currentPublic.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/current-public-20261103.json.gz',import.meta.url))))
const pageReader=(source,change=page=>page)=>{const f=fixture(source);return async url=>{const row=f.responses.find(row=>row.url===url);assert.ok(row,'Only original configured URL');return change({url:row.finalURL,status:row.status,html:row.body})}}

test('checked collapsed native company filter is request state; disabled or unowned controls cannot bind an employer query',()=>{
 const body=fixture('amazecodes').responses.find(row=>row.kind==='original-configured-public-india-search').body,tag=body.match(/<input\b[^>]*name="f_C"[^>]*>/)[0]
 assert.equal(inspectConfiguredLinkedInSearch('amazecodes',body).employerFilterBound,true)
 for(const replacement of[tag.replace(/\schecked(?:="[^"]*")?(?=\s|>)/,''),tag.replace('form="jserp-filters"','form="unrelated-form"'),'<fieldset disabled>'+tag+'</fieldset>']){assert.notEqual(replacement,tag);assert.equal(inspectConfiguredLinkedInSearch('amazecodes',body.replace(tag,replacement)).employerFilterBound,false)}
})

test('source-local current native profile does not borrow a related organization ID',async()=>{
 let calls=0
 await assert.rejects(academor({fetchPage:async url=>{calls++;return{url,status:200,html:fixture('academoredutech').responses[0].body.replaceAll('82553226','9482063')}}}),/organization ID/)
 assert.equal(calls,1)
})

test('current native keyword-search cards are retained as unqualified data and cannot turn into unrelated employer jobs',async()=>{
 const calls=[];let audit
 await assert.rejects(amaze({fetchPage:async(url,options)=>{calls.push(url);const page=await pageReader('amazecodes')(url,options);return url.includes('/jobs/search/')?{...page,html:page.html.replace('</body>','<div class="job-search-card" data-entity-urn="urn:li:jobPosting:999"><h3>Unrelated Engineer</h3><p>Other Employer; India</p></div></body>')}:page},onAudit:value=>{audit=value}}),/cards require a reviewed vacancy collector/)
 assert.equal(calls.length,4);assert.equal(audit.configuredSearch.unqualifiedNativeCards[0].nativePostingId,'999');assert.equal(audit.inventoryEvidence.reportedTotal,null)
})

test('closing public role announcement edits are held without changing native original dates or publishing the stale text',async()=>{
 let profiles=0
 await assert.rejects(amaze({fetchPage:pageReader('amazecodes',page=>!page.url.includes('/jobs/search/')&&++profiles===2?{...page,html:page.html.replaceAll('XM Cloud','New publisher requirement')}:page)}),/closing native.*changed/)
})

test('closing native announcement order alone does not change employer identity or its retained criteria set',async()=>{
 let reads=0
 const fetchPage=pageReader('amazecodes',page=>{
  if(page.url.includes('/jobs/search/')||++reads!==2)return page
  const match=page.html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)
  assert.ok(match);const value=JSON.parse(match[1]),posts=value['@graph'].filter(row=>row['@type']==='SocialMediaPosting'),other=value['@graph'].filter(row=>row['@type']!=='SocialMediaPosting')
  value['@graph']=[...other,...posts.reverse()];return{...page,html:page.html.replace(match[1],JSON.stringify(value))}
 })
 let audit;await amaze({fetchPage,onAudit:value=>{audit=value}});assert.equal(audit.closingReconciled,true);assert.equal(audit.nativeAnnouncements.length,4)
})

test('current caller cancellation preserves original signal and opaque reason through an ignored supplied reader',async()=>{
 const controller=new AbortController(),reason={cancelledGuest:true};let seen
 await assert.rejects(academor({signal:controller.signal,fetchPage:(_url,options)=>{seen=options.signal;controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
 assert.equal(seen,controller.signal)
})

test('current observer rejection identity and ignored observer lifetime stay bounded',async()=>{
 const error=Error('observer rejected')
 await assert.rejects(academor({fetchPage:pageReader('academoredutech'),onAudit:async()=>{throw error}}),caught=>caught===error)
 let entered=false
 await assert.rejects(academor({collectionBudgetMs:250,fetchPage:pageReader('academoredutech'),onAudit:()=>{entered=true;return new Promise(()=>{})}}),error=>error.name==='TimeoutError')
 assert.equal(entered,true)
})

test('current default denial retains status/retry metadata and never waits for a denied body or cancellation',async()=>{
 let calls=0,reads=0,cancels=0
 await assert.rejects(academor({fetchImpl:async url=>{calls++;return{url,status:429,headers:new Headers({'retry-after':'90'}),body:{cancel:()=>{cancels++;return new Promise(()=>{})}},text:()=>{reads++;return new Promise(()=>{})}}}}),error=>error.status===429&&error.retryDelayMs===90000&&error.abortRetries===true&&error.inventoryEvidence.reportedTotal===null)
 assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancels,1)
})

test('default and supplied current response bodies enforce the same source bound',async()=>{
 const oversized='x'.repeat(4*1024*1024+1)
 for(const options of[{fetchPage:async url=>({url,status:200,html:oversized})},{fetchImpl:async url=>({url,status:200,headers:new Headers(),text:async()=>oversized})}])await assert.rejects(academor(options),/byte bound/)
})

test('source audit receipts exclude raw HTML/login configuration while preserving all native announcement text',async()=>{
 let audit;await amaze({fetchPage:pageReader('amazecodes'),onAudit:value=>{audit=value}})
 assert.ok(audit.publicPages.every(page=>!Object.hasOwn(page,'html')));assert.equal(JSON.stringify(audit).includes('csrfToken'),false)
 assert.equal(audit.nativeAnnouncements.find(row=>row.hiringSignal).originalText.includes('Content Serialization'),true)
})
