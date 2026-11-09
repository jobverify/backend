import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from '../../scraper/collinsaerospace/script.js'
const row = (id, businessUnit = 'Collins Aerospace') => ({
  reqId: id, jobId: id, title: 'Engineer ' + id,
  country: 'India', cityStateCountry: 'Bangalore, India', businessUnit,
})
const response = (jobs, totalHits = jobs.length) => ({ refineSearch: {
  status: 200, totalHits, hits: jobs.length,
  data: { jobs, aggregations: [{ field: 'country', value: { India: totalHits } }] },
} })
const noListingHtml = async () => { throw new Error('The listing must use its advertised public API') }

test('Collins uses its public widget with both division and India scope and complete pagination', async () => {
  const offsets = []
  const jobs = await run({ detailEnrichmentBudgetMs: 0, fetchText: noListingHtml,
    fetchJson: async (url, options) => {
      assert.equal(url, 'https://careers.rtx.com/widgets')
      assert.equal(options.method, 'POST')
      const body = JSON.parse(options.body)
      assert.deepEqual(body.selected_fields, { country: ['India'], businessUnit: ['Collins Aerospace'] })
      assert.equal(body.size, 100)
      assert.ok(options.signal)
      offsets.push(body.from)
      return body.from === 0 ? response([row('1'), row('2')], 3) : response([row('3')], 3)
    },
  })
  assert.deepEqual(offsets, [0, 2])
  assert.deepEqual(jobs.map(job => job.jobId), ['1', '2', '3'])
  assert.ok(jobs.every(job => job.company === 'Collins Aerospace' && job.country === 'India' && job.sourceListingComplete !== false))
})

for (const division of ['Pratt & Whitney', null]) {
  test('Collins fails closed when the API loses division scope: ' + division, async () => {
    await assert.rejects(run({ detailEnrichmentBudgetMs: 0, fetchText: noListingHtml,
      fetchJson: async () => response([row('1', division)]),
    }), /Collins.*division/i)
  })
}

test('Collins keeps the shared repeated-page inventory guard', async () => {
  await assert.rejects(run({ detailEnrichmentBudgetMs: 0, fetchText: noListingHtml,
    fetchJson: async () => response([row('1')], 2),
  }), /duplicate page/i)
})

test('Collins propagates public API challenge failures without producing an empty snapshot', async () => {
  const reason = new Error('HTTP 403 public API challenge')
  await assert.rejects(run({ detailEnrichmentBudgetMs: 0, fetchText: noListingHtml,
    fetchJson: async () => { throw reason },
  }), error => error === reason)
})

test('Collins stops before public API requests after source cancellation', async () => {
  const reason = new Error('Source cancelled')
  let calls = 0
  await assert.rejects(run({ signal: AbortSignal.abort(reason), fetchText: noListingHtml,
    fetchJson: async () => { calls++; return response([]) },
  }), error => error === reason)
  assert.equal(calls, 0)
})
