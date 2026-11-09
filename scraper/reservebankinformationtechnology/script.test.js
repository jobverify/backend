import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import * as source from './script.js'
const fixture=async name=>fs.readFile(new URL('./fixtures/'+name,import.meta.url),'utf8')
const careers=await fixture('current-careers.html'),client=await fixture('current-client.js.txt'),config=await fixture('current-config.js.txt')
const openings=JSON.parse(await fixture('current-openings.json'))
const expectedBody=()=>{const m=client.match(/let n=(\[[\d,]+\]),r=(\[[\d,]+\]),s=pe\(n\),a=pe\(r\)/);return {username:Buffer.from(JSON.parse(m[1])).toString('base64'),password:Buffer.from(JSON.parse(m[2])).toString('base64')}}
const fetchText=async url=>url===source.CAREERS_URL?careers:url==='https://rebit.org.in/main-O5QYG73Y.js'?client:url==='https://rebit.org.in/chunk-DFJHAP4Q.js'?config:assert.fail('Unexpected source URL '+url)
const run=(overrides={})=>source.run({fetchText,postJson:async()=>({status:'success',access_token:'test-token'}),fetchJson:async()=>structuredClone(openings),...overrides})
test('ReBIT uses the current published anonymous bootstrap and exports all14 verified openings',async()=>{
  const calls=[]
  const jobs=await run({postJson:async(url,body)=>{calls.push({url,body});assert.deepEqual(body,expectedBody());return {status:'success',access_token:'test-token'}}})
  assert.equal(calls.length,1);assert.equal(calls[0].url,source.CAREERS_LOGIN_API_URL)
  assert.equal(jobs.length,14);assert.equal(new Set(jobs.map(j=>j.jobId)).size,14)
  assert.ok(jobs.every(j=>j.country==='India'&&new URL(j.applyUrl).hostname==='rebithr.darwinbox.in'))
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,14)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete,true)
})
test('ReBIT resolves changing public payloads from the bound login client rather than a cached constant',async()=>{
  const alternate=client.replace('let n=[238,213,121,35,86,106,211,160,11,125,20,188,219,62,158,29]','let n=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]')
  assert.notEqual(alternate,client)
  await run({fetchText:async url=>url.endsWith('main-O5QYG73Y.js')?alternate:fetchText(url),postJson:async(url,body)=>{assert.equal(body.username,Buffer.from([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]).toString('base64'));return {access_token:'test-token'}}})
})
test('ReBIT rejects foreign client URLs and API base changes before sending the anonymous login',async()=>{
  let posts=0;const postJson=async()=>{posts++;return {access_token:'test-token'}}
  await assert.rejects(run({postJson,fetchText:async()=>careers.replace('src="main-O5QYG73Y.js"','src="https://foreign.example/main-O5QYG73Y.js"')}),/client|first-party/i)
  await assert.rejects(run({postJson,fetchText:async url=>url.endsWith('chunk-DFJHAP4Q.js')?config.replace('https://rebit.org.in/web/api','https://foreign.example/web/api'):fetchText(url)}),/API|configuration/i)
  assert.equal(posts,0)
})
test('ReBIT rejects changed bootstrap encodings and out-of-range published bytes before login',async()=>{
  let posts=0;const postJson=async()=>{posts++;return {access_token:'test-token'}}
  for(const altered of [client.replace('return btoa(o)','return o'),client.replace('let n=[238,','let n=[999,')]){
    assert.notEqual(altered,client)
    await assert.rejects(run({postJson,fetchText:async url=>url.endsWith('main-O5QYG73Y.js')?altered:fetchText(url)}),/bootstrap|payload|encoding/i)
  }
  assert.equal(posts,0)
})
test('ReBIT refuses duplicate IDs, foreign application links and countryless remote roles',async()=>{
  for(const rows of [[openings[0],openings[0]],[{...openings[0],apply_now_link:'https://foreign.example/apply'}],[{...openings[0],location:'Remote'}]]){
    await assert.rejects(run({fetchJson:async()=>rows}),/identity|duplicate|location|country|scope|payload/i)
  }
})
test('ReBIT authoritative empty API inventory retains verified-empty evidence',async()=>{
  const jobs=await run({fetchJson:async()=>[]})
  assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,0)
})

test('ReBIT rejects malformed array entries and missing active-status semantics',async()=>{
  for(const rows of [[null],[{...openings[0],job_status:undefined}],[{...openings[0],job_status:'active'}]]){
    await assert.rejects(run({fetchJson:async()=>rows}),/payload|status|inventory/i)
  }
})
test('ReBIT does not manufacture full descriptions from listing metadata',async()=>{
  const jobs=await run()
  assert.ok(jobs.every(job=>job.jobDescription===null))
})

test('ReBIT keeps nullable fields absent and rejects missing titles or IDs',async()=>{
  const jobs=await run({fetchJson:async()=>[{...openings[0],job_desc:null,job_experience:null}]})
  assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].experienceRequired,null)
  for(const row of [{...openings[0],id:null},{...openings[0],job_title:null}]){
    await assert.rejects(run({fetchJson:async()=>[row]}),/payload|identity/i)
  }
})
test('ReBIT rejects inherited city-map keys and unverified application origins',async()=>{
  for(const row of [{...openings[0],location:'constructor'},{...openings[0],apply_now_link:openings[0].apply_now_link.replace('rebithr.darwinbox.in','rebithr.darwinbox.in:8443')}]){
    await assert.rejects(run({fetchJson:async()=>[row]}),/country|scope|identity|payload/i)
  }
})
test('ReBIT default transport rejects foreign final response identities at every stage',async()=>{
  const savedFetch=globalThis.fetch
  try{
    for(const changedUrl of [source.CAREERS_URL,'https://rebit.org.in/main-O5QYG73Y.js','https://rebit.org.in/chunk-DFJHAP4Q.js',source.CAREERS_LOGIN_API_URL,source.CURRENT_OPENINGS_API_URL]){
      const calls=[]
      globalThis.fetch=async(url,options)=>{
        calls.push({url,redirect:options.redirect})
        return {ok:true,status:200,url:url===changedUrl?'https://foreign.example/copied-surface':url,headers:{get:()=>url.includes('/web/api/')?'application/json':'text/html'},text:()=>fetchText(url),json:async()=>url===source.CAREERS_LOGIN_API_URL?{access_token:'test-token'}:structuredClone(openings)}
      }
      await assert.rejects(source.run(),/redirect|identity|first-party/i)
      assert.ok(calls.every(call=>call.redirect==='manual'))
    }
  }finally{globalThis.fetch=savedFetch}
})
