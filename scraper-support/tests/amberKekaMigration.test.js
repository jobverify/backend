import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import { run } from '../../scraper/amberstudent/script.js'
const career='https://amberstudent.com/career', opening='https://amberstudent.com/job-opening'
const assetRoot='https://cdn-static-assets.amberstudent.com/amber-user-website/build/assets/js/'
const tenant='https://amberstudent.keka.com/careers/'
const identifier='228f83f5-48b3-474a-b753-4fce2be7524f'
const main='path:"/job-opening",exact:!0,component:abc.A;var abc=n(42);42:function(e,t,n){chunkName:()=>"Jobs",importAsync:()=>Promise.all([n.e("100"),n.e("5004")]).then(n.bind(n,45111))};u.u=function(e){return"js/"+e+"."+({5004:"abcdef1234567890"})[e]+".desktop.js"}'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/amber-native-quality.json.gz',import.meta.url))))
const chunk=fixture.requests.find(p=>/\/5004\.[a-f0-9]+\.desktop\.js$/.test(p.requestedURL)).text
const texts={ [career]:'<title>Careers | Amber</title><a href="/job-opening">Explore Open Roles</a>', [opening]:'<script src="'+assetRoot+'main.abcdef.desktop.js"></script>', [assetRoot+'main.abcdef.desktop.js']:main, [assetRoot+'5004.abcdef1234567890.desktop.js']:chunk }
const info={name:'amber',shortName:'amber',careersPortalDomain:'amberstudent.keka.com'}
const role=(id=1,country='IN')=>({id,title:'Engineer',description:'<p>Build student accommodation products.</p>',jobLocations:[{city:'Pune',state:'MH',countryCode:country,countryName:country==='IN'?'India':'United States'}],publishedOn:'2026-09-11T06:38:37.257Z',skillNames:[],departmentName:'Engineering'})
const options=(rows,override={})=>({requestIntervalMs:0,fetchText:async url=>{assert.ok(Object.hasOwn(texts,url),'unexpected '+url);return texts[url]},fetchJson:async url=>url.endsWith('/careerportalinfo')?info:rows,...override})
test('Amber follows the current official route and fingerprinted jobs bundle to its exact Keka tenant',async()=>{
 const jobs=await run(options([role(),role(2,'US')]))
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].postingDate,'2026-09-11T06:38:37.257Z')
 assert.equal(jobs[0].sourceUrl,tenant+'jobdetails/1');assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(jobs[0].sourceClosingQualified,true);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('Amber preserves validated India positives without lifecycle reconciliation when any public role lacks geography',async()=>{
 const jobs=await run(options([role(),{...role(2),jobLocations:[]}]))
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
 const unknown=await run(options([{...role(2),jobLocations:[]}]))
 assert.equal(unknown.length,0)
 assert.deepEqual(unknown[Symbol.for('jobverify.verified-recruitment-observations')].unknownCountryIds,['2'])
})
test('Amber rejects wrong tenants, malformed inventories and duplicate roles',async()=>{
 for(const rows of [{},[role(),role()],[{...role(),description:''}]])await assert.rejects(run(options(rows)),/invalid|duplicate|incomplete/i)
 await assert.rejects(run(options([role()],{fetchJson:async()=>({...info,careersPortalDomain:'unrelated.keka.com'})})),/tenant|identity/i)
 await assert.rejects(run(options([role()],{fetchText:async url=>texts[url]?.replace('amberstudent.keka.com','unrelated.keka.com')})),/tenant|handoff/i)
})
test('Amber rejects generic marketing and honors pre-aborted requests',async()=>{
 await assert.rejects(run(options([],{fetchText:async()=>'<title>Amber</title>Our Culture'})),/careers|handoff/i)
 const reason=new Error('cancelled');await assert.rejects(run(options([],{signal:AbortSignal.abort(reason),fetchText:async()=>assert.fail('no fetch')})),e=>e===reason)
})
