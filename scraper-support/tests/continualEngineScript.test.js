import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from '../../scraper/continualengine/script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('../../scraper/continualengine/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <div class="elementor-accordion-item">
    <h3 id="elementor-tab-title-3311" class="elementor-tab-title" aria-controls="elementor-tab-content-3311">
      <a class="elementor-accordion-title" tabindex="0">Product Analyst</a>
    </h3>
    <div id="elementor-tab-content-3311" class="elementor-tab-content elementor-clearfix">
      <ul><li>Minimum of 2 years of experience as a Product Analyst or in a similar role.</li></ul>
      <a class="apply_now" href="mailto:contact@continualengine.com">Apply now</a>
    </div>
  </div>
  <div class="elementor-accordion-item">
    <h3 id="elementor-tab-title-3312" class="elementor-tab-title" aria-controls="elementor-tab-content-3312">
      <a class="elementor-accordion-title" tabindex="0">Editor - Alt text <span>(All engineering subjects)</span></a>
    </h3>
    <div id="elementor-tab-content-3312" class="elementor-tab-content elementor-clearfix">
      <ul><li>Minimum of 2 years of experience in alt text creation and eLearning content editing.</li></ul>
      <a class="apply_now" href="mailto:contact@continualengine.com">Apply now</a>
    </div>
  </div>
`

test("Continual Engine complete active panels preserve native text with unknown workplace, country and requisition",async()=>{const jobs=nativeSource.extractCareerListings(nativePage(nativeSource.CAREERS_URL));assert.equal(jobs.length,4);assert.equal(jobs[0].title,'Product Analyst');assert.ok(jobs.every(job=>job.jobDescription.length>400&&job.location==null&&job.country==null&&job.requisitionId==null));assert.match(jobs[0].sourceUrl,/#elementor-tab-title-3311$/);assert.match(jobs[3].jobDescription,/Responsibilities/i)})

test("Continual Engine default path reads one native page and retains partial inventory metadata",async()=>{await withCapturedNative(async calls=>{const jobs=await nativeSource.run();assert.equal(calls.length,1);assert.equal(jobs.length,4);assert.ok(jobs.every(job=>job.source==='continualengine'&&job.country==null));assert.equal(capturedInventory(jobs).status,'coverage-gap');assert.equal(capturedInventory(jobs).indiaFacetCount,null)})})
