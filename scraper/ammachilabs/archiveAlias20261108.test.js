import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import {syncBuiltinESMExports} from 'node:module'

// Only this targeted regression imports the real frozen/staged source caller.
// Every transport response is local; no source, publisher or test can network.
let forbiddenNetworkCalls=0
const deny=()=>{forbiddenNetworkCalls++;throw Error('OFFLINE_REGRESSION_NETWORK_FORBIDDEN')}
const originalFetch=globalThis.fetch, restores=[]
globalThis.fetch=deny
for(const [object,key]of[[http,'request'],[http,'get'],[https,'request'],[https,'get'],[net,'connect'],[net,'createConnection'],[tls,'connect']]){
 const original=object[key];object[key]=deny;restores.push(()=>{object[key]=original})
}
syncBuiltinESMExports()
const {run,JOBS_API_URL}=await import('./script.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
after(()=>{assert.equal(forbiddenNetworkCalls,0);globalThis.fetch=originalFetch;for(const restore of restores)restore();syncBuiltinESMExports()})

const CAREERS='https://ammachilabs.org/careers/',PAGE2=CAREERS+'page/2/',PAGE3=CAREERS+'page/3/',PAGE1=CAREERS+'page/1/'
const fixtureRoot=new URL('./test-data/archive-alias-20261108/genuine/',import.meta.url)
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',fixtureRoot)))
const expectedLinks=JSON.parse(fs.readFileSync(new URL('archive-links.expected.json',fixtureRoot)))
const digest=value=>createHash('sha256').update(value).digest('hex')
const recordsByURL=new Map(manifest.records.map(record=>[record.requestedUrl,record]))
const bodies=new Map()
for(const record of manifest.records)if(record.bodyFile){
 const body=gunzipSync(fs.readFileSync(new URL(record.bodyFile,fixtureRoot)))
 assert.equal(body.length,record.bytes);assert.equal(digest(body),record.sha256)
 assert.deepEqual(Buffer.from(body.toString('utf8')),body)
 bodies.set(record.requestedUrl,body)
}
assert.equal(expectedLinks.length,23)
assert.equal(recordsByURL.get(PAGE1).status,301)
assert.equal(recordsByURL.get(PAGE1).bodyUnavailable,true)
assert.equal(recordsByURL.get(PAGE1).location,CAREERS)

function genuinePage(url){
 const record=recordsByURL.get(url);assert.ok(record,'No genuine input for '+url)
 const body=bodies.get(url)
 // Exact actual injected shape: plain original headers plus lowercase view.
 // No synthetic body/status or flat Location is added for original301.
 return {url:record.finalUrl,status:record.status,headers:{...record.headers},publicHeaders:{...record.headers},
  bodyUnavailable:record.bodyUnavailable,contentType:record.contentType,
  sourceCapture:Object.freeze({sourceRequestedAt:record.sourceRequestedAt,sourceCompletedAt:record.sourceCompletedAt,
   bodySHA256:record.sha256??null,bodyBytes:record.bytes??null,bodyUnavailable:record.bodyUnavailable}),
  ...(body?{bodyBase64:body.toString('base64'),html:body.toString('utf8'),body:body.toString('utf8')}:{}),
  fixtureEvidenceKind:'genuine-saved-original'}
}
function syntheticPage(url,body,headers={}){
 return {url,status:200,body,headers:{...headers},publicHeaders:{...headers},
  fixtureEvidenceKind:'SYNTHETIC_CONTROL_ONLY_NOT_HTTP_ACQUISITION'}
}
const options={collectionBudgetMs:10000,now:'2012-01-01T00:00:00.000Z'}
function checked(fetchPage){return async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');return fetchPage(url,init)}}

test('genuine archives proceed to unacquired API without navigating the proven redundant page1 alias',async()=>{
 const stop=Object.assign(Error('SYNTHETIC_CONTROL_STOP_AT_UNACQUIRED_API'),{syntheticControlOnly:true}),calls=[]
 await assert.rejects(run({...options,fetchPage:checked(async url=>{calls.push(url);if(url===JOBS_API_URL)throw stop;return genuinePage(url)})}),error=>error===stop)
 assert.deepEqual(calls,[CAREERS,PAGE2,PAGE3,JOBS_API_URL])
})

const syntheticRecords=links=>links.map((link,index)=>({id:900001+index,status:'publish',link,
 title:{rendered:'SYNTHETIC CONTROL ROLE '+index},position_title:'SYNTHETIC CONTROL ROLE '+index,
 position_hiring_organization_name:'Ammachi Labs',position_description:'SYNTHETIC CONTROL CRITERIA ONLY. These authored test requirements are not acquired vacancy evidence.',
 position_employment_type:'FULL_TIME',date_gmt:'2012-01-01T00:00:00'}))
function syntheticDetail(record){
 const model={'@type':'JobPosting',title:record.position_title,hiringOrganization:{name:'Ammachi Labs'},datePosted:'2012-01-01T00:00:00.000Z',jobLocation:null}
 return '<html><head><link rel="alternate" type="application/json" href="https://ammachilabs.org/wp-json/wp/v2/jobs/'+record.id+'"></head><body><div class="job-post">'
 +'<div class="jobs-row position_title"><div class="jobs-row-label">Title</div><div class="jobs-row-input">'+record.position_title+'</div></div>'
 +'<div class="jobs-row position_description"><div class="jobs-row-label">Description</div><div class="jobs-row-input"><p>'+record.position_description+'</p></div></div>'
 +'</div><script type="application/ld+json">'+JSON.stringify(model)+'</script></body></html>'
}
async function controlledContinuation({links=expectedLinks,variants=new Map(),extraArchives=new Map()}={}){
 const rows=syntheticRecords(links),byURL=new Map(rows.map(row=>[row.link,row])),calls=[],audits=[]
 const jobs=await run({...options,maxJobs:2,onAudit:value=>audits.push(value),fetchPage:checked(async url=>{
  calls.push(url)
  if(variants.has(url))return syntheticPage(url,variants.get(url))
  if(extraArchives.has(url))return syntheticPage(url,extraArchives.get(url))
  if(bodies.has(url)||url===PAGE1)return genuinePage(url)
  if(url===JOBS_API_URL)return syntheticPage(url,JSON.stringify(rows),{'x-wp-total':String(rows.length),'x-wp-totalpages':'1','content-type':'application/json'})
  if(byURL.has(url))return syntheticPage(url,syntheticDetail(byURL.get(url)))
  assert.fail('Unprovided input refused: '+url)
 })})
 return{jobs,calls,audits}
}
test('real caller reaches synthetic details and closing while plain lowercase WP metadata and conservative scope survive',async()=>{
 const {jobs,calls,audits}=await controlledContinuation()
 assert.equal(jobs.length,2);assert.equal(audits.length,1)
 assert.equal(audits[0].observations.length,23);assert.equal(audits[0].fullNativeRoleDetails.length,23)
 assert.equal(audits[0].closingReconciled,true);assert.equal(audits[0].nativeArchivePagesEnumerated,3)
 assert.equal(audits[0].nativeApiTotal,23)
 for(const url of[CAREERS,PAGE2,PAGE3,JOBS_API_URL,...expectedLinks])assert.equal(calls.filter(value=>value===url).length,2)
 assert.ok(!calls.includes(PAGE1));assert.ok(jobs.every(job=>job.country===null&&job.requisitionId===null&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.jobDescription.includes('SYNTHETIC CONTROL')))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

const archiveVariant=(page,links,next)=>'<html><head><link rel="canonical" href="'+CAREERS+'"></head><body>AMMACHI LABS CAREERS'
 +links.map(link=>'<a href="'+link+'">CLICK HERE</a>').join('')
 +'<nav class="pagination column medium-12" role="navigation" aria-label="Job listings pagination"><span class="page-numbers current" aria-current="page">'+page+'</span>'
 +next.map(([number,url])=>'<a class="page-numbers" href="'+url+'">'+number+'</a>').join('')+'</nav></body></html>'
test('a genuinely distinct page4 remains traversed despite the shared canonical and cycles',async()=>{
 const page4=CAREERS+'page/4/',link='https://ammachilabs.org/job/synthetic-controlled-page-four-only/'
 const html=bodies.get(PAGE3).toString('utf8').replace(/(<nav\b[^>]*aria-label=["']Job listings pagination["'][^>]*>[\s\S]*?)(<\/nav>)/i,(_all,start,end)=>start+'<a class="page-numbers" href="'+page4+'">4</a>'+end)
 assert.notEqual(html,bodies.get(PAGE3).toString('utf8'))
 const result=await controlledContinuation({links:[...expectedLinks,link],variants:new Map([[PAGE3,html]]),extraArchives:new Map([[page4,archiveVariant(4,[link],[[1,PAGE1],[3,PAGE3]])]])})
 assert.equal(result.audits[0].nativeArchivePagesEnumerated,4);assert.equal(result.audits[0].observations.length,24)
 assert.equal(result.calls.filter(url=>url===page4).length,2);assert.ok(!result.calls.includes(PAGE1))
})

for(const [label,mutateRoot,mutatePage]of[
 ['missing canonical',html=>html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi,''),html=>html],
 ['current page marker not1',html=>html.replace(/(<span\b[^>]*aria-current=["']page["'][^>]*>)1(<\/span>)/i,(_all,start,end)=>start+'2'+end),html=>html],
 ['alias outside native pagination',html=>html,html=>html.replaceAll('Job listings pagination','SYNTHETIC unqualified navigation')]
])test('page1 is not deduplicated with '+label,async()=>{
 const calls=[],root=mutateRoot(bodies.get(CAREERS).toString('utf8'))
 if(label!=='alias outside native pagination')assert.notEqual(root,bodies.get(CAREERS).toString('utf8'))
 await assert.rejects(run({...options,fetchPage:checked(async url=>{
  calls.push(url)
  if(url===CAREERS)return syntheticPage(url,root)
  if(url===PAGE2||url===PAGE3)return syntheticPage(url,mutatePage(bodies.get(url).toString('utf8')))
  if(url===PAGE1)return genuinePage(url)
  assert.fail('No continuation should occur without alias proof: '+url)
 })}),/public redirect left the reviewed hiring handoff/)
 assert.ok(calls.includes(PAGE1));assert.ok(!calls.includes(JOBS_API_URL))
})
for(const [label,target]of[['foreign','https://foreign.example.invalid/archive/'],['unsupported same-origin',CAREERS+'unsupported-handoff/']])test(label+' archive redirects remain fail-closed',async()=>{
 const calls=[]
 await assert.rejects(run({...options,fetchPage:checked(async url=>{
  calls.push(url)
  if(url===CAREERS)return genuinePage(url)
  if(url===PAGE2)return{url,status:301,headers:new Headers({location:target}),bodyUnavailable:true,fixtureEvidenceKind:'SYNTHETIC_CONTROL_ONLY_NOT_HTTP_ACQUISITION'}
  assert.fail('Redirect destination or further archive must not be fetched: '+url)
 })}),/public redirect left the reviewed hiring handoff/)
 assert.deepEqual(calls,[CAREERS,PAGE2]);assert.ok(!calls.includes(target))
})
test('distinct archive growth still stops at the existing100-page bound before API or page101',async()=>{
 const calls=[]
 await assert.rejects(run({...options,fetchPage:checked(async url=>{
  calls.push(url);const number=url===CAREERS?1:Number(url.match(/\/page\/(\d+)\/$/)?.[1])
  assert.ok(number>=1&&number<=100)
  return syntheticPage(url,archiveVariant(number,['https://ammachilabs.org/job/synthetic-bound-'+number+'/'],[[1,PAGE1],[number+1,CAREERS+'page/'+(number+1)+'/']]))
 })}),/unbounded public archive continuation/)
 assert.equal(calls.length,100);assert.ok(!calls.includes(CAREERS+'page/101/'));assert.ok(!calls.includes(JOBS_API_URL))
})
