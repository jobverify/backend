import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const original = JSON.parse(fs.readFileSync(new URL('./fixtures/native-packet.json', import.meta.url)))
const now = original.records.at(-1).receivedAt
const listURL = board => `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
const detailURL = id => `https://boards-api.greenhouse.io/v1/boards/blenheimchalcotindia/jobs/${id}?questions=false`
const uk = 'blenheimchalcot', india = 'blenheimchalcotindia'
function harness(change = () => {}) {
  const records = structuredClone(original.records)
  const bodies = new Map(records.map(r => [r.requestedURL, /json/.test(r.headers['content-type']) ? JSON.parse(r.body) : r.body]))
  change(bodies)
  const calls = []
  const fetchValue = async (url, options = {}) => {
    assert.equal(options.method || 'GET', 'GET')
    assert.ok(bodies.has(url), `unrecorded URL: ${url}`)
    calls.push(url)
    const value = bodies.get(url)
    if (value instanceof Error) throw value
    return structuredClone(value)
  }
  return { calls, run: () => run({ fetchJson: fetchValue, fetchText: fetchValue, now }) }
}
test('observed complete two-board inventory retains five unconflicted India JDs and exact native publication', async () => {
  const h = harness(), jobs = await h.run()
  assert.equal(jobs.length, 5)
  assert.ok(h.calls.includes(listURL(uk)) && h.calls.includes(listURL(india)))
  assert.ok(!jobs.some(j => j.jobId === 8007068))
  const packaging = jobs.find(j => j.jobId === 7699027)
  assert.equal(packaging.postingDate, '2026-03-10T09:58:31-04:00')
  assert.equal(packaging.nativeUpdatedAt, '2026-09-15T06:04:16-04:00')
  assert.equal(packaging.nativeCreatedAt, null)
  assert.equal(packaging.company, 'Blenheim Chalcot India')
  assert.equal(packaging.nativeLegalEmployer, null)
  assert.ok(packaging.nativePortfolioAssignments.some(a => a.name === 'Agilisys'))
  assert.equal(packaging.scrapedAt, now)
  const fospha = jobs.find(j => j.jobId === 8068992)
  assert.equal(fospha.nativeBusiness, 'Fospha')
  assert.ok(fospha.nativePortfolioAssignments.some(a => a.name === 'Fospha'))
  assert.ok(jobs.every(j => j.sourceDescription === j.jobDescription && j.sourceDetailComplete === true && !j.sourceListingComplete))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /country-conflict/)
  assert.equal(evidence.reportedTotal, 19)
})
test('missing publication stays unknown; timestamp precision and raw update stay separate', async () => {
  const jobs = await harness(b => { delete b.get(detailURL(7699027)).first_published; b.get(detailURL(7699027)).application_deadline = '2026-12-03T20:15:30Z' }).run()
  const job = jobs.find(j => j.jobId === 7699027)
  assert.equal(job.postingDate, undefined)
  assert.equal(job.nativeFirstPublicationDate, null)
  assert.equal(job.nativeDateUnknown, true)
  assert.equal(job.nativeClosingDate, '2026-12-03T20:15:30Z')
  assert.equal(job.nativeClosingDatePrecision, 'instant')
})
for (const field of ['id','title','company_name','absolute_url','internal_job_id','requisition_id','metadata']) test(`rejects detail ${field} identity drift`, async () => {
  await assert.rejects(harness(b => { const d=b.get(detailURL(7699027)); d[field] = field==='metadata' ? [{name:'Business',value:'Unrelated'}] : field==='id'||field==='internal_job_id' ? 1 : 'Unrelated' }).run(), /identity|company|business|URL/i)
})
for (const field of ['first_published','application_deadline']) test(`rejects malformed ${field}`, async () => {
  await assert.rejects(harness(b => { b.get(detailURL(7699027))[field]='2026-02-31' }).run(), /date|precision/i)
})
for (const content of ['', '<p> </p>', '<p>About Blenheim Chalcot. We build ventures.</p>', 'Machine Learning placeholder description']) test(`rejects missing or non-role content: ${content.slice(0,22)}`, async () => {
  await assert.rejects(harness(b => { b.get(detailURL(7699027)).content=content }).run(), /description|content/i)
})
for (const board of [uk,india]) {
  test(`rejects ${board} upstream failure without partial success`, async () => { await assert.rejects(harness(b=>b.set(listURL(board),new Error('upstream HTTP 503'))).run(), /503/) })
  test(`rejects ${board} advertised total mismatch and continuation`, async () => {
    await assert.rejects(harness(b => { b.get(listURL(board)).meta.total++ }).run(), /total|count|incomplete/i)
    await assert.rejects(harness(b => { b.get(listURL(board)).meta.next='page2' }).run(), /pagination|continuation/i)
  })
}
test('native errors with stale valid job fields are rejected', async () => { await assert.rejects(harness(b => { b.get(detailURL(7699027)).success=false }).run(), /upstream|error/i) })
test('listing company label cannot conflict with the verified native board', async()=>{
  await assert.rejects(harness(b=>{b.get(listURL(india)).jobs[0].company_name='Unrelated'}).run(), /company|identity/i)
})
test('same internal requisition preserves distinct public posting IDs', async () => {
  const jobs=await harness(b=>{for(const id of [7699027,6944022]) {const l=b.get(listURL(india)).jobs.find(j=>j.id===id),d=b.get(detailURL(id)); l.internal_job_id=d.internal_job_id=3384222;l.requisition_id=d.requisition_id='1469'}}).run()
  assert.ok(jobs.some(j=>j.jobId===7699027) && jobs.some(j=>j.jobId===6944022))
})
test('duplicate identical public postings deduplicate; conflicting postings fail', async () => {
  const mutation = b=>{const l=b.get(listURL(india));l.jobs.push(structuredClone(l.jobs[0]));l.meta.total++}
  assert.equal((await harness(mutation).run()).length,5)
  await assert.rejects(harness(b=>{mutation(b);b.get(listURL(india)).jobs.at(-1).title='different'}).run(), /duplicate|identity/i)
})
test('additional foreign office cannot become India through provider default', async () => {
  const jobs=await harness(b=>{b.get(listURL(india)).jobs.find(j=>j.id===7699027).offices.push({id:99,name:'Foreign office',location:'Toronto, Canada'})}).run()
  assert.ok(!jobs.some(j=>j.jobId===7699027))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('empty bounded boards never certify whole-company zero', async () => {
  const jobs=await harness(b=>{for(const board of [uk,india])b.set(listURL(board),{jobs:[],meta:{total:0}})}).run()
  assert.equal(jobs.length,0)
  assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
test('India roles advertised on the primary board also hydrate with its own exact native company and portal ID', async () => {
  const jobs=await harness(b=>{
    const d=structuredClone(b.get(detailURL(7699027)))
    d.id=9000001;d.company_name='Blenheim Chalcot';d.absolute_url='https://job-boards.greenhouse.io/blenheimchalcot/jobs/9000001'
    const l=b.get(listURL(uk));l.jobs.push(structuredClone(d));l.meta.total++
    b.set('https://boards-api.greenhouse.io/v1/boards/blenheimchalcot/jobs/9000001?questions=false',d)
  }).run()
  assert.equal(jobs.length,6)
  const job=jobs.find(j=>j.jobId===9000001)
  assert.equal(job.nativeBoard,uk)
  assert.equal(job.company,'Blenheim Chalcot')
})
for(const field of ['active','published','is_published']) test(`rejects native ${field}=false with stale public fields`, async()=>{
  await assert.rejects(harness(b=>{b.get(detailURL(7699027))[field]=false}).run(), /public|visibility|status/i)
})
test('closure rejects listings that change after successful detail retrieval', async()=>{
  const h=harness(); let once=false
  const packet=structuredClone(original.records),bodies=new Map(packet.map(r=>[r.requestedURL,/json/.test(r.headers['content-type'])?JSON.parse(r.body):r.body]))
  const get=async url=>{const v=structuredClone(bodies.get(url));if(url===listURL(india)){if(once)v.jobs[0].title+=' changed';once=true}return v}
  await assert.rejects(run({fetchJson:get,fetchText:get,now}), /changed|identity/i)
})
test('changed official corporate module and board label reject stale mappings', async () => {
  await assert.rejects(harness(b=>b.set('https://blenheimchalcot.com/careers','<html>No module</html>')).run(), /official|module|handoff/i)
  await assert.rejects(harness(b=>b.get('https://boards-api.greenhouse.io/v1/boards/blenheimchalcotindia').name='Unrelated').run(), /board|company/i)
})
