import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as rupeek from '../../scraper/rupeek/script.js'
import {readRole} from '../../scraper/rupeek/native20261111.js'
import {normalizeScrapedJob} from '../utils/normalizeScrapedJob.js'
import {analyzePublishableJobs} from '../utils/publishableJobMetrics.js'

const discovery=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/rupeek/fixtures/discovery20261111.json.gz',import.meta.url))))
const partial=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/rupeek/fixtures/partial20261111.json.gz',import.meta.url))))
const html=packet=>Buffer.from(packet.rawBodyBase64,'base64').toString('utf8')
const corporate=html(discovery.packets[0]),detail=html(discovery.packets[1])
const response=(packet,body=Buffer.from(packet.rawBodyBase64,'base64'))=>{const result=new Response(body,{status:packet.status,headers:packet.headers});Object.defineProperty(result,'url',{value:packet.requestedUrl??packet.url});return result}
const controlledCard=(id,title,location)=>'<a href="https://www.linkedin.com/jobs/view/controlled-at-rupeek-'+id+'"><p>'+title+'</p><p>Location: '+location+'</p><p>1 day ago</p></a>'
// Historical inline fixtures were authored controls, not retained July HTTP
// bytes. Keep their India/city-only/foreign distinctions explicitly controlled.
const controlledLegacy='<html><head><title>Join our team | Rupeek | Careers</title><link rel="canonical" href="https://rupeek.com/careers"></head><body><h2>Why join Us?</h2><h2>Engineering at Rupeek</h2><div>Open Positions</div>'+controlledCard('9000000001','Taxation Analyst','Bengaluru, Karnataka, India')+controlledCard('9000000002','Back Office Executive','Greater Bengaluru Area')+controlledCard('9000000003','Growth Manager','Singapore')+'</body></html>'

test('Rupeek helpers remain pinned to the official publisher while preserving candidate country distinctions',()=>{
 assert.equal(rupeek.SOURCE,'rupeek');assert.equal(rupeek.COMPANY_NAME,'Rupeek');assert.equal(rupeek.OFFICIAL_BRAND_NAME,'Rupeek')
 assert.equal(rupeek.VERIFIED_ON,'2026-11-11')
 assert.equal(rupeek.OFFICIAL_CAREERS_URL,'https://rupeek.com/about/careers')
 assert.equal(rupeek.OFFICIAL_CAREERS_CANONICAL_URL,'https://rupeek.com/careers')
 assert.equal(rupeek.hasOfficialRupeekCareersSignals(controlledLegacy),true)
 assert.equal(rupeek.hasOfficialRupeekCareersSignals(controlledLegacy.replace('Open Positions','Open Roles')),false)
 const rows=rupeek.extractJobCardsFromCareersHtml(controlledLegacy)
 assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.country),['India',null,'Singapore'])
 assert.ok(rows.every(r=>r.requisitionId===null));assert.equal(rows[1].sourceCountryScopeUnresolved,true)
 const normalized=rows.map(r=>normalizeScrapedJob({...r,source:'rupeek',company:'Rupeek'},{countryFilter:'India',country:'India'}))
 assert.equal(analyzePublishableJobs(normalized).indiaJobs.length,1)
})

test('Rupeek accepts genuine current official copy only through its bound React reveal',()=>{
 assert.equal(rupeek.hasOfficialRupeekCareersSignals(corporate),true)
 const rows=rupeek.extractJobCardsFromCareersHtml(corporate)
 assert.equal(rows.length,15);assert.equal(new Set(rows.map(r=>r.jobId)).size,15)
 assert.ok(rows.every(r=>r.country==='India'&&r.location==='Bengaluru, Karnataka, India'))
 assert.equal(rows[0].jobId,'4486374940')
 assert.equal(rupeek.hasOfficialRupeekCareersSignals(corporate.replace('$RC("B:1","S:1")','$RC("B:1","other")')),false)
})

test('Rupeek run validates original current publisher and native responses and stops at genuine first429',async()=>{
 let ordinal=0,globalCalls=0
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{globalCalls++;throw Error('unexpected real network')}
 try{
  await assert.rejects(rupeek.createRupeekScraper().run({fetchImpl:async(url,init)=>{
   const packet=partial.nativeEvidence.transportPackets[ordinal++]
   assert.ok(packet);assert.equal(url,packet.url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
   return response(packet)
  }}),error=>{
   assert.equal(error.status,429);assert.equal(error.abortRetries,true);assert.equal(ordinal,12)
   assert.equal(error.nativeEvidence.observedCorporateRoleCards,15)
   assert.equal(error.nativeEvidence.observedListingCount,null)
   assert.equal(error.nativeEvidence.sourceScopeComplete,false);assert.equal(error.nativeEvidence.lifecycleCleanupAllowed,false)
   for(let i=0;i<12;i++){
    const retained=error.nativeEvidence.transportPackets[i],original=partial.nativeEvidence.transportPackets[i]
    assert.equal(retained.rawBodyBase64,original.rawBodyBase64);assert.equal(retained.status,original.status)
    assert.equal(retained.bodySHA256,createHash('sha256').update(Buffer.from(original.rawBodyBase64,'base64')).digest('hex'))
   }
   return true
  })
 }finally{globalThis.fetch=originalFetch}
 assert.equal(globalCalls,0)
})

test('Rupeek fails closed on current publisher drift before any detail read',async()=>{
 let calls=0
 await assert.rejects(rupeek.createRupeekScraper().run({fetchImpl:async url=>{
  calls++;assert.equal(url,rupeek.OFFICIAL_CAREERS_URL)
  return response(discovery.packets[0],corporate.replace('Join our team | Rupeek | Careers','Other publisher'))
 }}),/verified official careers page/)
 assert.equal(calls,1)
})

test('Rupeek body-only callbacks fail before callback or generic network invocation',async()=>{
 let calls=0;const unexpected=async()=>{calls++;throw Error('unexpected request')}
 await assert.rejects(rupeek.createRupeekScraper().run({fetchText:unexpected,fetchImpl:unexpected}),/complete native HTTP responses/)
 assert.equal(calls,0)
})

test('Rupeek own200 detail can prove only its exact native role and full criteria without generic composition',()=>{
 const row=rupeek.extractJobCardsFromCareersHtml(corporate)[0],proof=readRole(detail,row)
 assert.equal(proof.sourceDetailComplete,true);assert.match(proof.jobDescription,/Commerce is mandatory/)
 assert.match(proof.jobDescription,/Employment type: Full-time/)
 assert.equal(proof.nativeLegalEmployer,null);assert.equal(proof.skipPublicExperienceEnrichment,true)
 assert.throws(()=>readRole(detail,{...row,jobId:'9000000000'}),/ID mismatch/)
 assert.throws(()=>readRole(detail.replaceAll('Associate','Unrelated Role').replaceAll('Rupeek','Other Corporation'),row))
})
