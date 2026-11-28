import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {qualifyCurrentConsumer} from './currentConsumer20261121.js'
import {currentPublisher} from './currentPublisher20261121.js'
import {runCurrentConfiguredProjection} from './currentConfiguredProjection20261121.js'
import {currentBoard,currentProxy,currentFeed} from './currentCollection20261121.js'

const packet=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-jobs-20261127.json.gz',import.meta.url))))
const original=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const LISTING='https://www.checkout.com/jobs',PROXY='https://ashby-careers-checkout-production.up.railway.app/api/jobs'
const script=[...original.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find(m=>!m[1].trim()&&m[2].includes(PROXY))
assert(script)
const exact=(source,before,after)=>{assert.equal(source.split(before).length,2,'unique captured semantic mutation: '+before.slice(0,80));assert.notEqual(before,after);return source.replace(before,()=>after)}
const programme=edit=>{const changed=edit(script[2]);parse(changed,{ecmaVersion:'latest'});return exact(original,script[2],changed)}
const qualify=html=>qualifyCurrentConsumer(currentPublisher(html,LISTING,packet.observedAt),packet.observedAt,LISTING,PROXY)
const refuse=html=>assert.throws(()=>qualify(html),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')

test('Checkout template fixture preserves the actual current listing body',()=>{
 assert.equal(packet.requestedUrl,LISTING)
 assert.equal(packet.status,200)
 assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),'cb20cddf1845fead94ba5156c04d7eb41f49c7d989629f1cff314ae18db89a0b')
})

test('Checkout current promise consumer preserves raw native records and complete paginated membership without execution',()=>{
 const proof=qualify(original)
 assert.equal(proof.proxyURL,PROXY)
 assert.equal(proof.connected,true)
 assert.equal(proof.defaultUnfiltered,true)
 assert.equal(proof.nativeProgramsExecuted,false)
 assert.deepEqual(proof.sameRecordFields,{id:'id',title:'title',application:'applyUrl'})
 assert.equal(proof.templateConsumer.defaultRenderPageSize,12)
 assert.equal(proof.templateConsumer.loadMorePreservesMembership,true)
 assert.equal(proof.templateConsumer.dummyActive,false)
 assert.equal(proof.templateConsumer.rawRecordsReplaced,false)
 assert.equal(proof.templateConsumer.nativeIdentityRenderedIntoDOM,false)
})

test('Checkout current reviewed AST tolerates source comments and formatting',()=>{
 const changed=programme(s=>'\n// current publication comment\n'+s.replace('  function init() {','  function init(  ) {\n/* layout-neutral */'))
 assert.equal(qualify(changed).defaultUnfiltered,true)
})

for(const[name,edit]of[
 ['uninvoked client closure',s=>exact(s,'  init();\n})();','  init();\n});')],
 ['missing initialization',s=>exact(s,'  init();','  void init;')],
 ['dead proxy request',s=>exact(s,'    fetch(API_URL)','    (false && fetch(API_URL))')],
 ['foreign proxy request',s=>exact(s,PROXY,'https://other.invalid/jobs')],
 ['shadowed native fetch',s=>exact(s,'  function init() {','  function init() { var fetch=function(){ return Promise.resolve({json:function(){return {jobs:[]}}}) };')],
 ['disconnected JSON response',s=>exact(s,'return response.json();','return ({json:function(){return {jobs:[]}}}).json();')],
 ['response decoder changed',s=>exact(s,'return response.json();','return response.text();')],
 ['discarded original jobs',s=>exact(s,'return data.jobs || [];','return [];')],
 ['sliced original jobs',s=>exact(s,'return data.jobs || [];','return (data.jobs || []).slice(1);')],
 ['activated dummy branch',s=>exact(s,"var useDummy = String(root.getAttribute('jobs-dummy')).toLowerCase() === 'true';",'var useDummy = true;')],
 ['fallback jobs after fetch failure',s=>exact(s,'if (!useDummy) throw error;','if (false) throw error;')],
 ['replaced native role ID',s=>exact(s,'state.jobs = useDummy ? jobs.concat(DUMMY_JOBS) : jobs;',"jobs.forEach(function(job){job.id='replaced'});state.jobs = useDummy ? jobs.concat(DUMMY_JOBS) : jobs;")],
 ['replaced application URL',s=>exact(s,'state.jobs = useDummy ? jobs.concat(DUMMY_JOBS) : jobs;',"jobs.forEach(function(job){job.applyUrl='https://other.invalid/apply'});state.jobs = useDummy ? jobs.concat(DUMMY_JOBS) : jobs;")],
 ['nonempty initial search',s=>exact(s,"    search: '',","    search: 'engineer',")],
 ['nonempty initial country set',s=>exact(s,'selected: { locations: new Set(), departments: new Set() }',"selected: { locations: new Set(['India']), departments: new Set() }")],
 ['nonempty URL search fallback',s=>exact(s,"state.search = params.get('search') || '';","state.search = params.get('search') || 'engineer';")],
 ['false role predicate',s=>exact(s,'return matches(job, query);','return false && matches(job, query);')],
 ['replaced application source',s=>exact(s,'var url = safeUrl(job.applyUrl);','var url = safeUrl(job.jobUrl);')],
 ['constant title',s=>exact(s,"renderTitle($('[jobs-job-title]', row), job.title || '');","renderTitle($('[jobs-job-title]', row), 'Different');")],
 ['disconnected role append',s=>exact(s,'fragment.appendChild(createRow(job));','void createRow(job);')],
 ['disconnected fragment append',s=>exact(s,'els.list.appendChild(fragment);','void fragment;')],
 ['wrong page slice',s=>exact(s,'state.filtered.slice(from, to)','state.filtered.slice(from + 1, to)')],
 ['incomplete load more traversal',s=>exact(s,'renderRows(from, state.shown);','renderRows(from + 1, state.shown);')],
 ['no load more callback',s=>exact(s,'      loadMore();','      void loadMore;')],
 ['zero page size',s=>exact(s,'var PAGE_SIZE = 12;','var PAGE_SIZE = 0;')],
 ['runtime source execution attempt',s=>s+'\nthrow new Error("Untrusted script must never execute");']
])test('Checkout current template consumer holds '+name,()=>refuse(programme(edit)))

for(const[name,before,after]of[
 ['dummy markup activation','jobs-dummy="False"','jobs-dummy="True"'],
 ['already initialized markup','jobs-section=""','jobs-section="" jobs-ready=""'],
 ['missing list','jobs-list=""','data-unrelated-list=""'],
 ['missing templates','jobs-templates=""','data-unrelated-templates=""'],
 ['non-anchor row template','<a jobs-job-link=""','<span jobs-job-link=""'],
 ['hidden row template','<a jobs-job-link=""','<a jobs-job-link="" hidden'],
 ['hidden title','jobs-job-title=""','jobs-job-title="" hidden'],
 ['hidden native list','jobs-list=""','jobs-list="" hidden'],
 ['missing load more owner','jobs-load-more=""','data-unrelated-more=""'],
 ['missing location dropdown','jobs-dropdown="locations"','jobs-dropdown="unrelated"'],
 ['injected hidden-list CSS','</head>','<style>[jobs-list]{display:none!important}</style></head>'],
 ['injected hidden-row CSS','</head>','<style>[jobs-job-link]{visibility:hidden}</style></head>'],
])test('Checkout current template consumer holds '+name,()=>refuse(exact(original,before,after)))

for(const[name,source]of[
 ['fetch replacement','window.fetch=()=>null;'],
 ['Response decoder replacement','Response.prototype.json=()=>({jobs:[]});'],
 ['Promise continuation replacement','Promise.prototype.then=function(){return this};'],
 ['Set filter replacement','Set.prototype.has=()=>false;'],
 ['URLSearchParams replacement','URLSearchParams.prototype.getAll=()=>["India"];'],
 ['DOM clone replacement','Node.prototype.cloneNode=function(){return document.createElement("a")};'],
 ['native accessor replacement','window.__defineGetter__("fetch",()=>()=>null);'],
 ['list replacement','document.querySelector("[jobs-list]").textContent="";'],
])for(const placement of['before','after'])test('Checkout current holds '+placement+' client '+name,()=>{
 const inserted='<script>'+source+'</script>'
 refuse(exact(original,script[0],placement==='before'?inserted+script[0]:script[0]+inserted))
})

test('Checkout current template consumer holds a prefixed hidden class inherited above the component',()=>{
 const body=original.match(/<body\b[^>]*>/i)?.[0]
 assert(body)
 const changed=/\bclass="/.test(body)?body.replace('class="','class="component-library-checkout-x-flowninja-2026--hide '):body.replace('<body','<body class="component-library-checkout-x-flowninja-2026--hide"')
 refuse(exact(original,body,changed))
})

const live=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-contradiction-20261127.json.gz',import.meta.url))))
const nativeBody=url=>Buffer.from(live.responses.find(r=>r.url===url).bodyBase64,'base64').toString('utf8')
const HOME='https://www.checkout.com/careers',BOARD='https://jobs.ashbyhq.com/checkout.com',FEED='https://api.ashbyhq.com/posting-api/job-board/checkout.com'
test('Checkout current live capture preserves all five public original response bodies',()=>{
 assert.deepEqual(live.responses.map(r=>r.url),[HOME,LISTING,PROXY,BOARD,FEED])
 let bytes=0
 for(const response of live.responses){const body=Buffer.from(response.bodyBase64,'base64');assert.equal(body.length,response.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),response.bodySha256);assert.equal(response.status,200);assert.equal(response.redirected,false);bytes+=body.length}
 assert.equal(bytes,3277732)
})

test('Checkout repaired current client still holds the captured native title contradiction without certifying zero',async()=>{
 const calls=[]
 let audited=false
 const fetchImpl=async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual')
  const response=live.responses[calls.length]
  assert(response,'Only the five actually captured public GET Responses are available')
  assert.equal(String(url),response.url);calls.push(String(url))
  return Object.defineProperties(new Response(Buffer.from(response.bodyBase64,'base64'),{status:response.status,headers:response.headers}),{url:{value:response.finalUrl},redirected:{value:false}})
 }
 await assert.rejects(runCurrentConfiguredProjection({now:live.capturedAt,requestIntervalMs:0,fetchImpl,onAudit(){audited=true}}),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'&&/own\/native title\/workplace country/.test(error.message))
 assert.deepEqual(calls,[HOME,LISTING,PROXY,BOARD,FEED])
 assert.equal(audited,false)
})

test('Checkout current native payload title and full membership remain separate mandatory checks',()=>{
 const at=live.capturedAt,board=currentBoard(nativeBody(BOARD),at),proxy=currentProxy(nativeBody(PROXY),at),feed=JSON.parse(nativeBody(FEED))
 const id='9ed02abc-5a5b-4db6-887c-121b72505e3e',own=proxy.rows.find(r=>r.id===id),native=feed.jobs.find(r=>r.id===id)
 assert.equal(own.title,'Manager, Events & Experiential Marketing -  18m FTC')
 assert.equal(native.title,'Senior Manager, Events & Experiential Marketing -  18m FTC')
 assert.equal(proxy.rows.length,159)
 assert.equal(feed.jobs.filter(r=>r.isListed).length,158)
 // Isolate the independently observed missing-role obligation after removing
 // only the observed title conflict from this test copy of the native feed.
 const sameTitle=structuredClone(feed)
 sameTitle.jobs.find(r=>r.id===id).title=own.title
 assert.throws(()=>currentFeed(JSON.stringify(sameTitle),board,proxy,at),error=>error.nativeContradiction===true&&/complete own\/native membership/.test(error.message))
})

export {packet,original,LISTING,PROXY,qualify}
