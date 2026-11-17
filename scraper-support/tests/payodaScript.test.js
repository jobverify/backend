import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadPayodaModule = async () => {
  try {
    return await import('../../scraper/payoda/script.js')
  } catch {
    return null
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers · Build the future of agentic AI at Payoda</title>
  </head>
  <body>
    <main>
      <h1>Build the future of agentic AI for the industries that move the world.</h1>
      <section>
        <h2>Open Roles</h2>
        <p>Click any role to read the full job description. Inside, apply through Gmail or Outlook in your browser, or hand off to your default mail app. Every option opens a pre-filled draft to joinus@payoda.com.</p>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4 class="font-display font-semibold text-[1rem] sm:text-[1.05rem] text-black group-hover:text-burg transition-colors mb-1.5 leading-snug">Senior ReactJS Developer</h4>
            <div class="text-[0.74rem] text-g500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span class="inline-flex items-center gap-1.5 bg-burg/8 text-burg px-2 py-0.5 rounded-full font-display font-semibold text-[0.66rem] uppercase tracking-[0.08em]">Engineering</span>
              <span class="flex items-center gap-1">Coimbatore · Chennai · Bangalore</span>
              <span class="text-g300">·</span>
              <span>5–10 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Senior Golang Developer</h4>
            <div>
              <span>Engineering</span>
              <span>Coimbatore · Chennai · Bangalore</span>
              <span>·</span>
              <span>5–10 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Backend Engineer (Scala / Play)</h4>
            <div>
              <span>Engineering</span>
              <span>Hyderabad</span>
              <span>·</span>
              <span>3+ yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Power Platform Developer</h4>
            <div>
              <span>Engineering</span>
              <span>Bangalore · Mumbai · Delhi · Jaipur</span>
              <span>·</span>
              <span>4–8 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Support Engineer</h4>
            <div>
              <span>Customer Success</span>
              <span>Bangalore · Mumbai · Delhi · Jaipur</span>
              <span>·</span>
              <span>4–8 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
        <button type="button" class="group flex items-center justify-between gap-4 p-5 sm:p-6 bg-white border border-g200 rounded-[12px] hover:border-burg/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all min-h-[44px] text-left">
          <div class="min-w-0 flex-1">
            <h4>Digital Marketing Specialist</h4>
            <div>
              <span>Marketing</span>
              <span>Coimbatore · India</span>
              <span>·</span>
              <span>7–10 yrs · Full-time</span>
            </div>
          </div>
          <span>View job</span>
        </button>
      </section>
      <section>
        <a href="mailto:joinus@payoda.com?subject=CV%3A%20open%20application">Send us your CV</a>
      </section>
    </main>
  </body>
</html>
`

const currentCareersPageHtml = careersPageHtml
  .replaceAll('View job', 'View role')
  .replaceAll('Â·', '·')
  .replaceAll('5â€“10 yrs', '5–10 yrs')
  .replaceAll('4â€“8 yrs', '4–8 yrs')
  .replaceAll('7â€“10 yrs', '7–10 yrs')

test('Payoda historical presentation helper retains its dated role-card contract', async () => {
  const payoda = await loadPayodaModule()
  assert.ok(payoda, 'Expected Payoda scraper module at ../../scraper/payoda/script.js')

  assert.equal(payoda.CAREERS_URL, 'https://www.payoda.com/careers')
  assert.equal(payoda.COMPANY, 'Payoda')
  assert.equal(payoda.SOURCE, 'payoda')
  assert.equal(payoda.APPLICATION_EMAIL, 'joinus@payoda.com')
  assert.equal(payoda.hasOfficialCareersSignal(careersPageHtml), true)

  assert.deepEqual(payoda.extractRoleCards(careersPageHtml), [
    {
      title: 'Senior ReactJS Developer',
      department: 'Engineering',
      location: 'Coimbatore · Chennai · Bangalore, India',
      city: 'Coimbatore',
      experienceRequired: '5-10 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Senior Golang Developer',
      department: 'Engineering',
      location: 'Coimbatore · Chennai · Bangalore, India',
      city: 'Coimbatore',
      experienceRequired: '5-10 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Backend Engineer (Scala / Play)',
      department: 'Engineering',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      experienceRequired: '3+ yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Power Platform Developer',
      department: 'Engineering',
      location: 'Bangalore · Mumbai · Delhi · Jaipur, India',
      city: 'Bangalore',
      experienceRequired: '4-8 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Support Engineer',
      department: 'Customer Success',
      location: 'Bangalore · Mumbai · Delhi · Jaipur, India',
      city: 'Bangalore',
      experienceRequired: '4-8 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
    {
      title: 'Digital Marketing Specialist',
      department: 'Marketing',
      location: 'Coimbatore · India',
      city: 'Coimbatore',
      experienceRequired: '7-10 yrs',
      employmentType: 'Full-time',
      sourceUrl: 'https://www.payoda.com/careers',
      applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
    },
  ])
})

test('Payoda historical presentation helper retains View role and Unicode metadata parsing', async () => {
  const payoda = await loadPayodaModule()
  assert.ok(payoda, 'Expected Payoda scraper module at ../../scraper/payoda/script.js')

  assert.equal(payoda.hasOfficialCareersSignal(currentCareersPageHtml), true)

  const roles = payoda.extractRoleCards(currentCareersPageHtml)
  assert.equal(roles.length, 6)
  assert.deepEqual(roles[0], {
    title: 'Senior ReactJS Developer',
    department: 'Engineering',
    location: 'Coimbatore · Chennai · Bangalore, India',
    city: 'Coimbatore',
    experienceRequired: '5-10 yrs',
    employmentType: 'Full-time',
    sourceUrl: 'https://www.payoda.com/careers',
    applyUrl: 'mailto:joinus@payoda.com?subject=CV%3A%20open%20application',
  })
})


function currentNativeReplay(source,change=()=>{}){
 const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/'+source+'/fixtures/current-native-20261117.json.gz',import.meta.url)))),calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  const original=captures.find(row=>row.requestedUrl===url);assert.ok(original,'Unbound current native URL '+url)
  assert.equal(init.method??'GET','GET');assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal)
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push({url,nth})
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()};change(row,url,nth)
  const response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}
}

test('Payoda current runtime preserves five complete native observations without city-inferred India jobs',async()=>{
 const source=await loadPayodaModule(),transport=currentNativeReplay('payoda')
 const jobs=await source.createPayodaScraper().run({fetchImpl:transport.fetchImpl})
 assert.equal(jobs.length,0);assert.equal(transport.calls.length,10)
 const summary=readSourceObservationEvidence(jobs,'payoda');assert.equal(summary.observedVacancyCount,5);assert.equal(summary.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const observation of jobs.nativeCollectionEvidence.observations){
  assert.equal(observation.nativeOpeningRecord.location,'Bengaluru · Full-time');assert.equal(observation.country,null)
  assert.equal(observation.publicationDate,null);assert.equal(observation.applicationURL,null)
  assert.ok(observation.nativeOpeningRecord.summary.length>30);assert.ok(observation.nativeOpeningRecord.points.length>0)
  assert.deepEqual(observation.nativeOpeningRecord,observation.nativeClosingRecord)
 }
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false)
})
test('Payoda body-only historical fixtures cannot supply native transport or eligibility evidence',async()=>{
 const source=await loadPayodaModule();let callbacks=0
 await assert.rejects(source.run({fetchText:async()=>{callbacks++;return careersPageHtml}}),/original.*metadata|body-only/i)
 assert.equal(callbacks,0)
})
