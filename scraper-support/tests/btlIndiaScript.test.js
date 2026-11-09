import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from '../../scraper/btlindia/script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('../../scraper/btlindia/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>BE PART OF OUR TEAM !</h1>
    <p>
      BTL India is always looking forward to welcome enthusiastic and driven individuals to our family.
      send us your resume at btlinrd-hr@btlnet.com today.
    </p>
    <h4>Job Opportunities</h4>
    <h4><a href="/admin/image/career/Job%20Description%20-%20Firmware%20developer%20%205%20yrs.pdf">Firmware Design engineer - 4 to 6 years</a></h4>
    <h4><a href="/admin/image/career/Job%20Description%20-%20Hardware%20Engineer%206%20to%208%20yrs..pdf">Hardware Design engineer - 6 to 8 years</a></h4>
    <h4><a href="/admin/image/career/Job%20Description%20-%20I%26S%20Software%20Design%20Engineer%205%20to%208%20yrs.pdf">Software design engineer (R&amp;D Improvement &amp; Support)- 5 to 8 years</a></h4>
    <h4><a href="/admin/image/career/Job%20Description%20-%20I%26S%20Hardware%20Engineer%206%20to%208%20yrs..pdf">Hardware engineer (R&amp;D Improvement &amp; Support) - 6 to 8 years</a></h4>
  </body>
</html>
`

const loadBtlModule = async () => {
  try {
    return await import('../../scraper/btlindia/script.js')
  } catch {
    assert.fail('Expected BTL India scraper module at ../../scraper/btlindia/script.js')
  }
}

test('hasOfficialCareersSignal validates the verified BTL India careers surface', async () => {
  const btl = await loadBtlModule()

  assert.equal(btl.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test("BTL native PDF listings preserve plain titles, literal URLs and unknown geography",async()=>{const jobs=nativeSource.extractPublicListings(nativePage(nativeSource.CAREERS_URL));assert.equal(jobs.length,4);assert.equal(jobs[0].title,'Firmware Design engineer - 4 to 6 years');assert.match(jobs[0].sourceUrl,/developer%20%205%20yrs/);assert.ok(jobs.every(job=>job.country==null&&job.location==null&&job.requisitionId==null&&job.jobDescription==null));assert.equal(jobs[0].applyUrl,'mailto:btlinrd-hr@btlnet.com')})

test("BTL default native path closes four advertised PDFs and keeps their dates and countries unqualified",async()=>{await withCapturedNative(async calls=>{const jobs=await nativeSource.run();assert.equal(calls.length,10);assert.ok([...new Set(calls.map(c=>c.url))].every(url=>calls.filter(c=>c.url===url).length===2));assert.equal(jobs.length,4);assert.ok(jobs.every(job=>job.source==='btlindia'&&job.jobDescription.length>2000&&job.postingDate==null&&job.country==null));assert.equal(capturedInventory(jobs).status,'coverage-gap')})})

test("BTL changed employer surface fails closed without requesting unbound PDFs",async()=>{await assert.rejects(nativeSource.run({fetchText:async()=>'<html><title>Another employer</title></html>'}),error=>error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null)})
