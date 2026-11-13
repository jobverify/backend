import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as native from './nativeContract.js'
import {revisitFixture} from './revisitFixture.js'
import {run} from './script.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
import {readNativeDocument} from './nativeHtml.js'
const f=revisitFixture(import.meta.url),read=name=>gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261113/'+name,import.meta.url))),response=(url,body)=>{const r=new Response(body,{status:200});Object.defineProperty(r,'url',{value:url});return r}
const fixtureNames=['corporate.html.gz','board.html.gz','jobs.json.gz'],hashes=['3cb242039ea2707117c6531114ffdcb01f01d0c54b1058f96b6e9e07f05c4e85','e8b915b620fba5fa5b812e4593d3906736d194a59aa58776eede79aef7452dca','24c12388e849652c64fd8523558ebf82946afce179583d9f8c69b4505c8f81c3']
test('original successful corporate bytes bind the exact currently available native Castrol account',()=>{
 for(let i=0;i<fixtureNames.length;i++)assert.equal(createHash('sha256').update(read(fixtureNames[i])).digest('hex'),hashes[i])
 const board=native.parseCastrolBoard(read(fixtureNames[0]).toString(),read(fixtureNames[1]).toString()),inventory=native.validateCastrolInventory(JSON.parse(read(fixtureNames[2])),board)
 assert.equal(inventory.rows.length,112);assert.equal(inventory.india.length,21);assert.equal(inventory.configuredCountryMembershipComplete,true)
})
test('direct native board parser retains exact employer, public-account and unfiltered-board checks',()=>{
 const html=read('board.html.gz').toString(),board=native.parseCastrolNativeBoard(html)
 assert.equal(board.posts.total,112)
 const changed=html.replaceAll('"urlToken":"castrol"','"urlToken":"another-employer"');assert.notEqual(changed,html)
 assert.throws(()=>native.parseCastrolNativeBoard(changed),/identity|company/)
})
test('public entrypoint reads the reviewed native board directly with every original inventory and detail pass',async()=>{
 const calls=[],reports=[],jobs=await run({fetchImpl:async(url,request)=>{calls.push(url);assert.notEqual(url,native.CORPORATE,'Native primary must not request a consent-gated corporate page');return f.fetchImpl(url,request)},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,25);assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.sourceCorporateHandoffFresh===false&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,25)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:readInventoryEvidence(jobs)}),{replaceExisting:false})
 assert.equal(calls.filter(url=>url===native.BOARD).length,2);assert.equal(calls.filter(url=>url===native.API).length,2);assert.equal(calls.filter(url=>url.includes('/castrol/jobs/')).length,50)
 assert.equal(reports.length,1);assert.equal(reports[0].acquisitionMode,'reviewed-native-board');assert.equal(reports[0].corporateHandoffFresh,false);assert.equal(reports[0].observations.length,96);assert.equal(reports[0].sourceScopeComplete,false);assert.equal(reports[0].companyIndiaTotal,null);assert.equal(reports[0].lifecycleCleanupAllowed,false)
 assert.equal(reports[0].nativePrimaryReview.corporateBodySha256,hashes[0])
})
test('native primary does not suppress a native employer mismatch',async()=>{
 await assert.rejects(run({fetchImpl:async(url,request)=>{if(url===native.API){const p=JSON.parse(f.text(url));p.jobs[0].company_name='Other employer';return response(url,JSON.stringify(p))}return f.fetchImpl(url,request)}}),/company\/title\/URL mismatch/)
})
test('native primary still rejects changed closing own employer identity',async()=>{
 const target='https://job-boards.eu.greenhouse.io/castrol/jobs/4983338101';let reads=0
 await assert.rejects(run({fetchImpl:async(url,request)=>{const r=await f.fetchImpl(url,request);if(url===target&&++reads===2){const html=await r.text(),changed=html.replace('"company_name":"Castrol"','"company_name":"Other employer"');assert.notEqual(changed,html);return response(url,changed)}return r}}),/identity mismatch/)
 assert.equal(reads,2)
})
test('unknown entry modes cannot bypass the reviewed source contract',async()=>{
 await assert.rejects(run({entrySurface:'any-board',fetchImpl:async()=>{throw Error('must not read')}}),/entry surface/)
})
test('native-primary empty account retains scope holds and cannot become authoritative empty or allow cleanup',async()=>{
 const original=f.text(native.BOARD),script=readNativeDocument(original).nodes(n=>n.tag==='script'&&n.raw?.trim().startsWith('window.__remixContext'))[0],match=script.raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/),model=JSON.parse(match[1]),posts=model.state.loaderData['routes/$url_token'].jobPosts
 Object.assign(posts,{data:[],count:0,total:0,total_pages:1})
 const empty=original.replace(script.raw,script.raw.replace(match[1],JSON.stringify(model))),calls=[],jobs=await run({fetchImpl:async url=>{calls.push(url);if(url===native.BOARD)return response(url,empty);assert.equal(url,native.API);return response(url,JSON.stringify({jobs:[],meta:{total:0}}))}}),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(isVerifiedEmptyEvidence(evidence),false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false});assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeAcquisitionEvidence.corporateHandoffFresh,false);assert.equal(jobs.nativeAcquisitionEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeAcquisitionEvidence.lifecycleCleanupAllowed,false)
 assert.match(evidence.reason,/corporate.*company.scope.*unverified/);assert.deepEqual(calls,[native.BOARD,native.API,native.BOARD,native.API])
})
