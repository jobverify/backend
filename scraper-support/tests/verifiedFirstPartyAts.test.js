import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedFirstPartyAtsScraper } from '../shared/verifiedFirstPartyAts.js'

const ashby = { source: 'example-ashby', companyName: 'Example', platform: 'ashby', careersUrl: 'https://example.com/careers', board: 'Example', handoffUrl: 'https://jobs.ashbyhq.com/Example' }
const greenhouse = { source: 'example-greenhouse', companyName: 'Example Greenhouse', platform: 'greenhouse', careersUrl: 'https://example.com/careers', board: 'earnin', officialJobsApiPath: '/api/careers/open-positions', careersScriptPathPattern: '^/_next/static/chunks/app/\\(default\\)/careers/page-[a-f0-9]+\\.js$' }
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
const loc = (country, location = country) => ({ location, address: { postalAddress: { addressCountry: country } } })
const row = (n, country = 'India', secondaryLocations = []) => ({ id: id(n), title: 'Engineer ' + n, location: country, address: loc(country).address, secondaryLocations, isListed: true, descriptionHtml: '<p>Build and maintain production software and collaborate with our engineering team.</p>', jobUrl: 'https://jobs.ashbyhq.com/Example/' + id(n), applyUrl: 'https://jobs.ashbyhq.com/Example/' + id(n) + '/application' })
const ghRow = (n, location = 'Bengaluru, India') => ({ id: n, title: 'Engineer ' + n, location: { name: location }, content: '<p>Build production software.</p>', absolute_url: 'https://job-boards.greenhouse.io/earnin/jobs/' + n })
const response = (url, body, status = 200) => ({ ok: status >= 200 && status < 300, status, url, headers: { get: () => typeof body === 'string' ? 'text/html' : 'application/json' }, text: async () => typeof body === 'string' ? body : JSON.stringify(body), json: async () => structuredClone(body) })
const ashbyFetch = (jobs, { html = '<a href="https://jobs.ashbyhq.com/Example">Open positions</a>', payload = null, requests = [] } = {}) => async (url, options) => {
  requests.push({ url, signal: options.signal })
  return response(url, url === ashby.careersUrl ? html : payload || { apiVersion: '1', jobs })
}
const ghFetch = (jobs, options = {}) => async url => {
  if (url === greenhouse.careersUrl) return response(url, '<script src="/_next/static/chunks/app/(default)/careers/page-abc123.js"></script>')
  if (url.endsWith('.js')) return response(url, 'fetch("/api/careers/open-positions");const url="https://job-boards.greenhouse.io/earnin/jobs/".concat(id);')
  if (url.includes('/api/careers/')) return response(url, options.official || { totalJobs: jobs.length, departments: [{ id: 1, name: 'Engineering', jobs }] })
  return response(url, options.ats || { meta: { total: jobs.length }, jobs })
}

test('verified Ashby validates the full board then retains mixed primary/secondary India roles under the original source', async () => {
  const jobs = await createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([row(1, 'India', [loc('USA')]), row(2, 'USA', [loc('India', 'Bengaluru')]), row(3, 'USA'), { ...row(4), isListed: false }]) })
  assert.deepEqual(jobs.map(job => job.jobId), [id(1), id(2)])
  assert.ok(jobs.every(job => job.source === ashby.source && job.country === 'India' && job.publicExperienceChecked === true))
  assert.equal(jobs[1].location, 'Bengaluru')
  assert.equal(jobs[0].experienceRequired, null)
})

test('verified Ashby rejects malformed, duplicate, incomplete, or cross-tenant raw records even outside India', async () => {
  const broken = [
    { apiVersion: '1' }, { apiVersion: '2', jobs: [] }, { apiVersion: '1', jobs: [], hasMore: true },
    { apiVersion: '1', jobs: [row(1), row(1)] },
    ...[
      { id: 'invalid' }, { title: '' }, { descriptionHtml: '<p></p>' }, { isListed: undefined },
      { address: {} }, { address: loc('Unknown').address }, { secondaryLocations: null },
      { secondaryLocations: [loc('Unknown')] },
      { jobUrl: 'https://jobs.ashbyhq.com/Other/' + id(2) },
      { applyUrl: 'https://jobs.ashbyhq.com/Example/' + id(99) + '/application' },
      { jobUrl: 'http://jobs.ashbyhq.com/Example/' + id(2) },
      { jobUrl: 'https://jobs.ashbyhq.com/Example/' + id(2) + '?company=other' },
    ].map(change => ({ apiVersion: '1', jobs: [row(1), { ...row(2, 'USA'), ...change }] })),
  ]
  for (const payload of broken) await assert.rejects(createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([], { payload }) }), /invalid|incomplete|duplicate|identity|geography/i)
})

test('verified handoff requires the exact live link or iframe and cannot treat missing feeds as empty', async () => {
  for (const html of ['<p>Careers</p>', '<a href="https://jobs.ashbyhq.com/Other">Jobs</a>', '<script>const x=\'<a href="https://jobs.ashbyhq.com/Example">Jobs</a>\';</script>', '<!-- <a href="https://jobs.ashbyhq.com/Example">Jobs</a> -->']) {
    const requests = []
    await assert.rejects(createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([], { html, requests }) }), /handoff/i)
    assert.equal(requests.length, 1)
  }
  assert.deepEqual(await createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([]) }), [])
  const iframe = { ...ashby, handoffUrl: ashby.handoffUrl + '/embed?version=2' }
  assert.equal((await createVerifiedFirstPartyAtsScraper(iframe).run({ fetchImpl: ashbyFetch([row(1)], { html: '<iframe src="https://jobs.ashbyhq.com/Example/embed?version=2"></iframe>' }) })).length, 1)
})

test('verified Greenhouse requires official counts and exact job identity/location parity before selecting India', async () => {
  const jobs = [ghRow(1), ghRow(2, 'Remote, US'), ghRow(3, 'Mexico City, Mexico; Remote, Mexico')]
  const output = await createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: ghFetch(jobs) })
  assert.deepEqual(output.map(job => job.jobId), ['1'])
  assert.equal(output[0].source, greenhouse.source)
  assert.equal(output[0].publicExperienceChecked, true)
  for (const options of [
    { official: { departments: [] } }, { official: { totalJobs: 3, departments: [{ jobs: [ghRow(1)] }] } },
    { ats: { meta: { total: 4 }, jobs } }, { ats: { jobs } },
    { ats: { meta: { total: 3 }, jobs: [ghRow(1), ghRow(1), ghRow(3)] } },
    { ats: { meta: { total: 3 }, jobs: [ghRow(1), ghRow(2, 'Remote'), ghRow(3)] } },
    { ats: { meta: { total: 3 }, jobs: [ghRow(1), { ...jobs[1], absolute_url: 'https://job-boards.greenhouse.io/other/jobs/2' }, jobs[2]] } },
  ]) await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: ghFetch(jobs, options) }), /invalid|incomplete|duplicate|identity|geography/i)
})

test('verified Greenhouse rejects stale or cross-origin script/endpoint handoffs', async () => {
  for (const html of ['<p>Careers</p>', '<script src="https://other.example/_next/static/chunks/app/(default)/careers/page-abc123.js"></script>']) {
    await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: async url => response(url, html) }), /handoff/i)
  }
  const usual = ghFetch([ghRow(1)])
  await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: async url => url.endsWith('.js') ? response(url, 'fetch("/api/other");') : usual(url) }), /handoff/i)
})

test('verified first-party requests preserve caller cancellation before and after each response body', async () => {
  for (const stopAt of [0, 1, 2, 3]) {
    const controller = new AbortController(), reason = new Error('cancelled during request ' + stopAt)
    let count = 0
    const usual = ghFetch([ghRow(1)])
    await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ signal: controller.signal, fetchImpl: async (url, options) => {
      assert.ok(options.signal)
      const item = await usual(url)
      const current = count++
      for (const method of ['text', 'json']) { const original = item[method]; item[method] = async () => { const value = await original(); if (current === stopAt) controller.abort(reason); return value } }
      return item
    } }), error => error === reason)
    assert.equal(count, stopAt + 1)
  }
  const controller = new AbortController(), reason = new Error('already cancelled'); controller.abort(reason)
  await assert.rejects(createVerifiedFirstPartyAtsScraper(ashby).run({ signal: controller.signal, fetchImpl: () => { throw new Error('must not fetch') } }), error => error === reason)
})

test('verified first-party request deadlines and HTTP/redirect failures reject instead of returning partial jobs', async () => {
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(createVerifiedFirstPartyAtsScraper({ ...ashby, requestTimeoutMs: 10 }).run({ fetchImpl: (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) }), /timeout|timed out/i)
  } finally { clearTimeout(keepAlive) }
  await assert.rejects(createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: async url => response(url, 'Forbidden', 403) }), /403/)
  await assert.rejects(createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: async url => response('https://other.example/careers', '<a href="https://jobs.ashbyhq.com/Example">Jobs</a>') }), /redirect|identity/i)
})


test('verified Ashby accepts the explicitly configured external embed script without trusting inline script text', async () => {
  const config = { ...ashby, handoffUrl: ashby.handoffUrl + '/embed?version=2', handoffType: 'script' }
  const html = '<div id="ashby_embed"></div><script src="https://jobs.ashbyhq.com/Example/embed?version=2"></script>'
  assert.equal((await createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: ashbyFetch([row(1)], { html }) })).length, 1)
  await assert.rejects(createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: ashbyFetch([], { html: '<script>let s=\'<script src="https://jobs.ashbyhq.com/Example/embed?version=2">\';</script>' }) }), /handoff/i)
})

test('verified Ashby rejects contradictory optional totals instead of silently accepting an underreported feed', async () => {
  for (const extra of [{ totalCount: 0 }, { totalJobs: 2 }, { meta: { total: 0 } }]) await assert.rejects(
    createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([], { payload: { apiVersion: '1', jobs: [row(1)], ...extra } }) }), /incomplete|invalid/i,
  )
})


test('free-text US state IN cannot become India while literal India and structured country IN remain valid', async () => {
  const rows = [ghRow(1), ghRow(2, 'Indianapolis, IN')]
  await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: ghFetch(rows) }), /geography|ambiguous/i)
  const verified = { ...greenhouse, locationCountryOverrides: { 'Indianapolis, IN': 'United States' } }
  assert.deepEqual((await createVerifiedFirstPartyAtsScraper(verified).run({ fetchImpl: ghFetch(rows) })).map(job => job.jobId), ['1'])
  assert.equal((await createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([row(1, 'IN')]) }))[0].country, 'India')
})


test('free-text Indian state TN is unverified without a reviewed exact-location country override', async () => {
  const rows = [ghRow(1, 'Chennai, TN')]
  await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: ghFetch(rows) }), /geography|ambiguous/i)
  const config = { ...greenhouse, locationCountryOverrides: { 'Chennai, TN': 'India' } }
  const jobs = await createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: ghFetch(rows) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Chennai')
})


test('verified Greenhouse accepts only an exact configured inline API literal bound to its board', async () => {
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: undefined, greenhouseEmbeddedApiUrl: 'https://boards-api.greenhouse.io/v1/boards/earnin/departments' }
  const run = html => createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: async url => response(url, url === config.careersUrl ? html : { meta: { total: 1 }, jobs: [ghRow(1)] }) })
  assert.equal((await run('<script>const api="https://boards-api.greenhouse.io/v1/boards/earnin/departments";</script>')).length, 1)
  assert.equal((await run("<script>$.getJSON('https://boards-api.greenhouse.io/v1/boards/earnin/departments', showJobs);</script>")).length, 1)
  for (const html of ['<p>https://boards-api.greenhouse.io/v1/boards/earnin/departments</p>', '<!-- <script>const api="https://boards-api.greenhouse.io/v1/boards/earnin/departments";</script> -->', '<script>const api="https://boards-api.greenhouse.io/v1/boards/other/departments";</script>', '<script>const api="https://boards-api.greenhouse.io/v1/boards/earnin/departments?company=other";</script>']) await assert.rejects(run(html), /handoff/i)
  assert.throws(() => createVerifiedFirstPartyAtsScraper({ ...config, greenhouseEmbeddedApiUrl: 'https://boards-api.greenhouse.io/v1/boards/other/departments' }), /configuration|identity/i)
})

test('verified Greenhouse external role handoff requires nonempty exact board ID parity, ignoring repeated links', async () => {
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: undefined, greenhouseEmbeddedBoardJobIds: true }
  const link = n => '<a href="https://job-boards.greenhouse.io/earnin/jobs/' + n + '">Role</a>'
  const run = (html, jobs = [ghRow(1), ghRow(2, 'Paris, France')]) => createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: async url => response(url, url === config.careersUrl ? html : { meta: { total: jobs.length }, jobs }) })
  assert.deepEqual((await run(link(1) + link(1) + link(2))).map(job => job.jobId), ['1'])
  for (const html of [link(1), link(1) + link(2) + link(3), '<a href="https://job-boards.greenhouse.io/other/jobs/1">Role</a>', "<script>const x='" + link(1) + link(2) + "';</script>", '<!--' + link(1) + link(2) + '-->']) await assert.rejects(run(html), /handoff|parity/i)
  await assert.rejects(run('<p>Careers</p>', []), /handoff/i)
})

test('verified Greenhouse combines external script handoff with exact first-party embedded IDs', async () => {
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=earnin', handoffType: 'script', greenhouseEmbeddedJobIds: { listingPath: '/careers/', jobPath: '/careers/' } }
  const jobs = [{ ...ghRow(1), absolute_url: 'https://example.com/careers/?gh_jid=1' }]
  const script = '<script src="https://boards.greenhouse.io/embed/job_board/js?for=earnin"></script>'
  const link = '<a href="/careers/?gh_jid=1">Role</a>'
  const run = html => createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: async url => response(url, url === config.careersUrl ? html : { meta: { total: 1 }, jobs }) })
  assert.equal((await run(script + link)).length, 1)
  await assert.rejects(run(link), /handoff/i)
  await assert.rejects(run(script), /handoff/i)
  await assert.rejects(run(script + '<a href="/careers/?gh_jid=2">Role</a>'), /parity/i)
})


test('verified Greenhouse board script permits exact first-party role URLs without inventing embedded-ID parity', async () => {
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=earnin', handoffType: 'script', greenhouseFirstPartyJobPath: '/careers/' }
  const script = '<script src="https://boards.greenhouse.io/embed/job_board/js?for=earnin"></script>'
  const base = { ...ghRow(1, 'New York, United States'), absolute_url: 'https://example.com/careers/?gh_jid=1' }
  const run = (jobs = [base], html = script, total = jobs.length) => createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: async url => response(url, url === config.careersUrl ? html : { meta: { total }, jobs }) })
  assert.deepEqual(await run(), [])
  await assert.rejects(run([base], '<p>Careers</p>'), /handoff/i)
  await assert.rejects(run([base], script, 2), /incomplete/i)
  for (const absolute_url of ['https://example.com/other/?gh_jid=1', 'https://example.com/careers/?gh_jid=2', 'https://example.com/careers/?gh_jid=1&gh_jid=1', 'https://other.example/careers/?gh_jid=1', 'https://example.com/careers/?gh_jid=1#other']) await assert.rejects(run([{ ...base, absolute_url }]), /identity/i)
  for (const change of [{ handoffUrl: undefined }, { handoffUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=other' }, { greenhouseFirstPartyJobPath: '/careers/?other=1' }]) assert.throws(() => createVerifiedFirstPartyAtsScraper({ ...config, ...change }), /configuration|identity/i)
})


test('verified Greenhouse excludes only a fully validated exact non-vacancy record while preserving raw totals', async () => {
  const rule = { id: '215718', title: 'Example Talent Community', location: 'All offices - For General Applications', descriptionIncludes: ["do not see an opportunity", 'send us your resume', 'keep your information on file'] }
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: 'https://boards.greenhouse.io/earnin', excludedNonVacancies: [rule] }
  const prospect = { ...ghRow(215718, rule.location), title: rule.title, content: '<p>If you do not see an opportunity, send us your resume. We will keep your information on file.</p>' }
  const run = (jobs, total = jobs.length) => createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: async url => response(url, url === config.careersUrl ? '<a href="https://boards.greenhouse.io/earnin">Jobs</a>' : { meta: { total }, jobs }) })
  assert.deepEqual((await run([prospect, ghRow(1), ghRow(2, 'Paris, France')])).map(job => job.jobId), ['1'])
  await assert.rejects(run([prospect, ghRow(1)], 1), /incomplete/i)
  for (const change of [{ id: 2 }, { title: 'Engineer' }, { location: { name: 'Remote' } }, { content: '<p>Apply for this current engineering vacancy.</p>' }, { absolute_url: 'https://job-boards.greenhouse.io/other/jobs/215718' }]) await assert.rejects(run([{ ...prospect, ...change }, ghRow(1)]), /non-vacancy|identity|geography/i)
  await assert.rejects(run([prospect, ghRow(1), ghRow(2, 'Unknown geography')]), /geography/i)
  assert.deepEqual((await run([ghRow(1)])).map(job => job.jobId), ['1'])
  await assert.rejects(run([prospect, prospect]), /duplicate/i)
  for (const excludedNonVacancies of [[{ ...rule, descriptionIncludes: [] }], [{ ...rule, title: '' }], [rule, rule]]) assert.throws(() => createVerifiedFirstPartyAtsScraper({ ...config, excludedNonVacancies }), /configuration/i)
})


test('verified external Greenhouse links reconcile only exact tenant API job-not-found responses', async () => {
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: undefined, greenhouseEmbeddedBoardJobIds: true, greenhouseVerifyClosedLinkedJobIds: true }
  const link = n => '<a href="https://job-boards.greenhouse.io/earnin/jobs/' + n + '">Role</a>'
  const run = ({ html = link(1) + link(2), detailStatus = 404, detailBody = { status: 404, error: 'Job not found' }, detailUrl, jobs = [ghRow(1)], requests = [] } = {}) => createVerifiedFirstPartyAtsScraper(config).run({ fetchImpl: async (url, options) => {
    requests.push({ url, signal: options.signal })
    if (url === config.careersUrl) return response(url, html)
    if (url.includes('/jobs?')) return response(url, { meta: { total: jobs.length }, jobs })
    return response(detailUrl || url, detailBody, detailStatus)
  } })
  const requests = []
  assert.deepEqual((await run({ requests })).map(job => job.jobId), ['1'])
  assert.deepEqual(requests.map(x => x.url), [config.careersUrl, 'https://boards-api.greenhouse.io/v1/boards/earnin/jobs?content=true', 'https://boards-api.greenhouse.io/v1/boards/earnin/jobs/2'])
  for (const options of [{ detailStatus: 200 }, { detailStatus: 403 }, { detailBody: { status: 404, error: 'Forbidden' } }, { detailBody: { error: 'Job not found' } }, { detailUrl: 'https://other.example/jobs/2' }]) await assert.rejects(run(options), /HTTP|closed|identity/i)
  await assert.rejects(run({ html: link(2) }), /parity/i)
  const excessive = []; await assert.rejects(run({ html: Array.from({ length: 7 }, (_, i) => link(i + 1)).join(''), requests: excessive }), /parity|limit/i)
  assert.equal(excessive.length, 2)
  assert.throws(() => createVerifiedFirstPartyAtsScraper({ ...config, greenhouseEmbeddedBoardJobIds: undefined }), /configuration/i)
})

test('closed Greenhouse link verification preserves transport failures and caller abort after the 404 body', async () => {
  const config = { ...ashby, platform: 'greenhouse', board: 'earnin', handoffUrl: undefined, greenhouseEmbeddedBoardJobIds: true, greenhouseVerifyClosedLinkedJobIds: true }
  for (const abort of [false, true]) {
    const controller = new AbortController(), reason = new Error(abort ? 'caller stopped closed-link check' : 'detail transport failed')
    let requests = 0
    await assert.rejects(createVerifiedFirstPartyAtsScraper(config).run({ signal: controller.signal, fetchImpl: async (url, options) => {
      requests++; assert.ok(options.signal)
      if (url === config.careersUrl) return response(url, '<a href="https://job-boards.greenhouse.io/earnin/jobs/1">Role</a><a href="https://job-boards.greenhouse.io/earnin/jobs/2">Old role</a>')
      if (url.includes('/jobs?')) return response(url, { meta: { total: 1 }, jobs: [ghRow(1)] })
      if (!abort) throw reason
      const item = response(url, { status: 404, error: 'Job not found' }, 404)
      const original = item.json; item.json = async () => { const body = await original(); controller.abort(reason); return body }; return item
    } }), error => error === reason)
    assert.equal(requests, 3)
  }
})


test('verified ATS country parsing rejects reserved regions rather than filtering unknown scope as foreign', async () => {
  for (const code of ['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO']) await assert.rejects(createVerifiedFirstPartyAtsScraper(ashby).run({ fetchImpl: ashbyFetch([row(1, code)]) }), /geography|country/i)
  await assert.rejects(createVerifiedFirstPartyAtsScraper(greenhouse).run({ fetchImpl: ghFetch([ghRow(1, 'Unknown Region')]) }), /geography|country/i)
})
