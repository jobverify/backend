import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from '../../scraper/deitelengineeringsolutionsllp/script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('../../scraper/deitelengineeringsolutionsllp/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

const loadDeitelModule = async () => {
  try {
    return await import('../../scraper/deitelengineeringsolutionsllp/script.js')
  } catch {
    assert.fail('Expected DEITEL Engineering Solutions LLP scraper module at ../../scraper/deitelengineeringsolutionsllp/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DEITEL &#8211; Engineering|Resource|Solutions</title>
  </head>
  <body>
    <header>
      <a href="https://deitel.in/">Home</a>
      <a href="https://deitel.in/career/">Career</a>
      <div class="tagline site-description">Engineering|Resource|Solutions</div>
    </header>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career &#8211; DEITEL</title>
    <link rel="canonical" href="https://deitel.in/career/" />
  </head>
  <body>
    <main>
      <article>
        <h1 class="entry-title">Career</h1>
        <div class="entry-content">
          <p>
            <em>
              Candidates with relevant experience in following areas can apply to
              <span style="text-decoration: underline;">
                <span style="color: #0000ff; text-decoration: underline;">hr@deitel.in</span>
              </span>
            </em>
          </p>
          <ul>
            <li>Mechanical design for automotive and non-auto domains</li>
            <li>Analysis and simulation engineers</li>
            <li>Manufacturing engineering</li>
            <li>Automotive electronics and embedded system areas</li>
            <li>Technical writers and illustrators with aero/non-aero background</li>
            <li>Senior engineers/Subject matter experts in key engineering domains (30+ years exp)</li>
          </ul>
        </div>
      </article>
    </main>
  </body>
</html>
`

test("DEITEL published role areas remain discovery metadata without becoming six vacancies",async()=>{assert.equal(nativeSource.hasOfficialHomepageSignal(nativePage(nativeSource.HOMEPAGE_URL)),true);const jobs=nativeSource.extractOpenings(nativePage(nativeSource.CAREERS_URL));assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedRoleAreas.length,6);assert.equal(jobs.nativeCollectionEvidence.recordKind,'role-areas');assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,0);assert.equal(capturedInventory(jobs).reportedTotal,null)})

test("DEITEL first-party handoff preserves six non-vacancy observations and unknown company scope",async()=>{await withCapturedNative(async calls=>{const jobs=await nativeSource.run();assert.equal(calls.length,2);assert.equal(jobs.length,0);const observation=capturedObservations(jobs,'deitelengineeringsolutionsllp');assert.equal(observation.recordKind,'role-areas');assert.equal(observation.observedRecordCount,6);assert.equal(observation.observedVacancyCount,0);assert.equal(observation.companyGlobalTotal,null);assert.equal(capturedInventory(jobs).status,'coverage-gap')})})

test("DEITEL missing employer handoff or role-area scope is unavailable rather than verified empty",async()=>{await assert.rejects(nativeSource.run({fetchText:async()=>'<html><title>Changed</title></html>'}),/native:/);const changed=nativePage(nativeSource.CAREERS_URL).replace(/<ul>\s*<li>Mechanical design[\s\S]*?<\/ul>/,'');assert.notEqual(changed,nativePage(nativeSource.CAREERS_URL));assert.throws(()=>nativeSource.extractOpenings(changed),/native:/)})
