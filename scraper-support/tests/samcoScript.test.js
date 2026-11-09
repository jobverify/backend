import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from '../../scraper/samco/script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('../../scraper/samco/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Samco Stock Recommendations & Trading App | Best Stock Broker With Flat ₹20 Brokerage</title>
    <meta property="og:url" content="https://www.samco.in/" />
    <script type="application/ld+json">{"name":"Samco Securities Limited"}</script>
  </head>
  <body>
    <a href="https://www.samco.in/careers">Careers</a>
    <p>Open Demat Account</p>
    <p>Scientific Recommendations</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Explore a career at Samco | Opening Positions & Vacancies</title>
    <meta property="og:url" content="https://www.samco.in/careers" />
    <link rel="canonical" href="https://www.samco.in/careers" />
    <script type="application/ld+json">{"name":"SAMCO Securities Limited"}</script>
  </head>
  <body>
    <form id="careerForm"></form>
    <select id="dep_position">
      <option data-value="115" data-id="Channel Sales" value="115">Channel Sales</option>
      <option data-value="127" data-id="Growth" value="127">Growth</option>
      <option data-value="139" data-id="Operations" value="139">Operations</option>
      <option data-value="27" data-id="RankMF - B2B Sales" value="27">RankMF - B2B Sales</option>
    </select>
    <select id="depPosition" name="depPosition"></select>
    <input type="file" id="userfile" name="userfile" />
    <button id="careerSubmit">Submit</button>
    <p>SAMCO Securities Limited</p>
    <p>Registered Address: SAMCO Securities Limited</p>
    <a data-value="115" data-id="Channel Sales" class="video-listing" href="#job-115">
      <div class="v-text">Channel Sales</div>
      <div class="apply-txt">Apply now</div>
    </a>
    <a data-value="127" data-id="Growth" class="video-listing" href="#job-127">
      <div class="v-text">Growth</div>
      <div class="apply-txt">Apply now</div>
    </a>
    <a data-value="139" data-id="Operations" class="video-listing" href="#job-139">
      <div class="v-text">Operations</div>
      <div class="apply-txt">Apply now</div>
    </a>
    <a data-value="27" data-id="RankMF - B2B Sales" class="video-listing" href="#job-27">
      <div class="v-text">RankMF - B2B Sales</div>
      <div class="apply-txt">Apply now</div>
    </a>
  </body>
</html>
`

const loadSamcoModule = async () => {
  try {
    return await import('../../scraper/samco/script.js')
  } catch {
    assert.fail('Expected Samco scraper module at ../../scraper/samco/script.js')
  }
}

test('Samco exports a stable exact-name wrapper over the verified SAMCO first-party careers contract', async () => {
  const samco = await loadSamcoModule()

  assert.equal(samco.SOURCE, 'samco')
  assert.equal(samco.COMPANY, 'Samco')
  assert.equal(samco.OFFICIAL_BRAND_NAME, 'SAMCO Securities Limited')
  assert.equal(samco.HOMEPAGE_URL, 'https://www.samco.in/')
  assert.equal(samco.CAREERS_URL, 'https://www.samco.in/careers')
  assert.equal(samco.COMPANY_DOMAIN, 'samco.in')
  assert.equal(samco.ATS_PLATFORM, 'official-company-careers')
  assert.equal(samco.COUNTRY_FILTER, 'India')
  assert.equal(samco.PAGINATION_STRATEGY, 'single-first-party-careers-page-with-public-department-options')
  assert.equal(samco.VERIFIED_ON, '2026-10-03')
  assert.match(samco.VERIFIED_SURFACE_SUMMARY, /Channel Sales/i)
  assert.match(samco.VERIFIED_SURFACE_SUMMARY, /Engineering/i)
  assert.equal(samco.hasVerifiedSamcoHomepageSignal(homepageHtml), true)
  assert.equal(samco.hasVerifiedSamcoCareersSignal(careersHtml), true)
  assert.deepEqual(
    samco.decorateSamcoJob(
      {
        title: 'Channel Sales',
        company: 'SAMCO Securities Limited',
        source: 'samcosecuritieslimited',
        jobId: 'samcosecuritieslimited-115-channel-sales',
        link: 'https://www.samco.in/careers',
        applyUrl: 'https://www.samco.in/careers',
        sourceUrl: 'https://www.samco.in/careers#samcosecuritieslimited-115-channel-sales',
      },
      '2026-07-15T21:30:00.000Z',
    ),
    {
      title: 'Channel Sales',
      company: 'Samco',
      source: 'samco',
      jobId: 'samcosecuritieslimited-115-channel-sales',
      link: 'https://www.samco.in/careers',
      applyUrl: 'https://www.samco.in/careers',
      sourceUrl: 'https://www.samco.in/careers#samcosecuritieslimited-115-channel-sales',
      companyCareerPage: 'https://www.samco.in/careers',
      companyDomain: 'samco.in',
      atsPlatform: 'official-company-careers',
      scrapedAt: '2026-07-15T21:30:00.000Z',
    },
  )
})

test("Samco wrapper retains its source attribution for eight native positions and mixed observation evidence",async()=>{await withCapturedNative(async()=>{const jobs=await nativeSource.run();assert.equal(jobs.length,8);assert.ok(jobs.every(job=>job.source==='samco'&&job.company==='Samco'&&job.country==null));assert.equal(jobs.find(job=>job.requisitionId==='171').location,'Mumbai');const observation=capturedObservations(jobs,'samco');assert.equal(observation.observedRecordCount,12);assert.equal(observation.observedVacancyCount,8);assert.equal(observation.companyIndiaTotal,null);assert.equal(capturedInventory(jobs).listingComplete,false)})})

test('Samco fails closed when the verified homepage or careers page drifts materially', async () => {
  const samco = await loadSamcoModule()

  await assert.rejects(
    samco.createSamcoScraper().run({
      fetchText: async (url) => {
        if (url === samco.HOMEPAGE_URL) return '<html><body>Different homepage</body></html>'
        return careersHtml
      },
    }),
    /verified Samco homepage/i,
  )

  await assert.rejects(
    samco.createSamcoScraper().run({
      fetchText: async (url) => {
        if (url === samco.HOMEPAGE_URL) return homepageHtml
        return '<html><body>Different careers page</body></html>'
      },
    }),
    /verified Samco careers page/i,
  )
})
