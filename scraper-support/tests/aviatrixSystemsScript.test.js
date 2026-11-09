import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { decodeHTML } from 'entities'
import { createAviatrixSystemsScraper } from '../../scraper/aviatrixsystems/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capture = JSON.parse(readFileSync(new URL('../../scraper/aviatrixsystems/fixtures/jobs-response.json', import.meta.url), 'utf8'))
const payload = () => JSON.parse(capture.body)
const offices = JSON.parse(JSON.parse(readFileSync(new URL('../../scraper/aviatrixsystems/fixtures/offices-response.json', import.meta.url), 'utf8')).body)
const fetchNative = native => async url => url.includes('/offices?') ? offices : native

test('Aviatrix Systems extracts the five native India vacancies and preserves their identity and content', async () => {
  const native = payload()
  const before = structuredClone(native)
  const calls = []
  const jobs = await createAviatrixSystemsScraper().run({ fetchJson: async (url, options) => {
    calls.push(url)
    assert.ok(options.signal)
    return fetchNative(native)(url)
  } })
  assert.deepEqual(calls, ['https://boards-api.greenhouse.io/v1/boards/aviatrix/jobs?content=true',
    'https://boards-api.greenhouse.io/v1/boards/aviatrix/offices?render_as=tree'])
  assert.deepEqual(jobs.map(job => String(job.jobId)).sort(), ['4642996005', '4644128005', '4679475005', '4732064005', '4741459005'])
  for (const job of jobs) {
    const original = native.jobs.find(row => String(row.id) === String(job.jobId))
    assert.equal(job.source, 'aviatrixsystems')
    assert.equal(job.company, 'Aviatrix Systems')
    assert.equal(job.applyUrl, original.absolute_url)
    assert.equal(job.postingDate, original.first_published)
    assert.equal(job.jobDescription, decodeHTML(original.content))
    assert.equal(job.nativeDescriptionRaw, original.content)
    assert.equal(job.nativeDescriptionHTML, job.jobDescription)
    assert.equal(job.sourceNativeLocationEvidence.primary,original.location.name)
    assert.deepEqual(job.sourceNativeLocationEvidence.offices,original.offices)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 17)
  assert.equal(evidence.indiaFacetCount, 5)
  assert.deepEqual(native,before,'Country-qualified projection must preserve native location and office evidence')
})

test('Aviatrix office-country corroboration cannot remove genuinely broader APAC scope',async()=>{
  const native=payload()
  native.jobs.find(job=>job.id===4741459005).location.name='Bengaluru, Karnataka, India / APAC'
  const jobs=await createAviatrixSystemsScraper().run({fetchJson:fetchNative(native)})
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('Aviatrix embedded office identity must agree with its current native office tree',async()=>{
  const native=payload()
  native.jobs.find(job=>job.id===4741459005).offices[0].name='Unrelated office'
  await assert.rejects(createAviatrixSystemsScraper().run({fetchJson:fetchNative(native)}),/office.*identity/i)
})

test('Aviatrix repeated city labels cannot override the country of the role-assigned native office',async()=>{
  const tree=structuredClone(offices)
  const find=(nodes,id)=>nodes.flatMap(node=>[node,...(node.children?.length?[find(node.children,id)].filter(Boolean):[])]).find(node=>node.id===id)
  find(tree.offices,4000505005).children.push({id:9990000002,name:'Bengaluru',location:null,children:[]})
  const native=payload(),target=native.jobs.find(job=>job.id===4741459005)
  target.location.name='Bengaluru'
  const indiaOffices=structuredClone(target.offices)
  target.offices=[{id:9990000002,name:'Bengaluru',location:null,child_ids:[],parent_id:4000505005}]
  const read=async url=>url.includes('/offices?')?tree:native
  await assert.rejects(createAviatrixSystemsScraper().run({fetchJson:read}),/country|location|scope/i)
  target.offices=indiaOffices
  const jobs=await createAviatrixSystemsScraper().run({fetchJson:read})
  assert.ok(jobs.some(job=>job.jobId===target.id&&job.country==='India'),'The exact assigned India office remains valid despite an unrelated duplicate label')
})

test('Aviatrix city-only India inference cannot override exclusively foreign assigned offices',async()=>{
  const tree=structuredClone(offices)
  tree.offices.push({id:9990000003,name:'United Kingdom',location:'United Kingdom',children:[]})
  const usa={id:4000505005,name:'United States',location:'United States'}
  const gb={id:9990000003,name:'United Kingdom',location:'United Kingdom'}
  for(const assigned of [[usa],[usa,gb]]){
    const native=payload(),target=native.jobs.find(job=>job.id===4741459005)
    target.location.name='Bengaluru'
    target.offices=assigned
    await assert.rejects(createAviatrixSystemsScraper().run({fetchJson:async url=>url.includes('/offices?')?tree:native}),
      /country|location|scope/i)
  }
})

test('Aviatrix Systems records verified empty evidence only for a validated empty response', async () => {
  const jobs = await createAviatrixSystemsScraper().run({ fetchJson: fetchNative({ jobs: [], meta: { total: 0 } }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

for (const [name, change] of [
  ['truncated totals', p => { p.meta.total++ }],
  ['duplicate job IDs', p => { p.jobs[1].id = p.jobs[0].id }],
  ['foreign employer', p => { p.jobs[0].company_name = 'Unrelated employer' }],
  ['foreign application URL', p => { p.jobs[0].absolute_url = 'https://example.test/apply' }],
  ['mismatched application identity', p => { p.jobs[0].absolute_url = 'https://aviatrix.com/careers/?gh_jid=123' }],
  ['HTTP-success error envelopes', p => { p.error = 'unavailable' }],
]) test(`Aviatrix Systems rejects ${name}`, async () => {
  const native = payload()
  change(native)
  await assert.rejects(createAviatrixSystemsScraper().run({ fetchJson: fetchNative(native) }))
})

test('Aviatrix Systems retains descriptionless India vacancies and incomplete detail evidence', async () => {
  const native = payload()
  native.jobs.find(job => job.id === 4741459005).content = ''
  const jobs = await createAviatrixSystemsScraper().run({ fetchJson: fetchNative(native) })
  assert.equal(jobs.length, 5)
  assert.equal(jobs.find(job => job.jobId === 4741459005).jobDescription, '')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Aviatrix Systems cannot treat ambiguous location scope as complete inventory', async () => {
  const native = payload()
  native.jobs[0].location.name = 'Remote'
  native.jobs[0].offices = []
  const jobs = await createAviatrixSystemsScraper().run({ fetchJson: fetchNative(native) })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Aviatrix Systems rejects failed or malformed office-country evidence', async () => {
  for (const officePayload of [{ ...offices, success: false }, { offices: [offices.offices[0], offices.offices[0]] }, { offices: 'unavailable' }]) {
    await assert.rejects(createAviatrixSystemsScraper().run({ fetchJson: async url => url.includes('/offices?') ? officePayload : payload() }))
  }
})

test('Aviatrix Systems retains incomplete evidence when India labels conflict with foreign offices', async () => {
  const native = payload()
  const india = native.jobs.find(job => job.id === 4741459005)
  india.offices = native.jobs[0].offices
  const jobs = await createAviatrixSystemsScraper().run({ fetchJson: fetchNative(native) })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Aviatrix Systems honours cancellation and bounds a stalled request', async () => {
  const controller = new AbortController()
  controller.abort(new Error('stop source'))
  await assert.rejects(createAviatrixSystemsScraper().run({ signal: controller.signal,
    fetchJson: async () => assert.fail('cancelled source must not fetch') }), /stop source/)
  await assert.rejects(createAviatrixSystemsScraper().run({ timeoutMs: 20,
    fetchJson: () => new Promise(() => {}) }), /timed out/i)
})
