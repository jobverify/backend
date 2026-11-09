import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'

// Synthetic native contracts. Current employer responses and full native feeds
// are separately archived by verify-public-ats-scope.mjs.
const modes = { close: 'board-handoff', classdojo: 'board-handoff', coalesce: 'board-handoff',
  deepl: 'board-handoff', fellowapp: 'board-handoff', charthop: 'board-handoff',
  freshpaint: 'board-embed', datagrail: 'role-links-exact', fireworksai: 'role-links-exact' }
const catalog = getScraperCatalog()
const boardUrl = p => `https://${p.atsPlatform === 'ashby' ? 'jobs.ashbyhq.com' : 'job-boards.greenhouse.io'}/${p.boardToken}`
const nativeRow = (p, id = '1', location = 'Boston, United States', country = 'US') => p.atsPlatform === 'ashby'
  ? { id, title: 'Software Engineer', isListed: true, location,
    address: { postalAddress: { addressCountry: country } },
    jobUrl: `${boardUrl(p)}/${id}`, applyUrl: `${boardUrl(p)}/${id}/application`,
    descriptionPlain: 'Build and maintain production services.' }
  : { id: Number(id), title: 'Software Engineer', location: { name: location },
    absolute_url: `${boardUrl(p)}/jobs/${id}`, content: '<p>Build and maintain production services.</p>' }
const payloadFor = (p, rows) => p.atsPlatform === 'ashby'
  ? { apiVersion: '1', jobs: rows } : { jobs: rows, meta: { total: rows.length } }
const pageFor = (p, rows) => ({ status: 200, url: p.source === 'charthop' ? boardUrl(p) : p.companyCareerPage,
  html: `<title>${p.companyName} Careers</title>` + (modes[p.source] === 'board-embed'
    ? `<script src="${boardUrl(p)}/embed"></script>` : modes[p.source] === 'role-links-exact'
      ? rows.map(row => `<a href="${row.jobUrl || row.absolute_url}">${row.title}</a>`).join('')
      : `<a href="${boardUrl(p)}">All open roles</a>`),
})
const run = (p, rows, options = {}) => createCatalogScraper(p).run({
  fetchPage: async () => pageFor(p, rows), fetchJson: async () => payloadFor(p, rows), ...options,
})

for (const [source, mode] of Object.entries(modes)) {
  const provider = catalog.find(row => row.source === source)

  test(`${source} verifies the current employer before accepting a complete native zero-India inventory`, async () => {
    const rows = [nativeRow(provider)]
    let pages = 0, nativeRequests = 0
    const jobs = await run(provider, rows, {
      fetchPage: async (url, options) => {
        pages++
        assert.equal(url, provider.companyCareerPage)
        assert.ok(Object.hasOwn(options, 'signal'))
        return pageFor(provider, rows)
      },
      fetchJson: async () => { nativeRequests++; return payloadFor(provider, rows) },
    })
    assert.equal(jobs.length, 0)
    assert.equal(pages, 1)
    assert.equal(nativeRequests, 1)
    assert.equal(provider.runtimeInventoryVerification?.mode, mode)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 0)
    assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  })

  test(`${source} retains proven India roles and complete descriptions through runtime verification`, async () => {
    const jobs = await run(provider, [nativeRow(provider, '1', 'Bengaluru, India', 'India')])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].source, source)
    assert.match(jobs[0].jobDescription, /production services/)
    assert.notEqual(jobs[0].sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  })

  test(`${source} blocked or unbound employer pages cannot use cached binding as live proof`, async () => {
    const rows = [nativeRow(provider)]
    for (const page of [{ ...pageFor(provider, rows), status: 403 },
      { ...pageFor(provider, rows), url: 'https://different-company.invalid/careers' },
      { status: 200, url: provider.companyCareerPage, html: '<title>Careers</title><h1>Join us</h1>' }]) {
      await assert.rejects(run(provider, rows, { fetchPage: async () => page }), /binding|employer|handoff|scope/i)
    }
  })

  test(`${source} missing native geography remains partial after employer binding succeeds`, async () => {
    const jobs = await run(provider, [nativeRow(provider, '1', 'Worldwide', '')])
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
    assert.match(readInventoryEvidence(jobs)?.reason || '', /location-scope-unresolved/)
  })

  test(`${source} foreign native role identities cannot certify inventory`, async () => {
    const row = nativeRow(provider, '1', 'Bengaluru, India', 'India')
    if (provider.atsPlatform === 'ashby') row.jobUrl = row.jobUrl.replace(`/${provider.boardToken}/`, '/other-employer/')
    else row.absolute_url = row.absolute_url.replace(`/${provider.boardToken}/`, '/other-employer/')
    await assert.rejects(run(provider, [row]), /identity|board|inventory/i)
  })

  test(`${source} a city name without native India country evidence cannot establish an India vacancy`, async () => {
    for (const location of ['Delhi, NY', 'Hyderabad, Sindh', 'Bengaluru']) {
      const jobs = await run(provider, [nativeRow(provider, '1', location, '')])
      assert.equal(jobs.length, 0, location)
      assert.equal(readInventoryEvidence(jobs)?.listingComplete, false, location)
      assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null, location)
    }
  })

  test(`${source} caller cancellation prevents employer and native transport`, async () => {
    const reason = new Error('cancel runtime source check')
    const fail = async () => assert.fail('fetch after cancellation')
    await assert.rejects(run(provider, [], { signal: AbortSignal.abort(reason), fetchPage: fail, fetchJson: fail }), error => error === reason)
  })
}

test('current exact board handoff plus an empty native feed verifies empty inventory', async () => {
  const p = catalog.find(row => row.source === 'coalesce')
  const jobs = await run(p, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('hidden, inert, template, comment and inline-script handoffs cannot establish full board scope', async () => {
  const p = catalog.find(row => row.source === 'classdojo'), rows = [nativeRow(p)]
  const anchor = `<a href="${boardUrl(p)}">All roles</a>`
  for (const html of [`<div hidden>${anchor}</div>`, `<div inert>${anchor}</div>`,
    `<template>${anchor}</template>`, `<!-- ${anchor} -->`, `<script>const url='${boardUrl(p)}'</script>`,
    `<a href="${boardUrl(p)}/form/talent-community">Talent community</a>`,
    `<a href="${boardUrl(p)}?location=India">India subset</a>`]) {
    await assert.rejects(run(p, rows, { fetchPage: async () => ({ status: 200, url: p.companyCareerPage, html }) }), /binding|handoff|scope/i)
  }
})

test('non-executable or hidden embed scripts cannot establish full native scope', async () => {
  const p = catalog.find(row => row.source === 'freshpaint'), rows = [nativeRow(p)]
  for (const html of [`<div hidden><script src="${boardUrl(p)}/embed"></script></div>`,
    `<script type="application/ld+json" src="${boardUrl(p)}/embed"></script>`,
    `<script nomodule src="${boardUrl(p)}/embed"></script>`,
    `<script src="${boardUrl(p)}/embed?location=India"></script>`]) {
    await assert.rejects(run(p, rows, { fetchPage: async () => ({ status: 200, url: p.companyCareerPage, html }) }), /binding|embed|scope/i)
  }
})

test('advertised roles must reconcile even when a full board link is also present', async () => {
  const p = catalog.find(row => row.source === 'classdojo'), rows = [nativeRow(p)]
  const page = pageFor(p, rows)
  page.html += `<a href="${boardUrl(p)}/missing-role">Additional role</a>`
  const jobs = await run(p, rows, { fetchPage: async () => page })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs)?.reason || '', /reconcil/)
})

test('exact role-list verification requires equality with the native feed and non-vacuous delegation', async () => {
  for (const source of ['datagrail', 'fireworksai']) {
    const p = catalog.find(row => row.source === source), rows = [nativeRow(p), nativeRow(p, '2')]
    const jobs = await run(p, rows, { fetchPage: async () => pageFor(p, rows.slice(0, 1)) })
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
    assert.match(readInventoryEvidence(jobs)?.reason || '', /reconcil/)
    await assert.rejects(run(p, []), /binding|handoff|scope/i)
  }
})

test('additional native employer boards preserve unknown overall inventory scope', async () => {
  const p = catalog.find(row => row.source === 'classdojo'), rows = [nativeRow(p)]
  const page = pageFor(p, rows)
  page.html += '<a href="https://jobs.ashbyhq.com/another-company-board">Other open roles</a>'
  const jobs = await run(p, rows, { fetchPage: async () => page })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

test('unsupported recruiting surfaces cannot disappear into an authoritative empty native inventory', async () => {
  const p = catalog.find(row => row.source === 'classdojo')
  for (const extra of [
    '<a href="https://example.wd5.myworkdayjobs.com/External">Opportunities</a>',
    '<a href="https://jobs.smartrecruiters.com/Example">Careers</a>',
    '<a href="https://careers.smartrecruiters.com/Example">Jobs</a>',
    '<a href="https://apply.workable.com/example">View roles</a>',
    '<a href="https://jobs-example.icims.com/jobs">Opportunities</a>',
    '<iframe src="https://example.wd5.myworkdayjobs.com/External"></iframe>',
    '<a href="https://hiring.example.test/openings">View open roles</a>',
  ]) {
    const page = pageFor(p, [])
    page.html += extra
    const jobs = await run(p, [], { fetchPage: async () => page })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false, extra)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null, extra)
    assert.match(readInventoryEvidence(jobs)?.reason || '', /additional-employer/)
  }
})

test('ordinary external links and hidden recruiting markup do not create extra active job inventories', async () => {
  const p = catalog.find(row => row.source === 'coalesce'), page = pageFor(p, [])
  page.html += '<a href="https://partner.example.test/about">Our partner</a>'
    + '<a href="https://www.linkedin.com/company/example">LinkedIn</a>'
    + '<div hidden><a href="https://example.wd5.myworkdayjobs.com/External">Jobs</a></div>'
  const jobs = await run(p, [], { fetchPage: async () => page })
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('a proven secondary India address takes precedence over an ambiguous primary city name', async () => {
  const p = catalog.find(row => row.source === 'classdojo'), row = nativeRow(p, '1', 'Delhi, NY', '')
  row.secondaryLocations = [{ location: 'Kochi, India', address: { addressCountry: 'India', addressLocality: 'Kochi' } }]
  const jobs = await run(p, [row])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Kochi, India')
  assert.equal(jobs[0].country, 'India')
})
