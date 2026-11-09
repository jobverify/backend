import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-http-001.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(p=>[p.url,p])),body=url=>packets.get(url)?.body
const API='https://ats.rippling.com/api/v2/board/branch/jobs?groupJobsByLocation=false&page=0&pageSize=1000'
const BOARD='https://ats.rippling.com/branch/jobs',CORP='https://www.branch.io/careers/'
const now=new Date('2026-10-21T00:00:00Z'),native=()=>import('./native.js'),script=()=>import('./script.js')
const next=html=>JSON.parse(html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)[1])
const changed=(html,edit)=>{const value=next(html);edit(value);return html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)[\s\S]*?(<\/script>)/i,(_m,a,b)=>a+JSON.stringify(value).replace(/</g,'\\u003c')+b)}
const capture=async(overrides={},options={})=>{const calls=[];const jobs=await(await script()).run({now,...options,fetchText:async(url,{signal}={})=>{calls.push(url);signal?.throwIfAborted();const value=Object.hasOwn(overrides,url)?overrides[url]:body(url);if(value instanceof Error)throw value;assert.equal(typeof value,'string','Uncaptured '+url);return value}});return{jobs,calls}}
test('exact current corporate client, legal employer and native board establish the Branch Metrics tenant',async()=>{
 const n=await native(),binding=n.parseCorporate(body(CORP));assert.equal(binding.endpoint,API)
 assert.equal(binding.clientUrl,'https://www.branch.io/wp-content/plugins/branch-rippling-careers/assets/js/view.js?ver=1788895891')
 n.validateClient(body(binding.clientUrl));n.validateLegal(body(n.LEGAL_URL));const board=n.parseBoard(body(BOARD))
 assert.equal(board.totalItems,24);assert.equal(board.rows.length,20)
})
test('24 location records reconcile14 unique vacancies and6 India roles with14 native matching full details',async()=>{
 const n=await native(),page=n.parseListing(JSON.parse(body(API)),0),rows=n.mergeListings(page.rows)
 assert.equal(page.totalItems,24);assert.equal(rows.length,14);assert.equal(rows.filter(j=>j.locations.some(l=>l.countryCode==='IN')).length,6)
 for(const row of rows){const detail=n.parseDetail(body(row.sourceUrl),row,{now});assert.ok(detail.sourceDetailComplete);assert.ok(detail.jobDescription.length>100)}
 const{jobs,calls}=await capture();assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.company==='Branch Metrics'&&j.source==='branchmetrics'&&j.country==='India'&&j.sourceDetailComplete===true&&j.sourceNativeRecordCount===24&&j.sourceNativeVacancyCount===14))
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,24);assert.equal(evidence.indiaFacetCount,6)
 assert.equal(calls.filter(url=>/^https:\/\/ats\.rippling\.com\/branch\/jobs\//.test(url)).length,14)
 assert.equal(calls.filter(url=>url===API).length,2)
 assert.ok(jobs.every(j=>j.postingDate.startsWith('2026-')&&j.applyUrl===j.sourceUrl&&j.jobId===j.requisitionId))
})
test('inactive HTML, duplicate attributes and wrong first-party handoffs cannot establish identity',async()=>{
 const n=await native(),html=body(CORP),minimal=`<div class="branch-rippling-careers" data-endpoint="${API}"></div><script src="${n.parseCorporate(html).clientUrl}"></script>`
 for(const tag of ['template','textarea','xmp','iframe','noembed','noframes','noscript','plaintext'])assert.throws(()=>n.parseCorporate(`<${tag}>${minimal}</${tag}>`),tag)
 assert.throws(()=>n.parseCorporate(`<!--${minimal}-->`))
 assert.throws(()=>n.parseCorporate(html.replace('data-endpoint=','data-other= '+ 'data-fake-endpoint=')))
 assert.throws(()=>n.parseCorporate(html.replaceAll('/api/v2/board/branch/jobs','/api/v2/board/other/jobs')))
 assert.throws(()=>n.parseCorporate(html.replace('data-endpoint=','data-endpoint="https://unrelated.example/" data-endpoint=')))
 assert.throws(()=>n.validateClient('/* '+body(n.parseCorporate(html).clientUrl)+' */'))
 assert.throws(()=>n.validateLegal('<script>Branch Metrics, Inc.</script>'))
})
test('native Next JSON must be active, unique, exactly typed and bind the real board tenant',async()=>{
 const n=await native(),html=body(BOARD),minimal='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(next(html)).replace(/</g,'\\u003c')+'</script>'
 for(const tag of ['template','textarea','xmp','iframe','noembed','noframes','noscript','plaintext'])assert.throws(()=>n.parseBoard(`<${tag}>${minimal}</${tag}>`),tag)
 assert.throws(()=>n.parseBoard(`<!--${minimal}-->`));assert.throws(()=>n.parseBoard(html+html))
 for(const edit of [d=>{d.query.jobBoardSlug='other'},d=>{d.isFallback=true},d=>{d.props.pageProps.apiData.jobBoard.isTest='false'},d=>{d.props.pageProps.apiData.jobBoard.isTest=true},d=>{d.props.pageProps.apiData.jobBoard.companyName='Branch'},d=>{d.props.pageProps.apiData.jobBoard.boardURL=BOARD+'/other'},d=>{d.props.pageProps.error='upstream'},d=>{d.props.pageProps.dehydratedState.queries[0].state.status='error'}])assert.throws(()=>n.parseBoard(changed(html,edit)))
})
test('all native row countries and identities validate before India selection; sameID only permits disjoint locations',async()=>{
 const n=await native(),rows=JSON.parse(body(API)).items
 for(const edit of [r=>{r.id=['id']},r=>{r.id=' '+r.id},r=>{r.name={text:r.name}},r=>{r.url=[r.url]},r=>{r.url=r.url.replace('/branch/','/other/')},r=>{r.locations[0].country=['India']},r=>{r.locations[0].countryCode='ZZ'},r=>{r.locations[0].country='Unknown'},r=>{r.locations[0].countryCode='IN'},r=>{r.locations[0].name='Bengaluru, India'}]){const copy=structuredClone(rows);edit(copy[0]);assert.throws(()=>n.mergeListings(copy))}
 assert.throws(()=>n.mergeListings([...rows,structuredClone(rows[0])]))
 const conflict=structuredClone(rows);conflict[1].name='Different job';assert.throws(()=>n.mergeListings(conflict))
})
test('error, malformed and inconsistent API counters cannot certify native zero or completeness',async()=>{
 const n=await native(),base=JSON.parse(body(API))
 for(const edit of [p=>{p.error='failed';p.items=[];p.totalItems=0;p.totalPages=0},p=>{p.success=false},p=>{p.status=500},p=>{p.totalItems='24'},p=>{p.totalPages=2},p=>{p.page=1},p=>{p.pageSize=20},p=>{p.items.pop()},p=>{p.items={}}]){const p=structuredClone(base);edit(p);assert.throws(()=>n.parseListing(p,0))}
 assert.throws(()=>n.parseListing({items:[],page:0,pageSize:1000,totalItems:1,totalPages:1},0))
 assert.equal(n.parseListing({items:[],page:0,pageSize:1000,totalItems:0,totalPages:0},0).totalItems,0)
})
test('full native role identity, public flags, canonical, all locations and actual dates cannot be replaced',async()=>{
 const n=await native(),row=n.mergeListings(JSON.parse(body(API)).items)[0],html=body(row.sourceUrl)
 for(const edit of [d=>{d.query.jobId='bad'},d=>{d.props.pageProps.apiData.jobPost.uuid='bad'},d=>{d.props.pageProps.apiData.jobPost.name='Different'},d=>{d.props.pageProps.apiData.jobPost.companyName='Other'},d=>{d.props.pageProps.apiData.jobPost.unlistedFromSearch=true},d=>{d.props.pageProps.apiData.jobPost.activeJobApplication=null},d=>{d.props.pageProps.apiData.jobPost.url='https://unrelated.example/'},d=>{d.props.pageProps.apiData.jobPost.workLocations=['London, United Kingdom']},d=>{d.props.pageProps.apiData.jobPost.workLocations.push('New York, US')},d=>{d.props.pageProps.apiData.jobPost.createdOn='2099-01-01T00:00:00Z'},d=>{d.props.pageProps.apiData.jobPost.createdOn='2026-02-30T00:00:00Z'},d=>{d.props.pageProps.apiData.jobPost.description.role={text:'changed'}}])assert.throws(()=>n.parseDetail(changed(html,edit),row,{now}))
 assert.throws(()=>n.parseDetail(html.replace(`rel="canonical" href="${row.sourceUrl}"`,'rel="canonical" href="https://unrelated.example/"'),row,{now}))
 const empty=n.parseDetail(changed(html,d=>{d.props.pageProps.apiData.jobPost.description.role='<script>invented role</script>'}),row,{now});assert.equal(empty.jobDescription,'');assert.equal(empty.sourceDetailComplete,false);assert.equal(empty.sourceDetailFailureKind,'missing-content')
})
test('missing full details and transport/identity failures retain positive roles but protect reconciliation',async()=>{
 const n=await native(),row=n.mergeListings(JSON.parse(body(API)).items).find(r=>r.locations.some(l=>l.countryCode==='IN'))
 for(const value of [new Error('HTTP503'),changed(body(row.sourceUrl),d=>{d.props.pageProps.apiData.jobPost.uuid='wrong'}),changed(body(row.sourceUrl),d=>{d.props.pageProps.apiData.jobPost.description.role=''})]){
  const{jobs}=await capture({[row.sourceUrl]:value});assert.equal(jobs.length,6);assert.ok(jobs.every(j=>j.sourceListingComplete===false));assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,5)
 }
})
test('caps, terminal drift and final-feed drift never acquire complete inventory evidence',async()=>{
 const{jobs}=await capture({}, {maxJobs:1});assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[0].sourceListingComplete,false)
 const terminal=API.replace('page=0','page=1'),bad=JSON.parse(body(terminal));bad.totalItems++
 await assert.rejects(capture({[terminal]:JSON.stringify(bad)}))
 let calls=0;await assert.rejects((await script()).run({now,fetchText:async url=>{if(url===API&&++calls===2){const p=JSON.parse(body(API));p.items[0].name='changed';return JSON.stringify(p)}return body(url)}}))
 await assert.rejects(capture({}, {maxPages:0}));await assert.rejects(capture({}, {maxJobs:0}))
})
test('caller abort remains abort even when injected transport ignores its signal',async()=>{
 const controller=new AbortController();controller.abort(new Error('caller stop'))
 await assert.rejects(capture({}, {signal:controller.signal}),/caller stop/)
 const later=new AbortController();await assert.rejects((await script()).run({now,signal:later.signal,fetchText:async url=>{later.abort(new Error('transport stop'));return body(url)}}),/transport stop/)
})
test('default transport requires exact HTTP200, exactURL and anonymous public fetch',async t=>{
 const mod=await script();for(const status of [202,206,403]){t.mock.method(globalThis,'fetch',async()=>({status,url:CORP,text:async()=>body(CORP)}));await assert.rejects(mod.run({now}),/HTTP/);t.mock.restoreAll()}
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(options.credentials,'omit');return{status:200,url:CORP+'?redirected=1',text:async()=>body(CORP)}})
 await assert.rejects(mod.run({now}),/HTTP|redirect/)
})
test('explicit India cannot hide an explicit foreign country inside the same native label',async()=>{
 const n=await native(),rows=JSON.parse(body(API)).items
 rows[1].locations[0].name='Bengaluru, United States, India'
 assert.throws(()=>n.mergeListings(rows))
})
test('rendered role heading cannot disagree with the native listing and data title',async()=>{
 const n=await native(),row=n.mergeListings(JSON.parse(body(API)).items)[0]
 const html=body(row.sourceUrl).replace(/(<h2\b[^>]*>)[\s\S]*?(<\/h2>)/i,'$1Unrelated vacancy$2')
 assert.notEqual(html,body(row.sourceUrl))
 assert.throws(()=>n.parseDetail(html,row,{now}))
})
test('additional native closed and unpublished flags are never ignored',async()=>{
 const n=await native(),row=n.mergeListings(JSON.parse(body(API)).items)[0],html=body(row.sourceUrl)
 for(const edit of [d=>{d.props.pageProps.apiData.jobPost.published=false},d=>{d.props.pageProps.apiData.jobPost.closed=true}])assert.throws(()=>n.parseDetail(changed(html,edit),row,{now}))
})
test('inventory must reconcile again after all native details, so concurrent changes cannot be hidden',async()=>{
 let detailsSeen=false
 await assert.rejects((await script()).run({now,fetchText:async url=>{
  if(url.startsWith(BOARD+'/'))detailsSeen=true
  if(url===API&&detailsSeen){const payload=JSON.parse(body(API));payload.items[0].name='Vacancy changed during details';return JSON.stringify(payload)}
  return body(url)
 }}))
})
test('catalog selects the source-local Branch Metrics implementation and leaves ambiguous Branch separate',async()=>{
 const{getScraperCatalog}=await import('../../scraper-support/providers/index.js'),catalog=getScraperCatalog(),provider=catalog.find(p=>p.source==='branchmetrics'),ambiguous=catalog.find(p=>p.source==='branch')
 assert.match(provider.modulePath,/[\\/]scraper[\\/]branchmetrics[\\/]script\.js$/)
 assert.equal(provider.companyName,'Branch Metrics');assert.equal(provider.atsPlatform,'rippling');assert.equal(provider.zeroResultPolicy,'evidence-required')
 assert.equal(provider.companyDomain,'branch.io');assert.equal(provider.companyCareerPage,CORP)
 assert.match(ambiguous.modulePath,/[\\/]scraper[\\/]branch[\\/]script\.js$/);assert.equal(ambiguous.atsPlatform,'runtime-first-party-recruitment')
 assert.notEqual(ambiguous.source,provider.source)
 assert.equal(ambiguous.boardIdentityVerified,false);assert.equal(ambiguous.sourceScopeComplete,false);assert.equal(ambiguous.lifecycleCleanupAllowed,false)
})
