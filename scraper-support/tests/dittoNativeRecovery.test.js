import assert from 'node:assert/strict'
import test from 'node:test'
import { createDittoInsuranceScraper } from '../../scraper/dittoinsurance/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'

const home = '<title>Ditto Insurance</title><a href="https://ditto.zappyhire.com/">Careers</a>'
const portal = '<title>Ditto Insurance Careers</title><script src="main.abc123.js"></script>'
const bundle = 'const base="zappyhire-multitenant-be-prod.zappyhire.com/"; class Config { loadConfig(){let tenant="dittoinsurance",url=`https://${tenant}.${base}api/careers/configurations/`; sessionStorage.setItem("TENANT",tenant); return this.http.get(url)}} class Jobs {getTenant(){return sessionStorage.getItem("TENANT")} getJobService(){return this.http.get(`https://${this.getTenant()}.${base}api/jobs/jobsearch/?page=1&page_size=100`)} getJobDetailsService(id){return this.http.get(`https://${this.getTenant()}.${base}api/careers/jobs/${id}/`)}}'
const api = 'https://dittoinsurance.zappyhire-multitenant-be-prod.zappyhire.com'
const config = { status: 1, errors: '', results: { name: 'Ditto Insurance', website: 'https://joinditto.in/', multiple_entity: false } }
const hit = (id, location = 'Bangalore') => ({ _id: `${id}dittoinsurance`, _source: {
  client: 'dittoinsurance', job: id, title: `Software Engineer ${id}`, location,
  entity: 'Ditto Insurance', department: 'Engineering', job_type: 'Full Time',
} })
const detail = (id, city = 'Bangalore-Karnataka', country_code = null) => ({ status: 1, errors: '', results: {
  id, title: `Software Engineer ${id}`, location: [{ city, country_code }],
  description: '<p>Build reliable services. Maintain employer production systems.</p>',
  job_type: 'Full Time', department: 'Engineering', skills: ['JavaScript'], experience: 1, max_experience: 3,
  job_publish_date: '2026-10-22T14:27:54.777947Z', entity: 1, is_vendor_job: false,
  job_board_urls: [{ name: 'Career Page', url: `https://ditto.zappyhire.com/apply/?job=${id}&source=1`,
    feature: { name: 'career_page', is_active: true, is_enabled: true, status: 'AV' } }],
  apply_url: `https://forms.zappyhire.com/dittoinsurance/forms/87?jobId=${id}&mode=job-application`,
} })
const listing = (rows, total = rows.length, relation = 'eq') => ({ status: 1, errors: '',
  results: { hits: rows, total: { value: total, relation } } })
const optionsFor = (rows, details = {}, overrides = {}) => ({
  // The old implementation reads only the homepage and silently returns [].
  fetchText: async () => home,
  fetchPage: async url => ({ status: 200, url, html: url.includes('main.') ? bundle : url === 'https://joinditto.in/' ? home : portal }),
  fetchJson: async url => {
    assert.equal(new URL(url).origin, api)
    if (url.includes('/configurations/')) return structuredClone(config)
    if (url.includes('/jobsearch/')) return listing(structuredClone(rows))
    const id = Number(url.match(/\/jobs\/(\d+)\//)?.[1])
    return structuredClone(details[id] || detail(id))
  }, ...overrides,
})
const registered = () => createCatalogScraper(getScraperCatalog().find(p => p.source === 'dittoinsurance'))

test('Ditto recovers native Bangalore roles with complete descriptions, source dates and tenant-bound URLs', async () => {
  const jobs = await registered().run(optionsFor([hit(62)]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'dittoinsurance')
  assert.equal(jobs[0].company, 'Ditto Insurance')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].location, 'Bangalore-Karnataka')
  assert.equal(jobs[0].postingDate, '2026-10-22T14:27:54.777947Z')
  assert.match(jobs[0].jobDescription, /Maintain employer production systems/)
  assert.equal(jobs[0].applyUrl, detail(62).results.apply_url)
  assert.equal(jobs[0].sourceUrl, detail(62).results.job_board_urls[0].url)
  assert.deepEqual(jobs[0].requiredSkills, ['JavaScript'])
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('Ditto generic remote and ambiguous city jobs are excluded while native India roles remain partial', async () => {
  for (const city of ['Remote-Remote', 'Delhi-New York', 'Hyderabad-Sindh']) {
    const jobs = await registered().run(optionsFor([hit(62), hit(34, city)], { 34: detail(34, city) }))
    assert.equal(jobs.length, 1, city)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  }
})

test('Ditto explicit India country can qualify a remote role without using company marketing copy', async () => {
  const jobs = await registered().run(optionsFor([hit(34, 'Remote')], { 34: detail(34, 'Remote-Remote', 'IN') }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].remoteStatus, 'Remote')
})

test('Ditto native India country includes ordinary cities while unknown country codes retain uncertainty', async () => {
  const jobs = await registered().run(optionsFor([hit(1, 'Kochi')], { 1: detail(1, 'Kochi-Kerala', 'IN') }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Kochi')
  assert.equal(jobs[0].country, 'India')
})

test('Ditto unrecognized country codes cannot certify a foreign-only zero India inventory', async () => {
  for (const code of ['ZZ', 'XX']) {
    const unknown = await registered().run(optionsFor([hit(1, 'Remote')], { 1: detail(1, 'Remote-Remote', code) }))
    assert.equal(unknown.length, 0)
    assert.equal(readInventoryEvidence(unknown)?.listingComplete, false)
    assert.equal(readInventoryEvidence(unknown)?.indiaFacetCount, null)
  }
})

test('Ditto validates application identity for excluded foreign roles as well as India roles', async () => {
  const role = detail(1, 'Toronto-Ontario', 'CA')
  role.results.apply_url = 'https://forms.zappyhire.com/another-company/forms/87?jobId=1&mode=job-application'
  await assert.rejects(registered().run(optionsFor([hit(1, 'Toronto')], { 1: role })), /apply|identity/i)
})

test('Ditto registered limits retain full native counts and prevent complete-inventory cleanup', async () => {
  const jobs = await registered().run({ ...optionsFor([hit(1)]), maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Ditto paginates the full native listing and reconciles the closing role-ID set', async () => {
  const calls = [], rows = [hit(1), hit(2), hit(3)]
  const opts = optionsFor(rows)
  opts.fetchJson = async url => {
    if (!url.includes('/jobsearch/')) return optionsFor(rows).fetchJson(url)
    calls.push(url)
    const parsed = new URL(url), page = Number(parsed.searchParams.get('page'))
    assert.equal(parsed.searchParams.get('page_size'), '2')
    return listing(rows.slice((page - 1) * 2, page * 2), 3)
  }
  const jobs = await createDittoInsuranceScraper({ pageSize: 2 }).run(opts)
  assert.equal(jobs.length, 3)
  assert.equal(calls.length, 4)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('Ditto only a current bound, exact, empty native inventory can certify empty', async () => {
  const jobs = await registered().run(optionsFor([]))
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('Ditto bounded pages/jobs and approximate totals cannot authorize complete inventory', async () => {
  const rows = [hit(1), hit(2)]
  for (const limits of [{ maxJobs: 0 }, { maxJobs: 1 }, { pageSize: 1, maxPages: 1 }]) {
    const base = optionsFor(rows), opts = { ...base, fetchJson: async url => url.includes('/jobsearch/')
      ? listing(rows.slice(0, Number(new URL(url).searchParams.get('page_size'))), 2) : base.fetchJson(url) }
    const jobs = await createDittoInsuranceScraper(limits).run(opts)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
  }
  const base = optionsFor(rows)
  const jobs = await registered().run({ ...base, fetchJson: async url => url.includes('/jobsearch/')
    ? listing(rows, 2, 'gte') : base.fetchJson(url) })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
})

test('Ditto missing details or selected descriptions remain partial without discarding healthy roles', async () => {
  const rows = [hit(1), hit(2)]
  for (const failure of ['transport', 'empty-description']) {
    const base = optionsFor(rows)
    const jobs = await registered().run({ ...base, fetchJson: async url => {
      if (url.endsWith('/jobs/2/')) {
        if (failure === 'transport') throw new Error('HTTP 503')
        return { ...detail(2), results: { ...detail(2).results, description: '<p>&nbsp;</p>' } }
      }
      return base.fetchJson(url)
    } })
    assert.equal(jobs.length, 1)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  }
})

test('Ditto closing listing changes and repeated pages cannot become authoritative inventory', async () => {
  let reads = 0
  const base = optionsFor([hit(1)])
  const jobs = await registered().run({ ...base, fetchJson: async url => url.includes('/jobsearch/')
    ? listing([hit(++reads === 1 ? 1 : 2)]) : base.fetchJson(url) })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  await assert.rejects(createDittoInsuranceScraper({ pageSize: 1 }).run({ ...base,
    fetchJson: async url => url.includes('/jobsearch/') ? listing([hit(1)], 2) : base.fetchJson(url),
  }), /repeated|duplicate|inventory/i)
})

test('Ditto foreign tenant, employer, role, country and apply identities fail closed', async () => {
  const base = optionsFor([hit(1)])
  const badDetails = [
    { ...detail(1).results, id: 99 },
    { ...detail(1).results, entity: 2 },
    { ...detail(1).results, is_vendor_job: true },
    { ...detail(1).results, location: [{ city: 'Bangalore-Karnataka', country_code: 'US' }] },
    { ...detail(1).results, apply_url: 'https://forms.zappyhire.com/other/forms/87?jobId=1&mode=job-application' },
    { ...detail(1).results, apply_url: 'https://forms.zappyhire.com/dittoinsurance/forms/87?jobId=99&mode=job-application' },
    { ...detail(1).results, job_board_urls: [{ ...detail(1).results.job_board_urls[0], url: 'https://ditto.zappyhire.com/apply/?job=99' }] },
  ]
  for (const result of badDetails) await assert.rejects(registered().run({ ...base,
    fetchJson: async url => url.endsWith('/jobs/1/') ? { status: 1, errors: '', results: result } : base.fetchJson(url),
  }), /identity|country|employer|tenant|vendor|inventory|apply/i)
  await assert.rejects(registered().run(optionsFor([{ ...hit(1), _source: { ...hit(1)._source, client: 'other' } }])), /tenant|identity|inventory/i)
  await assert.rejects(registered().run({ ...base, fetchJson: async url => url.includes('/configurations/')
    ? { ...config, results: { ...config.results, website: 'https://other-company.invalid/' } } : base.fetchJson(url) }), /employer|binding|identity/i)
})

test('Ditto stale/inert bindings and unrelated bundle tenant references cannot establish current employer identity', async () => {
  const base = optionsFor([])
  for (const page of [
    { status: 403, url: 'https://joinditto.in/', html: home },
    { status: 200, url: 'https://other-company.invalid/', html: home },
    { status: 200, url: 'https://joinditto.in/', html: `<div hidden>${home}</div>` },
  ]) await assert.rejects(registered().run({ ...base, fetchPage: async () => page }), /binding|employer|handoff|page/i)
  for (const js of [`/* ${bundle} */`, `const reference=${JSON.stringify(bundle)};`, bundle.replace('dittoinsurance', 'different-tenant'),
    bundle.replace('let tenant="dittoinsurance",url=', 'let tenant="dittoinsurance";tenant="other";let url=')]) {
    await assert.rejects(registered().run({ ...base, fetchPage: async url => url.includes('main.')
      ? { status: 200, url, html: js } : base.fetchPage(url) }), /bundle|tenant|binding|contract/i)
  }
})

test('Ditto cancellation is forwarded before and during public transport', async () => {
  const reason = new Error('cancel Ditto source'), base = optionsFor([])
  await assert.rejects(registered().run({ ...base, signal: AbortSignal.abort(reason) }), error => error === reason)
  const controller = new AbortController()
  await assert.rejects(registered().run({ ...base, signal: controller.signal, fetchPage: async (url, options) => {
    assert.equal(options.signal, controller.signal)
    controller.abort(reason)
    return base.fetchPage(url)
  } }), error => error === reason)
})
