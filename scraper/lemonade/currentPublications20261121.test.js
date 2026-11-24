import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {run} from './script.js'
import {createLemonadeReader,HOME} from './nativeTransport20261121.js'
import {nativeHTMLModel} from './publicationsContract20261121.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publications-20261121.json.gz',import.meta.url))))
const originals=new Map(fixture.responses.map(r=>[r.requestedURL,r]))
const provider=getScraperCatalog().find(r=>r.source==='lemonade')
const response=r=>Object.defineProperty(new Response(Buffer.from(r.bodyBase64,'base64'),{status:r.status,headers:r.headers}),'url',{value:r.finalURL})
const text=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const changed=(r,body)=>({...r,bodyBase64:Buffer.from(body).toString('base64')})
const fake=(mutate=(_url,body)=>body)=>{
 const requests=[]
 return{requests,fetchImpl:async(input,init={})=>{
  const url=String(input instanceof Request?input.url:input);requests.push(url)
  assert.equal(init.method,'GET');assert.equal(init.body??null,null);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  assert.equal(new Headers(init.headers).has('cookie'),false);assert.equal(new Headers(init.headers).has('authorization'),false)
  const row=originals.get(url);assert.ok(row,'No unretained URL may be requested')
  return response(changed(row,mutate(url,text(row),requests.length)))
 }}
}
const direct=(io,options={})=>run({fetchImpl:io.fetchImpl,requestIntervalMs:0,...options})

test('registered default retains the original authored empty public cohort with unknown company scope',async t=>{
 const requests=[]
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input instanceof Request?input.url:input);requests.push(url)
  assert.equal(init.method??'GET','GET');assert.equal(init.body??null,null)
  const r=originals.get(url);assert.ok(r,'Only the three exact original public entities are available')
  return response(r)
 })
 const jobs=await createCatalogScraper(provider).run()
 assert.equal(jobs.length,0)
 assert.deepEqual(requests,['https://www.mylemonade.io/','https://www.mylemonade.io/career/','https://www.mylemonade.io/main.js','https://www.mylemonade.io/','https://www.mylemonade.io/career/','https://www.mylemonade.io/main.js'])
 const native=readSourceObservationEvidence(jobs,'lemonade')
 assert.equal(native?.recordKind,'vacancy-rows');assert.equal(native?.observedRecordCount,0);assert.equal(native?.observedVacancyCount,0)
 assert.equal(native?.sourceScopeComplete,false);assert.equal(native?.companyGlobalTotal,null);assert.equal(native?.companyIndiaTotal,null)
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory?.status,'discovery-only');assert.equal(inventory?.listingComplete,false);assert.equal(inventory?.lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.configuredPublicCohortEmpty,true)
 assert.equal(jobs.nativeCollectionEvidence.wholeModelClosingEqual,true)
})

test('cosmetic colors, SVG geometry, classes and client-local renames do not invalidate the authored cohort',async()=>{
 const io=fake((url,body)=>url.endsWith('main.js')?body.replaceAll('navToggle','renamedToggle').replaceAll('show-menu','opened-menu'):body.replace('class="pb-2"','class="new-decoration" style="color: purple"').replace(/d="M[^"]+"/,'d="M0 0"'))
 const jobs=await direct(io);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.configuredPublicCohortEmpty,true)
})

test('registered default cannot donate an unreviewed thin role through fallback',async t=>{
 const io=fake((url,body)=>url.endsWith('/career/')?body.replace('</body>','<article><h3>New Engineer</h3><p>Bangalore</p><a href="/job/123">Apply now</a></article></body>'):body)
 t.mock.method(globalThis,'fetch',io.fetchImpl)
 await assert.rejects(createCatalogScraper(provider).run())
 assert.equal(io.requests.length,2)
})

test('registered default stops after a native denial without fallback reads',async t=>{
 let requests=0
 t.mock.method(globalThis,'fetch',async url=>{requests++;return Object.defineProperty(new Response('denied',{status:403,headers:{'content-type':'text/html'}}),'url',{value:String(url)})})
 await assert.rejects(createCatalogScraper(provider).run(),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(requests,1)
})

for(const [name,markup]of[
 ['new role','<article><h3>Software Engineer</h3><p>Location: Bangalore</p><a href="/job/123">Apply now</a></article>'],
 ['new authored criterion','<p>Applicants must hold an additional certification.</p>'],
 ['hidden role','<div hidden>Senior Engineer. Applications close tomorrow.</div>'],
 ['template record','<template><article data-native-id="88">Backend Engineer</article></template>'],
 ['structured vacancy','<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>'],
 ['new unlabelled handoff','<a href="https://new-board.example/public">Explore</a>'],
 ['new embedded handoff','<iframe src="https://new-board.example/jobs"></iframe>'],
 ['new application form','<form action="/apply" method="post"><input name="role"></form>'],
 ['new native data','<div data-jobs="[{&quot;id&quot;:1}]" hidden></div>'],
 ['generated criterion','<style>section::before{content:"Applicants need certification"}</style>'],
 ['unknown inline effect','<script>window.location.href="https://new-board.example/jobs"</script>'],
])test(name+' must hold the whole finite cohort',async()=>{
 const io=fake((url,body)=>url.endsWith('/career/')?body.replace('</body>',markup+'</body>'):body)
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(io.requests.length,2)
})

test('changed empty statement is not accepted as an empty cohort',async()=>{
 await assert.rejects(direct(fake((url,body)=>url.endsWith('/career/')?body.replace('no open roles at the moment','Open positions listed below'):body)),/Open Roles cohort changed/)
})

for(const [name,extra]of[
 ['network inventory dataflow','fetch("/jobs")'],
 ['dynamic import','import("./jobs.js")'],
 ['role DOM write','document.querySelector("#roles").innerHTML="Engineer"'],
 ['ambient body-class hiding','document.body.classList.add("hidden")'],
])test('complete declared client rejects '+name,async()=>{
 const io=fake((url,body)=>url.endsWith('/main.js')?body+'\n'+extra:body)
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(io.requests.length,3)
})

test('all raw documents and full models must remain equal at closing',async()=>{
 const io=fake((url,body,n)=>n===6?body+'\n// concurrent UI edit':body)
 await assert.rejects(direct(io),error=>/closing model changed/.test(error.message)&&error.nativeCollectionEvidence.acquisition.requests===6)
})

for(const reason of[Object.freeze({caller:'opaque'}),null]){
 test('caller reason survives synchronous source-controller close: '+String(reason),async()=>{
  const caller=new AbortController(),io=fake(),fetchImpl=async(url,init)=>{
   init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true})
   return io.fetchImpl(url,init)
  }
  let caught=Symbol('not thrown');try{await run({signal:caller.signal,fetchImpl,requestIntervalMs:0})}catch(error){caught=error}
  assert.equal(caught,reason)
 })
 test('caller reason survives a denied-body awaited cleanup: '+String(reason),async()=>{
  const caller=new AbortController();let readers=0,cancelled=false
  const fetchImpl=async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('not allowed')},async cancel(){await new Promise(resolve=>setTimeout(resolve,20));cancelled=true;caller.abort(reason)}}})
  let caught=Symbol('not thrown');try{await run({signal:caller.signal,fetchImpl,requestIntervalMs:0})}catch(error){caught=error}
  assert.equal(caught,reason);assert.equal(readers,0);assert.equal(cancelled,true)
 })
 test('caller reason wins after error audit and source-controller close: '+String(reason),async()=>{
  const caller=new AbortController()
  const fetchImpl=async(url,init)=>{
   init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true})
   return{status:403,url,headers:new Headers({'content-type':'text/html'}),body:{async cancel(){}}}
  }
  let caught=Symbol('not thrown');try{await run({signal:caller.signal,fetchImpl,requestIntervalMs:0})}catch(error){caught=error}
  assert.equal(caught,reason)
 })
}

for(const item of[
 {name:'403',status:403,headers:{'content-type':'text/html'},kind:'blocked_or_access_denied'},
 {name:'429',status:429,headers:{'content-type':'text/html'},kind:'blocked_or_access_denied'},
 {name:'202 challenge',status:202,headers:{'content-type':'text/html','x-amzn-waf-action':'challenge'},kind:'blocked_or_access_denied'},
 {name:'foreign effective URL',status:200,headers:{'content-type':'text/html'},foreign:true,kind:'parser_or_contract_error'},
 {name:'HTML subtype suffix',status:200,headers:{'content-type':'text/html+xml'},kind:'parser_or_contract_error'},
])test('metadata prebody guard: '+item.name,async()=>{
 let readers=0,cancelled=false,requests=0
 const fetchImpl=async url=>{requests++;return{status:item.status,url:item.foreign?'https://foreign.example/':url,headers:new Headers(item.headers),body:{getReader(){readers++;throw Error('must not consume')},async cancel(){await new Promise(resolve=>setTimeout(resolve,5));cancelled=true}}}}
 await assert.rejects(run({fetchImpl,requestIntervalMs:0}),error=>error.failureKind===item.kind)
 assert.equal(readers,0);assert.equal(cancelled,true);assert.equal(requests,1)
})

test('observed HTTP denial survives local source expiry during bounded cleanup',async()=>{
 let cancelled=false
 const fetchImpl=async url=>({status:429,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){throw Error('denied')},async cancel(){await new Promise(resolve=>setTimeout(resolve,35));cancelled=true}}})
 await assert.rejects(run({fetchImpl,requestIntervalMs:0,sourceTimeoutMs:20}),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied')
 assert.equal(cancelled,true)
})

test('a never-settling denied-body cancel is bounded and retains observed HTTP',async()=>{
 const started=performance.now();let readers=0
 const fetchImpl=async url=>({status:429,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('denied')},cancel(){return new Promise(()=>{})}}})
 await assert.rejects(run({fetchImpl,requestIntervalMs:0,sourceTimeoutMs:20}),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied')
 assert.equal(readers,0);assert.ok(performance.now()-started<1800)
})

test('a changed decorative image caption remains authored availability/criteria data',async()=>{
 const io=fake((url,body)=>url.endsWith('/career/')?body.replace('<img ','<img alt="Applications are closed. Additional certification is required." '):body)
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
})

test('late response is disposed and awaited before timeout rejection settles',async()=>{
 let cancelled=false,readers=0
 const fetchImpl=async url=>{await new Promise(resolve=>setTimeout(resolve,25));return{status:200,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('late reader')},async cancel(){await new Promise(resolve=>setTimeout(resolve,10));cancelled=true}}}}
 await assert.rejects(run({fetchImpl,requestIntervalMs:0,requestTimeoutMs:10}),error=>error.name==='TimeoutError')
 assert.equal(cancelled,true);assert.equal(readers,0)
})

test('source deadline during pacing retains its actual TimeoutError',async()=>{
 const io=fake();await assert.rejects(direct(io,{requestIntervalMs:100,sourceTimeoutMs:20}),error=>error.name==='TimeoutError')
 assert.equal(io.requests.length,1)
})

test('caller read cap cannot fabricate a closed empty observation',async()=>{
 const io=fake();await assert.rejects(direct(io,{maxRequests:3}),/excessive public read/);assert.equal(io.requests.length,3)
})

for(const status of[403,429])test('late known '+status+' replaces a local request timeout and retains its receipt',async()=>{
 let readers=0,cancelled=false
 const io=createLemonadeReader({sourceTimeoutMs:500,requestTimeoutMs:10,requestIntervalMs:0,fetchImpl:async url=>{await new Promise(resolve=>setTimeout(resolve,25));return{status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('late denial')},async cancel(){await new Promise(resolve=>setTimeout(resolve,30));cancelled=true}}}}})
 let error;try{await io.read(HOME)}catch(value){error=value}finally{await io.close()}
 assert.equal(error?.status,status);assert.equal(error?.failureKind,'blocked_or_access_denied');assert.equal(io.stats().receipts[0].status,status);assert.equal(io.stats().receipts[0].observedAfterReadOwnershipEnded,true)
 assert.equal(readers,0);assert.equal(cancelled,true)
})

test('late known denial reaches the final source error audit',async()=>{
 const fetchImpl=async url=>{await new Promise(resolve=>setTimeout(resolve,25));return{status:403,url,headers:new Headers({'content-type':'text/html'}),body:{async cancel(){await new Promise(resolve=>setTimeout(resolve,10))}}}}
 await assert.rejects(run({fetchImpl,requestTimeoutMs:10,requestIntervalMs:0}),error=>error.status===403&&error.nativeCollectionEvidence.acquisition.receipts[0].status===403)
})

for(const reason of[Object.freeze({caller:'late-denial'}),null])test('late denial cleanup preserves exact caller '+String(reason),async()=>{
 const caller=new AbortController()
 const fetchImpl=async url=>{await new Promise(resolve=>setTimeout(resolve,25));return{status:429,url,headers:new Headers({'content-type':'text/html'}),body:{async cancel(){await new Promise(resolve=>setTimeout(resolve,10));caller.abort(reason)}}}}
 let error=Symbol('not thrown');try{await run({fetchImpl,signal:caller.signal,requestTimeoutMs:10,requestIntervalMs:0})}catch(value){error=value}
 assert.equal(error,reason)
})

for(const[name,replacement]of[
 ['nested entity','n&amp;#111; open roles at the moment'],
 ['nested entity inside inline node','<span>n&amp;#111;</span> open roles at the moment'],
 ['entity assembled across original text nodes','n<span>&</span><span>#111;</span> open roles at the moment'],
 ['missing inline word boundary','<span>no</span><span>open</span> roles at the moment'],
])test('single-pass availability holds '+name,async()=>{
 const io=fake((url,body)=>url.endsWith('/career/')?body.replace('no open roles at the moment',replacement):body)
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
})

for(const[name,replacement]of[
 ['ordinary numeric entity','n&#111; open roles at the moment'],
 ['real inline word concatenation','n<span>o</span> open roles at the moment'],
])test('single-pass availability accepts '+name,async()=>{
 const io=fake((url,body)=>url.endsWith('/career/')?body.replace('no open roles at the moment',replacement):body)
 const jobs=await direct(io);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.configuredPublicCohortEmpty,true)
})

for(const[name,url,from,to]of[
 ['own Career href',HOME,'href="./career"','href="./care&#x26;#101;r"'],
 ['declared client src',HOME+'career/','src="../main.js"','src="../ma&#x26;#105;n.js"'],
 ['publisher author content',HOME,'content="Lemonade Payments"','content="Lemonade Paym&#x26;#101;nts"'],
 ['publisher author name',HOME,'name="author"','name="a&#x26;#117;thor"'],
])test('single-pass attribute rejects nested '+name,async()=>{
 const io=fake((requested,body)=>{if(requested!==url)return body;assert.ok(body.includes(from));return body.replace(from,to)})
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
})

test('single-pass attribute retains critical style value without decoding a newly exposed reference',()=>{
 const body=text(originals.get(HOME)),from='style="overflow-x: hidden"'
 assert.ok(body.includes(from))
 const model=nativeHTMLModel(body.replace(from,'style="overflow-x: hidden; opacity:0.&#x26;#53;"'),HOME)
 const opacity=model.carriers.flatMap(row=>row.style).find(([key])=>key==='opacity')
 assert.equal(opacity?.[1],'0.&#53')
})

test('single-pass attribute recomputes critical visibility from the owned raw value',()=>{
 const url=HOME+'career/',body=text(originals.get(url)),from='style="color: #2ab34b"'
 assert.ok(body.includes(from))
 const model=nativeHTMLModel(body.replace(from,'aria-hidden="tr&#x26;#117;e" '+from),url)
 const icon=model.carriers.find(row=>row.tag==='i'&&Object.hasOwn(row.attrs,'aria-hidden'))
 assert.equal(icon?.attrs['aria-hidden'],'tr&#117;e');assert.equal(icon?.inert,false)
})

test('single-pass attribute retains all native data carrier values literally after one decode',()=>{
 const url=HOME+'career/',body=text(originals.get(url)),from='style="color: #2ab34b"'
 assert.ok(body.includes(from))
 const model=nativeHTMLModel(body.replace(from,'data-native-note="qualific&#x26;#97;tions" '+from),url)
 const icon=model.carriers.find(row=>Object.hasOwn(row.attrs,'data-native-note'))
 assert.equal(icon?.attrs['data-native-note'],'qualific&#97;tions')
})

test('single-pass attribute accepts equivalent ordinary numeric own authority values',async()=>{
 const io=fake((url,body)=>url===HOME?body.replace('href="./career"','href="./care&#101;r"').replace('content="Lemonade Payments"','content="Lemonade Paym&#101;nts"'):url===HOME+'career/'?body.replace('src="../main.js"','src="../ma&#105;n.js"'):body)
 const jobs=await direct(io);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.configuredPublicCohortEmpty,true)
})

test('single-pass attribute preserves the first native duplicate href owner',async()=>{
 const io=fake((url,body)=>url===HOME?body.replace('href="./career"','href="./career" href="https://foreign.example/jobs"'):body)
 const jobs=await direct(io);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.configuredPublicCohortEmpty,true)
})

test('single-pass attribute cannot donate a later own href over a foreign first owner',async()=>{
 const io=fake((url,body)=>url===HOME?body.replace('href="./career"','href="https://foreign.example/jobs" href="./career"'):body)
 await assert.rejects(direct(io),error=>error.failureKind==='parser_or_contract_error')
})
