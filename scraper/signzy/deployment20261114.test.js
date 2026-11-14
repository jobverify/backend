import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import observed from './observed.fixture.json' with {type:'json'}
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const official='https://www.signzy.com/careers'
const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261114/assets.json.gz',import.meta.url))))
const transport=(change=(url,body)=>body)=>{const calls=[];const fetchImpl=async value=>{
 const url=String(value);calls.push(url)
 const row=current[url]||(!url.startsWith('https://www.signzy.com/')&&observed[url])
 assert.ok(row,'Unexpected stale or undeclared URL '+url)
 const body=change(url,row.body)
 return {status:row.status,ok:row.status===200,url:row.finalUrl,text:async()=>new Response(body).text(),json:async()=>JSON.parse(body)}
};fetchImpl.calls=calls;return fetchImpl}
test('current declared Signzy deployment recovers native India roles without requesting retired assets',async()=>{
 const fetchImpl=transport();const jobs=await run({fetchImpl})
 assert.equal(jobs.length,19);assert.equal(new Set(jobs.map(job=>job.jobId)).size,19)
 assert.ok(jobs.every(job=>job.country==='India'&&job.companyCareerPage===official))
 assert.ok(fetchImpl.calls.some(url=>url.includes('webpack-35832e21aef20912')))
 assert.ok(!fetchImpl.calls.some(url=>url.includes('webpack-1952010a31572163')))
 assert.equal(jobs.filter(job=>job.sourceDetailComplete===true).length,18)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
test('unreviewed Signzy corporate deployment fails before requesting any retired runtime',async()=>{
 const fetchImpl=transport((url,body)=>url===official?body.replaceAll('dpl_2QWWHsgFY8JCznBCtwpQt3MCfo1A','dpl_unreviewed'):body)
 await assert.rejects(run({fetchImpl}),/unreviewed.*deployment/)
 assert.deepEqual(fetchImpl.calls,[official])
})
test('current Signzy deployment still rejects a changed complete NextScript bridge',async()=>{
 const fetchImpl=transport((url,body)=>url.includes('/2630-e086bcee3b2bfc1f.js')?body+';window.changed=true;':body)
 await assert.rejects(run({fetchImpl}),/bridge/)
})
import {setTimeout as delay} from 'node:timers/promises'
test('Signzy fetches declared deployment assets concurrently within a four-request limit',async()=>{
 const underlying=transport();let active=0,peak=0
 const fetchImpl=async(url,options)=>{
  if(String(url)===official||!Object.hasOwn(current,String(url)))return underlying(url,options)
  active++;peak=Math.max(peak,active)
  try{await delay(3);return await underlying(url,options)}finally{active--}
 }
 const jobs=await run({fetchImpl});assert.equal(jobs.length,19)
 assert.ok(peak>1,'independent deployment asset requests must overlap')
 assert.ok(peak<=4,'at most four independent asset requests may run at once')
 for(const url of Object.keys(current).filter(url=>url!==official))assert.equal(underlying.calls.filter(value=>value===url).length,2,'both complete asset inventories must be retained: '+url)
})
