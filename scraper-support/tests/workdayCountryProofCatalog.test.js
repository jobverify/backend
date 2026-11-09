import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildScrapers} from '../providers/index.js'
import {resolveZeroJobOutcome} from '../runner.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {WORKDAY_COUNTRY_INVENTORY_PROOF} from '../myworkday/countryInventoryProof.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayCountryInventoryProof/capture.json.gz', import.meta.url))))

for (const source of ['csg']) {
  test(`selected ${source} scraper uses a fresh complete-board country proof instead of an India keyword zero`, async t => {
    const scraper = buildScrapers().find(item => item.name === source)
    assert.equal(scraper.provider.adapter, 'workday')
    const config = JSON.parse(fs.readFileSync(scraper.provider.sourceDirectory + '/config.json'))
    assert.equal(config.inventoryScope, 'complete-board-country-proof')
    const calls = []
    let snapshots = 0
    const responseFor = receipt => {
      const body = Buffer.from(receipt.bodyBase64, 'base64')
      assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
      const response = new Response(body, {status: receipt.status, headers: {'content-type': receipt.contentType}})
      Object.defineProperty(response, 'url', {value: receipt.url})
      return response
    }
    const fetchMock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
      const url = String(input)
      const method = init.method || 'GET'
      calls.push({url, method})
      if (method === 'POST' && url === capture.responses[`${source}-initial`].url) {
        const request = JSON.parse(init.body)
        assert.deepEqual(request.appliedFacets, {})
        assert.equal(request.searchText, '')
        snapshots++
        assert.ok(snapshots <= 2)
        return responseFor(capture.responses[`${source}-${snapshots === 1 ? 'initial' : 'closing'}`])
      }
      const receipt = Object.entries(capture.responses).find(([name, item]) => name.startsWith(source + '-') && item.url === url)?.[1]
      if (method === 'GET' && receipt) return responseFor(receipt)
      if (method === 'GET' && url === config.detailUrlBase) {
        const response = new Response('<html><body>Workday careers</body></html>', {headers: {'content-type': 'text/html'}})
        Object.defineProperty(response, 'url', {value: url})
        return response
      }
      throw Error(`Unexpected native request; live HTTP is forbidden: ${method} ${url}`)
    })
    try {
      if (source === 'csg') {
        const jobs = await scraper.run()
        assert.equal(jobs.length, 0)
        assert.equal(readInventoryEvidence(jobs).reportedTotal, 15)
        assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
        assert.equal(resolveZeroJobOutcome(scraper, jobs, []), 'fetched-zero')
        assert.equal(snapshots, 2)
        const proof = jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
        assert.ok(proof, 'Registered execution must preserve the native country proof receipt')
        assert.equal(proof.scope, 'complete-board-country-proof')
        assert.equal(proof.initial.count, 15)
        assert.equal(proof.closing.count, 15)
        assert.equal(proof.initial.sha256, proof.closing.sha256)
        assert.equal(proof.roles.length, 2)
        assert.ok(proof.roles.every(role => role.countryScopes.length === role.locations.length
          && role.countryScopes.every(scope => scope === 'foreign')))
        assert.equal(proof.boardReceipt.requestedUrl, config.officialCareersUrl)
      } else {
        await assert.rejects(scraper.run(), error => error.name === 'WorkdayIncompleteScopeError' && /Johannesburg/.test(error.cause?.message || ''))
      }
      assert.equal(calls.filter(call => call.url === config.officialCareersUrl).length, 1)
    } finally {
      fetchMock.mock.restore()
    }
  })
}

test('registered Temenos source composes current CXS and exact public worksite proof without a keyword zero',async t=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/temenos.workday/test-data/worksites-native-20261103.json.gz',import.meta.url)))),scraper=buildScrapers().find(r=>r.name==='temenos'),calls=[]
 assert.equal(scraper.provider.adapter,'script');assert.match(scraper.provider.modulePath,/temenos\.workday[\\/]script\.js$/);assert.equal(scraper.provider.lifecycleCleanupAllowed,false)
 const mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),method=init.method||'GET',request=init.body?JSON.parse(init.body):null;calls.push({url,method})
  if(request){assert.deepEqual(request.appliedFacets,{});assert.equal(request.searchText,'')}
  const row=fixture.responses.find(r=>r.url===url&&(r.method||'GET')===method&&(method!=='POST'||r.requestBody.offset===request.offset));assert.ok(row,'Unexpected declared Temenos request '+url)
  const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:url});return response
 })
 try{
  const jobs=await scraper.run({requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{}}}),evidence=readInventoryEvidence(jobs),proof=jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  assert.equal(jobs.length,0);assert.equal(evidence.reportedTotal,22);assert.equal(evidence.indiaFacetCount,0);assert.equal(evidence.listingComplete,true);assert.equal(resolveZeroJobOutcome(scraper,jobs,[]),'fetched-zero')
  assert.equal(proof.initial.count,22);assert.equal(proof.closing.count,22);assert.equal(proof.initial.sha256,proof.closing.sha256);assert.ok(calls.some(c=>c.url==='https://www.temenos.com/offices/page/6/'))
 }finally{mock.mock.restore()}
})
