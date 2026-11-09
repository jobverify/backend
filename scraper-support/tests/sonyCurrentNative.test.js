import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/sony/test-data/native-current-20261102.json.gz', import.meta.url))))
const current = () => structuredClone(captured)
const response = (url, body, type = 'text/html') => {
  const result = new Response(typeof body === 'string' ? body : JSON.stringify(body), { headers: { 'content-type': type } })
  Object.defineProperty(result, 'url', { value: url })
  return result
}

async function exercise(t, { change = () => {}, options = {} } = {}) {
  const fixture = current()
  change(fixture)
  const provider = getScraperCatalog().find(provider => provider.source === 'sony')
  assert.equal(provider.adapter, 'script', 'Sony must use its currently published India hiring surfaces')
  assert.match(provider.modulePath, /scraper[\\/]sony[\\/]script\.js$/)
  const calls = [], counts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    init.signal?.throwIfAborted()
    const url = String(input), path = new URL(url).pathname
    const countKey = `${init.method || 'GET'} ${url}`
    counts.set(countKey, (counts.get(countKey) || 0) + 1)
    calls.push({ url, init })
    let body, type = 'text/html'
    if (url === 'https://www.sony.co.in/microsite/corporate/') body = fixture.responses.indiaCorporate
    else if (url === 'https://www.sony.co.in/microsite/careers/') body = fixture.responses.indiaCareers
    else if (url.startsWith('https://www.sony.co.in/microsite/careers/career.html')) body = fixture.responses.indiaFragment
    else if (url.startsWith('https://www.myemploywise.com/asperm/servlet/website')) {
      if (init.method === 'POST') {
        assert.equal(init.body, 'mode=create&customer_code=sid&viewname=Web&modulename=Recruitment&pos_id=null&bwi=null')
        body = fixture.responses.employwiseInventory; type = 'text/xml'
      } else body = fixture.responses.employwiseShell
    } else if (url === 'https://sonyindiasoftware.co.in/careers.html') body = fixture.responses.softwareCorporate
    else if (url === 'https://careers.sonyindiasoftware.co.in/sonyindiasoftware/') body = fixture.responses.softwareShell
    else if (url === 'https://careers.sonyindiasoftware.co.in/sonyindiasoftware/main.e351481f8136100a.js') { body = fixture.responses.softwareClient; type = 'application/javascript' }
    else if (path === '//tenant_management/tenant/group' || path === '/tenant_management/tenant/group') { body = fixture.responses.softwareTenant; type = 'application/json' }
    else if (path === '/data-service/v2/company/15532/careersite-configurations') { body = fixture.responses.softwareConfig; type = 'application/json' }
    else if (url === 'https://public.zwayam.com/jobs/search') {
      assert.ok(init.body instanceof FormData)
      assert.equal(init.body.get('domain'), 'careers.sonyindiasoftware.co.in')
      assert.equal(init.body.get('companyId'), 'MTU1MzI=')
      assert.deepEqual(JSON.parse(init.body.get('filterCri')), { paginationStartNo: 0, selectedCall: 'sort', sortCriteria: { name: 'modifiedDate', isAscending: false }, anyOfTheseWords: '' })
      body = counts.get(countKey) === 3 && fixture.finalListing ? fixture.finalListing : counts.get(countKey) > 1 && fixture.closingListing ? fixture.closingListing : fixture.responses.softwareListing
      type = 'application/json'
    } else if (url === 'https://public.zwayam.com/jobs-service/v1/jobs/careersite') {
      const request = JSON.parse(init.body)
      assert.equal(request.companyId, '15532')
      assert.equal(request.externalSource, 'CAREERSITE')
      assert.equal(request.campusUrl, 'empty')
      const id = String(request.jobId)
      assert.equal(request.jobUrl, fixture.details[id]?.jobUrl)
      const key = `detail-${id}`
      counts.set(key, (counts.get(key) || 0) + 1)
      body = counts.get(key) > 1 && fixture.closingDetails?.[id] ? fixture.closingDetails[id] : fixture.details[id]
      type = 'application/json'
    } else if (/^\/requisition_service\/getReqFieldsForCareersSite\/\d+\/15532$/.test(path)) {
      body = fixture.reqFields[path.split('/')[3]]; type = 'application/json'
    } else if (url === 'https://www.sonyjobs.com/jobs.html') body = fixture.responses.globalCorporate
    else if (url === 'https://sonyglobal.wd1.myworkdayjobs.com/wday/cxs/sonyglobal/SonyGlobalCareers/jobs') {
      assert.deepEqual(JSON.parse(init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: '' })
      body = fixture.responses.globalListing; type = 'application/json'
    } else throw new Error(`Unexpected Sony public request: ${init.method || 'GET'} ${url}`)
    assert.notEqual(body, undefined, `Missing captured Sony response: ${url}`)
    return response(url, body, type)
  })
  const jobs = await createCatalogScraper(provider).run({ ...options })
  return { jobs, calls, fixture }
}

test('Sony recovers complete criteria only for explicitly typed India roles from its current native surfaces', async t => {
  const { jobs } = await exercise(t)
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.company === 'Sony India Software Centre'))
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs[0].sourceNativeInventory.software.reportedTotal, 7)
  assert.equal(jobs[0].sourceNativeInventory.software.unresolvedCountries.length, 2)
  assert.equal(jobs[0].sourceNativeInventory.software.nativeRoleDetails.length,7)
  assert.equal(readSourceObservationEvidence(jobs,'sony').observedVacancyCount,7)
  assert.equal(jobs[0].sourceNativeInventory.consumer.reportedTotal, 0)
  assert.equal(jobs[0].sourceNativeInventory.globalWorkday.reportedTotal, 116)
})

test('Sony preserves both visible Description and Role criteria and native original publication dates', async t => {
  const { jobs } = await exercise(t)
  const job = jobs.find(job => job.jobId === '1194685')
  assert.match(job.sourceDescription, /Preferred Certifications/)
  assert.match(job.sourceDescription, /Network Architecture/)
  assert.match(job.sourceDescription, /Any graduate with 10\+ years/)
  assert.equal(job.postingDate, '2026-10-12T06:35:12.000Z')
  assert.equal(job.sourceRawDates.postedOn, '1791786912000')
  assert.equal(job.sourceRawDates.modifiedDate, 1793266884000)
  assert.notEqual(job.postingDate, new Date(job.sourceRawDates.modifiedDate).toISOString())
})

for (const [label, change] of [
  ['missing India corporate fragment handoff', f => { f.responses.indiaCareers = f.responses.indiaCareers.replace('career.html?_=', 'unbound.html?_=') }],
  ['changed EmployWise customer identity', f => { f.responses.indiaFragment = f.responses.indiaFragment.replace('customer_code=sid', 'customer_code=other') }],
  ['comment-only software handoff', f => { f.responses.softwareCorporate = f.responses.softwareCorporate.replace(/<iframe[\s\S]*?<\/iframe>/i, match => `<!--${match}-->`) }],
  ['foreign native client company', f => { f.responses.softwareClient = f.responses.softwareClient.replace('COMPANYID:"MTU1MzI="', 'COMPANYID:"OTk5"') }],
  ['foreign native company config', f => { f.responses.softwareConfig.reponseObject.company.id = 999 }],
  ['duplicate raw role identity', f => { f.responses.softwareListing.data.data[1] = structuredClone(f.responses.softwareListing.data.data[0]) }],
  ['truncated native inventory', f => { f.responses.softwareListing.data.totalCount++ }],
  ['foreign native detail employer', f => { f.details[1194685].companyId = 999 }],
  ['wrong native detail role', f => { f.details[1194685].id = 999 }],
  ['changed native detail title', f => { f.details[1194685].jobTitle = 'Another role' }],
  ['contradictory native country', f => { f.responses.softwareListing.data.data[0]._source.jobLocationRecord[0].country = 'United States' }],
  ['malformed explicit native publication date', f => { f.details[1194685].jobConfigurationData['Posted On'] = 'unparseable' }],
]) test('Sony rejects ' + label, async t => { await assert.rejects(exercise(t, { change })) })

test('Sony holds an unreviewed country property rather than borrowing the listing country', async t => {
  const { jobs } = await exercise(t, { change: f => { f.details[1194685].countryCode = 'US' } })
  assert.ok(!jobs.some(job => job.jobId === '1194685'))
  assert.ok(jobs[0].sourceNativeInventory.software.unresolvedCountries.some(role => role.jobId === '1194685'))
})

test('Sony does not infer India for city-only roles even when their internal office IDs match', async t => {
  const { jobs } = await exercise(t)
  assert.ok(!jobs.some(job => ['1197758', '1196961'].includes(job.jobId)))
})

test('Sony verifies closing native inventory and complete criteria before applying a caller cap', async t => {
  const { jobs, calls } = await exercise(t, { options: { maxJobs: 1 } })
  assert.equal(jobs.length, 1)
  assert.equal(calls.filter(call => call.url === 'https://public.zwayam.com/jobs/search').length, 3)
  assert.equal(calls.filter(call => call.url === 'https://public.zwayam.com/jobs-service/v1/jobs/careersite').length, 14)
})

test('Sony final inventory follows every full detail read and holds only the role removed during those reads',async t=>{
 const {jobs,calls}=await exercise(t,{change:f=>{f.finalListing=structuredClone(f.responses.softwareListing);f.finalListing.data.data=f.finalListing.data.data.filter(r=>r._source.id!==1194685);f.finalListing.data.totalCount--}})
 assert.equal(jobs.length,4);assert.ok(jobs.every(j=>j.jobId!=='1194685'));assert.equal(readSourceObservationEvidence(jobs,'sony').observedVacancyCount,7)
 assert.equal(jobs[0].sourceNativeInventory.software.finalInventoryStable,false)
 assert.ok(calls.findLastIndex(c=>c.url==='https://public.zwayam.com/jobs/search')>calls.findLastIndex(c=>c.url==='https://public.zwayam.com/jobs-service/v1/jobs/careersite'))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Sony caller cancellation bounds a fetch collaborator that ignores its signal',async t=>{
 const c=new AbortController(),reason={stop:'Sony pending read'},timer=setTimeout(()=>c.abort(reason),10)
 t.mock.method(globalThis,'fetch',()=>new Promise(()=>{}))
 try{const {createSonyScraper}=await import('../../scraper/sony/script.js');await assert.rejects(createSonyScraper().run({signal:c.signal}),e=>e===reason)}finally{clearTimeout(timer)}
})

test('Sony closing native inventory drift cannot certify or emit stale rows', async t => {
  await assert.rejects(exercise(t, { change: f => {
    f.closingListing = structuredClone(f.responses.softwareListing)
    f.closingListing.data.data[0]._source.jobTitle += ' changed'
  } }))
})

test('Sony closing native Role criteria drift cannot pass source detail verification', async t => {
  await assert.rejects(exercise(t, { change: f => {
    f.closingDetails = { 1194685: structuredClone(f.details[1194685]) }
    f.closingDetails[1194685].jobConfigurationData.Role += '<p>Additional mandatory certification.</p>'
  } }))
})

test('Sony retains reviewed criteria but holds a new mandatory question as incomplete detail', async t => {
  const { jobs } = await exercise(t, { change: f => { f.details[1194685].jobSpecificQuestions = [{ mandatory: true, question: 'Do you hold the required licence?' }] } })
  assert.equal(jobs.find(job => job.jobId === '1194685').sourceDetailComplete, false)
})

test('Sony a modification-date configured public field cannot renew original publication', async t => {
  const { jobs } = await exercise(t, { change: f => {
    f.details[1194685].isModifiedDateConfiguredForCareerSiteView = true
    f.details[1194685].modifiedDateConfiguredForCareerSiteView = true
    f.details[1194685].jobConfigurationData['Posted On'] = String(f.details[1194685].modifiedDate)
  } })
  assert.equal(jobs.find(job => job.jobId === '1194685').postingDate, null)
})

test('Sony rejects caller cancellation before any corporate or native request', async t => {
  const provider = getScraperCatalog().find(provider => provider.source === 'sony')
  assert.equal(provider.adapter, 'script')
  const reason = new Error('cancel Sony source')
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Must not request') })
  await assert.rejects(createCatalogScraper(provider).run({ signal: AbortSignal.abort(reason) }), error => error === reason)
  assert.equal(calls, 0)
})

test('Sony holds an additional displayed country instead of erasing a native location alternative', async t => {
  const { jobs } = await exercise(t, { change: f => { f.details[1194685].jobConfigurationData['Additional Country'] = 'United States' } })
  assert.ok(!jobs.some(job => job.jobId === '1194685'))
})

test('Sony reconciles a supplied detail address list with the own native listing countries', async t => {
  const { jobs } = await exercise(t, { change: f => {
    f.details[1194685].jobLocationRecord = [{ jobId: 1194685, companyId: 15532, id: 1874142, city: 'Boston', location: 'Boston', formattedLocation: 'Boston, Massachusetts, United States', country: 'United States' }]
  } })
  assert.ok(!jobs.some(job => job.jobId === '1194685'))
})

test('Sony hidden mandatory criteria remain raw evidence without a complete-detail claim', async t => {
  const { jobs } = await exercise(t, { change: f => { f.details[1194685].jobConfigurationData.Role += '<div style="height:0;overflow:hidden">Mandatory licence X.</div>' } })
  const job = jobs.find(job => job.jobId === '1194685')
  assert.equal(job.sourceDetailComplete, false)
  assert.doesNotMatch(job.sourceDescription, /Mandatory licence X/)
  assert.match(job.sourceNativeDetailPayload.jobConfigurationData.Role, /Mandatory licence X/)
})

test('Sony closing native detail geography drift cannot retain an earlier India address', async t => {
  await assert.rejects(exercise(t, { change: f => {
    f.closingDetails = { 1194685: structuredClone(f.details[1194685]) }
    f.closingDetails[1194685].jobLocationRecord = [{ jobId: 1194685, companyId: 15532, id: 1874142, city: 'Boston', location: 'Boston', formattedLocation: 'Boston, Massachusetts, United States', country: 'United States' }]
  } }))
})

for (const [label, change] of [
  ['hidden corporate careers handoff', f => { f.responses.indiaCorporate = f.responses.indiaCorporate.replace(/(<a\b[^>]*href="https:\/\/www\.sony\.co\.in\/microsite\/careers\/"[^>]*)(>)/, '$1 style="opacity:0"$2') }],
  ['hidden software iframe handoff', f => { f.responses.softwareCorporate = f.responses.softwareCorporate.replace('<iframe', '<iframe style="opacity:0"') }],
  ['consumer handoff outside India opportunities', f => { const match = f.responses.indiaFragment.match(/<a\b[^>]*href="http:\/\/www\.myemploywise\.com\/asperm\/servlet\/website\?customer_code=sid"[^>]*>[\s\S]*?<\/a>/); assert.ok(match); f.responses.indiaFragment = f.responses.indiaFragment.replace(match[0], '') + match[0] }],
]) test('Sony rejects ' + label, async t => { await assert.rejects(exercise(t, { change })) })
