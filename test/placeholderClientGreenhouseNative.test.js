import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js'

const PROOF = Symbol.for('jobverify.official-ats-discovery')
const sources = {
  careem: { total: 11, requests: 8, first: 8890956002, company: 'Careem', nativeCompany: 'Careem', token: 'careem',
    careers: 'https://www.careem.com/en-ae/careers/', portal: 'https://jobs.careem.com/',
    published: '2026-10-22T04:23:30-04:00', updated: '2026-10-22T04:23:30-04:00' },
  auvik: { total: 13, requests: 4, first: 8789330002, company: 'Auvik', nativeCompany: 'Auvik Networks', token: 'auviknetworks',
    careers: 'https://www.auvik.com/careers/', published: '2026-09-09T09:34:20-04:00', updated: '2026-10-26T16:08:17-04:00' },
}
for (const [source, config] of Object.entries(sources)) {
  const folder = new URL(`../scraper/${source}/fixtures/current-20261030/`, import.meta.url)
  const current = source === 'careem' ? JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/careem-native-quality.json.gz',import.meta.url)))) : null
  const manifest = current || JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
  const unique = manifest.requests.filter((row,index,rows)=>rows.findIndex(other=>other.requestedURL===row.requestedURL)===index)
  config.records = unique.map(row => {
    const body = current ? Buffer.from(row.text) : gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
    assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
    return { ...row, body }
  })
  config.api = `https://boards-api.greenhouse.io/v1/boards/${config.token}/jobs?content=true`
  config.payload = JSON.parse(config.records.find(row => row.requestedURL === config.api).body)
  config.provider = getScraperCatalog().find(row => row.source === source)
  config.run = options => createCatalogScraper(config.provider).run({requestIntervalMs:0,fetchImpl:(...args)=>globalThis.fetch(...args),...options})
}
const json = (row, change) => {
  const data = JSON.parse(row.body), result = change(data)
  return { ...row, body: Buffer.from(JSON.stringify(result === undefined ? data : result)) }
}
const replace = (row, before, after) => {
  assert.ok(row.body.toString().includes(before), 'Mutation must change the actual captured response')
  return { ...row, body: Buffer.from(row.body.toString().replaceAll(before, after)) }
}
function replay(t, source, change) {
  const calls = [], occurrences = new Map(), config = sources[source]
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    assert.equal(init.method, 'GET'); assert.equal(init.body, undefined)
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'manual')
    const row = config.records.find(row => row.requestedURL === url)
    assert.ok(row, 'Uncaptured network is forbidden: ' + url)
    const count = (occurrences.get(url) || 0) + 1
    occurrences.set(url, count); calls.push(url)
    const current = change ? change({ ...row }, count) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
// These locations are deliberately synthetic. Both saved native boards currently
// return zero selected India records; no synthetic role is live validation.
const syntheticIndia = (row, source, count = 1) => row.requestedURL !== sources[source].api ? row : json(row, payload => {
  for (const job of payload.jobs.slice(0, count)) {
    job.location.name = 'Bengaluru, India'
    job.offices = []
    if (Array.isArray(job.metadata)) for (const item of job.metadata) if (item.name === 'Country') item.value = 'India'
  }
})

for (const [source, config] of Object.entries(sources)) {
  test(`registered ${source} reads the current employer binding and full public native feed twice`, async t => {
    const calls = replay(t, source), jobs = await config.run()
    assert.equal(jobs.length, 0)
    assert.equal(calls.length, config.requests)
    for (const row of config.records) assert.equal(calls.filter(url => url === row.requestedURL).length, 2)
    const proof = jobs[PROOF], evidence = readInventoryEvidence(jobs)
    assert.equal(proof.binding.nativeAccount, config.token)
    assert.equal(proof.nativeInventory.snapshots, 2)
    assert.equal(proof.nativeInventory.observedNativeRoles, config.total)
    assert.equal(proof.nativeInventory.fullContentRoles, config.total)
    assert.equal(proof.nativeInventory.selectedIndiaPostings, 0)
    assert.equal(proof.productionWrites, false)
    assert.equal(evidence.firstParty, true)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, config.total)
    assert.equal(evidence.indiaFacetCount, null)
    assert.equal(config.provider.backfillMode, 'live-parser')
  })
  test(`synthetic ${source} India extraction preserves original full content, publication and separate revision`, async t => {
    replay(t, source, row => syntheticIndia(row, source))
    const jobs = await config.run(), job = jobs[0], original = config.payload.jobs[0]
    assert.equal(jobs.length, 1)
    assert.equal(String(job.jobId), String(config.first))
    assert.equal(job.company, config.company)
    assert.equal(job.country, 'India')
    assert.equal(job.nativeDescriptionRaw, original.content)
    assert.equal(job.jobDescription, job.sourceDescription)
    assert.equal(job.nativeDescriptionHTML, job.sourceDescription)
    assert.match(job.sourceDescription, source === 'careem' ? /^<div class="content-intro">/ : /^<h4><strong>/)
    assert.equal(job.nativeSourceRecord.content, original.content)
    assert.equal(job.nativeEmployerBrand, config.nativeCompany)
    assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.postingDate, config.published)
    assert.equal(job.nativePublicationDate, config.published)
    assert.equal(job.nativeUpdatedAt, config.updated)
    assert.equal(job.nativeApplicationDeadline, null)
    assert.equal(job.employmentType, null)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationAccessVerified, false)
  })
  test(`${source} rejects another employer on the same public board`, async t => {
    replay(t, source, row => row.requestedURL === config.api ? json(row, d => { d.jobs[0].company_name = 'Another Employer' }) : row)
    await assert.rejects(config.run(), /native.*employer/i)
  })
  test(`${source} validates full foreign content even when no India job would be returned`, async t => {
    replay(t, source, row => row.requestedURL === config.api ? json(row, d => { d.jobs.at(-1).content = '<p>Coming soon</p>' }) : row)
    await assert.rejects(config.run(), /native.*content/i)
  })
  test(`${source} rejects changed full native content in the closing snapshot`, async t => {
    replay(t, source, (row, n) => row.requestedURL === config.api && n === 2 ? json(row, d => { d.jobs.at(-1).content += '<p>New role-specific requirements.</p>' }) : row)
    await assert.rejects(config.run(), /native.*changed/i)
  })
}

test('Careem requires its current corporate jobs hyperlink', async t => {
  const calls = replay(t, 'careem', row => row.requestedURL === sources.careem.careers
    ? replace(row, 'href="https://jobs.careem.com', 'href="https://retired.careem.com') : row)
  await assert.rejects(sources.careem.run(), /native.*handoff/i)
  assert.deepEqual(calls, [sources.careem.careers])
})
test('Careem rejects an inert copy of the otherwise current client element', async t => {
  replay(t, 'careem', row => row.requestedURL === sources.careem.portal
    ? replace(row, '<script src="/_next/static/chunks/pages/_app-', '<script type="application/json" src="/_next/static/chunks/pages/_app-') : row)
  await assert.rejects(sources.careem.run(), /native.*client/i)
})
test('Careem requires the current root route and build metadata', async t => {
  replay(t, 'careem', row => row.requestedURL === sources.careem.portal ? replace(row, '"page":"/"', '"page":"/archive"') : row)
  await assert.rejects(sources.careem.run(), /native.*route/i)
})
test('Careem rejects changed client bytes rather than trusting stale endpoint strings', async t => {
  replay(t, 'careem', row => row.requestedURL.includes('/pages/_app-') ? { ...row, body: Buffer.concat([row.body, Buffer.from('\n/* new client */')]) } : row)
  await assert.rejects(sources.careem.run(), /native.*client/i)
})
test('Careem checks the executable client MIME type', async t => {
  replay(t, 'careem', row => row.requestedURL.includes('/pages/_app-') ? { ...row, headers: { 'content-type': 'text/plain' } } : row)
  await assert.rejects(sources.careem.run(), /native.*content type/i)
})

const EMBED = 'https://boards.greenhouse.io/embed/job_board/js?for=auviknetworks'
test('Auvik refuses an unregistered account even if another board returns valid-looking jobs', async t => {
  replay(t, 'auvik', row => row.requestedURL === sources.auvik.careers ? replace(row, EMBED, EMBED.replace('auviknetworks', 'other')) : row)
  await assert.rejects(sources.auvik.run(), /native.*binding/i)
})
test('Auvik rejects a loader call present only inside an uncalled function', async t => {
  replay(t, 'auvik', row => {
    if (row.requestedURL !== sources.auvik.careers) return row
    const before = row.body.toString(), after = before.replace(
      /NPRL\.registerScript\("https:\/\/boards\.greenhouse\.io\/embed\/job_board\/js\?for=auviknetworks",[^;]+;/,
      match => `function dormant(){${match}}`)
    assert.notEqual(after, before)
    return { ...row, body: Buffer.from(after) }
  })
  await assert.rejects(sources.auvik.run(), /native.*binding/i)
})
test('Auvik requires the actual visible native openings container', async t => {
  replay(t, 'auvik', row => row.requestedURL === sources.auvik.careers ? replace(row, 'id="grnhse_app"', 'id="retired_grnhse_app"') : row)
  await assert.rejects(sources.auvik.run(), /native.*container/i)
})
test('Auvik rejects loader metadata that no longer points at the advertised embed', async t => {
  replay(t, 'auvik', row => row.requestedURL === sources.auvik.careers ? {
    ...row, body: Buffer.from(row.body.toString().replace(/NPRL\.registerScript\("https:\/\/boards\.greenhouse\.io\/embed\/job_board\/js\?for=auviknetworks",\s*"([^"]+)",\s*"([^"]+)"\)/,
      (whole, id, encoded) => { const data = JSON.parse(Buffer.from(encoded, 'base64')); data.canonicalLink = 'https://example.invalid/'; return `NPRL.registerScript("${EMBED}", "${id}", "${Buffer.from(JSON.stringify(data)).toString('base64')}")` }))
  } : row)
  await assert.rejects(sources.auvik.run(), /native.*loader/i)
})

const badNative = [
  ['duplicate native identities', d => { d.jobs[1].id = d.jobs[0].id }, /native.*identity/i],
  ['wrong native role URL identity', d => { d.jobs[0].absolute_url = d.jobs[0].absolute_url.replace('8890956002', '999999') }, /native.*identity/i],
  ['foreign native role URL authority', d => { d.jobs[0].absolute_url = 'https://example.invalid/careem/jobs/8890956002?gh_jid=8890956002' }, /native.*identity/i],
  ['an unclosed native page', d => { d.hasMore = true }, /native.*inventory/i],
  ['an incorrect native total', d => { d.meta.total++ }, /native.*inventory/i],
  ['a failed JSON envelope with plausible jobs', d => { d.success = false }, /native.*inventory/i],
  ['an explicit inactive flag', d => { d.jobs[0].is_active = false }, /native.*status/i],
  ['an internal-only flag', d => { d.jobs[0].is_internal = true }, /native.*status/i],
  ['an impossible native original date', d => { d.jobs[0].first_published = '2026-02-30T01:00:00Z' }, /native.*date/i],
  ['a non-string original date', d => { d.jobs[0].first_published = 1791000000000 }, /native.*date/i],
  ['an impossible revision date', d => { d.jobs[0].updated_at = '2026-10-29T24:00:00Z' }, /native.*date/i],
  ['a missing role qualification section', d => { d.jobs[0].content = '<p>' + 'Careem is a wonderful company. '.repeat(70) + '</p>' }, /native.*content/i],
]
for (const [name, change, pattern] of badNative) test('Careem rejects ' + name, async t => {
  replay(t, 'careem', row => row.requestedURL === sources.careem.api ? json(row, change) : row)
  await assert.rejects(sources.careem.run(), pattern)
})
test('Careem rejects contradictory explicit country metadata and location', async t => {
  replay(t, 'careem', row => row.requestedURL === sources.careem.api ? json(row, d => { d.jobs[0].location.name = 'Bengaluru, India' }) : row)
  await assert.rejects(sources.careem.run(), /contradictory|country/i)
})
test('missing original publication never falls back to the native edit timestamp', async t => {
  replay(t, 'auvik', row => {
    row = syntheticIndia(row, 'auvik')
    return row.requestedURL === sources.auvik.api ? json(row, d => { d.jobs[0].first_published = null }) : row
  })
  const jobs = await sources.auvik.run()
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].nativePublicationDate, null)
  assert.equal(jobs[0].nativeUpdatedAt, '2026-10-26T16:08:17-04:00')
})
test('a returned job limit still validates the entire native inventory twice', async t => {
  const calls = replay(t, 'careem', row => syntheticIndia(row, 'careem', 2))
  const jobs = await sources.careem.run({ maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 8)
  assert.equal(jobs[PROOF].nativeInventory.selectedIndiaPostings, 2)
})
test('HTTP access denial is retained as failure, without returning an authoritative zero', async t => {
  replay(t, 'careem', row => row.requestedURL === sources.careem.api ? { ...row, status: 403 } : row)
  await assert.rejects(sources.careem.run(), /HTTP.*403/i)
})
test('native transport refuses redirects', async t => {
  const calls = replay(t, 'auvik', row => ({ ...row, status: 302, headers: { 'content-type': 'text/html', location: 'https://example.invalid/' } }))
  await assert.rejects(sources.auvik.run(), /HTTP.*302/i)
  assert.equal(calls.length, 1)
})
test('caller cancellation prevents every native request', async t => {
  const calls = replay(t, 'careem'), controller = new AbortController()
  controller.abort(Error('cancelled native source'))
  await assert.rejects(sources.careem.run({ signal: controller.signal }), /cancelled native source/)
  assert.equal(calls.length, 0)
})
test('native request budget is enforced before the next request', async t => {
  const calls = replay(t, 'careem')
  await assert.rejects(sources.careem.run({ maxRequests: 1 }), /native.*request.*bound/i)
  assert.equal(calls.length, 1)
})
test('native aggregate body budget is enforced', async t => {
  const calls = replay(t, 'careem')
  await assert.rejects(sources.careem.run({ maxAggregateBytes: 1024 }), /native.*aggregate/i)
  assert.equal(calls.length, 1)
})
test('Auvik placement cannot be supplied by a commented-out template marker', async t => {
  replay(t, 'auvik', row => row.requestedURL !== sources.auvik.careers ? row : {
    ...row, body: Buffer.from(row.body.toString().replace(
      /<template data-nitro-marker-id="d6efff44cdc6d94bca3ff43ff3d929c1-1"><\/template>/,
      match => '<!--' + match + '-->')),
  })
  await assert.rejects(sources.auvik.run(), /native.*loader.*marker/i)
})
test('Auvik rejects a native loader registration with inert script attributes', async t => {
  replay(t, 'auvik', row => row.requestedURL !== sources.auvik.careers ? row : {
    ...row, body: Buffer.from(row.body.toString().replace(
      /NPRL\.registerScript\("https:\/\/boards\.greenhouse\.io\/embed\/job_board\/js\?for=auviknetworks",\s*"([^"]+)",\s*"([^"]+)"\)/,
      (whole, id, encoded) => { const data = JSON.parse(Buffer.from(encoded, 'base64')); data.attributes.type = 'application/json'; return `NPRL.registerScript("${EMBED}", "${id}", "${Buffer.from(JSON.stringify(data)).toString('base64')}")` })),
  })
  await assert.rejects(sources.auvik.run(), /native.*loader.*metadata/i)
})
test('role headings without qualification content do not establish a complete native description', async t => {
  replay(t, 'careem', row => row.requestedURL !== sources.careem.api ? row : json(row, d => {
    d.jobs[0].content = '<h2>What you\'ll do</h2><p>' + 'Build integrations and maintain operational services. '.repeat(15)
      + '</p><h2>What you\'ll need</h2><h2>What we\'ll provide you</h2><p>' + 'Our company provides extensive benefits. '.repeat(15) + '</p>'
  }))
  await assert.rejects(sources.careem.run(), /native.*content/i)
})
test('qualification content cannot replace missing native responsibilities', async t => {
  replay(t, 'careem', row => row.requestedURL !== sources.careem.api ? row : json(row, d => {
    d.jobs[0].content = '<h2>What you\'ll do</h2><h2>What you\'ll need</h2><p>'
      + 'Experience implementing integrations and maintaining operational services. '.repeat(15) + '</p>'
  }))
  await assert.rejects(sources.careem.run(), /native.*content/i)
})
test('the source deadline cancels a native body that never completes', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const response = new Response(new ReadableStream({ start() {}, cancel() {} }), { headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  await assert.rejects(sources.careem.run({ sourceTimeoutMs: 30 }), /timeout/i)
})
test('earlier prose repeating a section heading cannot supply empty native qualifications', async t => {
  replay(t, 'careem', row => row.requestedURL !== sources.careem.api ? row : json(row, d => {
    d.jobs[0].content = '<p>Our guide calls this section What you\'ll need. ' + 'Read our company overview and culture. '.repeat(12)
      + '</p><h2>What you\'ll do</h2><p>' + 'Build integrations and maintain operational services. '.repeat(15)
      + '</p><h2>What you\'ll need</h2><h2>What we\'ll provide you</h2><p>' + 'Our company provides extensive benefits. '.repeat(15) + '</p>'
  }))
  await assert.rejects(sources.careem.run(), /native.*content/i)
})
test('an unrelated benefits heading cannot fill an empty native qualification section', async t => {
  replay(t, 'careem', row => row.requestedURL !== sources.careem.api ? row : json(row, d => {
    d.jobs[0].content = '<h2>What you\'ll do</h2><p>' + 'Build integrations and maintain operational services. '.repeat(15)
      + '</p><h2>What you\'ll need</h2><h2>Benefits</h2><p>' + 'Our company provides extensive benefits. '.repeat(15) + '</p>'
  }))
  await assert.rejects(sources.careem.run(), /native.*content/i)
})
test('the visible Auvik container cannot borrow the loader marker of a hidden duplicate', async t => {
  const pair = '<div id="grnhse_app"></div> <template data-nitro-marker-id="d6efff44cdc6d94bca3ff43ff3d929c1-1"></template>'
  replay(t, 'auvik', row => row.requestedURL !== sources.auvik.careers ? row
    : replace(row, pair, '<div style="opacity:0">' + pair + '</div><div id="grnhse_app"></div>'))
  await assert.rejects(sources.auvik.run(), /native.*container|native.*marker/i)
})
for (const [source, config] of Object.entries(sources)) test(`${source} native HTML remains readable through actual backend normalization and description policy`, async t => {
  replay(t, source, row => syntheticIndia(row, source))
  const [job] = await config.run(), normalized = normalizeScrapedJob(job, config.provider)
  const persisted = buildDescriptionSourceUpdate({ ...normalized, sourceDescription: job.sourceDescription }, null)
  const displayed = persisted.description
  assert.ok(displayed.length > 2000)
  assert.equal(/(?:&lt;|<)\/?(?:div|p|h[1-6]|ul|li|br|strong)\b/i.test(displayed), false,
    'Actual description consumers must display employer text without encoded markup')
  assert.match(displayed, source === 'careem' ? /What you['\u2019]ll need/ : /What are we looking for/)
  assert.equal(job.nativeSourceRecord.content, config.payload.jobs[0].content)
})
