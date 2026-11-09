import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseProvidenceRoleHTML,parseProvidenceListingHTML,parseProvidenceNativeDate,createProvidenceReader,createProvidenceScraper,PROVIDENCE_INDIA_CAREERS_URL} from './currentIndia20261108.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261108/current-owner-fragments.json.gz',import.meta.url))))
// Fragment reassembly is synthetic, not captured page/browser/closing evidence.
const names=['Cybersecurity Product Engineer','Providence','Lead Legal Analyst']
const row=i=>({sourceUrl:fixture.roles[i].sourceURL,title:names[i]})
const html=i=>{const r=fixture.roles[i];return'<!doctype html><html><head>'+r.canonical+'</head><body>'+r.postingOpenTag+r.jobLocation+r.datePosted+(r.validThrough||'')+r.hiringOrganization+'<h1>'+r.title+'</h1>'+r.description+r.applyAnchors.join('')+'</div></body></html>'}
const read=(i=0,body=html(i),now='2026-11-07T19:00:00.000Z')=>parseProvidenceRoleHTML(body,row(i),{now})
for(const i of [0,1])test('genuine passive own IN model '+i+' preserves title/full criteria/Tela',()=>{
 const r=read(i);assert.equal(r.held,false);assert.equal(r.model.title,names[i]);assert.equal(r.model.address.addressCountry,'IN');assert.equal(r.model.address.addressRegion,'Tela');assert.equal(r.model.employer,'Providence');assert.equal(r.model.legalEmployer,null);assert.ok(r.model.descriptionText.length>2000);assert.ok(r.model.descriptionHTML.includes('jobdescription'))
})
test('genuine PK role never becomes India through Hyderabad display',()=>{const r=read(2);assert.equal(r.held,true);assert.equal(r.model.address.addressCountry,'PK');assert.equal(r.model.address.addressLocality,'Hyderabad');assert.equal(r.model.descriptionText.length>1000,true)})
test('internal criteria H1 headings survive title ownership binding',()=>{const r=read(0);assert.ok(r.model.descriptionHTML.includes('<h1>'));assert.ok(r.model.descriptionText.includes('Position Summary'));assert.ok(r.model.descriptionText.includes('Key Responsibilities'))})
for(const [label,change]of[
 ['foreign canonical',h=>h.replace('https://careers.providence.in/job/','https://unrelated.invalid/job/')],
 ['other canonical role',h=>h.replace('/60272944/','/60272945/')],
 ['foreign employer',h=>h.replace('content="Providence"','content="Other Employer"')],
 ['missing own country',h=>h.replace(/<meta\b[^>]*itemprop="addressCountry"[^>]*>/,'')],
 ['duplicate country',h=>h.replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="IN" content="US"')],
 ['extra country microdata',h=>h.replace('</body>','<meta itemprop="addressCountry" content="US"></body>')],
 ['hidden country metadata',h=>h.replace('</head>','<meta hidden name="country" content="US"></head>')],
 ['head employer link',h=>h.replace('</head>','<link itemprop="hiringOrganization" href="https://unrelated.invalid/"></head>')],
 ['compound country data carrier',h=>h.replace('</body>','<div data-work-location-country="US"></div></body>')],
 ['inert second scope',h=>h.replace('</body>','<div inert itemscope itemtype="http://schema.org/JobPosting"></div></body>')],
 ['unknown property',h=>h.replace('</body>','<meta itemprop="unreviewedEmployment" content="unreviewed"></body>')],
 ['hidden criteria',h=>h.replace('</p>','<span hidden>Additional mandatory authored criterion</span></p>')],
 ['unknown criteria style',h=>h.replace('</p>','<span style="display:none">Additional mandatory criterion</span></p>')],
 ['criteria script',h=>h.replace('</p>','<script>unreviewed()</script></p>')],
 ['wrong apply ID',h=>h.replaceAll('/talentcommunity/apply/60272944/','/talentcommunity/apply/60272945/')],
 ['duplicate apply locale',h=>h.replaceAll('?locale=en_US','?locale=en_US&amp;locale=en_GB')],
 ['unknown role metadata attribute',h=>h.replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="IN" data-alpha2-code="US"')],
 ['orphan native schema',h=>h.replace('</body>','<span itemscope itemtype="http://schema.org/Country">US</span></body>')],
])test(label+' cannot silently become a source-qualified role',()=>{assert.throws(()=>read(0,change(html(0))),/Providence India/ )})
test('explicit foreign/unknown own country is raw held evidence',()=>{for(const value of ['US','ZZ','India']){const r=read(0,html(0).replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="'+value+'"'));assert.equal(r.held,true);assert.equal(r.model.address.addressCountry,value)}})
test('single-pass entity projection does not reparse emitted references',()=>{const r=read(0,html(0).replace('</p>',' Literal &amp;bull; &#38;rsquo; &bull; &#8226;.</p>'));assert.ok(r.model.descriptionText.includes('Literal &bull; &rsquo; '+String.fromCodePoint(0x2022)+' '+String.fromCodePoint(0x2022)))})
test('future and expired native dates hold, absent closing date stays null',()=>{assert.equal(read(0,html(0),'2026-11-05T19:00:00.000Z').held,true);assert.equal(read(0,html(0),'2026-12-01T00:00:00.000Z').held,true);assert.equal(read(1).model.closingDate,null)})
test('native UTC calendar requires exact weekday and real date',()=>{
 assert.equal(parseProvidenceNativeDate('Thu Feb 29 02:00:00 UTC 2024'),'2024-02-29T02:00:00.000Z')
 for(const v of ['Thu Feb 29 02:00:00 UTC 2025','Fri Nov 31 02:00:00 UTC 2026','Sat Nov 06 02:00:00 UTC 2026','2026-11-06','Fri Nov 06 24:00:00 UTC 2026',{},''])assert.throws(()=>parseProvidenceNativeDate(v),/Providence India/)
})
test('native listing counts are observations and unknown display country is retained',()=>{
 const body='<html><head>'+fixture.listing.canonical+'</head><body>'+fixture.listing.range+'<table id="searchresults"><tbody>'+fixture.listing.rows.join('')+'</tbody></table></body></html>'
 const r=parseProvidenceListingHTML(body);assert.equal(r.total,80);assert.equal(r.rows.length,15);assert.ok(r.rows.some(x=>x.publicId==='19021344'));assert.equal(r.pages.length,0)
})

test('empty country fails closed with exact whole raw role evidence',()=>{const h=html(0).replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content=""');assert.throws(()=>read(0,h),e=>e.nativeRoleEvidence.rawHTML===h&&e.failureKind==='coverage_gap')})

// Synthetic negative transport controls; none represents a captured denial.
const response=(url,{status=200,body='<html></html>',MIME='text/html',...rest}={})=>({status,url,headers:{get:key=>key==='content-type'?MIME:null},body:typeof body==='string'?new ReadableStream({start(c){c.enqueue(Buffer.from(body));c.close()}}):body,...rest})
const withReader=async(options,action)=>{const r=createProvidenceReader(options);try{return await action(r)}finally{r.close()}}
for(const status of [403,429,500,503])test('typed HTTP '+status+' retains complete raw body and classification',async()=>{
 await withReader({fetchImpl:async u=>response(u,{status,body:'native denial '+status})},async r=>{
  await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e.status===status&&e.softFailure&&e.abortRetries&&e.upstreamOutage&&e.nativeOriginalResponses[0].body==='native denial '+status)
 })
})
test('known denial status survives a body failure and a missing body',async()=>{
 for(const body of [null,new ReadableStream({start(c){c.error(Error('body stream failed'))}})])await withReader({fetchImpl:async u=>response(u,{status:403,body:'',...{body}})},async r=>{await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e.status===403&&e.upstreamOutage===true&&e.softFailure&&e.abortRetries)})
})
for(const status of [301,400,404,406])test('other numeric status '+status+' remains soft without invented outage',async()=>{
 await withReader({fetchImpl:async u=>response(u,{status})},async r=>{await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e.status===status&&e.upstreamOutage===false&&e.softFailure&&e.abortRetries)})
})
test('strict GET identity, manual redirects, omitted credentials and bounded raw response',async()=>{
 await withReader({fetchImpl:async(u,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.deepEqual(init.headers,{Accept:'text/html,application/xhtml+xml'});assert.ok(init.signal instanceof AbortSignal);return response(u)}},async r=>{const v=await r.read(PROVIDENCE_INDIA_CAREERS_URL);assert.equal(v.html,'<html></html>');assert.equal(v.receipt.complete,true);assert.equal(v.receipt.decodedBytes,13);assert.match(v.receipt.bodySHA256,/^[a-f0-9]{64}$/)})
})
test('foreign response URL, MIME and excess body fail with retained raw response',async()=>{
 for(const change of [{url:'https://unrelated.invalid/'},{MIME:'application/json'},{body:'x'.repeat(100)}])await withReader({maxBodyBytes:50,fetchImpl:async u=>response(u,change)},async r=>{await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e.softFailure&&e.abortRetries&&r.receipts.length===1)})
})
test('unapproved route fails before invoking supplied fetch',async()=>{
 let calls=0;await withReader({fetchImpl:async()=>{calls++;throw Error('unexpected')}},async r=>{await assert.rejects(r.read('https://careers.providence.in/talentcommunity/apply/1/?locale=en_US'),/Unapproved/);assert.equal(calls,0)})
})
test('opaque caller reason survives pending headers and known denial body work',async()=>{
 for(const denial of [false,true]){const c=new AbortController(),reason=Object.freeze({nativeCaller:'opaque'});let entered;const ready=new Promise(r=>entered=r)
 const reader=createProvidenceReader({signal:c.signal,fetchImpl:async u=>{entered();return denial?response(u,{status:403,body:'',...{body:new ReadableStream({pull(){return new Promise(()=>{})}})}}):new Promise(()=>{})}})
 try{const p=reader.read(PROVIDENCE_INDIA_CAREERS_URL);await ready;c.abort(reason);await assert.rejects(p,e=>e===reason)}finally{reader.close()}}
})
test('late response is cancelled once after pending-header caller cancellation',async()=>{
 const c=new AbortController(),reason=Object.freeze({cancel:'late'});let resolve,cancels=0
 await withReader({signal:c.signal,fetchImpl:()=>new Promise(r=>resolve=r)},async r=>{const p=r.read(PROVIDENCE_INDIA_CAREERS_URL);c.abort(reason);await assert.rejects(p,e=>e===reason);resolve(response(PROVIDENCE_INDIA_CAREERS_URL,{body:'',...{body:{cancel(){cancels++;return new Promise(()=>{})}}}}));await new Promise(setImmediate);assert.equal(cancels,1)})
})
test('foreign fetch exception identity remains exact and unannotated',async()=>{
 const error=Object.freeze(Error('foreign transport error'));await withReader({fetchImpl:async()=>{throw error}},async r=>{await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e===error);assert.equal(Object.hasOwn(error,'source'),false)})
})
test('monotonic deadline checks cover synchronous fetch and synchronous parsing',async()=>{
 const busy=()=>{const end=performance.now()+35;while(performance.now()<end){}}
 await withReader({sourceTimeoutMs:15,fetchImpl:u=>{busy();return response(u)}},async r=>{await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),/deadline/)})
 await withReader({requestTimeoutMs:15,fetchImpl:async u=>response(u)},async r=>{const v=await r.read(PROVIDENCE_INDIA_CAREERS_URL);assert.throws(()=>r.parse(v,()=>{busy();return true}),/deadline/)})
})
test('request timer cancels stalled body without awaiting uncooperative cleanup',async()=>{
 let cancels=0
 const body={getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancels++;return new Promise(()=>{})}})}
 await withReader({requestTimeoutMs:15,fetchImpl:async u=>response(u,{body})},async r=>{
  await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),/deadline/);assert.equal(cancels,1)
 })
})
test('current factory starts exact India corporate route and preserves native failure audit',async()=>{
 const seen=[];await assert.rejects(createProvidenceScraper({fetchImpl:async u=>{seen.push(u);return response(u,{status:403,body:'controlled denial'})}}).run(),e=>e.status===403&&e.sourceAudit.sourceScopeComplete===false&&e.lifecycleCleanupAllowed===false&&e.nativeOriginalResponses[0].body==='controlled denial');assert.deepEqual(seen,[PROVIDENCE_INDIA_CAREERS_URL])
})

test('raw listing role URL cannot be repaired by URL normalization',()=>{
 const body='<html><head>'+fixture.listing.canonical+'</head><body>'+fixture.listing.range+'<table id="searchresults"><tbody>'+fixture.listing.rows.join('')+'</tbody></table></body></html>'
 assert.throws(()=>parseProvidenceListingHTML(body.replaceAll('/job/','/job/phantom/../')),/Providence India/)
})
test('foreign head property metadata is an unreviewed country carrier',()=>{
 assert.throws(()=>read(0,html(0).replace('</head>','<meta property="og:country" content="US"></head>')),/Providence India/)
})
test('country attributes decode once without promoting nested references',()=>{
 const h=html(0).replace('itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="&amp;#73;N"')
 const r=read(0,h);assert.equal(r.held,true);assert.equal(r.model.address.addressCountry,'&#73;N')
})
test('default and registered factories share India route, legacy Solr is explicit',async()=>{
 const current=await import('./script.js')
 assert.equal(current.createProvidenceScraper,createProvidenceScraper);assert.equal(typeof current.createProvidenceSolrScraper,'function')
 let legacyCalls=0
 const urls=[]
 await assert.rejects(current.run({fetchJson:async()=>{legacyCalls++;return{}},fetchImpl:async u=>{urls.push(u);return response(u,{status:403})}}),e=>e.status===403&&e.sourceScopeComplete===false&&e.lifecycleCleanupAllowed===false)
 assert.deepEqual(urls,[PROVIDENCE_INDIA_CAREERS_URL]);assert.equal(legacyCalls,0)
})

for(const mode of ['aggregate','request'])test('observed numeric403 survives '+mode+' body deadline with its cause',async()=>{
 let bodyStarted=false
 const body={getReader:()=>({read(){bodyStarted=true;return new Promise(()=>{})},cancel(){return Promise.resolve()}})}
 await withReader({sourceTimeoutMs:mode==='aggregate'?20:1000,requestTimeoutMs:mode==='request'?20:1000,fetchImpl:async u=>response(u,{status:403,body})},async r=>{
  await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>bodyStarted&&r.receipts[0].status===403&&e.status===403&&e.failureKind==='blocked'&&e.upstreamOutage===true&&e.cause?.nativeBudgetFailure===true)
 })
})

test('foreign response numeric403 is not promoted to an own native denial',async()=>{
 await withReader({fetchImpl:async()=>response('https://unrelated.invalid/',{status:403})},async r=>{
  await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e.failureKind==='coverage_gap'&&e.status===undefined&&!e.upstreamOutage&&r.receipts[0].status===403&&r.receipts[0].finalURL==='https://unrelated.invalid/')
 })
})
test('invalid numeric HTTP statuses cannot invent upstream classification',async()=>{
 for(const status of [0,99,600,999])await withReader({fetchImpl:async u=>response(u,{status})},async r=>{await assert.rejects(r.read(PROVIDENCE_INDIA_CAREERS_URL),e=>e.failureKind==='coverage_gap'&&e.status===undefined&&!e.upstreamOutage)})
})


// A previous parser invocation does not confer ownership on a supplied fetch
// callback's exception. Synthetic control, using the real exported parser error.
for(const mode of ['sync','rejected'])test('opaque previously owned frozen fetch callback error remains exact '+mode,async()=>{
 let reason
 try{parseProvidenceRoleHTML('<html></html>',{sourceUrl:'https://careers.providence.in/job/Controlled/1/',title:'Controlled'},{now:'2026-11-07T19:00:00.000Z'})}catch(error){reason=Object.freeze(error)}
 assert.ok(reason);const descriptors=Object.getOwnPropertyDescriptors(reason)
 let calls=0,caught
 try{await createProvidenceScraper().run({fetchImpl:()=>{calls++;if(mode==='sync')throw reason;return Promise.reject(reason)}})}catch(error){caught=error}
 assert.equal(caught,reason);assert.equal(calls,1)
 assert.deepEqual(Object.getOwnPropertyDescriptors(reason),descriptors)
 assert.equal(Object.hasOwn(reason,'sourceAudit'),false)
})


// Local-only genuine publisher originals are never embedded in this source,
// fixture or portable delivery. These additional admission checks skip only if
// that explicitly excluded diagnostic evidence is unavailable in another checkout.
const {createHash:profileHash}=await import('node:crypto')
const {readProvidenceAuthorityHTML:readCorporateProfile,PROVIDENCE_INDIA_BOARD_URL:profileBoard}=await import('./currentIndia20261108.js')
const profileNewFile=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-20261108/local-only/001-response.body',import.meta.url)
const profileOldFile=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/first-party-india-handoff-20261107/01.body.local-only',import.meta.url)
const localPublisherProfilesAvailable=fs.existsSync(profileNewFile)&&fs.existsSync(profileOldFile)
const profileSHA=value=>profileHash('sha256').update(value).digest('hex')
const publisherBody=which=>{
 const b=fs.readFileSync(which==='new'?profileNewFile:profileOldFile)
 assert.equal(b.length,which==='new'?850633:850710)
 assert.equal(profileSHA(b),which==='new'?'518cb6591862a1d78e3511848116a05b381706d8065d3d7754d997027c5e2602':'a2d3f701dd38ec218b9ac018f1bbfdda2efbe91c4baa3b84f4d33d1f0857eb67')
 return b.toString('utf8')
}
const profileScript=(body,hash)=>[...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].find(m=>profileSHA(m[1])===hash)
const profileCurrentProgram='0466e7e7fea34a0310b694779ae170429d464b6dce466b32304b858d3bb64cae'
const profileOldProgram='da906c4a4e472448d5959ae4aa060640cd35ae8ab81c0da3369cbcf47624d961'
const profileCSSNew='https://www.providence.in/wp-content/litespeed/css/3fabd0e978c031ea11ad044dda73f32e.css?ver=07e5c'
const profileCSSOld='https://www.providence.in/wp-content/litespeed/css/ace48e898fc947c74d6098cc005a6fb2.css?ver=07e5c'
test('genuine current corporate complete passive profile preserves exact declared board',{skip:!localPublisherProfilesAvailable},()=>{
 const result=readCorporateProfile(publisherBody('new'),PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(result.nextURL,profileBoard);assert.equal(result.bodySHA256,'518cb6591862a1d78e3511848116a05b381706d8065d3d7754d997027c5e2602')
})
test('genuine current corporate profile reaches declared board without invented fallback',{skip:!localPublisherProfilesAvailable},async()=>{
 const reason=Object.freeze({controlledBoard:'not-acquired'}),seen=[]
 await assert.rejects(createProvidenceScraper().run({fetchImpl:async u=>{seen.push(u);if(u===PROVIDENCE_INDIA_CAREERS_URL)return response(u,{body:publisherBody('new')});throw reason}}),e=>e===reason)
 assert.deepEqual(seen,[PROVIDENCE_INDIA_CAREERS_URL,profileBoard])
})
for(const[label,mutate]of[
 ['unknown complete program',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],m[0].replace(m[1],m[1]+'/*unreviewed*/'))}],
 ['unknown stylesheet href',h=>{assert.ok(h.includes(profileCSSNew));return h.replace(profileCSSNew,profileCSSNew.replace('/3fabd','/4fabd'))}],
 ['stylesheet event attribute',h=>{const i=h.indexOf(profileCSSNew);assert.ok(i>=0);const p=h.lastIndexOf('<link',i);return h.slice(0,p)+h.slice(p).replace('<link','<link onload="unreviewed()"')}],
 ['program event attribute',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],m[0].replace('<script','<script onload="unreviewed()"'))}],
 ['hidden passive program',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],m[0].replace('<script','<script hidden'))}],
 ['foreign canonical',h=>h.replace('rel="canonical" href="https://www.providence.in/experienced-professionals/"','rel="canonical" href="https://unrelated.invalid/"')],
 ['event-controlled own handoff',h=>h.replaceAll('href="https://careers.providence.in/"','onclick="unreviewed()" href="https://careers.providence.in/"')],
 ['base authority',h=>h.replace('</head>','<base href="https://unrelated.invalid/"></head>')]
])test('current corporate exact profile refuses '+label,{skip:!localPublisherProfilesAvailable},()=>{
 const h=publisherBody('new'),changed=mutate(h);assert.notEqual(changed,h)
 assert.throws(()=>readCorporateProfile(changed,PROVIDENCE_INDIA_CAREERS_URL),e=>e.softFailure&&e.abortRetries&&e.sourceScopeComplete===false)
})


// Actual C02 proves P1/CSS0 is a third observed complete carrier vector.
// This dated observation superseded a prior exact-vector oracle. Actual C06
// later witnesses the closed seven-literal P0/CSS1 class; two controlled
// historical raw mixes are checked as class positives at the end of this file.
const profileThirdFile=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-02-20261108/local-only/001-response.body',import.meta.url)
const localThirdProfileAvailable=localPublisherProfilesAvailable&&fs.existsSync(profileThirdFile)
const thirdPublisherBody=()=>{
 const b=fs.readFileSync(profileThirdFile)
 assert.equal(b.length,850633);assert.equal(profileSHA(b),'d2b52a1fd9cc0614dc2df5fc82b330c8d032acdf08dd2f91ebd0d27c44a00c32')
 return b.toString('utf8')
}
test('genuine C02 P1 CSS0 corporate vector replaces the prior hybrid-negative oracle',{skip:!localThirdProfileAvailable},()=>{
 const result=readCorporateProfile(thirdPublisherBody(),PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(result.nextURL,profileBoard);assert.equal(result.bodySHA256,'d2b52a1fd9cc0614dc2df5fc82b330c8d032acdf08dd2f91ebd0d27c44a00c32')
})
test('genuine C02 factory advances to exact declared board and preserves opaque next-read reason',{skip:!localThirdProfileAvailable},async()=>{
 const reason=Object.freeze({controlledBoard:'not-acquired-C02'}),seen=[]
 await assert.rejects(createProvidenceScraper().run({fetchImpl:async u=>{seen.push(u);if(u===PROVIDENCE_INDIA_CAREERS_URL)return response(u,{body:thirdPublisherBody()});throw reason}}),e=>e===reason)
 assert.deepEqual(seen,[PROVIDENCE_INDIA_CAREERS_URL,profileBoard])
})
const thirdStylesheetTag=h=>{
 const i=h.indexOf(profileCSSOld);assert.ok(i>=0);const from=h.lastIndexOf('<link',i),to=h.indexOf('>',i)+1
 assert.ok(from>=0&&to>from);return h.slice(from,to)
}
for(const[label,mutate]of[
 ['unknown whole program',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],m[0].replace(m[1],m[1]+'/*unreviewed*/'))}],
 ['program attribute',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],m[0].replace('<script','<script data-unreviewed="true"'))}],
 ['unknown stylesheet URL',h=>h.replace(profileCSSOld,profileCSSOld.replace('/ace48','/bce48'))],
 ['stylesheet attribute',h=>{const tag=thirdStylesheetTag(h);return h.replace(tag,tag.replace('<link','<link media="print"'))}],
 ['passive carrier order',h=>{const tag=thirdStylesheetTag(h);return h.replace(tag,'').replace('<script',tag+'<script')}],
 ['passive program ancestry',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],'<div class="unreviewed-program-parent">'+m[0]+'</div>')}],
 ['hidden program',h=>{const m=profileScript(h,profileCurrentProgram);assert.ok(m);return h.replace(m[0],m[0].replace('<script','<script hidden'))}],
 ['own handoff event',h=>h.replaceAll('href="https://careers.providence.in/"','onclick="unreviewed()" href="https://careers.providence.in/"')],
 ['base authority',h=>h.replace('</head>','<base href="https://unrelated.invalid/"></head>')],
])test('C02 exact third vector refuses '+label,{skip:!localThirdProfileAvailable},()=>{
 const original=thirdPublisherBody(),changed=mutate(original);assert.notEqual(changed,original)
 assert.throws(()=>readCorporateProfile(changed,PROVIDENCE_INDIA_CAREERS_URL),e=>e.softFailure&&e.abortRetries&&e.sourceScopeComplete===false)
})


// Board-only passive data class. Actual private publisher bodies remain excluded
// from portable fixtures/deliveries. Synthetic values below are inert test data.
const {parse:boardParseJavaScript}=await import('acorn')
const boardDataFiles=[new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/first-party-india-handoff-20261107/02.body.local-only',import.meta.url),new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-03-20261108/local-only/002-response.body',import.meta.url)]
const boardDataAvailable=localPublisherProfilesAvailable&&boardDataFiles.every(f=>fs.existsSync(f))
const boardDataBody=(i=1)=>{const b=fs.readFileSync(boardDataFiles[i]);assert.equal(b.length,90843);assert.equal(profileSHA(b),i?'53b48bd34362037bc0619a84b380ed0a7d6ba7305823ca7c845b6c82c4c33157':'fb26b9b63e3c33c5244a31976a72d696921efb1bdb62532da7d97677e00a2cee');return b.toString('utf8')}
const boardDataProgram=(body,i)=>{const hashes=i?['67cf1b1696f640923b59649a7c87b8cc5d6ceb075f2d11abba24169cc1410562','85aeed71b000df46401ffe1d8f02d389152af781a1c1c0c5be6701bb7598d05c']:['c5444b3ae6fbbbc1260936d09a9ed03200cfb6a528acf85dcace6510a07827d6','2cca8aed6fe15bea83162ce88866913e87a16e4f76a2d016331c66077d1e1ffb'];const m=[...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].find(m=>hashes.includes(profileSHA(m[1])));assert.ok(m);return m}
const boardDataLiteral=(body,i)=>{const m=boardDataProgram(body,i),ast=boardParseJavaScript(m[1],{ecmaVersion:'latest'}),paths=i?['body',2,'expression','arguments',0,'properties',1,'value','properties',0,'value']:['body',0,'expression','arguments',0,'body','body',0,'declarations',0,'init'];return{m,literal:paths.reduce((x,k)=>x[k],ast)}}
const boardReplaceLiteral=(body,i,value,rawValue=null)=>{const{m,literal}=boardDataLiteral(body,i),quote=m[1][literal.start],raw=rawValue??quote+value+quote;return body.replace(m[0],m[0].replace(m[1],m[1].slice(0,literal.start)+raw+m[1].slice(literal.end)))}
for(const i of [0,1])test('genuine native board exact data class '+i+' keeps whole search handoff',{skip:!boardDataAvailable},()=>{const b=boardDataBody(i),r=readCorporateProfile(b,profileBoard);assert.equal(r.nextURL,'https://careers.providence.in/search/');assert.equal(r.bodySHA256,profileSHA(b))})
test('genuine C03 board controlled factory advances only to exact search and preserves opaque sentinel',{skip:!boardDataAvailable},async()=>{const seen=[],reason=Object.freeze({controlledUnobservedSearch:'not-acquired-after-C03-board'});await assert.rejects(createProvidenceScraper().run({fetchImpl:async u=>{seen.push(u);if(u===PROVIDENCE_INDIA_CAREERS_URL)return response(u,{body:publisherBody('old')});if(u===profileBoard)return response(u,{body:boardDataBody()});throw reason}}),e=>e===reason);assert.deepEqual(seen,[PROVIDENCE_INDIA_CAREERS_URL,profileBoard,'https://careers.providence.in/search/'])})
test('synthetic typed UUID data changes preserve exact board class without using values',{skip:!boardDataAvailable},()=>{let b=boardReplaceLiteral(boardDataBody(),0,'11111111-2222-4333-8444-555555555555');b=boardReplaceLiteral(b,1,'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');assert.equal(readCorporateProfile(b,profileBoard).nextURL,'https://careers.providence.in/search/')})
for(const [label,mutate]of[
 ['tracking malformed UUID',h=>boardReplaceLiteral(h,0,'not-a-UUID')],
 ['header uppercase UUID',h=>boardReplaceLiteral(h,1,'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')],
 ['tracking wrong UUID version',h=>boardReplaceLiteral(h,0,'11111111-2222-3333-8444-555555555555')],
 ['header wrong UUID variant',h=>boardReplaceLiteral(h,1,'11111111-2222-4333-7444-555555555555')],
 ['tracking escaped data literal',h=>boardReplaceLiteral(h,0,null,"'\\x31'+'1111111-2222-4333-8444-555555555555'")],
 ['tracking used field change',h=>{const m=boardDataProgram(h,0);return h.replace(m[0],m[0].replace('encodeURIComponent(referrer)','encodeURIComponent(ctid)'))}],
 ['header used field change',h=>{const m=boardDataProgram(h,1);return h.replace(m[0],m[0].replace('X-CSRF-Token','X-Other-Token'))}],
 ['extra code',h=>{const m=boardDataProgram(h,0);return h.replace(m[0],m[0].replace(m[1],m[1]+'/*unreviewed*/'))}],
 ['program attribute',h=>{const m=boardDataProgram(h,0);return h.replace(m[0],m[0].replace('<script','<script data-unreviewed="true"'))}],
 ['program event',h=>{const m=boardDataProgram(h,0);return h.replace(m[0],m[0].replace('<script','<script onload="unreviewed()"'))}],
 ['program hidden',h=>{const m=boardDataProgram(h,0);return h.replace(m[0],m[0].replace('<script','<script hidden'))}],
 ['program ancestry',h=>{const m=boardDataProgram(h,0);return h.replace(m[0],'<div class="unreviewed-parent">'+m[0]+'</div>')}],
 ['program order',h=>{const a=boardDataProgram(h,0),b=boardDataProgram(h,1);return h.replace(a[0],'<script data-controlled-order-marker></script>').replace(b[0],a[0]).replace('<script data-controlled-order-marker></script>',b[0])}],
 ['unknown numeric URL',h=>h.replace('/js/override.js?locale=en_US&amp;i=745724182','/js/override.js?locale=en_US&amp;i=745724183')],
 ['third detail URL not admitted to board',h=>h.replace('/js/override.js?locale=en_US&amp;i=745724182','/js/override.js?locale=en_US&amp;i=1008964815')],
 ['override extra query',h=>h.replace('/js/override.js?locale=en_US&amp;i=745724182','/js/override.js?locale=en_US&amp;i=745724182&amp;extra=1')],
 ['override foreign origin',h=>h.replace('/js/override.js?locale=en_US&amp;i=745724182','https://unrelated.invalid/js/override.js?locale=en_US&amp;i=745724182')],
 ['override attribute',h=>h.replace('src="/js/override.js?locale=en_US&amp;i=745724182"','src="/js/override.js?locale=en_US&amp;i=745724182" async')],
 ['event controlled search handoff',h=>h.replaceAll('href="https://careers.providence.in/search/"','onclick="unreviewed()" href="https://careers.providence.in/search/"')],
 ['foreign base',h=>h.replace('</head>','<base href="https://unrelated.invalid/"></head>')]
])test('board data class refuses '+label,{skip:!boardDataAvailable},()=>{const original=boardDataBody(),changed=mutate(original);assert.notEqual(changed,original);assert.throws(()=>readCorporateProfile(changed,profileBoard),e=>e.softFailure&&e.abortRetries&&e.sourceScopeComplete===false)})


// Synthetic query grammar controls. These assembled fragments are not a fresh
// listing, complete workflow, or evidence for additional qualified vacancies.
const typedSearch='https://careers.providence.in/search/'
const typedQuery=typedSearch+'?q=&sortColumn=referencedate&sortDirection=desc&startrow='
const typedListing=()=>'<html><head>'+fixture.listing.canonical+'</head><body>'+fixture.listing.range+'<table id="searchresults"><tbody>'+fixture.listing.rows.join('')+'</tbody></table></body></html>'
test('synthetic exact query-zero uses native query-free canonical',()=>{assert.equal(parseProvidenceListingHTML(typedListing(),typedQuery+'0').start,1)})
for(const [label,url]of[
 ['foreign origin','https://unrelated.invalid/search/'],['wrong path','https://careers.providence.in/other/'],
 ['extra key',typedQuery+'0&other=1'],['duplicate key',typedQuery+'0&q='],['missing key',typedSearch+'?q=&sortColumn=referencedate&startrow=0'],
 ['nonempty search',typedQuery.replace('q=&','q=x&')+'0'],['wrong sort',typedQuery.replace('referencedate','title')+'0'],['ascending',typedQuery.replace('desc','asc')+'0'],
 ['encoded key',typedQuery.replace('q=','%71=')+'0'],['encoded value',typedQuery.replace('desc','%64esc')+'0'],['leading zero',typedQuery+'00'],['exponent',typedQuery+'1e1'],
 ['unsafe integer',typedQuery+'9007199254740992'],['hash',typedQuery+'0#x'],['credentials',typedQuery.replace('https://','https://u@')+'0'],
 ['offset range mismatch',typedQuery+'15'],['trailing question',typedSearch+'?'],
])test('synthetic listing request rejects '+label,()=>{assert.throws(()=>parseProvidenceListingHTML(typedListing(),url),/Providence India/)})
test('synthetic query-bearing canonical is not source authority',()=>{assert.throws(()=>parseProvidenceListingHTML(typedListing().replace('href="'+typedSearch+'"','href="'+typedQuery+'0"'),typedQuery+'0'),/Providence India/)})
const typedCorporateFile=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/native-html-corpus-preparation-02-20261108/local-only/001-response.body',import.meta.url)
test('retained genuine fourth corporate frame keeps exact authority',{skip:!fs.existsSync(typedCorporateFile)},()=>{const b=fs.readFileSync(typedCorporateFile);assert.equal(profileSHA(b),'50d7f26c1315298c86f8a0e67133c48145e696e15961d12416dc5f60eba44dd1');assert.equal(readCorporateProfile(b.toString('utf8'),PROVIDENCE_INDIA_CAREERS_URL).nextURL,profileBoard)})


// Controlled synthetic formatting vectors, never original vacancy criteria.
const formattingBody=markup=>{const original=fixture.roles[0].description,at=original.lastIndexOf('</span>');assert.ok(at>0);const changed=original.slice(0,at)+markup+original.slice(at);return html(0).replace(original,changed)}
for(const style of[
 'margin:0cm 64pt','margin:.5in 24px','margin-left:-9pt','margin-right:0cm','margin-top:0px','margin-bottom:10.661764px','padding:0cm 1pt',
 'font-size:7pt','font-size:20px','font-family:"Arial", sans-serif','font-weight:700.0','color:WindowText','background-color:#fff',
 'border:solid #000 1pt','border-bottom:2.25pt double navy','border-top:medium none currentcolor','border-width:0 1pt 2.25pt thin',
 'border-style:none solid double','border-color:#000 navy white','line-height:105%','line-height:14.266666px','line-height:15pt',
 'list-style-type:disc','font-style:italic','text-align:justify','text-indent:18pt','text-decoration:underline','vertical-align:middle',
 ' color : black ; color:red; color :#000;','font-family:\'Arial Narrow\', "Times New Roman";font-size:12.0px',
])test('synthetic bounded formatting preserves raw declaration '+style,()=>{const mark='<span style="'+style.replaceAll('"','&quot;')+'">CONTROLLED formatting text &amp;bull; and &bull;.</span>',r=read(0,formattingBody(mark));assert.ok(r.model.descriptionHTML.includes(mark));assert.ok(r.model.descriptionText.includes('CONTROLLED formatting text &bull; and '+String.fromCodePoint(0x2022)));assert.equal(r.model.address.addressCountry,'IN');assert.equal(r.model.legalEmployer,null)})
for(const[tag,markup]of[
 ['em','<em>CONTROLLED emphasis criterion text</em>'],['u','<u>CONTROLLED underline criterion text</u>'],
 ['table','<table><thead><tr><td>CONTROLLED first cell</td></tr></thead><tbody><tr><td>CONTROLLED second cell</td></tr></tbody></table>'],
])test('synthetic formatting '+tag+' preserves all authored text and raw relationships',()=>{const r=read(0,formattingBody(markup));assert.ok(r.model.descriptionHTML.includes(markup));if(tag==='table')assert.ok(r.model.descriptionText.includes('CONTROLLED first cell CONTROLLED second cell'))})
for(const style of[
 'display:none','visibility:hidden','opacity:0','font-size:0pt','font-size:21pt','line-height:0','line-height:17.120001px',
 'margin:64in','margin:1cm','margin-left:-9in','margin-left:-0px','margin-right:1in','padding:1in','text-indent:19pt',
 'position:absolute','clip:rect(0,0,0,0)','transform:translateX(-999px)','content:"hidden"','color:transparent','color:rgba(0,0,0,0)',
 'color:var(--x)','font-family:url(x)','color:expression(x)','color:black!important','color:black;garbage','color:black;unknown:x',
 'color:black/**/','color:\\62 lack','color:black\n','@import "x"','--unknown:red','color:{red}','font-family:"A;B"','font-family:"A:B"',
 'font-family:"Arial','font-weight:450','font-weight:700.0000000000000000000001','font-size:20.0000000000000000000001pt','margin:64.900000000000000000000001pt',
])test('synthetic dangerous or unsupported formatting refuses '+JSON.stringify(style),()=>{const markup='<span style="'+style.replaceAll('"','&quot;')+'">CONTROLLED retained text</span>';assert.throws(()=>read(0,formattingBody(markup)),/Providence India/)})
for(const[label,markup]of[
 ['empty unknown semantic','<span data-country="">CONTROLLED</span>'],['foreign semantic','<span data-employer="Other">CONTROLLED</span>'],
 ['hidden','<em hidden>CONTROLLED</em>'],['inert','<u inert>CONTROLLED</u>'],['aria-hidden','<span aria-hidden="true">CONTROLLED</span>'],
 ['event','<table onclick="void 0"><tr><td>CONTROLLED</td></tr></table>'],['duplicate attr','<span style="color:black" style="color:red">CONTROLLED</span>'],
 ['unknown class','<table class="unknown"><tr><td>CONTROLLED</td></tr></table>'],['unknown id','<div id="unknown">CONTROLLED</div>'],
 ['wrong-element formatting','<span align="center">CONTROLLED</span>'],['ordinary unknown href','<a href="https://example.invalid/reference">CONTROLLED</a>'],
 ['credential href','<a href="https://u:p@example.invalid/reference">CONTROLLED</a>'],['application href','<a href="https://example.invalid/apply/">CONTROLLED</a>'],
 ['empty href','<a href="">CONTROLLED</a>'],['missing href','<a>CONTROLLED</a>'],['script','<script>void 0</script>'],['style','<style>span{display:none}</style>'],
 ['form','<form>CONTROLLED</form>'],['iframe','<iframe>CONTROLLED</iframe>'],['embed','<embed src="x">'],['input','<input value="CONTROLLED">'],
 ['comment','<!-- CONTROLLED -->'],['doctype','<!DOCTYPE html>'],['processing instruction','<?controlled?>'],
])test('synthetic unreviewed criteria carrier refuses '+label,()=>assert.throws(()=>read(0,formattingBody(markup)),/Providence India/))

// Current C06 full page is PRIVATE retained evidence, not a portable fixture.
// This ordinary public-parser regression explicitly skips without that original.
import {readProvidenceAuthorityHTML as readC06CorporateAuthority} from './currentIndia20261108.js'
const c06CorporateOriginal=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-06-20261108/local-only/001-response.body',import.meta.url)
test('retained genuine C06 corporate passive fields preserve exact own handoff',{skip:!fs.existsSync(c06CorporateOriginal)},()=>{
 const body=fs.readFileSync(c06CorporateOriginal,'utf8')
 assert.equal(readC06CorporateAuthority(body,PROVIDENCE_INDIA_CAREERS_URL).nextURL,'https://careers.providence.in/')
})

// These two raw mixes are CONTROLLED mutations of retained originals, not
// publisher-issued bodies or proof of nonce/runtime semantics. They match
// actual C06 only after the closed seven-literal data class; every other
// program/carrier byte and selected authority fact remains guarded.
const c06HistoricalClassVectors=[
 ['controlled historical mixed-program vector belongs to witnessed C06 passive class',localPublisherProfilesAvailable,()=>publisherBody('new'),h=>{const old=profileScript(publisherBody('old'),profileOldProgram),current=profileScript(h,profileCurrentProgram);assert.ok(old&&current);return h.replace(current[0],current[0].replace(current[1],old[1]))}],
 ['controlled historical fourth vector belongs to witnessed C06 passive class',localThirdProfileAvailable,thirdPublisherBody,h=>{const old=profileScript(publisherBody('old'),profileOldProgram),current=profileScript(h,profileCurrentProgram);assert.ok(old&&current);return h.replace(current[0],current[0].replace(current[1],old[1])).replace(profileCSSOld,profileCSSNew)}]
]
for(const[name,available,body,mutate]of c06HistoricalClassVectors)test(name,{skip:!available},()=>{
 const original=body(),changed=mutate(original);assert.notEqual(changed,original)
 const result=readCorporateProfile(changed,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(result.nextURL,profileBoard);assert.equal(result.bodySHA256,profileSHA(changed))
})


// C07 is a PRIVATE retained original, never a portable raw-program fixture.
// These ordinary-import tests skip explicitly when that original is absent.
// No program is executed, no URL is requested, and the URL is privacy data only.
import {parse as parseC07PrivacyProgram} from 'acorn'
import {createHash as createC07PrivacyHash} from 'node:crypto'
import {readProvidenceAuthorityHTML as readC07PrivacyAuthority} from './currentIndia20261108.js'
const c07PrivacyOriginal=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-07-20261108/local-only/001-response.body',import.meta.url)
const c07PrivacySHA=value=>createC07PrivacyHash('sha256').update(value).digest('hex')
function c07PrivacyFixture(){
 const bytes=fs.readFileSync(c07PrivacyOriginal)
 assert.equal(bytes.length,850724)
 assert.equal(c07PrivacySHA(bytes),'27e29620537407dbf79168ad1c8721f140b8b1a7416c5ded1a9fff89d5872296')
 const body=bytes.toString('utf8'),matches=[...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
 const selected=matches.filter(m=>c07PrivacySHA(m[1])==='88e5354f837555defa9e21e473c758cc0debda1ac4399944a88f533b02a0efb3')
 assert.equal(selected.length,1,'Unique complete observed program')
 const match=selected[0],program=match[1],programStart=match.index+match[0].indexOf('>')+1
 assert.equal(Buffer.byteLength(program),1445)
 const ast=parseC07PrivacyProgram(program,{ecmaVersion:'latest',sourceType:'script'})
 const site=['body',0,'declarations',0,'init','properties',26,'value','properties',1,'value','properties',2,'value','properties',1,'value']
 const literal=site.reduce((node,key)=>node?.[key],ast)
 assert.equal(literal?.type,'Literal');assert.equal(literal.value,'https://www.providence.in/early-careers/')
 assert.equal(program.slice(literal.start,literal.end),JSON.stringify(literal.value))
 assert.equal(ast.body[0].declarations[0].id.name,'complianz')
 return {body,match,program,programStart,literal}
}
test('retained genuine C07 privacy-config alternative preserves exact corporate handoff',{skip:!fs.existsSync(c07PrivacyOriginal)},()=>{
 const {body}=c07PrivacyFixture()
 const result=readC07PrivacyAuthority(body,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(result.nextURL,'https://careers.providence.in/')
 assert.equal(result.bodySHA256,c07PrivacySHA(body))
})
test('C07 privacy-config class refuses other URLs, use-sites, syntax and carrier layouts',{skip:!fs.existsSync(c07PrivacyOriginal)},()=>{
 const {body,match,program,programStart,literal}=c07PrivacyFixture()
 const replaceProgram=value=>body.slice(0,programStart)+value+body.slice(programStart+program.length)
 const replaceLiteral=value=>replaceProgram(program.slice(0,literal.start)+value+program.slice(literal.end))
 const changedPath=program.replace('privacy-statement-children','unreviewed-privacy-use-site')
 assert.ok(changedPath!==program)
 const openEnd=body.indexOf('>',match.index)
 const changedAttribute=attribute=>body.slice(0,openEnd)+' '+attribute+body.slice(openEnd)
 const cases=[
  ['third own URL',replaceLiteral(JSON.stringify('https://www.providence.in/unreviewed-privacy/'))],
  ['foreign URL',replaceLiteral(JSON.stringify('https://example.invalid/early-careers/'))],
  ['wrong property/use-site',replaceProgram(changedPath)],
  ['single-quote spelling',replaceLiteral("'https://www.providence.in/early-careers/'")],
  ['escaped spelling',replaceLiteral('"https:\\u002f\\u002fwww.providence.in/early-careers/"')],
  ['code instead of data',replaceLiteral('String('+JSON.stringify(literal.value)+')')],
  ['extra program byte',replaceProgram(program+';')],
  ['event attribute',changedAttribute('onload="controlledNegative()"')],
  ['unknown attribute',changedAttribute('data-c07-unreviewed="true"')],
  ['hidden carrier',changedAttribute('hidden')],
  ['changed carrier ancestry',body.slice(0,match.index)+'<div data-c07-unreviewed="true">'+match[0]+'</div>'+body.slice(match.index+match[0].length)]
 ]
 for(const[name,changed]of cases){
  assert.ok(changed!==body,name+' mutation changed the original')
  let reason;try{readC07PrivacyAuthority(changed,PROVIDENCE_INDIA_CAREERS_URL)}catch(error){reason=error}
  assert.ok(reason,name+' must refuse')
  assert.equal(reason.failureKind,'coverage_gap',name)
  assert.equal(reason.softFailure,true,name)
  assert.equal(reason.abortRetries,true,name)
  assert.equal(reason.lifecycleCleanupAllowed,false,name)
 }
})


// C08 raw HTML remains PRIVATE retained evidence, never a portable fixture.
// These ordinary public-factory tests are controlled transport replays, not
// actual default/closing evidence; no downloaded program is ever executed.
const c08ListingRoot=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-08-20261108/local-only/',import.meta.url)
const c08ListingOriginals=['001-response.body','002-response.body','003-response.body'].map(n=>new URL(n,c08ListingRoot))
const c08ListingAvailable=c08ListingOriginals.every(p=>fs.existsSync(p))
function c08ListingFixture(){
 const expected=[
  [850710,'23ef0c57fa384bd60c1d4b41aa4b55a40bbc2ec474767c3b54cfd18bf81376c9'],
  [90843,'046f66e6a27c45d7abdf460973725f74043ba7d370a84d92807fadd716fd684a'],
  [123605,'dcc9a6c38f42643c36f1a9754cb14e0f4fe1afe6b8729fb05b6708ed4370cc9f']
 ]
 const bodies=c08ListingOriginals.map((p,i)=>{const b=fs.readFileSync(p);assert.equal(b.length,expected[i][0]);assert.equal(c07PrivacySHA(b),expected[i][1]);return b.toString('utf8')})
 const page=parseProvidenceListingHTML(bodies[2]);assert.equal(page.rows.length,15);assert.equal(page.total,80)
 const next=[...page.pages].filter(p=>p.offset>0).sort((a,b)=>a.offset-b.offset)[0];assert.ok(next)
 const tags=[...bodies[2].matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].filter(m=>c07PrivacySHA(m[0])==='b2c2eacc7a9c61fab7a72f543852347946c38f30eef6479d9daed1a0f3e28b16')
 assert.equal(tags.length,1,'Unique whole empty observed script tag')
 return {bodies,page,next:next.url,tag:tags[0][0],tagStart:tags[0].index}
}
async function c08ControlledListingReplay(bodies){
 const urls=[PROVIDENCE_INDIA_CAREERS_URL,'https://careers.providence.in/','https://careers.providence.in/search/']
 const byURL=new Map(urls.map((url,i)=>[url,bodies[i]])),seen=[],sentinel=Object.freeze({controlledUnobservedC08Pagination:true})
 let caught
 try{await createProvidenceScraper().run({fetchImpl:async url=>{seen.push(url);if(byURL.has(url))return response(url,{body:byURL.get(url)});throw sentinel}})}catch(reason){caught=reason}
 return {seen,caught,sentinel,urls}
}
test('retained genuine C08 listing alias advances only to exact declared nextpage',{skip:!c08ListingAvailable},async()=>{
 const {bodies,next}=c08ListingFixture()
 const result=await c08ControlledListingReplay(bodies)
 assert.ok(result.caught===result.sentinel,'Preserve exact opaque next-page reason after successful first-page admission')
 assert.deepEqual(result.seen,[...result.urls,next])
})
test('C08 listing alias rejects unknown URL/content/lexical/context variations',{skip:!c08ListingAvailable},async()=>{
 const {bodies,tag,tagStart}=c08ListingFixture(),body=bodies[2],decodedCurrent='/js/override.js?locale=en_US&i=745724182',current='/js/override.js?locale=en_US&amp;i=745724182'
 // Mutate the exact RAW quoted attribute; the parser independently decodes it.
 assert.equal(current.replace('&amp;','&'),decodedCurrent)
 assert.ok(tag.includes(current));assert.ok(tag.endsWith('></script>'))
 const withTag=value=>body.slice(0,tagStart)+value+body.slice(tagStart+tag.length)
 const cases=[
  ['third numeric URI',withTag(tag.replace(current,'/js/override.js?locale=en_US&amp;i=111111111'))],
  ['foreign URI',withTag(tag.replace(current,'https://example.invalid/js/override.js?locale=en_US&amp;i=745724182'))],
  ['wrong pathname',withTag(tag.replace('/js/override.js','/js/unreviewed.js'))],
  ['duplicate src',withTag(tag.replace(' src=',' src="'+current+'" src='))],
  ['event',withTag(tag.replace('<script','<script onload="controlledNegative()"'))],
  ['unknown attribute',withTag(tag.replace('<script','<script data-c08-unreviewed="true"'))],
  ['wrong type',withTag(tag.replace('text/javascript','application/json'))],
  ['nonempty content',withTag(tag.replace('></script>','>void 0</script>'))],
  ['hidden',withTag(tag.replace('<script','<script hidden'))],
  ['different quote',withTag(tag.replace('src="'+current+'"',"src='"+current+"'"))],
  ['changed ancestry',withTag('<div data-c08-unreviewed="true">'+tag+'</div>')],
  ['moved slot',body.slice(0,tagStart)+body.slice(tagStart+tag.length).replace('</body>',tag+'</body>')]
 ]
 for(const[name,changed]of cases){
  assert.ok(changed!==body,name)
  const result=await c08ControlledListingReplay([bodies[0],bodies[1],changed])
  assert.ok(result.caught!==result.sentinel,name+' must refuse before pagination')
  assert.ok(result.caught,name);assert.equal(result.caught.failureKind,'coverage_gap',name)
  assert.equal(result.caught.softFailure,true,name);assert.equal(result.caught.abortRetries,true,name)
  assert.equal(result.caught.lifecycleCleanupAllowed,false,name);assert.deepEqual(result.seen,result.urls,name)
 }
})


// C09 originals remain PRIVATE. This controlled public-factory replay never
// executes downloaded programs and is not default/closing/role recovery proof.
const c09NextpageRoot=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-09-20261108/local-only/',import.meta.url)
const c09NextpageFiles=Array.from({length:6},(_,i)=>new URL(String(i+1).padStart(3,'0')+'-response.body',c09NextpageRoot))
const c09NextpageAvailable=c09NextpageFiles.every(file=>fs.existsSync(file))
test('retained genuine C09 six-response public factory advances only to declared startrow60',{skip:!c09NextpageAvailable},async()=>{
 const expected=[
  [850710,'8994f4a8ac0e1c1a7cac828b16c14b2af78991ab325104082ddb46a47b6a5c3b'],
  [90843,'ebd4d11c86ae3b3c812ab90004f346456ccf980ec45a79fa0b8d5b4ed2a6c3a4'],
  [123605,'df33880b97da2d697fc2b220ff5c85f7d2cb9f79b19f15ffe4deb26627561e17'],
  [123492,'f6de3e328322b7a943084f2cd84e93436ddde2786c23f3c6105a4571a174a83e'],
  [123328,'d86dca6d3c023ed66aba03724e63db50e45fc715c538363b4525fb6ed1f231ed'],
  [123662,'7dd2560b7d41aaf2b8ea790c816f102bd57068651286da99da681b3922be9b12']
 ]
 const bodies=c09NextpageFiles.map((file,i)=>{const bytes=fs.readFileSync(file);assert.equal(bytes.length,expected[i][0]);assert.equal(c07PrivacySHA(bytes),expected[i][1]);return bytes.toString('utf8')})
 const search='https://careers.providence.in/search/',urls=[PROVIDENCE_INDIA_CAREERS_URL,'https://careers.providence.in/',search,...[15,30,45].map(offset=>search+'?q=&sortColumn=referencedate&sortDirection=desc&startrow='+offset)]
 // The ordinary decoder only validates fixture facts/declarations. It does not
 // replace the positive factory's actual passive/authority/admission checks.
 const pages=bodies.slice(2).map((body,i)=>parseProvidenceListingHTML(body,urls[i+2]))
 assert.deepEqual(pages.map(page=>[page.start,page.end,page.total,page.rows.length]),[[1,15,80,15],[16,30,80,15],[31,45,80,15],[46,60,80,15]])
 const next=pages.at(-1).pages.find(page=>page.offset===60);assert.ok(next,'Exact own next-page declaration required')
 assert.equal(next.url,search+'?q=&sortColumn=referencedate&sortDirection=desc&startrow=60')
 const seen=[],inputs=new Map(urls.map((url,i)=>[url,bodies[i]])),reason=Object.freeze({controlledUnobservedC09Pagination:'startrow60-not-captured'})
 let caught
 try{await createProvidenceScraper().run({fetchImpl:async url=>{seen.push(url);if(inputs.has(url))return response(url,{body:inputs.get(url)});if(url===next.url)throw reason;throw Error('Unexpected controlled C09 request')}})}catch(error){caught=error}
 assert.ok(caught===reason,'All six genuine surfaces must pass before exact opaque next-page reason')
 assert.deepEqual(seen,[...urls,next.url])
 assert.deepEqual(Reflect.ownKeys(reason),['controlledUnobservedC09Pagination'])
})

// Only the actual failed sixth body's unique table ancestor is mutated below.
// No passive program, source model, country, criteria or request is rewritten.
function c09AncestorNegativeBodies(body){
 const tables=[...body.matchAll(/<table\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)].filter(m=>/\bid="searchresults"/.test(m[0]))
 assert.equal(tables.length,1,'Unique own searchresults table opening')
 const match=tables[0],opening=match[0]
 assert.equal(c07PrivacySHA(opening),'3db9a8f70800c35f6e1863b040aeea1aaa2754adf016d03498f3a95f62eca34b')
 const labels=[...opening.matchAll(/\baria-label="([^"]*)"/g)]
 assert.equal(labels.length,1,'Unique RAW doublequoted aria-label')
 const rawLabel=labels[0][1]
 assert.equal(rawLabel,'Search results for . Page 4 of 6, Results 46 to 60 of 80')
 assert.deepEqual(rawLabel.match(/\d+/g),['4','6','46','60','80'])
 const rawAttribute='aria-label="'+rawLabel+'"'
 assert.equal(opening.split(rawAttribute).length,2)
 const changed=[
  ['numeric label disagrees with native range',opening.replace(rawAttribute,'aria-label="'+rawLabel.replace('Page 4 of 6, Results 46 to 60','Page 1 of 6, Results 1 to 15')+'"')],
  ['unknown nonnumeric label template',opening.replace(rawAttribute,'aria-label="'+rawLabel.replace('Search results for .','Unreviewed results for .')+'"')],
  ['duplicate raw aria-label',opening.replace(rawAttribute,rawAttribute+' '+rawAttribute)],
  ['another ancestor attribute',opening.replace('<table','<table data-c09-context="unreviewed"')]
 ]
 const bodies=changed.map(([name,tag])=>{
  assert.ok(tag!==opening,name+' must change raw opening bytes')
  const value=body.slice(0,match.index)+tag+body.slice(match.index+opening.length)
  assert.ok(value!==body,name+' must change original body')
  return {name,body:value,opening:tag,openingStart:match.index}
 })
 assert.equal(new Set(bodies.map(x=>c07PrivacySHA(x.body))).size,4,'Four distinct changed bodies')
 return bodies
}

test('C09 listing ancestor rejects four raw label/context changes without losing native facts',{skip:!c09NextpageAvailable},async()=>{
 const hashes=['8994f4a8ac0e1c1a7cac828b16c14b2af78991ab325104082ddb46a47b6a5c3b','ebd4d11c86ae3b3c812ab90004f346456ccf980ec45a79fa0b8d5b4ed2a6c3a4','df33880b97da2d697fc2b220ff5c85f7d2cb9f79b19f15ffe4deb26627561e17','f6de3e328322b7a943084f2cd84e93436ddde2786c23f3c6105a4571a174a83e','d86dca6d3c023ed66aba03724e63db50e45fc715c538363b4525fb6ed1f231ed','7dd2560b7d41aaf2b8ea790c816f102bd57068651286da99da681b3922be9b12']
 const bodies=c09NextpageFiles.map((file,i)=>{const bytes=fs.readFileSync(file);assert.equal(c07PrivacySHA(bytes),hashes[i]);return bytes.toString('utf8')})
 const search='https://careers.providence.in/search/',urls=[PROVIDENCE_INDIA_CAREERS_URL,'https://careers.providence.in/',search,...[15,30,45].map(offset=>search+'?q=&sortColumn=referencedate&sortDirection=desc&startrow='+offset)]
 const baseline=JSON.stringify(parseProvidenceListingHTML(bodies[5],urls[5]))
 for(const mutation of c09AncestorNegativeBodies(bodies[5])){
  // Pagination/ranges/whole rows/page declarations are independent of this
  // accessibility/context carrier in the unchanged exported decoder.
  assert.ok(JSON.stringify(parseProvidenceListingHTML(mutation.body,urls[5]))===baseline,mutation.name+' leaves complete decoded native facts unchanged')
  const inputs=new Map(urls.map((url,i)=>[url,i===5?mutation.body:bodies[i]])),seen=[],sentinel=Object.freeze({controlledUnobservedC09NegativeRead:true})
  let caught
  try{await createProvidenceScraper().run({fetchImpl:async url=>{seen.push(url);if(inputs.has(url))return response(url,{body:inputs.get(url)});throw sentinel}})}catch(error){caught=error}
  assert.ok(caught&&caught!==sentinel,mutation.name+' must refuse before another read')
  assert.equal(caught.failureKind,'coverage_gap',mutation.name);assert.equal(caught.softFailure,true,mutation.name)
  assert.equal(caught.abortRetries,true,mutation.name);assert.equal(caught.lifecycleCleanupAllowed,false,mutation.name)
  assert.deepEqual(seen,urls,mutation.name)
 }
})


// Actual C10 corporate response is private external evidence, not portable data.
// This positive is the normal public factory boundary, never a decoder stand-in.
import {readNativeDocument as readC10AbsenceDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const c10AbsenceFile=new URL('../../../artifacts/scraper-all-repair-2026-11-06/current-providence/default-source-capture-10-20261108/local-only/001-response.body',import.meta.url)
const c10AbsenceAvailable=fs.existsSync(c10AbsenceFile)
const c10AbsenceSkip=c10AbsenceAvailable?false:'private actual C10 corporate response not shipped'
const c10AbsenceBody=()=>{
 const bytes=fs.readFileSync(c10AbsenceFile)
 assert.equal(bytes.length,850633)
 assert.equal(c07PrivacySHA(bytes),'1517b71cc0c25a8db821e0f9c6bbea30ed19acad28f8efe9c25e5cba677cb7e1')
 return bytes.toString('utf8')
}
const c10AbsenceHandoffFacts=body=>{
 const d=readC10AbsenceDocument(body)
 const links=d.nodes(n=>n.tag==='a'&&n.attrs.href===profileBoard)
 assert.equal(profileBoard,'https://careers.providence.in/')
 assert.equal(links.length,2,'Both exact active own board declarations are required')
 const canonicals=d.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))
 assert.equal(canonicals.length,1);assert.equal(canonicals[0].attrs.href,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(d.nodes(n=>n.tag==='base').length,0)
 return JSON.stringify({canonical:canonicals,boardLinks:links})
}
const c10AbsenceMutationBodies=body=>{
 const scripts=[...body.matchAll(/<script\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi)]
 const matches=scripts.filter(m=>c07PrivacySHA(m[2])==='0466e7e7fea34a0310b694779ae170429d464b6dce466b32304b858d3bb64cae')
 assert.equal(matches.length,1,'One exact known1354-byte absent-property program')
 const own=matches[0],index=scripts.indexOf(own),neighbor=scripts[index-1]
 assert.equal(Buffer.byteLength(own[2]),1354);assert.ok(neighbor&&neighbor.index<own.index)
 assert.equal(own[2].includes('privacy-statement-children'),false)
 const replace=(match,value)=>body.slice(0,match.index)+value+body.slice(match.index+match[0].length)
 const rawOpen=own[0].slice(0,own[0].indexOf('>')+1),rawClose=own[0].slice(rawOpen.length+own[2].length)
 const variants=[
  ['unknown one-byte program suffix',replace(own,rawOpen+own[2]+' '+rawClose)],
  ['unknown extra program statement',replace(own,rawOpen+own[2]+';void 0;'+rawClose)],
  ['unknown slot33 attribute',replace(own,own[0].replace('<script','<script data-c10-unreviewed="1"'))],
  ['unknown neighboring carrier attribute',replace(neighbor,neighbor[0].replace('<script','<script data-c10-unreviewed="1"'))],
 ]
 const values=variants.map(([name,changed])=>{assert.notEqual(changed,body,name+' changes actual bytes');return{name,body:changed}})
 assert.equal(new Set(values.map(x=>c07PrivacySHA(x.body))).size,4)
 return values
}
test('actual C10 known absent privacy program public factory reaches only exact declared board opaque boundary',{skip:c10AbsenceSkip},async()=>{
 const body=c10AbsenceBody();c10AbsenceHandoffFacts(body)
 const seen=[],reason=Object.freeze({controlledUnobservedC10Board:'exact-declared-board-not-captured'})
 let caught
 try{await createProvidenceScraper().run({fetchImpl:async url=>{seen.push(url);if(seen.length===1&&url===PROVIDENCE_INDIA_CAREERS_URL)return response(url,{body});if(seen.length===2&&url===profileBoard)throw reason;throw Error('Unexpected controlled C10 request')}})}catch(error){caught=error}
 assert.ok(caught===reason,'Actual complete corporate authority must pass before exact unobserved board reason')
 assert.deepEqual(seen,[PROVIDENCE_INDIA_CAREERS_URL,profileBoard])
 assert.deepEqual(Reflect.ownKeys(reason),['controlledUnobservedC10Board'])
})
test('C10 absent privacy program keeps unknown programs and carrier contexts refused before board',{skip:c10AbsenceSkip},async()=>{
 const body=c10AbsenceBody(),facts=c10AbsenceHandoffFacts(body)
 for(const mutation of c10AbsenceMutationBodies(body)){
  assert.equal(c10AbsenceHandoffFacts(mutation.body),facts,mutation.name+' preserves whole active canonical/board subtrees')
  const seen=[],reason=Object.freeze({unobservedC10NegativeBoard:true});let caught
  try{await createProvidenceScraper().run({fetchImpl:async url=>{seen.push(url);if(seen.length===1&&url===PROVIDENCE_INDIA_CAREERS_URL)return response(url,{body:mutation.body});throw reason}})}catch(error){caught=error}
  assert.ok(caught&&caught!==reason,mutation.name+' must refuse before board')
  assert.equal(caught.failureKind,'coverage_gap');assert.equal(caught.softFailure,true)
  assert.equal(caught.abortRetries,true);assert.equal(caught.lifecycleCleanupAllowed,false)
  assert.deepEqual(seen,[PROVIDENCE_INDIA_CAREERS_URL],mutation.name)
 }
})
