import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_BOARD_URL,HOMEPAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
const manifest=JSON.parse(readFileSync(new URL('./test-data/current-20261103/manifest.json',import.meta.url))),rows=new Map(manifest.files.map(r=>[r.url,{...r,html:gunzipSync(readFileSync(new URL('./test-data/current-20261103/'+r.file,import.meta.url))).toString('utf8')}]))
globalThis.fetch=async()=>{throw Error('Offline native tests prohibit live network')}
const options=(change,calls=[])=>({minRequestIntervalMs:0,fetchPage:async(url,request)=>{calls.push({url,request});const row=rows.get(url);assert(row,'Unpublished fixture '+url);const page={url,status:row.status,html:row.html};return change?change(page,calls):page},fetchText:async url=>{if(url===HOMEPAGE_URL)throw Object.assign(Error('fetch failed'),{cause:Object.assign(Error('connection timeout'),{code:'UND_ERR_CONNECT_TIMEOUT'})});const row=rows.get(url);assert(row,'Unpublished fixture '+url);return row.html}})
const mutate=(html,operation)=>html.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_all,start,json,end)=>{const p=JSON.parse(json);operation(p);return start+JSON.stringify(p)+end})
test('real11role inventory yields9full India descriptions and retains2blank native details',async()=>{
 const audits=[],jobs=await run({...options(),onAudit:a=>audits.push(a)})
 assert.equal(jobs.length,9);assert(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true))
 assert.equal(audits[0].nativeTotal,11);assert.equal(audits[0].observations.length,11)
 assert.deepEqual(audits[0].detailGaps.map(r=>r.jobId).sort(),['234','465'])
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(jobs.find(j=>j.jobId==='403').requisitionId,'INS00391')
 assert.equal(jobs.find(j=>j.jobId==='403').location,'Bangalore,   Chennai,   Hyderabad')
 assert.equal(audits[0].lifecycleCleanupAllowed,false)
})
test('native corporate office country stays role-bound and contradictory location countries are held',async()=>{
 const jobs=await run(options(page=>page.url.endsWith('/jobs/403')?{...page,html:mutate(page.html,p=>p.props.pageProps.job.location='London, United Kingdom')}:page))
 assert(!jobs.some(j=>j.jobId==='403'))
})
test('country object alternatives cannot collapse an India/name versus CA/code conflict',async()=>{
 const jobs=await run(options(page=>page.url.endsWith('/jobs/403')?{...page,html:mutate(page.html,p=>p.props.pageProps.job.office.country={name:'India',identifier:'CA'})}:page))
 assert(!jobs.some(j=>j.jobId==='403'))
})
test('closing native details precede the final full inventory and changes withhold stale jobs',async()=>{
 const calls=[];await run(options(null,calls))
 const lastDetail=calls.findLastIndex(r=>/\/jobs\/\d+$/.test(r.url)),lastListing=calls.findLastIndex(r=>r.url===CAREERS_BOARD_URL)
 assert(lastListing>lastDetail)
 let seen=0
 await assert.rejects(run(options(page=>page.url.endsWith('/jobs/403')&&++seen===2?{...page,html:mutate(page.html,p=>p.props.pageProps.job.description_external+='<p>Changed qualification</p>')}:page)))
})
test('zero caller cap means unlimited; positive caps retain incomplete evidence',async()=>{
 assert.equal((await run({...options(),maxJobs:0})).length,9)
 assert.equal((await run({...options(),maxJobs:2})).length,2)
})
test('listing errors or duplicate native IDs cannot masquerade as empty completion',async()=>{
 for(const change of [p=>{p.props.pageProps.jobsData={error:'unavailable',count:0,rows:[]}},p=>{p.props.pageProps.jobsData.rows[1]=p.props.pageProps.jobsData.rows[0]}])await assert.rejects(run(options(page=>page.url===CAREERS_BOARD_URL?{...page,html:mutate(page.html,change)}:page)))
})
for(const status of [401,403,429])test('native HTTP '+status+' is a typed local failure and stops retries',async()=>{
 let calls=0
 await assert.rejects(run({minRequestIntervalMs:0,fetchPage:async url=>{calls++;return{url,status,html:'denied'}}}),e=>e.status===status&&e.abortRetries&&!e.abortPipeline&&!e.isPipelineFatal)
 assert.equal(calls,1)
})
test('ignored readers and observers remain bounded',{timeout:1500},async()=>{
 for(const settings of [{fetchPage:()=>new Promise(()=>{})},{...options(),onAudit:()=>new Promise(()=>{})}])await assert.rejects(run({...settings,minRequestIntervalMs:0,collectionBudgetMs:40}),e=>e.name==='TimeoutError')
})
test('caller cancellation reaches the transport with the exact opaque reason',async()=>{
 const controller=new AbortController(),reason={callerStop:true};let supplied
 await assert.rejects(run({signal:controller.signal,minRequestIntervalMs:0,fetchPage:async(url,request)=>{supplied=request.signal;controller.abort(reason);return{url,status:200,html:rows.get(CAREERS_BOARD_URL).html}}}),e=>e===reason)
 assert.equal(supplied.aborted,true);assert.equal(supplied.reason,reason)
})
test('winning catalog does not advertise historical counts or company cleanup',()=>{
 const row=getScraperCatalog().find(r=>r.source==='bataindia')
 assert.equal(row.verifiedOn,null);assert.equal(row.verifiedPublicJobCount,null)
 assert.equal(row.zeroResultPolicy,'evidence-required');assert.equal(row.lifecycleCleanupAllowed,false)
})
for(const style of ['height:0;overflow:hidden','color:transparent'])test('native own-description '+style+' is held without discarding raw criteria',async()=>{
 const audits=[],jobs=await run({...options(page=>page.url.endsWith('/jobs/403')?{...page,html:page.html.replace('class="css-1ih3bu2"','class="css-1ih3bu2" style="'+style+'"')}:page),onAudit:a=>audits.push(a)})
 assert(!jobs.some(j=>j.jobId==='403'))
 assert(audits[0].observations.find(j=>j.jobId==='403').nativePublicJob.description_external.length>4000)
})
for(const alternative of ['unknown-country-identifier','unresolved-second-office'])test('all native office alternatives survive '+alternative,async()=>{
 const jobs=await run(options(page=>page.url.endsWith('/jobs/403')?{...page,html:mutate(page.html,p=>{const j=p.props.pageProps.job;j.location='Delhi, India';if(alternative==='unknown-country-identifier')j.office.country={name:'India',identifier:'unrecognized-country-code'};else j.office=[j.office,{city:'Toronto',country:null}]})}:page))
 assert(!jobs.some(j=>j.jobId==='403'))
})
test('missing native created_on stays unknown rather than becoming a1970publication',async()=>{
 const audits=[],jobs=await run({...options(page=>({...page,html:mutate(page.html,p=>{const props=p.props.pageProps;if(props.job?.id===403)props.job.created_on=null;for(const row of props.jobsData?.rows??[])if(row.id===403)row.created_on=null})})),onAudit:a=>audits.push(a)})
 assert.equal(jobs.find(j=>j.jobId==='403')?.postingDate??null,null)
 assert.equal(audits[0].observations.find(j=>j.jobId==='403').postingDate,null)
 assert.equal(audits[0].inventoryEvidence.listingComplete,false)
})
for(const shape of ['error','err','continuation'])test('native zero cannot conceal '+shape,async()=>{
 await assert.rejects(run(options(page=>page.url===CAREERS_BOARD_URL?{...page,html:mutate(page.html,p=>{p.props.pageProps.jobsData={count:0,rows:[]};if(shape==='continuation'){p.props.pageProps.hasMore=true;p.props.pageProps.nextCursor='next-native-page'}else p[shape]={message:'native service unavailable'}})}:page)))
})
test('supplied transport receives request deadline without aborting the caller',{timeout:1000},async()=>{
 const caller=new AbortController();let transportSignal
 await assert.rejects(run({signal:caller.signal,requestTimeoutMs:20,collectionBudgetMs:200,minRequestIntervalMs:0,fetchPage:async(url,request)=>{transportSignal=request.signal;return new Promise(()=>{})}}),e=>e.name==='TimeoutError')
 assert.equal(transportSignal.aborted,true);assert.equal(caller.signal.aborted,false)
})
