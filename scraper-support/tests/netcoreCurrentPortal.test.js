import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { run } from '../../scraper/netcorecloud/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const board = 'https://netcoreai.mynexthire.com/employer/jobs/careers'
const presentation = 'https://careerpagenetcore.lovable.app/'
const clientUrl = 'https://netcoreai.mynexthire.com/employer/jobboard/details_by_shortname/get/netcoreai/'
const listUrl = 'https://netcoreai.mynexthire.com/employer/careers/reqlist/get'
const detailUrl = 'https://netcoreai.prod.us1.mynexthire.io/d17/careers/requisition/object'
const scriptUrl = 'https://netcoreai.mynexthire.com/employer/ui/js/jobboard/careers.js'
const fixture = async name => readFile(new URL('./fixtures/netcorecloud/' + name, import.meta.url), 'utf8')
const json = async name => JSON.parse(await fixture(name))
const harness = async (overrides = {}) => {
  const client = await json('tenant.json')
  const inventory = await json('inventory.json')
  const details = await json('details.json')
  const calls = []
  let listCalls = 0
  const invoke = () => run({
    now: () => '2026-10-09T00:00:00.000Z',
    fetchPage: async url => {
      calls.push({ url, type: 'page' })
      if (/^https:\/\/(?:netcorecloud\.com|netcore\.ai)\//.test(url)) return { status: 403, url: url.replace('netcorecloud.com', 'netcore.ai'), html: '<title>Error 403 Forbidden</title>' }
      const name = url === board ? 'board.html' : url === presentation ? 'presentation.html' : url === scriptUrl ? 'board-contract.txt' : null
      assert.ok(name, 'Unexpected page request: ' + url)
      return { status: overrides.boardStatus && url === board ? overrides.boardStatus : 200, url, html: overrides[name] ?? await fixture(name) }
    },
    fetchJson: async (url, options) => {
      calls.push({ url, type: 'json' })
      if (url === clientUrl) return overrides.client ?? client
      assert.equal(options.method, 'POST')
      const body = JSON.parse(options.body)
      assert.equal(body.source, 'careers')
      assert.equal(body.code, '')
      if (url === listUrl) {
        assert.equal(body.filterByBuId, -1)
        listCalls += 1
        return listCalls > 1 && overrides.secondInventory ? overrides.secondInventory : overrides.inventory ?? inventory
      }
      assert.equal(url, detailUrl)
      assert.equal(body.id, '')
      const detail = overrides.details?.[body.reqId] ?? details[body.reqId]
      assert.ok(detail, 'Missing mocked detail ' + body.reqId)
      return detail
    },
  })
  return { invoke, calls, client, inventory, details }
}

test('Netcore verifies its live public ATS independently of blocked marketing pages and reconciles every detail before India filtering', async () => {
  const h = await harness()
  const jobs = await h.invoke()
  assert.deepEqual(jobs.map(job => [job.jobId, job.title, job.city, job.country]), [
    ['1046', 'Global Lead - Sales Enablement', 'Mumbai', 'India'],
    ['1034', 'Senior AI Platform Engineer', 'Bengaluru', 'India'],
  ])
  assert.equal(h.calls.filter(call => call.url === detailUrl).length, 3)
  assert.equal(h.calls.filter(call => call.url === listUrl).length, 2)
  assert.equal(h.calls.some(call => /^https:\/\/(?:netcorecloud\.com|netcore\.ai)\//.test(call.url)), false)
  for (const job of jobs) {
    assert.equal(job.company, 'Netcore Cloud')
    assert.equal(job.source, 'netcorecloud')
    assert.equal(job.publicExperienceChecked, true)
    assert.ok(job.jobDescription.length > 1500)
    const url = new URL(job.applyUrl)
    assert.equal(url.origin + url.pathname, board)
    assert.equal(JSON.parse(Buffer.from(url.searchParams.get('p'), 'base64')).reqId, Number(job.jobId))
    assert.equal(JSON.parse(Buffer.from(url.searchParams.get('p'), 'base64')).pageType, 'application')
    const detailContext = JSON.parse(Buffer.from(new URL(job.sourceUrl).searchParams.get('p'), 'base64'))
    assert.equal(detailContext.pageType, 'jd')
  }
  assert.match(jobs[0].jobDescription, /Bonus Points If You/i)
  assert.equal(jobs[0].postingDate, '2026-08-27')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 2)
  assert.match(evidence.reason, /3.*published.*detail/i)
})

test('Netcore rejects wrong public tenant ID, brand, company website and careers handoff', async () => {
  const original = (await harness()).client
  for (const client of [
    { ...original, clientId: 99 }, { ...original, clientName: 'Other Company' },
    { ...original, companyWebsite: 'https://other.example/' },
    { ...original, tenantPreferencesMap: { career_page_url: { url: [{ pageType: 'list', url: 'https://other.example/jobs' }] } } },
  ]) await assert.rejects((await harness({ client })).invoke(), /tenant identity|careers handoff/i)
})
test('Netcore rejects unhealthy or unrelated public ATS and presentation pages', async () => {
  await assert.rejects((await harness({ boardStatus: 403 })).invoke(), /403|unavailable/i)
  await assert.rejects((await harness({ 'presentation.html': '<title>Other Careers</title>' })).invoke(), /presentation|handoff/i)
  await assert.rejects((await harness({ 'board-contract.txt': 'pagination.totalItems = 10; // truncated listing' })).invoke(), /complete.*inventory.*contract/i)
})
test('Netcore rejects malformed, duplicated, closed, incomplete and unknown-country inventory records', async () => {
  const h = await harness(), row = h.inventory.reqDetailsBOList[0]
  for (const inventory of [
    {}, { reqDetailsBOList: null },
    { reqDetailsBOList: [row, row] },
    { reqDetailsBOList: [{ ...row, reqTitle: '' }] },
    { reqDetailsBOList: [{ ...row, statusId: 4 }] },
    { reqDetailsBOList: [{ ...row, location: 'Remote', locationAddress: '', locationList: [{ office: 'Remote', address: '' }] }] },
  ]) await assert.rejects((await harness({ inventory })).invoke(), /incomplete|duplicate|status|country/i)
})
test('Netcore rejects unpublished, closed, missing, mismatched and failed current job details', async () => {
  const original = (await harness()).details[1046], row = original.data.reqDetailsBO
  for (const detail of [
    { ...original, status: 500 }, { ...original, data: {} },
    { ...original, data: { reqDetailsBO: { ...row, requisitionPublished: false } } },
    { ...original, data: { reqDetailsBO: { ...row, statusId: 4 } } },
    { ...original, data: { reqDetailsBO: { ...row, reqId: 9999 } } },
    { ...original, data: { reqDetailsBO: { ...row, jdDisplay: '' } } },
    { ...original, data: { reqDetailsBO: { ...row, locationList: [{ office: 'Singapore', address: 'Singapore' }] } } },
  ]) await assert.rejects((await harness({ details: { 1046: detail } })).invoke(), /published.*detail|detail.*published|job detail/i)
})
test('Netcore rejects inventory count or field changes during detailed validation', async () => {
  const h = await harness()
  for (const secondInventory of [
    { ...h.inventory, reqDetailsBOList: h.inventory.reqDetailsBOList.slice(0, 2) },
    { ...h.inventory, reqDetailsBOList: h.inventory.reqDetailsBOList.map((row, index) => index ? row : { ...row, expMin: row.expMin + 1 }) },
  ]) await assert.rejects((await harness({ secondInventory })).invoke(), /inventory changed|count.*agreement/i)
})
test('Netcore verifies a foreign-only inventory without treating missing data as empty', async () => {
  const h = await harness()
  const foreign = h.inventory.reqDetailsBOList.find(row => row.reqId === 935)
  const jobs = await (await harness({ inventory: { ...h.inventory, reqDetailsBOList: [foreign] } })).invoke()
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})
test('Netcore accepts a typed zero-job inventory only with its verified public tenant and full-list contract', async () => {
  const jobs = await (await harness({ inventory: { requesterTitle: '', reqDetailsBOList: [], hrXmlModel: null } })).invoke()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Netcore rejects a public board that loses its native application form surface', async () => {
  const boardHtml = (await fixture('board.html')).replace('careers-application.html', 'unrelated-page.html')
  await assert.rejects((await harness({ 'board.html': boardHtml })).invoke(), /board handoff unavailable/i)
})
