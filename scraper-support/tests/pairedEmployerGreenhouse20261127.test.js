import test from 'node:test'
import assert from 'node:assert/strict'
import { run as runHoneycomb } from '../../scraper/honeycomb/script.js'
import { run as runKeeper } from '../../scraper/keepersecurity/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const description = '<h2>Responsibilities</h2><p>Build, operate, and maintain reliable production services with a collaborative engineering team. Investigate customer issues and improve production systems.</p><h2>Requirements</h2><p>Experience building production software, reviewing changes, and supporting operational reliability. Communicate clearly and work effectively with other engineers.</p>'
const sources = [
  { source: 'honeycomb', company: 'Honeycomb', nativeCompany: 'Honeycomb.io', run: runHoneycomb,
    careers: 'https://www.honeycomb.io/careers', roles: 'https://www.honeycomb.io/careers/open-roles' },
  { source: 'keepersecurity', company: 'Keeper Security', nativeCompany: 'Keeper Security', run: runKeeper,
    careers: 'https://www.keepersecurity.com/jobs.html' },
]
const fixture = config => {
  const native = id => ({ id, internal_job_id: id + 100, company_name: config.nativeCompany, title: 'Software Engineer',
    location: { name: 'Remote, United States' }, offices: [], metadata: null,
    absolute_url: `https://job-boards.greenhouse.io/${config.source}/jobs/${id}`, content: description,
    first_published: '2026-11-01T12:00:00Z', updated_at: '2026-11-20T12:00:00Z' })
  const rows = [native(101), native(102)]
  let apiCalls = 0
  const pages = []
  const options = ({ mutatePayload, mutatePage } = {}) => ({
    fetchPage: async url => {
      pages.push(url)
      const html = `<title>${config.company} Careers</title><h1>${config.company} Careers</h1>` + (config.roles
        ? url === config.careers ? `<a href="${config.roles}">View open roles</a>`
          : rows.map(row => `<a href="${row.absolute_url}">${row.title}</a>`).join('')
        : `<a href="https://job-boards.greenhouse.io/${config.source}">View Careers</a>`)
      const page = { status: 200, url, html, body: html }
      return mutatePage ? mutatePage(page, pages.length) : page
    },
    fetchJson: async url => {
      assert.equal(url, `https://boards-api.greenhouse.io/v1/boards/${config.source}/jobs?content=true`)
      const payload = { jobs: structuredClone(rows), meta: { total: rows.length } }
      return mutatePayload ? mutatePayload(payload, ++apiCalls) : (apiCalls++, payload)
    },
  })
  return { rows, options }
}

for (const config of sources) {
  test(`${config.source} proves a current zero-India inventory using employer binding and both full native snapshots`, async () => {
    const setup = fixture(config), jobs = await config.run(setup.options())
    assert.equal(jobs.length, 0)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.listingComplete, true)
    assert.equal(evidence.status, 'complete-inventory')
    assert.equal(evidence.reportedTotal, 2)
    assert.equal(evidence.indiaFacetCount, 0)
    assert.equal(jobs.nativeCollectionEvidence.openingNativePayload.jobs.length, 2)
    assert.equal(jobs.nativeCollectionEvidence.closingNativePayload.jobs.length, 2)
  })

  test(`${config.source} returns a real explicit-India role with its complete employer description`, async () => {
    const setup = fixture(config)
    setup.rows[0].location.name = 'Bengaluru, India'
    const jobs = await config.run(setup.options())
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, 101)
    assert.equal(jobs[0].country, 'India')
    assert.match(jobs[0].sourceDescription, /Requirements[\s\S]*Communicate clearly/)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  })

  for (const [name, mutate] of [
    ['membership changes', p => { p.jobs.pop(); p.meta.total = 1 }],
    ['a country changes', p => { p.jobs[0].location.name = 'Remote, Canada' }],
    ['role criteria change', p => { p.jobs[0].content += '<p>Additional required qualification.</p>' }],
  ]) {
    test(`${config.source} preserves an incomplete inventory when closing ${name}`, async () => {
      const setup = fixture(config)
      const jobs = await config.run(setup.options({ mutatePayload: (p, count) => { if (count === 2) mutate(p); return p } }))
      assert.equal(readInventoryEvidence(jobs).listingComplete, false)
      assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
      assert.match(readInventoryEvidence(jobs).reason, /closing-native-inventory-changed/)
    })
  }

  test(`${config.source} rejects a native employer substitution even when the board URL is unchanged`, async () => {
    const setup = fixture(config)
    await assert.rejects(config.run(setup.options({ mutatePayload: p => { p.jobs[0].company_name = 'Different Company'; return p } })), /native employer/i)
  })

  test(`${config.source} rejects truncated native totals and unavailable responses`, async () => {
    const setup = fixture(config)
    await assert.rejects(config.run(setup.options({ mutatePayload: p => { p.meta.total = 3; return p } })), /inventory/i)
    await assert.rejects(config.run({ ...setup.options(), fetchPage: async () => { throw Error('HTTP 503') } }), /503/)
  })

  test(`${config.source} retains unknown native country scope and additional recruiting boards as incomplete`, async () => {
    const setup = fixture(config)
    const unknown = await config.run(setup.options({ mutatePayload: p => { p.jobs[0].location.name = 'Worldwide'; return p } }))
    assert.equal(readInventoryEvidence(unknown).listingComplete, false)
    const additional = await config.run(setup.options({ mutatePage: p => ({ ...p,
      html: p.html + '<a href="https://job-boards.greenhouse.io/other-company">Other jobs</a>' }) }))
    assert.equal(readInventoryEvidence(additional).listingComplete, false)
  })
}
