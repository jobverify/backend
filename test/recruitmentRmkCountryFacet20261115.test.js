import test from 'node:test'
import assert from 'node:assert/strict'
import { runCurrentRmkCountryFacet } from '../scraper-support/utils/recruitmentRmkCountryFacet.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { rmkCountryFacetFixture } from './helpers/rmkCountryFacetPublicContract20261115.js'
const source = 'newellbrands'
const selected = 'https://jobs.newellbrands.com/search/?createNewAlert=false&q=&optionsFacetsDD_customfield4=India'
const roles = ['1430982300', '1431367400']
const run = (change, options = {}) => { const fixture = rmkCountryFacetFixture(change); return { ...fixture, jobs: runCurrentRmkCountryFacet(source, { fetchImpl: fixture.fetchImpl, ...options }) } }

test('current typed country facet and independently selected roles yield two full native Newell jobs', async () => {
  const result = run(), jobs = await result.jobs
  assert.deepEqual(jobs.map(job => job.jobId), roles)
  assert.ok(jobs.every(job => job.company === 'Newell Brands' && job.country === 'India' && job.jobDescription.length > 1000
    && job.sourceScopeComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs[0].location, 'IN')
  assert.equal(jobs[0].nativeCountryEvidence.selectedCountry.name, 'India')
  assert.equal(jobs[0].nativeCountryEvidence.nativeAddress.streetAddress, 'IN')
  assert.equal(jobs[0].sourceOfficialBinding.currentHandoffRechecked, true)
  assert.equal(jobs[0].sourceNativeClosingContext.eachFullRoleRechecked, true)
  assert.equal(jobs[0].sourceNativeClosingContext.selectedReportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs[0].nativeBatchEvidence.responses.some(response => response.body.includes('Purpose of the Role:')))
  assert.ok(result.calls.filter(call => call.url === selected).length >= 2)
  const post = result.calls.find(call => call.init.method === 'POST')
  assert.equal(post.url, 'https://jobs.newellbrands.com/services/jobs/options/facetValues/')
  assert.deepEqual(JSON.parse(post.init.body), { page: 0, keywords: '', locationsearch: '', sortby: 'referencedate', sortdir: 'desc', sortfield: 'title', recordsperpage: 25, startrow: 0,
    facetquery: { facet: true, mincount: 1, limit: 5000, fields: ['customfield4', 'department', 'customfield3', 'customfield5', 'facility', 'dept'], sort: 'index', showPicklistAllLocales: true }, filterquery: {} })
})

test('only current active corporate handoffs bind the native account', async () => {
  const result = run((packet) => { if (packet.url === 'https://www.newellbrands.com/') packet.body = packet.body.replaceAll('https://careers.newellbrands.com/index', 'https://wrong.example/jobs') })
  await assert.rejects(result.jobs, /handoff/i)
  assert.equal(result.calls.some(call => call.init.method === 'POST'), false)
})

test('country typing requires the reviewed declared selector and a native India country record', async () => {
  for (const mode of ['label', 'typed-map', 'client']) {
    const result = run((packet) => {
      if (mode === 'label' && packet.url.endsWith('/search/')) packet.body = packet.body.replaceAll('Country\n', 'City\n')
      if (mode === 'typed-map' && packet.url.includes('/facetValues/')) { const data = JSON.parse(packet.body);data.facets.map.customfield4.find(value => value.name === 'India').translated = 'Indonesia';packet.body = JSON.stringify(data) }
      if (mode === 'client' && packet.url.includes('options-search.min.js')) packet.body += '\n// changed deployment'
    })
    await assert.rejects(result.jobs, /country|client|selector/i, mode)
  }
})

test('a country facet count or listing identity mismatch cannot certify a partial selection', async () => {
  for (const mode of ['count', 'duplicate', 'title']) {
    const result = run((packet) => {
      if (mode === 'count' && packet.url.includes('/facetValues/')) { const data = JSON.parse(packet.body);data.facets.map.customfield4.find(value => value.name === 'India').count = 3;packet.body = JSON.stringify(data) }
      if (mode === 'duplicate' && packet.url === selected) packet.body = packet.body.replaceAll('1431367400', '1430982300')
      if (mode === 'title' && packet.url.includes('/job/Data-Capability')) packet.body = packet.body.replaceAll('Data Capability Engineer', 'Another title')
    })
    await assert.rejects(result.jobs, /count|pagination|identity|title|duplicate/i, mode)
  }
})

test('own native employer, country, visible description and application identity remain mandatory', async () => {
  for (const mode of ['employer', 'country', 'blank', 'hidden', 'css-hidden', 'apply']) {
    const result = run((packet) => {
      if (!packet.url.includes('/job/')) return
      if (mode === 'employer') packet.body = packet.body.replaceAll('itemprop="hiringOrganization" content="Newell Brands"', 'itemprop="hiringOrganization" content="Other Company"')
      if (mode === 'country') packet.body = packet.body.replaceAll('itemprop="streetAddress" content="IN"', 'itemprop="streetAddress" content="ID"').replaceAll('itemprop="addressCountry" content="IN"', 'itemprop="addressCountry" content="ID"')
      if (mode === 'blank') packet.body = packet.body.replace(/(<span\b[^>]*itemprop="description"[^>]*>)[\s\S]*?<\/span>/g, '$1</span>')
      if (mode === 'hidden') packet.body = packet.body.replace('class="jobDisplayShell"', 'hidden class="jobDisplayShell"')
      if (mode === 'css-hidden') packet.body += '<style>.jobDisplayShell{display:none}</style>'
      if (mode === 'apply') packet.body = packet.body.replaceAll('/talentcommunity/apply/' + packet.url.match(/\/(\d+)\/$/)[1] + '/', '/talentcommunity/apply/9999999999/')
    })
    await assert.rejects(result.jobs, /employer|country|description|visible|scope|application/i, mode)
  }
})

test('closing changes in native role, selection, facet, client or publisher reject the staged batch', async () => {
  for (const mode of ['role', 'listing', 'facet', 'client', 'publisher']) {
    const result = run((packet, call) => {
      if (call.ordinal < 2) return
      if (mode === 'role' && packet.url.includes('/job/')) packet.body = packet.body.replaceAll('Data Capability Engineer', 'Changed role title')
      if (mode === 'listing' && packet.url === selected) packet.body = packet.body.replaceAll('Data Capability Engineer', 'Changed listing title')
      if (mode === 'facet' && packet.url.includes('/facetValues/')) { const data = JSON.parse(packet.body);data.facets.map.customfield4.find(value => value.name === 'India').count = 1;packet.body = JSON.stringify(data) }
      if (mode === 'client' && packet.url.includes('options-search.min.js')) packet.body += '// later change'
      if (mode === 'publisher' && packet.url === 'https://www.newellbrands.com/') packet.body = packet.body.replaceAll('https://careers.newellbrands.com/index', 'https://wrong.example/jobs')
    })
    await assert.rejects(result.jobs, /closing|changed|handoff|client|count/i, mode)
  }
})

test('a public denial and an uncertified empty selection remain failures, never zero inventory', async () => {
  const denied = run(packet => { if (packet.url.includes('/facetValues/')) { packet.status = 403;packet.body = 'Forbidden' } })
  await assert.rejects(denied.jobs, /403/)
  const empty = run(packet => { if (packet.url.includes('/facetValues/')) { const data=JSON.parse(packet.body);data.facets.map.customfield4.find(value=>value.name==='India').count=0;packet.body=JSON.stringify(data) } })
  await assert.rejects(empty.jobs, /empty|count|unverified/i)
})

test('native antiClickjack interpretation cannot remove arbitrary body-hiding styles or changed programs', async () => {
  for (const mode of ['program', 'extra-style']) {
    const result = run(packet => { if (packet.url.includes('/job/')) packet.body = mode === 'program' ? packet.body.replaceAll('self === top', 'self !== top') : packet.body + '<style>body{display:none!important}</style>' })
    await assert.rejects(result.jobs, /antiClick|visible|scope/i, mode)
  }
})

test('detail caps, caller cancellation and unsupported sources fail before claiming any inventory', async () => {
  const capped = run(undefined, { maxDetails: 1 })
  await assert.rejects(capped.jobs, /bound|detail|count/i)
  const controller = new AbortController();controller.abort(Error('caller stopped'))
  const cancelled = run(undefined, { signal: controller.signal })
  await assert.rejects(cancelled.jobs, /caller stopped/)
  assert.equal(cancelled.calls.length, 0)
  await assert.rejects(runCurrentRmkCountryFacet('unreviewed-source'), /unsupported|reviewed/i)
})

test('unexecuted antiClickjack data and CSS in a hidden ancestor cannot grant visibility', async () => {
  for (const mode of ['inert-program', 'hidden-style']) {
    const result = run(packet => { if (!packet.url.includes('/job/')) return
      packet.body = mode === 'inert-program' ? packet.body.replace('type="text/javascript" id="antiClickJackScript"', 'type="application/json" id="antiClickJackScript"') : packet.body + '<div hidden><style>body{display:none!important}</style></div>'
    })
    await assert.rejects(result.jobs, /antiClick|visible|scope/i, mode)
  }
})

test('conflicting country fields and nested unrelated employer scopes cannot donate own role properties', async () => {
  for (const mode of ['country', 'employer']) {
    const result = run(packet => { if (!packet.url.includes('/job/')) return
      if (mode === 'country') packet.body = packet.body.replace('itemprop="streetAddress" content="IN"', 'itemprop="streetAddress" content="ID" /><meta itemprop="streetAddress" content="IN"')
      else packet.body = packet.body.replace('<meta itemprop="hiringOrganization" content="Newell Brands"', '<section itemscope itemtype="http://schema.org/Organization"><meta itemprop="hiringOrganization" content="Newell Brands" /></section><meta data-unrelated="true"')
    })
    await assert.rejects(result.jobs, /country|employer|hiringOrganization|ambiguous/i, mode)
  }
})

test('current configured first-party Essilor legal publisher and typed country selection yield seventeen full native roles', async () => {
  const fixture = rmkCountryFacetFixture(undefined, 'essilorluxottica')
  const jobs = await runCurrentRmkCountryFacet('essilorluxottica', { fetchImpl: fixture.fetchImpl })
  assert.equal(jobs.length, 17)
  assert.ok(jobs.some(job => job.jobId === '1432767833' && job.title === 'Senior Sales Executive'))
  assert.ok(jobs.every(job => job.company === 'EssilorLuxottica' && job.nativeEmployer === 'EssilorLuxottica Group' && job.country === 'India' && job.jobDescription.length > 500 && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs[0].nativeCountryEvidence.selectedCountry.name, 'IN')
  assert.equal(jobs[0].nativeCountryEvidence.selectedCountry.translated, 'India')
  assert.equal(jobs[0].sourceOfficialBinding.method, 'configured-first-party-native-legal-publisher')
  assert.equal(jobs[0].sourceOfficialBinding.companyScopeComplete, false)
  assert.equal(jobs[0].sourceOfficialBinding.currentHandoffRechecked, true)
})

test('Essilor legal publisher, reciprocal corporate URLs and closing proof are source-local requirements', async () => {
  for (const mode of ['legal', 'reciprocal', 'closing']) {
    const fixture = rmkCountryFacetFixture((packet, call) => {
      if (packet.url !== 'https://careers.essilorluxottica.com/') return
      if (mode === 'legal' || mode === 'closing' && call.ordinal >= 3) packet.body = packet.body.replaceAll('10182640150', '00000000000')
      if (mode === 'reciprocal') packet.body = packet.body.replaceAll('https://www.essilorluxottica.com/mission', 'https://wrong.example/mission')
    }, 'essilorluxottica')
    await assert.rejects(runCurrentRmkCountryFacet('essilorluxottica', { fetchImpl: fixture.fetchImpl }), /legal|publisher|reciprocal|closing/i, mode)
  }
})

test('native expiry and explicit future UTC posting dates reject the complete staged batch', async t => {
  for (const mode of ['expired', 'invalid-expiry', 'future-posted']) await t.test(mode, async () => {
    const result = run(packet => {
      if (!packet.url.includes('/job/')) return
      if (mode === 'future-posted') {
        const future = new Date(Date.now() + 60_000).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) (.+) GMT$/, '$1 $3 $2 $5 UTC $4')
        packet.body = packet.body.replace(/(itemprop="datePosted" content=")[^"]+/, '$1' + future)
      } else packet.body = packet.body.replace('<meta itemprop="datePosted"', '<meta itemprop="validThrough" content="' + (mode === 'expired' ? '2020-01-01' : 'unknown') + '" /><meta itemprop="datePosted"')
    })
    await assert.rejects(result.jobs, /expired|expiry|future|validThrough/i, mode)
  })
})

test('external or nomodule options/bootstrap programs cannot supply current inline declarations', async t => {
  for (const mode of ['anti-empty-src', 'options-empty-src', 'options-nomodule', 'token-empty-src', 'token-nomodule']) await t.test(mode, async () => {
    const result = run(packet => {
      if (mode === 'anti-empty-src' && packet.url.includes('/job/')) packet.body = packet.body.replace('type="text/javascript" id="antiClickJackScript"', 'type="text/javascript" src="" id="antiClickJackScript"')
      if (!packet.url.endsWith('/search/')) return
      if (mode.startsWith('options-')) packet.body = packet.body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (all, attrs, code) => code.includes('j2w.search.options') ? '<script ' + (mode.endsWith('empty-src') ? 'src=""' : 'nomodule') + attrs + '>' + code + '</script>' : all)
      if (mode.startsWith('token-')) packet.body = packet.body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (all, attrs, code) => code.includes('"X-CSRF-Token"') ? '<script ' + (mode.endsWith('empty-src') ? 'src=""' : 'nomodule') + attrs + '>' + code + '</script>' : all)
    })
    await assert.rejects(result.jobs, /antiClick|declaration|program|CSRF/i, mode)
    if (mode !== 'anti-empty-src') assert.equal(result.calls.some(call => call.init.method === 'POST'), false, mode)
  })
})

test('later or nested active options mutations cannot reuse an earlier literal declaration', async t => {
  const mutations = [
    'j2w.search.options.facets = ["city"];',
    'if (true) { j2w.search.options.facets = ["city"]; }',
    'j2w["search"]["options"].facets.push("city");',
    'Object.assign(j2w.search.options, {facets:["city"]});',
    'const alias = j2w.search; alias.options = {facets:["city"]};',
    'j2w.search = {options:{facets:["city"]}};',
    'window.j2w = {search:{options:{facets:["city"]}}};',
  ]
  for (const mutation of mutations) await t.test(mutation, async () => {
    const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body += '<script>' + mutation + '</script>' })
    await assert.rejects(result.jobs, /options|mutation|bootstrap/i, mutation)
    assert.equal(result.calls.some(call => call.init.method === 'POST'), false, mutation)
  })
})

test('active inline modules cannot override or supply the reviewed classic options bootstrap', async t => {
  for (const [label, script] of [
    ['module mutation', '<script type="module">j2w.search.options.facets=["city"];</script>'],
    ['module with import and await', '<script type="module">import "./published-module.js";await Promise.resolve();j2w.search.options.facets=["city"];</script>'],
    ['module nomodule attribute remains active', '<script type="module" nomodule>j2w.search.options.facets=["city"];</script>'],
    ['uppercase module type', '<script type="MODULE">j2w.search.options.facets=["city"];</script>'],
    ['uppercase classic JavaScript MIME', '<script type="TEXT/JAVASCRIPT">j2w.search.options.facets=["city"];</script>'],
    ['classic JavaScript MIME parameters', '<script type="text/javascript; charset=UTF-8">j2w.search.options.facets=["city"];</script>'],
  ]) await t.test(label, async () => {
    const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body += script })
    await assert.rejects(result.jobs, /options|mutation|bootstrap/i)
    assert.equal(result.calls.some(call => call.init.method === 'POST'), false)
  })
  for (const type of ['module', 'application/json', 'text/plain']) await t.test(type + ' cannot supply classic declaration', async () => {
    const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body = packet.body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,
      (all, attrs, code) => code.includes('j2w.search.options') ? '<script type="' + type + '">' + code + '</script>' : all) })
    await assert.rejects(result.jobs, /declaration|options|bootstrap/i)
    assert.equal(result.calls.some(call => call.init.method === 'POST'), false)
  })
})

test('inert module fallback and data scripts do not mutate a current classic contract', async () => {
  const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body += '<script type="module" src="">j2w.search.options.facets=["city"];</script>'
    + '<script type="application/json">j2w.search.options.facets=["city"];</script>'
    + '<script type="module">await Promise.resolve();const unrelatedPublishedValue=42;</script>' })
  assert.equal((await result.jobs).length, 2)
})

test('actual global object roots cannot hide active computed options mutations', async t => {
  for (const mode of ['script', 'module']) for (const root of ['globalThis', 'self', 'window', 'this']) {
    await t.test(mode + ' ' + root, async () => {
      const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body += '<script' + (mode === 'module' ? ' type="module"' : '') + '>'
        + root + '["j2w"]["search"]["options"]["facets"]=["city"];' + '</script>' })
      await assert.rejects(result.jobs, /options|mutation|bootstrap/i)
      assert.equal(result.calls.some(call => call.init.method === 'POST'), false)
    })
  }
  for (const root of ['window.self', 'globalThis["window"]', 'this["globalThis"]']) await t.test(root, async () => {
    const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body += '<script>' + root + '["j2w"]["search"]["options"]={facets:["city"]};</script>' })
    await assert.rejects(result.jobs, /options|mutation|bootstrap/i)
    assert.equal(result.calls.some(call => call.init.method === 'POST'), false)
  })
})

test('unrelated object keys and member property names do not impersonate global namespace references', async () => {
  const result = run(packet => { if (packet.url.endsWith('/search/')) packet.body += '<script type="module">'
    + 'const unrelated={j2w:{search:{options:{facets:["city"]}}}};unrelated.j2w.search.options.facets;'
    + 'const {j2w:unrelatedValue}=unrelated;unrelatedValue;'
    + '</script>' })
  assert.equal((await result.jobs).length, 2)
})

test('public reads use manual redirects and omit ambient credentials', async () => {
  const result = run()
  await result.jobs
  assert.ok(result.calls.length > 10)
  assert.ok(result.calls.every(call => call.init.redirect === 'manual' && call.init.credentials === 'omit' && call.init.cache === 'no-store'))
})

test('uncooperative fetch and body promises still obey the source deadline', async t => {
  for (const mode of ['fetch', 'body']) await t.test(mode, async () => {
    let cancelled = false
    const pending = new Promise(() => {})
    const started = Date.now()
    const operation = runCurrentRmkCountryFacet(source, { sourceDeadlineMs: 40, fetchImpl: async () => {
      if (mode === 'fetch') return pending
      return { ok: true, status: 200, url: 'https://www.newellbrands.com/', headers: new Headers(),
        text: () => pending, body: { getReader: () => ({ read: () => pending, cancel: () => { cancelled = true }, releaseLock() {} }) } }
    } })
    let watchdog
    try {
      await assert.rejects(Promise.race([operation, new Promise((_, reject) => { watchdog = setTimeout(() => reject(Error('test watchdog exceeded')), 700) })]), error => /deadline|timeout|abort/i.test(error.message) && !/watchdog/.test(error.message), mode)
      assert.ok(Date.now() - started < 600, mode)
      if (mode === 'body') assert.equal(cancelled, true)
    } finally { clearTimeout(watchdog) }
  })
})

test('response and aggregate byte bounds stop stream reads before buffering later chunks', async t => {
  for (const mode of ['response', 'aggregate']) await t.test(mode, async () => {
    const fixture = rmkCountryFacetFixture(), nativeFetch = fixture.fetchImpl
    let chunkReads = 0, cancelled = 0, textCalls = 0, suppliedBytes = 0
    const fetchImpl = async (url, init) => {
      const response = await nativeFetch(url, init)
      if (mode === 'response' && url !== 'https://www.newellbrands.com/') return response
      if (mode === 'aggregate' && url.includes('options-search.min.js')) return response
      const raw = new TextEncoder().encode(await response.text())
      const size = mode === 'response' ? 2_100_000 : 3_600_000
      const chunk = new Uint8Array(size);chunk.fill(32);chunk.set(raw)
      let index = 0
      return { ok: true, status: 200, url: response.url, headers: response.headers,
        text: async () => { textCalls++; return ' '.repeat(4_100_000) },
        body: { getReader: () => ({
          read: async () => { chunkReads++; if (mode === 'response' || index++ === 0) { suppliedBytes += chunk.length; return { done: false, value: chunk } } return { done: true } },
          cancel: () => { cancelled++ }, releaseLock() {},
        }) } }
    }
    await assert.rejects(runCurrentRmkCountryFacet(source, { fetchImpl }), /bound|limit|bytes/i, mode)
    assert.equal(textCalls, 0, mode)
    assert.ok(cancelled > 0, mode)
    if (mode === 'response') assert.equal(chunkReads, 2)
    else assert.ok(suppliedBytes > 24_000_000 && suppliedBytes <= 24_000_000 + 4 * 3_600_000)
  })
})

test('one failed role stops queued hydration and drains the already active requests', async () => {
  const fixture = rmkCountryFacetFixture(packet => { if (packet.url.includes('/job/') && packet.url.includes('1437705133')) { packet.status = 403;packet.body = 'Forbidden' } }, 'essilorluxottica')
  const nativeFetch = fixture.fetchImpl
  let active = 0, finished = 0
  const fetchImpl = async (url, init) => {
    if (!url.includes('/job/')) return nativeFetch(url, init)
    active++
    const response = await nativeFetch(url, init)
    if (response.ok) await new Promise(resolve => setTimeout(resolve, 35))
    finished++;active--
    return response
  }
  await assert.rejects(runCurrentRmkCountryFacet('essilorluxottica', { fetchImpl }), /403/)
  const roleCalls = fixture.calls.filter(call => call.url.includes('/job/'))
  assert.equal(roleCalls.length, 4)
  assert.equal(finished, 4)
  assert.equal(active, 0)
})
