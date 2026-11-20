import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {document as sourceDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createSwymScraper} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-configured-board-final-20261120.json.gz',import.meta.url)))),HOME='https://www.getswym.com/',CAREERS=HOME+'careers',BOARD='https://wellfound.com/company/swym/jobs',text=p=>Buffer.from(p.bodyBase64,'base64').toString()
const stateEdit=(html,fn)=>{const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__');assert.equal(scripts.length,1);const m=JSON.parse(scripts[0].raw);fn(m);return html.replace(scripts[0].raw,JSON.stringify(m).replace(/</g,'\\u003c'))},cache=m=>m.props.pageProps.apolloState.data,target=m=>{const c=cache(m),ref=c.ROOT_QUERY['startup({"slug":"swym"})'].__ref;return c[ref]},connection=m=>Object.keys(target(m)).find(k=>k.startsWith('jobListingsConnection('))
async function replay(change,options={}){const counts=new Map(),calls=[];let mutationError,changes=0;const fetchImpl=async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const n=counts.get(url)??0;counts.set(url,n+1);const p=fixture.responses.filter(p=>p.requestedUrl===url)[n];assert(p,'Only genuine exact current URLs '+url+' #'+n);let m;try{m=change?.(text(p),url,n)??{};if(Object.keys(m).length)changes++}catch(error){mutationError=error;throw error}calls.push({url,n});return Object.defineProperties(new Response(m.originalBytes??Buffer.from(m.body??text(p)),{status:m.status??p.status,headers:m.headers??p.headers}),{url:{value:m.url??p.url},redirected:{value:m.redirected??false}})};const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No live/default IO in captured original Response replay')};try{const jobs=await createSwymScraper().run({fetchImpl,now:fixture.observedAt,requestIntervalMs:0,...options});if(mutationError)throw mutationError;if(change)assert(changes,'Actual guarded mutation applied');return{jobs,calls,audit:jobs.nativeCollectionEvidence}}finally{globalThis.fetch=original}}
const nativeChange=fn=>(h,u,n)=>u===BOARD&&n===1?{body:stateEdit(h,fn)}:null
test('all ten genuine current own/native/delegated-alias response bytes and hashes verify',()=>{assert.equal(fixture.responses.length,10);for(const p of fixture.responses){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256)}})
test('current own declared unfiltered company board native and SSR empty qualifies only configured-board zero',async()=>{const r=await replay(),e=readInventoryEvidence(r.jobs);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,10);assert.equal(r.audit.configuredBoardClosingQualified,true);assert.equal(r.audit.companyIndiaTotal,null);assert.equal(r.audit.companyGlobalTotal,null);assert.equal(r.audit.sourceScopeComplete,false);assert.equal(r.audit.lifecycleCleanupAllowed,false);assert.equal(r.audit.originalResponses.length,10);assert.equal(e.status,'complete-inventory');assert.equal(e.listingComplete,true);assert.equal(e.indiaFacetCount,null);assert.equal(e.lifecycleCleanupAllowed,false);assert(r.audit.openingBoard.otherEmployerRecommendations.length>0);assert.equal(r.audit.openingBoard.nativeCompanyBacklink.qualifiedCurrentPublisher,true)})
for(const[name,edit]of[
 ['positive current native live job count',m=>{target(m).liveJobListingsCount=1}],
 ['native count unknown',m=>{delete target(m).liveJobListingsCount}],
 ['native hidden premium jobs',m=>{target(m).hasPremiumJobs=true}],
 ['native hiring becomes true',m=>{target(m).hiring=true}],
 ['native unpublished company',m=>{target(m).published=false}],
 ['native non-public company',m=>{target(m).public=false}],
 ['native quarantined company',m=>{target(m).quarantined=true}],
 ['native different company name',m=>{target(m).name='Other Employer'}],
 ['native different company slug',m=>{target(m).slug='other-employer'}],
 ['native current fallback loader',m=>{m.isFallback=true}],
 ['native current query slug differs',m=>{m.query.slug='other-employer'}],
 ['native multiple unknown result pages',m=>{target(m)[connection(m)].totalPageCount=2}],
 ['native unknown reported page size',m=>{target(m)[connection(m)].pageSize=null}],
 ['native positive own connection edge',m=>{target(m)[connection(m)].edges=[{__typename:'JobListingEdge',node:{__ref:'JobListing:123'}}]}],
 ['native positive role facet',m=>{target(m).jobListingCounts.roles=[{name:'Engineer',count:1}]}],
 ['native known job connection has country filter',m=>{const t=target(m),k=connection(m),a=JSON.parse(k.slice('jobListingsConnection('.length,-1));a.filters.locationIds=['India'];t['jobListingsConnection('+JSON.stringify(a)+')']=t[k];delete t[k]}],
 ['native known job connection starts after first page',m=>{const t=target(m),k=connection(m),a=JSON.parse(k.slice('jobListingsConnection('.length,-1));a.after='MQ==';t['jobListingsConnection('+JSON.stringify(a)+')']=t[k];delete t[k]}],
 ['native related job actually belongs to current employer',m=>{const c=cache(m),job=Object.values(c).find(v=>v?.__typename==='JobListing');job.startup=c.ROOT_QUERY['startup({"slug":"swym"})']}],
])test(name+' cannot qualify empty configured collection',async()=>{await assert.rejects(()=>replay(nativeChange(edit)),error=>error.failureKind==='parser_or_contract_error')})
test('new same-role job collection carrier remains held when current semantics unqualified',async()=>{await assert.rejects(()=>replay(nativeChange(m=>{target(m).externalJobListings=[{id:'new-current-role'}]})),e=>e.failureKind==='parser_or_contract_error')})
test('harmless own UI copy revisions and unrelated recommendation changes preserve scoped zero',async()=>{const r=await replay((h,u,n)=>n===1?{body:u===BOARD?stateEdit(h,m=>{target(m).highConcept='Current revised company marketing copy';const j=Object.values(cache(m)).find(v=>v?.__typename==='JobListing');j.title='Revised other employer recommendation'}):h+'<!-- harmless current own copy release -->'}:null);assert.equal(r.jobs.length,0);assert.equal(r.audit.configuredBoardClosingQualified,true)})
test('current native account identity is derived dynamically rather than frozen historical integer',async()=>{const r=await replay((h,u)=>u===BOARD?{body:h.replaceAll('173721','173722')}:null);assert.equal(r.jobs.length,0);assert.equal(r.audit.openingBoard.nativeCompanyId,'173722')})
test('complete200 malformed canonical is explicitly a parser contradiction',async()=>{await assert.rejects(()=>replay((h,u,n)=>{if(u!==BOARD||n!==1)return null;const body=h.replace(/(<link\b(?=[^>]*\brel="canonical")(?=[^>]*\bhref=")[^>]*\bhref=")[^"]+/, '$1http://[');assert.notEqual(body,h,'Actual canonical field mutated');return{body}}),e=>e.failureKind==='parser_or_contract_error')})
test('active SSR positive job count contradicts native zero',async()=>{await assert.rejects(()=>replay((h,u,n)=>{if(u!==BOARD||n!==1)return null;const anchor=[...h.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].find(m=>{const d=readNativeDocument(m[0]);return d.text(d.nodes(n=>n.tag==='a')[0])==='View 0 jobs'});assert(anchor,'Actual native View 0 job link');return{body:h.replace(anchor[0],anchor[0].slice(0,anchor[0].indexOf('>')+1)+'View 1 jobs</a>')}}),e=>e.failureKind==='parser_or_contract_error')})
test('own current application link outside native model refuses configured zero',async()=>{await assert.rejects(()=>replay((h,u,n)=>u===BOARD&&n===1?{body:h.replace('</h4>','</h4><a href="/jobs/123-new-role">New role</a>')}:null),e=>e.failureKind==='parser_or_contract_error')})
test('current own careers must still declare the same board',async()=>{await assert.rejects(()=>replay((h,u,n)=>u===CAREERS&&n===1?{body:h.replaceAll(BOARD,'https://wellfound.com/company/other/jobs')}:null),e=>e.failureKind==='parser_or_contract_error')})
test('native company backlink to an unrelated company refuses configured zero',async()=>{await assert.rejects(()=>replay(nativeChange(m=>{target(m).companyUrl='https://unrelated.invalid/';target(m).domain='unrelated.invalid'})),e=>e.failureKind==='parser_or_contract_error')})
test('native declared company alias must return to current publisher without foreign redirect',async()=>{await assert.rejects(()=>replay((h,u,n)=>u==='https://swym.it/'&&n===1?{headers:{'content-type':'text/html',location:'https://unrelated.invalid/'}}:null),e=>e.failureKind==='parser_or_contract_error')})
test('current native empty board owner cannot be explicitly unpublished',async()=>{await assert.rejects(()=>replay((h,u,n)=>u===BOARD&&n===1?{body:h.replace('data-test="JobsTab"','data-test="JobsTab" data-is-published="false"')}:null),e=>e.failureKind==='parser_or_contract_error')})
for(const[name,edit]of[
 ['native additional unknown next-page info',m=>{target(m)[connection(m)].pageInfo={hasNextPage:true}}],
 ['native contradictory totalCount despite empty edges',m=>{target(m)[connection(m)].totalCount=1}],
 ['native new positive totalJobs carrier',m=>{target(m).totalJobs=1}],
 ['native hidden current job section',m=>{target(m).hiddenSections=['JOBS']}],
])test(name+' refuses configured zero',async()=>{await assert.rejects(()=>replay(nativeChange(edit)),e=>e.failureKind==='parser_or_contract_error')})
test('actual empty-message owner cannot be explicitly disabled',async()=>{await assert.rejects(()=>replay((h,u,n)=>{if(u!==BOARD||n!==1)return null;const body=h.replace(/(<h4\b[^>]*)(>)/, '$1 aria-disabled="true"$2');assert.notEqual(body,h);return{body}}),e=>e.failureKind==='parser_or_contract_error')})
test('unknown absolute own job URL contradicts empty configured board',async()=>{await assert.rejects(()=>replay((h,u,n)=>u===BOARD&&n===1?{body:h.replace('</h4>','</h4><a href="https://wellfound.com/jobs/123-new-role">New role</a>')}:null),e=>e.failureKind==='parser_or_contract_error')})
test('coherent absolute URL for known other-employer recommendation remains unrelated',async()=>{const r=await replay((h,u,n)=>u===BOARD&&n===1?{body:h.replace(/href="(\/jobs\/\d[^\"]*)"/g,'href="https://wellfound.com$1"')}:null);assert.equal(r.audit.configuredBoardClosingQualified,true)})
test('account identity must remain reconciled across the two current observations',async()=>{await assert.rejects(()=>replay((h,u,n)=>u===BOARD&&n===1?{body:h.replaceAll('173721','173722')}:null),e=>e.failureKind==='parser_or_contract_error')})
test('original redirected metadata cannot establish current source',async()=>{await assert.rejects(()=>replay(()=>({redirected:true})),/redirect|identity/i)})
for(const status of[202,401,402,403,406,407,429,451])test('HTTP'+status+' stops before another current request',async()=>{let calls=0;await assert.rejects(()=>replay(()=>{calls++;return{status,body:'Denied'}}));assert.equal(calls,1)})
test('zero caller cap cannot become empty proof and issues no IO',async()=>{const r=await replay(null,{maxJobs:0});assert.equal(r.calls.length,0);assert.equal(readInventoryEvidence(r.jobs).listingComplete,false)})
test('late opaque caller cancellation after callback never returns zero proof',async()=>{const c=new AbortController(),reason=Object.freeze({caller:'swym-late'});await assert.rejects(()=>replay(null,{signal:c.signal,onAudit:()=>{c.abort(reason)}}),e=>e===reason)})
test('source deadline bounds unfinished evidence callback',async()=>{let entered=false;await assert.rejects(()=>replay(null,{sourceTimeoutMs:350,onAudit:()=>{entered=true;return new Promise(()=>{})}}),/source deadline/i);assert(entered)})


function carrierAttributes(html,kind,attributes){const d=sourceDocument(html),nodes=d.nodes(n=>kind==='heading'?n.tag==='h1'&&d.text(n)==='Jobs at Swym':n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json');assert.equal(nodes.length,1,'Actual original '+kind+' carrier');const n=nodes[0];assert(Number.isSafeInteger(n.start)&&Number.isSafeInteger(n.openEnd),'Actual byte-backed element boundaries');const original=html.slice(n.start,n.openEnd),changed=original.slice(0,-1)+' '+attributes+'>';assert.notEqual(original,changed);return html.slice(0,n.start)+changed+html.slice(n.openEnd)}
for(const [name,kind,attributes] of [
 ['actual JobsTab title is unpublished','heading','data-is-published="false"'],
 ['actual JobsTab title names another employer','heading','data-employer="Other Employer"'],
 ['actual native JSON page-model carrier is unpublished','page-model','data-is-published="false"'],
])test(name+' cannot establish configured empty proof in either observation',async()=>{for(const phase of [0,1])await assert.rejects(()=>replay((h,u,n)=>u===BOARD&&n===phase?{body:carrierAttributes(h,kind,attributes)}:null),e=>e.failureKind==='parser_or_contract_error')})
test('coherent explicit current title and native page-model publication metadata preserves configured zero',async()=>{const r=await replay((h,u)=>u===BOARD?{body:carrierAttributes(carrierAttributes(h,'heading','data-is-published="true" data-employer="Swym"'),'page-model','data-is-published="true" data-employer="Swym"')}:null);assert.equal(r.audit.configuredBoardClosingQualified,true);assert.equal(readInventoryEvidence(r.jobs).listingComplete,true)})
