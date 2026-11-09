import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from './script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

const loadSamcoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SAMCO Securities Limited scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Samco Stock Recommendations & Trading App | 20 Brokerage</title>
      <link rel="canonical" href="https://www.samco.in/" />
      <meta property="og:url" content="https://www.samco.in/" />
    </head>
    <body>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "Organization",
          "name": "Samco Securities Limited",
          "alternateName": "Samco",
          "url": "https://www.samco.in/"
        }
      </script>
      <h1>Invest in Indian & US Markets with Scientific Recommendations</h1>
      <a href="https://www.samco.in/careers" id="careers-footer">Careers</a>
      <a href="https://www.samco.in/open-free-demat-account">Open Demat Account</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Explore a career at Samco | Opening Positions & Vacancies</title>
      <meta property="og:url" content="https://www.samco.in/careers" />
      <link rel="canonical" href="https://www.samco.in/careers" />
    </head>
    <body>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "Organization",
          "name": "SAMCO Securities Limited",
          "url": "https://www.samco.in/"
        }
      </script>

      <section class="carrier-section">
        <h1>Discover Your Future at Samco</h1>
        <p>Join a culture that values innovation, learning, and growth.</p>

        <div class="steps-box bene-steps" id="positionsList">
          <a href="javascript:void(0);" data-value="115" data-id="Channel Sales" class="video-listing">
            <div class="ctxt">
              <div class="v-text">Channel Sales</div>
              <div class="apply-txt">Apply now</div>
            </div>
          </a>
          <a href="javascript:void(0);" data-value="127" data-id="Growth" class="video-listing">
            <div class="ctxt">
              <div class="v-text">Growth</div>
              <div class="apply-txt">Apply now</div>
            </div>
          </a>
          <a href="javascript:void(0);" data-value="139" data-id="Operations" class="video-listing">
            <div class="ctxt">
              <div class="v-text">Operations</div>
              <div class="apply-txt">Apply now</div>
            </div>
          </a>
          <a href="javascript:void(0);" data-value="27" data-id="RankMF - B2B Sales" class="video-listing">
            <div class="ctxt">
              <div class="v-text">RankMF - B2B Sales</div>
              <div class="apply-txt">Apply now</div>
            </div>
          </a>
        </div>

        <form class="cmxform" name="careerForm" id="careerForm" method="post" action="javascript:void(0);">
          <select class="op-controller dep_position" id="dep_position">
            <option data-value="115" data-id="Channel Sales" value="115">Channel Sales</option>
            <option data-value="127" data-id="Growth" value="127">Growth</option>
            <option data-value="139" data-id="Operations" value="139">Operations</option>
            <option data-value="27" data-id="RankMF - B2B Sales" value="27">RankMF - B2B Sales</option>
          </select>

          <select class="op-controller select-bg border-gray" id="depPosition" name="depPosition">
            <option selected disabled>Select position</option>
          </select>

          <p id="positionDescription"></p>
          <input type="hidden" id="hiddendescription" name="hiddendescription" value="" />
          <input type="hidden" id="hiddendepartment" name="hiddendepartment" value="" />
          <input type="hidden" id="firsthiddendepartment" name="firsthiddendepartment" value="" />
          <input class="op-controller border-gray" type="file" id="userfile" name="userfile" />
          <button class="btn brand-btn" type="button" id="careerSubmit" name="careerSubmit" value="submit">
            Submit
          </button>
        </form>
      </section>

      <div class="term-consition">
        <p>
          <a href="https://www.samco.in/certificate-of-incorporation">SAMCO Securities Limited</a>
          (Formerly known as Samruddhi Stock Brokers Limited)
        </p>
        <p>
          Registered Address: SAMCO Securities Limited, 1004 - A, 10th Floor, Naman Midtown - A Wing,
          Senapati Bapat Marg, Prabhadevi, Mumbai - 400 013, Maharashtra, India.
        </p>
      </div>
    </body>
  </html>
`

test('SAMCO sentinels recognize the verified homepage and first-party careers page', async () => {
  const samco = await loadSamcoModule()

  assert.equal(samco.SOURCE, 'samcosecuritieslimited')
  assert.equal(samco.COMPANY, 'SAMCO Securities Limited')
  assert.equal(samco.HOMEPAGE_URL, 'https://www.samco.in/')
  assert.equal(samco.CAREERS_URL, 'https://www.samco.in/careers')
  assert.equal(samco.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(samco.hasOfficialCareersSignal(careersHtml), true)
})

test("SAMCO accepts a bound department rename without turning the filter label into a vacancy",async()=>{const html=nativePage(nativeSource.CAREERS_URL).replaceAll('Engineering','Controlled Platform'),jobs=nativeSource.extractPublicJobs(html);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedDepartments.find(row=>row.id==='125').name,'Controlled Platform');assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,0)})

test("SAMCO four active department options remain discovery records until native positions are fetched",async()=>{const jobs=nativeSource.extractPublicJobs(nativePage(nativeSource.CAREERS_URL));assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedDepartments.length,4);assert.equal(jobs.nativeCollectionEvidence.recordKind,'departments');assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,0);assert.equal(capturedInventory(jobs).reportedTotal,null)})

test("SAMCO resolves eight native position identities and retains duplicate titles across different IDs",async()=>{await withCapturedNative(async calls=>{const jobs=await nativeSource.run();assert.equal(jobs.length,8);assert.equal(calls.filter(call=>call.method==='POST').length,12);assert.equal(new Set(jobs.map(job=>job.requisitionId)).size,8);assert.equal(jobs.filter(job=>job.title==='Business Development Manager').length,2);assert.ok(jobs.every(job=>job.country==null&&job.postingDate==null));assert.equal(capturedInventory(jobs).status,'coverage-gap')})})

test("SAMCO employer identity and canonical source drift remain unavailable with unknown inventory",async()=>{await assert.rejects(nativeSource.run({fetchText:async()=>'<html><title>Changed</title></html>'}),error=>error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null);const html=nativePage(nativeSource.CAREERS_URL).replace('rel="canonical" href="https://www.samco.in/careers"','rel="canonical" href="https://foreign.example/careers"');assert.notEqual(html,nativePage(nativeSource.CAREERS_URL));assert.throws(()=>nativeSource.extractPublicJobs(html),/native:/)})
