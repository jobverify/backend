import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../providers/index.js'
import {primaryDeclaration} from './nativeData.js'
import {DECLARED_JOB_FEED_PROFILES} from '../declaredJobFeeds/nativeCareers.js'
import {readInventoryEvidence} from '../../utils/inventoryEvidence.js'

const folder=new URL('./fixtures/current-client-bindings-20261105/',import.meta.url)
const metadata=JSON.parse(fs.readFileSync(new URL('metadata.json',folder)))
const sha=body=>createHash('sha256').update(body).digest('hex')
const saved=new Map(metadata.records.map(row=>{
 const gzip=fs.readFileSync(new URL(row.bodyFile,folder)),body=gunzipSync(gzip)
 assert.equal(sha(gzip),row.gzipSHA256);assert.equal(sha(body),row.sha256);assert.equal(body.length,row.bytes)
 return[row.requestedUrl,{...row,body}]
}))
const catalog=getScraperCatalog()
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')

for(const source of ['affirm','tailscale']){
 const profile=DECLARED_JOB_FEED_PROFILES[source],home=saved.get(profile.primaryURL)
 const client=[...saved.values()].find(row=>row.source===source&&row.contentType.includes('javascript'))
 assert.ok(home&&client)
 const html=home.body.toString('utf8'),specifier=new URL(client.requestedUrl).pathname
 const matches=html.match(new RegExp('<script\\b[^>]*\\bsrc=["\']'+escape(specifier)+'["\'][^>]*>[\\s\\S]*?<\\/script>','g'))
 assert.equal(matches?.length,1,'The saved fixture must contain one exact current external script declaration')
 const tag=matches[0],changeTag=change=>html.replace(tag,change(tag))
 const run=async(mutate=(_url,row)=>row)=>{
  const audits=[],calls=[],missingOwnPostResponses=[]
  const provider=catalog.find(row=>row.source===source)
  assert.ok(provider)
  const jobs=await createCatalogScraper(provider).run({
   now:()=>[...saved.values()].filter(row=>row.source===source).map(row=>row.sourceCompletedAt).sort().at(-1),
   fetchPage:async url=>{
    calls.push(url)
    const row=saved.get(url)
    if(!row){
     // A binding-only fixture deliberately supplies no own-post bodies. A
     // missing test response is never fabricated as an HTTP source failure.
     missingOwnPostResponses.push(url)
     throw Error('Binding-only control has no captured own-post response: '+url)
    }
    const page=mutate(url,{url:row.finalUrl,status:row.status,headers:row.headers,bodyBase64:row.body.toString('base64')})
    return page
   },
   onAudit:async audit=>audits.push(audit),
  })
  assert.equal(audits.length,1)
  return{jobs,audit:audits[0],calls,missingOwnPostResponses}
 }
 test(source+': actual registered collector recognizes the current declared client without upgrading source scope',async()=>{
  const {jobs,audit,calls,missingOwnPostResponses}=await run()
  assert.equal(audit.opening.currentPrimaryDeclarationQualified,true)
  assert.equal(audit.opening.publisherQualified,true)
  assert.equal(audit.closing.publisherQualified,true)
  assert.equal(calls.filter(url=>url===client.requestedUrl).length,2)
  const native=JSON.parse(saved.get(profile.publicAPIURL).body.toString('utf8'))
  assert.deepEqual(audit.opening.originalNativeFeed,native)
  assert.deepEqual(audit.closing.originalNativeFeed,native)
  assert.ok(native.jobs.every(row=>audit.observations.some(job=>job.jobId===String(row.id))))
  assert.ok(missingOwnPostResponses.length>0,'Binding-only controls must retain their missing own-post limitation')
  assert.equal(jobs.length,0)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 })
 test(source+': hidden and aria-hidden do not disable an executable resource declaration',()=>{
  assert.equal(primaryDeclaration(changeTag(value=>value.replace('<script','<script hidden aria-hidden="true"')),profile),true)
 })
 test(source+': equivalent absolute same-origin script URLs keep the exact reviewed binding',()=>{
  assert.equal(primaryDeclaration(changeTag(value=>value.replace(specifier,client.requestedUrl)),profile),true)
 })
 test(source+': any unreviewed client entity change holds native publisher qualification',async()=>{
  const {audit}=await run((url,page)=>url===client.requestedUrl?{...page,
   bodyBase64:Buffer.concat([Buffer.from(page.bodyBase64,'base64'),Buffer.from('\n/* SYNTHETIC unreviewed client mutation */')]).toString('base64')}:page)
  assert.equal(audit.opening.publisherQualified,false)
  assert.equal(audit.closing.publisherQualified,false)
 })
 test(source+': a detached current client cannot supply the company declaration',()=>{
  assert.equal(primaryDeclaration(html.replace(tag,''),profile),false)
 })
 test(source+': a genuine program declared inside an inert template is insufficient',()=>{
  assert.equal(primaryDeclaration(changeTag(value=>'<template>'+value+'</template>'),profile),false)
 })
 test(source+': a data-script type does not declare an executable native client',()=>{
  assert.equal(primaryDeclaration(changeTag(value=>value.replace('<script','<script type="application/json"')),profile),false)
 })
 test(source+': unseen deployment filenames remain unqualified even with a known resource shape',()=>{
  assert.equal(primaryDeclaration(changeTag(value=>value.replace(specifier,specifier.replace('.js','-unreviewed.js'))),profile),false)
 })
 test(source+': a document base leaves URL authority unqualified',()=>{
  assert.equal(primaryDeclaration(html.replace('</head>','<base href="https://example.invalid/">'+'</head>'),profile),false)
 })
 test(source+': duplicate executable current declarations are ambiguous',()=>{
  assert.equal(primaryDeclaration(html.replace('</body>',tag+'</body>'),profile),false)
 })
 test(source+': a different native publisher remains held even with the current client bytes',async()=>{
  const {audit}=await run((url,page)=>{
   if(url!==profile.publicAPIBase)return page
   const data=JSON.parse(Buffer.from(page.bodyBase64,'base64').toString('utf8'))
   data.name='SYNTHETIC different native publisher'
   return{...page,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')}
  })
  assert.equal(audit.opening.publisherQualified,false)
  assert.equal(audit.closing.publisherQualified,false)
 })
 test(source+': authored integrity requires a matching digest at the strongest declared algorithm',async()=>{
  const correct=algorithm=>createHash(algorithm).update(client.body).digest('base64')
  const wrong=algorithm=>Buffer.alloc({sha256:32,sha512:64}[algorithm]).toString('base64')
  const cases=[
   ['sha256-'+correct('sha256')+' sha512-'+wrong('sha512'),false],
   ['sha256-'+wrong('sha256')+' sha512-'+correct('sha512'),true],
   ['sha512-'+wrong('sha512')+' sha512-'+correct('sha512'),true],
   ['sha512-',false],
  ]
  for(const [integrity,qualified]of cases){
   const replacement=tag.replace(/\s+integrity\s*=\s*(?:"[^"]*"|'[^']*')/gi,'')
    .replace('<script','<script integrity="'+integrity+'"')
   const mutant=html.replace(tag,replacement)
   const {audit}=await run((url,page)=>url===profile.primaryURL
    ?{...page,bodyBase64:Buffer.from(mutant).toString('base64')}:page)
   assert.equal(audit.opening.publisherQualified,qualified,'opening: '+integrity)
   assert.equal(audit.closing.publisherQualified,qualified,'closing: '+integrity)
  }
 })
}
