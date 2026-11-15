import assert from 'node:assert/strict'
import test from 'node:test'
import {createEnerparcEnergyScraper,hasOfficialCareersSignal,hasNoPublicListingsSignal,hasVerifiedCloudflareChallengeSignal} from '../../scraper/enerparcenergy/script.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {fixture,replay,response,BOARD,CORPORATE,ROLE,changeDetailBinding,changeHiddenCarrier} from '../../scraper/enerparcenergy/test-data/replay20261114.js'

const provider=()=>getScraperCatalog().find(row=>row.source==='enerparcenergy')
const careersHtml=`<!doctype html><html lang="en"><body><h1>Apply Now</h1><section><h2>Careers</h2><p>Enerparc is a certified Great Place to Work.</p><a href="https://enerparc.zohorecruit.in/jobs/Careers">Apply Now</a></section><footer>Enerparc Energy Pvt. Ltd.</footer></body></html>`

test('preserves historical official-surface helpers and acquires complete own native criteria at the registered route',async()=>{
 assert.equal(hasOfficialCareersSignal(careersHtml),true)
 assert.equal(hasNoPublicListingsSignal(careersHtml),true)
 const transport=replay(),jobs=await createCatalogScraper(provider()).run(transport.options)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].company,'Enerparc Energy')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDescription,fixture.expectedRole.Job_Description)
 assert.deepEqual(jobs[0].sourceNativeDetailRecord,fixture.expectedRole)
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.unhydratedRecordCount,24)
 assert.equal(jobs.nativeCollectionEvidence.currentCorporateBindingVerified,false)
 assert.equal(transport.requests.length,8)
 assert.equal(transport.requests.some(row=>row.url===CORPORATE),false)
})

test('fails closed when the current own native Enerparc employer identity changes',async()=>{
 const transport=replay(({url,bytes})=>url===BOARD?{bytes:changeHiddenCarrier(bytes,'meta',meta=>{meta.org_info.company_name='Unrelated site'})}:{})
 await assert.rejects(createEnerparcEnergyScraper().run(transport.options),/own employer|model/)
 assert.equal(transport.requests.length,1)
})

test('fails closed when a listed public opening supplies only its title instead of full criteria',async()=>{
 const transport=replay(({url,bytes})=>url===ROLE?{bytes:changeDetailBinding(bytes,'jobs',jobs=>{jobs[0].Job_Description=jobs[0].Posting_Title})}:{})
 await assert.rejects(createCatalogScraper(provider()).run(transport.options),/full original criteria unavailable/)
 assert.equal(transport.requests.length,3)
})

test('a recognized historical Cloudflare challenge cannot authorize an empty current native result or extra fallback reads',async()=>{
 const blocked=fixture.packets.find(row=>row.status===403)
 assert.equal(hasVerifiedCloudflareChallengeSignal({...blocked,url:CORPORATE,html:Buffer.from(blocked.bodyBase64,'base64').toString('utf8')}),true)
 const requests=[]
 await assert.rejects(createCatalogScraper(provider()).run({fetchImpl:async url=>{requests.push(url);return response(blocked,{url:BOARD})}}),error=>error.status===403&&/Original native HTTP 403/.test(error.message))
 assert.deepEqual(requests,[BOARD])
})

for(const callback of ['fetchText','fetchJson'])test('body-only '+callback+' is rejected before I/O at the registered route',async()=>{
 let reads=0
 await assert.rejects(createCatalogScraper(provider()).run({[callback]:async()=>{reads++;return careersHtml}}),/Original HTTP metadata is required/)
 assert.equal(reads,0)
})
