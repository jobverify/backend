import assert from 'node:assert/strict'
import test from 'node:test'
import * as jpmorgan from './script.js'
import * as chaseindia from '../chaseindia/script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const description = 'Design reliable production software services, collaborate with engineering teams, and maintain automated testing and operational controls.'
const corporate = '<title>Careers | JPMorganChase</title><link rel="canonical" href="https://www.jpmorganchase.com/careers"><a href="https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions">Join our team</a><p>Explore opportunities. Equal Opportunity Employer</p>'
const candidate = '<title>JPMC Candidate Experience page</title><base href="/hcmUI/CandidateExperience/en/sites/CX_1001" data-apibaseurl="https://jpmc.fa.oraclecloud.com:443" data-sitenumber="CX_1001"><p>Careers at Chase GLOBAL equal opportunity employer</p>'
const row = index => ({ Id: String(810000000 + index), Title: `Software Engineer ${index}`, PrimaryLocationCountry: 'IN', PrimaryLocation: 'Bengaluru, Karnataka, India', secondaryLocations: [], ShortDescriptionStr: description })
const transport = (total, change = value => value) => {
  const offsets = []; let listingRequests = 0
  return { offsets,
    fetchText: async url => {
      assert.ok([chaseindia.CORPORATE_CAREERS_URL, chaseindia.CANDIDATE_EXPERIENCE_URL].includes(url))
      return url === chaseindia.CORPORATE_CAREERS_URL ? corporate : candidate
    },
    fetchJson: async (url, options) => {
      const match = /,offset=(\d+),/.exec(url)
      if (match) {
        const offset = Number(match[1]); offsets.push(offset); listingRequests++
        return change({ items: [{ SiteNumber: 'CX_1001', Limit: 24, Offset: offset, TotalJobsCount: total,
          requisitionList: Array.from({ length: Math.min(24, total - offset) }, (_, i) => row(offset + i)) }] }, { offset, listingRequests, url, options })
      }
      const id = /Id=%22(\d+)%22/.exec(url)?.[1]
      assert.ok(id, `Unexpected detail URL: ${url}`)
      return change({ items: [{ ...row(Number(id) - 810000000), ExternalDescriptionStr: `<p>${description}</p>` }] }, { id, url, options })
    },
  }
}
const variants = [
  ['jpmorgan', 'JP Morgan', (options, io) => jpmorgan.createJPMorganScraper({ ...io, ...options }).run()],
  ['chaseindia', 'Chase India', (options, io) => chaseindia.createChaseIndiaScraper({ ...io, ...options }).run()],
]
for (const [source, company, execute] of variants) {
  test(`${source} defaults exhaust the raw native inventory beyond ten pages and validate closing membership`, async () => {
    const io = transport(265), jobs = await execute({}, io)
    assert.equal(jobs.length, 265)
    assert.equal(jobs.at(-1).jobId, '810000264')
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
    assert.equal(io.offsets.filter(offset => offset === 264).length, 2)
    assert.ok(jobs.every(job => job.source === source && job.company === company && job.sourceDetailComplete && job.lifecycleCleanupAllowed))
  })
  test(`${source} explicit page limits retain observed rows with incomplete inventory`, async () => {
    const io = transport(25), jobs = await execute({ maxPages: 1 }, io)
    assert.equal(jobs.length, 24)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
    assert.deepEqual(io.offsets, [0])
    assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  })
  test(`${source} explicit job limits disable inventory cleanup`, async () => {
    const jobs = await execute({ maxJobs: 1 }, transport(2))
    assert.equal(jobs.length, 1)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })
  test(`${source} follows raw offsets through foreign rows and short nonterminal pages`, async () => {
    const io = transport(25, (payload, { offset }) => {
      if (offset === 0) { payload.items[0].requisitionList.pop(); Object.assign(payload.items[0].requisitionList[0], { PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States' }) }
      return payload
    })
    const jobs = await execute({}, io)
    assert.equal(jobs.length, 23)
    assert.equal(jobs.at(-1).jobId, '810000024')
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.ok(io.offsets.includes(24))
  })
  test(`${source} rejects duplicate native identities`, async () => {
    await assert.rejects(execute({}, transport(25, (p, { offset }) => {
      if (offset === 24) p.items[0].requisitionList[0] = row(0)
      return p
    })), /duplicate|overlap/i)
  })
  test(`${source} rejects native detail identities and countries that disagree with their listing`, async () => {
    for (const changes of [{ Id: '999999' }, { PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States' }])
      await assert.rejects(execute({}, transport(1, (p, { id }) => {
        if (id) Object.assign(p.items[0], changes)
        return p
      })), /identity|countries/i)
  })
  test(`${source} rejects closing native membership changes after detail hydration`, async () => {
    await assert.rejects(execute({}, transport(1, (p, { listingRequests, offset }) => {
      if (offset === 0 && listingRequests > 1) p.items[0].requisitionList[0].Title = 'Changed role'
      return p
    })), /closing inventory changed/i)
  })
  test(`${source} preserves opaque cancellation before any HTTP or during a detail read`, async () => {
    const reason = Object.freeze({ caller: source })
    for (const duringDetail of [false, true]) {
      const controller = new AbortController()
      if (!duringDetail) controller.abort(reason)
      const io = transport(1, (p, { id }) => { if (id) controller.abort(reason); return p })
      if (!duringDetail) io.fetchText = io.fetchJson = async () => assert.fail('preaborted request must not read HTTP')
      await assert.rejects(execute({ signal: controller.signal }, io), error => error === reason)
    }
  })
  test(`${source} includes an India secondary worksite outside the first secondary location`, async () => {
    const jobs = await execute({}, transport(1, p => {
      Object.assign(p.items[0].requisitionList?.[0] || p.items[0], {
        PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States',
        secondaryLocations: [{ Name: 'Berlin, Germany', CountryCode: 'DE' }, { Name: 'Bengaluru, Karnataka, India', CountryCode: 'IN' }],
      })
      return p
    }))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
    assert.equal(jobs[0].sourceDetailComplete, true)
  })
}

test('jpmorgan exported run forwards injection and explicit caps without default HTTP', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('run discarded caller fetchJson'))
  const io = transport(2), jobs = await jpmorgan.run({ ...io, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
