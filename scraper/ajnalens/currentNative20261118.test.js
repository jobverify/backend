import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-20261118.json.gz',import.meta.url))))
function replay(edit=(url,body)=>body){return{fetchPage:async url=>{const p=packets.find(p=>p.url===(url===CAREERS_URL?'https://www.ajnalens.com/careers':url));assert.ok(p,url);return{url:p.finalUrl,status:p.status,html:edit(url,p.body)}}}}
test('current AjnaLens complete title-only program retains two observed openings without fabricated criteria or India jobs',async()=>{
 const jobs=await run(replay());assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'ajnalens').observedVacancyCount,2);assert.equal(jobs.nativeCollectionEvidence.fullCriteriaPublished,false);assert.equal(jobs.nativeCollectionEvidence.nativeWorkCountriesPublished,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('current AjnaLens client mutation and inactive declaration stay rejected',async()=>{
 await assert.rejects(run(replay((url,body)=>url.endsWith('.js')?body+'\nwindow.changedOpeningRules=true;':body)),/client contract/)
 await assert.rejects(run(replay((url,body)=>url===CAREERS_URL?body.replace('src="/_next/static/chunks/9ae02a466e00eb50.js"','nomodule src="/_next/static/chunks/9ae02a466e00eb50.js"'):body)),/client missing/)
})
