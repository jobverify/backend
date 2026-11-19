import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const legacy=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const read=name=>gunzipSync(readFileSync(new URL('./test-data/current-'+name+'-20261118.gz',import.meta.url))).toString()
const client='https://static.zohocdn.com/recruit/javascript/career-website-common.5d760a87446385b0a4896c0b55098b2c.js'
const replay=(mutate=(url,body)=>body)=>({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET')
  let p=legacy.responses.find(p=>p.requestedURL===String(url)),body
  if(String(url)===client){p=legacy.responses.find(p=>p.requestedURL.includes('/career-website-common.'));body=read('client')}
  else {assert.ok(p,'Only currently declared native requests '+url);body=Buffer.from(p.bodyBase64,'base64').toString()}
  if(String(url)==='https://genworx.zohorecruit.com/jobs/Careers')body=read('board')
  if(String(url).includes('/jobs/Careers/802719000002492042/'))body=read('detail-marketing')
  if(String(url).includes('/jobs/Careers/802719000000585025/'))body=read('detail-software')
  return Object.defineProperty(new Response(mutate(String(url),body),{status:p.status,headers:p.headers}),'url',{value:String(url)})
}})

test('Genworx current declared Zoho runtime retains native India role criteria and held observations',async()=>{
  const jobs=await run(replay())
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].jobId,'802719000002492042')
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.rows.length,2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Genworx new runtime profile never admits changed code or foreign program paths',async()=>{
  for(const mutate of [(url,body)=>url===client?body+';globalThis.changed=true':body,
    (url,body)=>url.endsWith('/jobs/Careers')?body.replace('career-website-common.5d760a87446385b0a4896c0b55098b2c','career-website-common.unreviewed'):body]){
    await assert.rejects(run(replay(mutate)),error=>error.failureKind==='parser_or_contract_error')
  }
})
