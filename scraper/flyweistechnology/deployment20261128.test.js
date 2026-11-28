import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/deployment-20261128.json.gz',import.meta.url))))
const HOME='https://www.flyweis.technology/',DELEGATED=HOME+'careers',BOARD='https://flyweis.technology/careers'
const BASE='/_next/static/css/46804a84a3f95bbc.css',COMPANY='/_next/static/css/b83a55a9d343c40f.css'
const REACT=BOARD+'/senior-react-developer'
const sha=value=>createHash('sha256').update(value).digest('hex')
function replay(edit=()=>{}){
  const calls=[],visits=new Map(),unacquired=Object.freeze({unacquiredCurrentRole:true})
  return{calls,unacquired,run:options=>run({now:'2026-11-28T00:00:00.000Z',...options,fetchImpl:async(url,init)=>{
    assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
    assert.ok(!url.endsWith('/apply'),'Application string is not an authorized application read')
    calls.push(url)
    const original=fixture.packets.find(row=>row.requestedUrl===url)
    if(!original)throw unacquired
    const packet=structuredClone(original),visit=(visits.get(url)||0)+1;visits.set(url,visit)
    edit(packet,url,visit)
    return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  }})}
}

test('all eleven current prefix originals retain complete body hashes and each exact native stylesheet response',()=>{
  assert.equal(fixture.source,'flyweistechnology');assert.equal(fixture.packets.length,11)
  for(const packet of fixture.packets){assert.equal(packet.status,200);assert.equal(packet.url,packet.requestedUrl);assert.equal(sha(packet.body),packet.sha256)}
  const css=fixture.packets.filter(row=>row.requestedUrl.endsWith('.css'))
  assert.equal(css.length,6)
  for(const suffix of [BASE,COMPANY])assert.equal(css.find(row=>row.requestedUrl==='https://www.flyweis.technology'+suffix).body,css.find(row=>row.requestedUrl==='https://flyweis.technology'+suffix).body)
  assert.ok(css.every(row=>!/@import\b/i.test(row.body)))
})

test('genuine two-style homepage and three-style delegated/current board reach only the first unacquired role without inventing a result',async()=>{
  const operation=replay()
  await assert.rejects(operation.run(),error=>error===operation.unacquired)
  assert.ok(operation.calls.includes(DELEGATED));assert.ok(operation.calls.includes(BOARD));assert.ok(operation.calls.includes(REACT))
  assert.equal(operation.calls.filter(url=>url.endsWith(COMPANY)).length,2)
  assert.ok(operation.calls.at(-1).startsWith(BOARD+'/'))
})

for(const suffix of [BASE,COMPANY])test('current full CSS bytes remain pinned at '+suffix,async()=>{
  let changed=false
  const operation=replay((packet,url)=>{if(url==='https://www.flyweis.technology'+suffix){packet.body+='\narticle{display:none!important}';changed=true}})
  await assert.rejects(operation.run(),/unreviewed native stylesheet bytes/);assert.equal(changed,true)
  assert.equal(operation.calls.includes(BOARD),false)
})

for(const [name,change] of [
  ['unknown stylesheet',html=>html.replace(BASE,'/_next/static/css/unreviewed.css')],
  ['missing current homepage stylesheet',html=>html.replace(/<link\b[^>]*href="\/_next\/static\/css\/f19dbbf993f3b973\.css"[^>]*>/,'')],
  ['extra current homepage stylesheet',html=>html.replace('</head>','<link rel="stylesheet" href="/_next/static/css/unreviewed.css" data-precedence="next"/></head>')],
  ['foreign style host',html=>html.replace(BASE,'https://foreign.invalid'+BASE)],
  ['changed style media attribute',html=>html.replace('href="'+BASE+'"','href="'+BASE+'" media="print"')],
])test('finite per-surface release rejects '+name+' before any dependency read',async()=>{
  const operation=replay((packet,url)=>{if(url===HOME){const changed=change(packet.body);assert.notEqual(changed,packet.body);packet.body=changed}})
  await assert.rejects(operation.run(),/native stylesheet declarations changed/)
  assert.deepEqual(operation.calls,[HOME])
})

for(const status of [401,403,429])test('current declared stylesheet HTTP'+status+' stops without native alternate reads',async()=>{
  const operation=replay((packet,url)=>{if(url==='https://www.flyweis.technology'+BASE)packet.status=status})
  await assert.rejects(operation.run(),new RegExp('public HTTP status/final URL changed: '+status))
  assert.deepEqual(operation.calls,[HOME,'https://www.flyweis.technology'+BASE])
})

for(const [name,change,rejection] of [
  ['foreign employer',html=>html.replaceAll('"name":"Flyweis Technology"','"name":"Other Company"'),/employer identity changed/],
  ['contradictory country',html=>html.replaceAll('"addressCountry":"IN"','"addressCountry":"US"'),/work-country\/worksite unqualified/],
  ['missing complete role article',html=>html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/,'<article></article>'),/native role|native full role/],
])test('current CSS release cannot qualify '+name+' in the genuine current own role',async()=>{
  let changed=false
  const operation=replay((packet,url)=>{if(url===REACT){const value=change(packet.body);assert.notEqual(value,packet.body);packet.body=value;changed=true}})
  await assert.rejects(operation.run(),rejection);assert.equal(changed,true)
})

test('new release retains the exact null caller cancellation and performs no public reads',async()=>{
  const operation=replay()
  await assert.rejects(operation.run({signal:AbortSignal.abort(null)}),value=>value===null)
  assert.equal(operation.calls.length,0)
})

const current=fixture.registeredCurrent
async function full(edit=()=>{},registered=false){
  const pending=[...current.packets],visits=new Map(),calls=[]
  const options={now:current.capturedAt,fetchImpl:async(url,init)=>{
    const packet=structuredClone(pending.shift());assert.ok(packet,'No read outside actual current opening/closing acquisition')
    assert.equal(packet.requestedUrl,url);assert.equal(packet.method,init.method);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
    assert.equal(sha(packet.body),packet.sha256);assert.ok(!url.endsWith('/apply'))
    const visit=(visits.get(url)||0)+1;visits.set(url,visit);calls.push(url);edit(packet,url,visit)
    return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  }}
  const provider=getScraperCatalog().find(row=>row.source==='flyweistechnology')
  const jobs=await(registered?createCatalogScraper(provider).run(options):run(options))
  assert.equal(pending.length,0)
  return{jobs,calls,provider}
}

test('all32 actual registered response bodies retain complete hashes and the complete six-role native acquisition',()=>{
  assert.equal(current.packets.length,32);assert.equal(current.expectedJobs.length,6)
  assert.equal(current.packets.reduce((sum,p)=>sum+Buffer.byteLength(p.body),0),1474268)
  for(const packet of current.packets){assert.equal(packet.status,200);assert.equal(packet.requestedUrl,packet.url);assert.equal(sha(packet.body),packet.sha256)}
})

test('actual current full native replay preserves every raw role, full authored article and paired closing evidence',async()=>{
  const{jobs,calls}=await full()
  assert.equal(jobs.length,6);assert.equal(calls.length,32)
  for(const expected of current.expectedJobs){
    const job=jobs.find(row=>row.jobId===expected.jobId);assert.ok(job)
    assert.deepEqual(job.sourceNativeJobPosting,expected.sourceNativeJobPosting)
    assert.equal(job.sourceDescription,expected.sourceDescription);assert.ok(job.sourceNativeFullArticle)
    assert.equal(job.sourceDetailComplete,true);assert.equal(job.country,'India')
    assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  }
  assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,32)
  assert.equal(jobs.nativeCollectionEvidence.ownFullCriteriaClosingReconciled,true)
  assert.equal(jobs.nativeCollectionEvidence.corporateHandoffClosingReconciled,true)
})

test('registered current adapter retains coverage gap and forbids cleanup despite six assessment-eligible India roles',async()=>{
  const{jobs,provider}=await full(()=>{},true),assessed=assessSoftFailureAcquisition(provider,jobs)
  assert.equal(assessed.indiaJobs,6);assert.equal(assessed.eligibleJobs,6)
  assert.equal(assessed.runnerOutcome.partial,true);assert.equal(assessed.runnerOutcome.detailHealth.complete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(assessed.runnerOutcome.sourceObservations.companyGlobalTotal,null)
  assert.equal(assessed.runnerOutcome.sourceObservations.companyIndiaTotal,null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.deepEqual(assessed.cleanupOptions,{replaceExisting:false})
})

test('a closing whole company stylesheet byte change cannot commit current native roles',async()=>{
  let changed=false
  await assert.rejects(full((packet,url,visit)=>{if(url==='https://flyweis.technology'+COMPANY&&visit===2){packet.body+='\narticle{display:none!important}';changed=true}}),/unreviewed native stylesheet bytes/)
  assert.equal(changed,true)
})

test('separately reviewed old and current CSS releases cannot be mixed at corporate close',async()=>{
  let changed=false
  await assert.rejects(full((packet,url,visit)=>{
    if(url!==HOME||visit!==2)return
    packet.body=packet.body.replace(BASE,'/_next/static/css/8ac2af147fdd4582.css').replace('</head>','<link rel="stylesheet" href="/_next/static/css/3ad56064251c9581.css" data-precedence="next"/></head>');changed=true
  }),/native stylesheet release changed/)
  assert.equal(changed,true)
})

for(const[name,change,rejection]of[
  ['mandatory criteria',html=>html.replaceAll('Redux Toolkit','Additional mandatory compliance certification'),/closing native full criteria changed/],
  ['native country',html=>html.replaceAll('"addressCountry":"IN"','"addressCountry":"US"'),/work-country\/worksite unqualified/],
  ['application identity',html=>html.replaceAll('href="/careers/senior-react-developer/apply"','href="https://foreign.invalid/apply"'),/native visible application changed/],
])test('closing '+name+' drift rejects before publishing any staged current roles',async()=>{
  let changed=false
  await assert.rejects(full((packet,url,visit)=>{if(url===REACT&&visit===2){const next=change(packet.body);assert.equal(next!==packet.body,true);packet.body=next;changed=true}}),rejection)
  assert.equal(changed,true)
})

test('current full replay retains the invalid calendar publication guard',async()=>{
  let changed=false
  await assert.rejects(full((packet,url)=>{if(url===REACT){const next=packet.body.replace(/"datePosted":"\d{4}-\d{2}-\d{2}"/g,'"datePosted":"2026-02-30"');assert.equal(next!==packet.body,true);packet.body=next;changed=true}}),/native publication date unavailable or future/)
  assert.equal(changed,true)
})
