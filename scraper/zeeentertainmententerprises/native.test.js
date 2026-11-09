import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createZeeEntertainmentEnterprisesScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { defaultZeeFetchText } from './native.js'

const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)))
const listing = fixture('native-listing')
const detail = fixture('native-detail')
const origin = 'https://zee.sensehq.com/careers'
const html = payload => `<html><body><h1>${payload.props.pageProps.job?.title || 'Zee'}</h1><button>Apply Now</button><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script></body></html>`
const now = () => '2026-10-21T00:00:00.000Z'
const mocks = (mutate, { failDetail = false, signal } = {}) => {
  const list = structuredClone(listing), role = structuredClone(detail)
  if (mutate) mutate(list, role)
  const requests = []
  return { requests, now, signal, fetchText: async url => {
    requests.push(url)
    if (url === 'https://www.zee.com/about-us/') return '<h1>Zee Entertainment Enterprises Limited</h1>'
    if (url === 'https://www.zee.com/careers/') return '<h1>Zee Entertainment Enterprises Limited</h1><a href="https://zee.sensehq.com/careers">Explore Jobs</a>'
    if (url === `${origin}/jobs`) return html(list)
    if (url === `${origin}/jobs/5831`) {
      if (failDetail) throw new Error('HTTP 503')
      return html(role)
    }
    throw new Error('Unexpected native URL ' + url)
  } }
}

test('complete native check fetches stable totals and full published role details', async () => {
  const options = mocks()
  const jobs = await createZeeEntertainmentEnterprisesScraper().run(options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '5831')
  assert.equal(jobs[0].postingDate, '2026-10-14')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.match(jobs[0].sourceDescription, /SDE|iOS|Swift/i)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(options.requests.filter(url => url === `${origin}/jobs`).length, 2)
  assert.ok(options.requests.includes(`${origin}/jobs/5831`))
})

for (const [label, mutate] of [
  ['missing inventory', p => { delete p.props.pageProps.jobsData }],
  ['unknown total', p => { delete p.props.pageProps.jobsData.count }],
  ['string total', p => { p.props.pageProps.jobsData.count = '1' }],
  ['wrong organization', p => { p.props.pageProps.organization.id = 123 }],
  ['wrong tenant', p => { p.props.pageProps.organization.career_page_subdomain = 'other' }],
  ['wrong row employer', p => { p.props.pageProps.jobsData.rows[0].organization_id = 123 }],
  ['future date', p => { p.props.pageProps.jobsData.rows[0].created_on = Date.parse('2099-01-01') }],
  ['array ID', p => { p.props.pageProps.jobsData.rows[0].id = [5831] }],
  ['unknown country', p => { p.props.pageProps.jobsData.rows[0].office.country = 'Unknown' }],
  ['conflicting country label', p => { p.props.pageProps.jobsData.rows[0].location = 'New York, United States' }],
  ['conflicting country code', p => { p.props.pageProps.jobsData.rows[0].location = 'Paris, FR' }],
  ['preview inventory', p => { p.props.pageProps.preview = true }],
]) test(`rejects ${label} rather than claiming an empty or complete check`, async () => {
  await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(mocks(mutate)))
})

for (const [label, mutate] of [
  ['wrong detail ID', (_, p) => { p.props.pageProps.job.id = 999 }],
  ['wrong detail employer', (_, p) => { p.props.pageProps.job.organization_id = 123 }],
  ['wrong detail title', (_, p) => { p.props.pageProps.job.title = 'Different role' }],
  ['unpublished role', (_, p) => { p.props.pageProps.job.is_published = false }],
  ['deleted role', (_, p) => { p.props.pageProps.job.is_deleted = true }],
  ['wrong route ID', (_, p) => { p.query.id = '999' }],
  ['foreign detail country', (_, p) => { p.props.pageProps.job.office.country = 'United States' }],
  ['missing native description', (_, p) => { p.props.pageProps.job.description_external = null }],
  ['script-only description', (_, p) => { p.props.pageProps.job.description_external = '<script>Develop software systems and support applications</script>' }],
  ['spacing-entity description', (_, p) => { p.props.pageProps.job.description_external = '<p>&#8203;</p>'; p.props.pageProps.job.skills_and_expertise_external = '' }],
]) test(`${label} keeps useful listing identity explicitly partial`, async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper().run(mocks(mutate))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].jobDescription, '')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('failed native detail does not publish a listing description as a replacement', async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper().run(mocks(null, { failDetail: true }))
  assert.equal(jobs[0].jobDescription, '')
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('explicit complete empty inventory stays separate from an absent response', async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper().run(mocks(p => {
    p.props.pageProps.jobsData = { count: 0, rows: [] }
  }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('caller cancellation remains a failed check', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(mocks(null, { signal: controller.signal })))
})

test('caller cancellation settles even when a transport ignores its abort signal', async () => {
  const controller = new AbortController(), options = mocks(null, { signal: controller.signal })
  options.fetchText = async () => new Promise(() => {})
  const pending = createZeeEntertainmentEnterprisesScraper().run(options)
  controller.abort(new Error('cancelled during source request'))
  await assert.rejects(pending, /cancelled during source request/)
})

const multiPage = (mutate = () => {}) => {
  const base = mocks(), records = Array.from({length: 12}, (_, index) => {
    const record = structuredClone(listing.props.pageProps.jobsData.rows[0])
    record.id = 6000 + index; record.code = String(7000 + index)
    return record
  })
  let firstPageRequests = 0
  const fetchText = async url => {
    if (url === `${origin}/jobs` || url === `${origin}/jobs?page=1`) {
      const p = structuredClone(listing), page = url.includes('?') ? 2 : 1
      p.query = page === 1 ? {} : {page: '1'}
      p.props.pageProps.jobsData = { count: 12, rows: records.slice((page - 1) * 10, page * 10) }
      if (page === 1) firstPageRequests++
      mutate(p, page, firstPageRequests)
      return html(p)
    }
    const id = Number(url.split('/').at(-1)), record = records.find(row => row.id === id)
    if (record) {
      const p = structuredClone(detail)
      p.props.pageProps.job = {...p.props.pageProps.job, ...record}
      p.query.id = String(id)
      return html(p)
    }
    return base.fetchText(url)
  }
  return { ...base, fetchText }
}

test('pagination uses the stable native page size through a shorter final page', async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper().run(multiPage())
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 12)
  assert.equal(jobs.every(job => job.sourceListingComplete), true)
})

test('a page limit retains useful rows with incomplete inventory and health', async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper({ maxPages: 1 }).run(multiPage())
  assert.equal(jobs.length, 10)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.every(job => job.sourceDetailComplete && !job.sourceListingComplete), true)
})

test('a job limit does not report untraversed inventory as complete', async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper({ maxJobs: 3 }).run(multiPage())
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.every(job => !job.sourceListingComplete), true)
})

test('duplicate page boundary and unstable native totals reject', async () => {
  await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(multiPage((p, page) => {
    if (page === 2) p.props.pageProps.jobsData.rows[0].id = 6000
  })), /duplicate/)
  await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(multiPage((p, page, requests) => {
    if (page === 1 && requests === 2) p.props.pageProps.jobsData.count = 13
  })), /changed/)
})

for (const wrapper of [body => `<!--${body}-->`, body => `<template>${body}</template>`, body => `<textarea>${body}</textarea>`]) {
  test('inert HTML cannot supply the native inventory payload', async () => {
    const options = mocks(), get = options.fetchText
    options.fetchText = async url => url === `${origin}/jobs` ? wrapper(await get(url)) : get(url)
    await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(options), /active native JSON/)
  })
}

test('an inert corporate handoff cannot verify the employer portal', async () => {
  const options = mocks(), get = options.fetchText
  options.fetchText = async url => url === 'https://www.zee.com/careers/'
    ? '<h1>Zee Entertainment Enterprises Limited</h1><!--<a href="https://zee.sensehq.com/careers">Jobs</a>-->' : get(url)
  await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(options), /handoff/)
})

test('a final recheck resolving after caller cancellation cannot mark complete', async () => {
  const controller = new AbortController(), options = mocks(null, { signal: controller.signal }), get = options.fetchText
  let firstRequests = 0
  options.fetchText = async url => {
    if (url === `${origin}/jobs` && ++firstRequests === 2) controller.abort()
    return get(url)
  }
  await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(options))
})

test('default transport rejects partial HTTP statuses and redirected identities', async () => {
  const native = globalThis.fetch
  try {
    for (const [status, url] of [[202, `${origin}/jobs`], [206, `${origin}/jobs`], [200, `${origin}/jobs/other`]]) {
      globalThis.fetch = async () => ({ status, url, text: async () => 'not a complete native response' })
      await assert.rejects(defaultZeeFetchText(`${origin}/jobs`), /HTTP status or final URL/)
    }
  } finally { globalThis.fetch = native }
})

for (const value of ['india', ' India ']) test('country normalization cannot turn India roles into a verified zero', async () => {
  const jobs = await createZeeEntertainmentEnterprisesScraper().run(mocks((p, d) => {
    p.props.pageProps.jobsData.rows[0].office.country = value
    d.props.pageProps.job.office.country = value
  }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
})

for (const mutate of [p => { p.statusCode = 500 }, p => { p.error = 'upstream failed' },
  p => { p.props.pageProps.success = false }, p => { p.props.pageProps.error = 'upstream failed' }]) {
  test('an error envelope cannot certify a verified zero', async () => {
    await assert.rejects(createZeeEntertainmentEnterprisesScraper().run(mocks(p => {
      p.props.pageProps.jobsData = { count: 0, rows: [] }; mutate(p)
    })))
  })
}
