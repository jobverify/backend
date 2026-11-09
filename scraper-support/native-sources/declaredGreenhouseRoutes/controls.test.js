import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, replay, editHTML, editJSON } from './fixtureReplay.js'
import { createNativeRouteScraper, NATIVE_ROUTE_PROFILES as profiles } from './nativeCareers.js'
import { postURI, nativeJSON } from '../declaredGreenhouse/nativeData.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'

globalThis.fetch = async () => { throw Error('Offline original corpus only; no network or website execution') }
const run = (source, r, options = {}, profile = profiles[source]) => createNativeRouteScraper(profile).run({ ...r.options, ...options })

test('route profiles accept only the published company/board/id/query contracts', () => {
  for (const source of ['pathai', 'lyft']) {
    const p = profiles[source], row = fixture.oracle[source].records[0], url = row.originalNative.absolute_url
    assert.equal(postURI(url, row.id, p), true)
    assert.equal(postURI(row.resolvedOwnURI, row.id, p), true)
    for (const changed of [url.replace('https:', 'http:'), url + '#application-form', url + '&gh_jid=' + row.id,
      url + '&unrelated=1', url.replace('https://', 'https://user:password@'), url.replace(row.id, '1'),
      'https://job-boards.greenhouse.io/' + p.boardToken + '/jobs/' + row.id]) {
      assert.equal(postURI(changed, row.id, p), false, changed)
    }
  }
})

test('a wrong-ID published redirect is retained without requesting its destination', async () => {
  const first = fixture.oracle.pathai.records[0], second = fixture.oracle.pathai.records[1]
  const r = replay((url, page) => url === first.originalNative.absolute_url
    ? { ...page, headers: { ...page.headers, location: second.resolvedOwnURI } } : page)
  await run('pathai', r)
  const job = r.audits[0].observations.find(job => job.jobId === first.id)
  assert.ok(job.sourceNativeRecord.content)
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.equal(r.requests.filter(url => url === second.resolvedOwnURI).length, 2, 'Only its own independent native ID may load the second role')
})

test('an inactive own renderer script cannot qualify a PathAI template', async () => {
  const first = fixture.oracle.pathai.records[0], asset = profiles.pathai.ownRoute.scriptURL
  const r = replay((url, page) => url === first.resolvedOwnURI ? editHTML(page, raw => raw.replace('src="' + asset + '"', 'type="application/json" src="' + asset + '"')) : page)
  await run('pathai', r)
  const job = r.audits[0].observations.find(job => job.jobId === first.id)
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.ok(job.jobDescription)
})

test('changed opening renderer bytes cannot be repaired by a closing read alone', async () => {
  const asset = profiles.pathai.ownRoute.scriptURL
  const r = replay((url, page, visit) => url === asset && visit === 1 ? editHTML(page, raw => raw + '\n// changed boundary test') : page)
  const jobs = await run('pathai', r)
  assert.equal(jobs.length, 0)
  assert.ok(r.audits[0].observations.every(job => job.jobDescription && !job.sourceCurrentNativePostingIdentityQualified))
  assert.equal(r.requests.filter(url => url === asset).length, 2, 'Each actual phase reads the shared renderer once')
})

test('department-only posts retain complete own models and per-post positives while wider inventory is held', async () => {
  const first = fixture.oracle.pathai.records[0]
  const r = replay((url, page) => url === profiles.pathai.publicAPIURL ? editJSON(page, value => {
    value.jobs = value.jobs.filter(job => String(job.id) !== first.id);value.meta.total = value.jobs.length
  }) : page)
  const jobs = await run('pathai', r, {}, { ...profiles.pathai, countryFilter: 'Global' })
  assert.equal(r.audits[0].observations.length, 10)
  assert.equal(r.audits[0].closing.nativeListingComplete, false)
  const job = jobs.find(job => job.jobId === first.id)
  assert.ok(job, 'The first-party-declared department and complete native own pair remain valid discoveries')
  assert.deepEqual(job.sourceNativeRecord, first.originalNative)
  assert.ok(job.sourceNativeDepartmentIndexDeclarations.length > 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('an unrelated malformed department cannot erase a known posting conflict', async () => {
  const first = fixture.oracle.pathai.records.find(row => row.indiaCandidate), p = profiles.pathai
  const r = replay((url, page) => url === p.publicDepartmentIndexURL ? editJSON(page, value => {
    for (const department of value.departments) for (const job of department.jobs)
      if (String(job.id) === first.id) job.title = 'Conflicting published title'
    value.departments.push({ ...value.departments[0], jobs: [] })
  }) : page)
  const jobs = await run('pathai', r), audit = r.audits[0], job = audit.observations.find(row => row.jobId === first.id)
  assert.equal(audit.closing.nativeDepartmentHierarchyQualified, false)
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.equal(jobs.some(row => row.jobId === first.id), false)
  assert.ok(job.sourceNativeDepartmentIndexDeclarations.some(row => row.originalRecord.title === 'Conflicting published title'))
  assert.ok(jobs.some(row => row.jobId !== first.id), 'Unrelated supported discoveries survive the wider hierarchy failure')
})

test('valid department-only posts remain observable beside an unrelated malformed hierarchy node', async () => {
  const first = fixture.oracle.pathai.records[0], p = profiles.pathai
  const r = replay((url, page) => {
    if (url === p.publicAPIURL) return editJSON(page, value => {
      value.jobs = value.jobs.filter(job => String(job.id) !== first.id);value.meta.total = value.jobs.length
    })
    if (url === p.publicAPIBase + '/offices') return editJSON(page, value => {
      for (const office of value.offices) for (const department of office.departments || [])
        department.jobs = department.jobs.filter(job => String(job.id) !== first.id)
    })
    return url === p.publicDepartmentIndexURL ? editJSON(page, value => value.departments.push({ ...value.departments[0], jobs: [] })) : page
  })
  const jobs = await run('pathai', r, {}, { ...p, countryFilter: 'Global' }), audit = r.audits[0]
  assert.equal(audit.observations.length, 10)
  assert.equal(audit.closing.nativeDepartmentHierarchyQualified, false)
  assert.equal(audit.closing.nativeListingComplete, false)
  const job = jobs.find(row => row.jobId === first.id)
  assert.ok(job, 'A valid independently paired posting is not lost with an unrelated bad department')
  assert.deepEqual(job.sourceNativeRecord, first.originalNative)
  assert.ok(job.sourceNativeDepartmentIndexDeclarations.length)
})

test('closing native failure retains earlier complete criteria and route evidence', async () => {
  const first = fixture.oracle.pathai.records[0], uri = profiles.pathai.publicAPIBase + '/jobs/' + first.id + '?pay_transparency=true'
  const r = replay((url, page, visit) => url === uri && visit === 2 ? { ...page, status: 502 } : page)
  const jobs = await run('pathai', r)
  const job = r.audits[0].observations.find(job => job.jobId === first.id)
  assert.ok(job.jobDescription.includes(first.criteriaFacts[0]))
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.equal(jobs.some(job => job.jobId === first.id), false)
  assert.equal(job.sourceResolvedNativePostURI, first.resolvedOwnURI)
})

test('a denied published role host is held without alias or closing retries', async () => {
  const r = replay((url, page) => new URL(url).hostname === 'app.careerpuck.com' ? { ...page, status: 403 } : page)
  const jobs = await run('lyft', r)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 170)
  assert.ok(r.audits[0].observations.every(job => job.jobDescription))
  assert.ok(r.requests.filter(url => new URL(url).hostname === 'app.careerpuck.com').length <= 4)
  assert.ok(!r.requests.some(url => new URL(url).hostname === 'job-boards.greenhouse.io'))
  assert.equal(r.audits[0].authoritativeSourceTotal, null)
})

test('Global override retains foreign route-bound posts and caps only the completed native order', async () => {
  const r = replay(), jobs = await run('pathai', r, { maxJobs: 3 }, { ...profiles.pathai, countryFilter: 'Global' })
  assert.equal(r.audits[0].observations.length, 10)
  assert.deepEqual(jobs.map(job => job.jobId), fixture.oracle.pathai.records.slice(0, 3).map(row => row.id))
  assert.ok(jobs.every(job => job.country === 'United States'))
})

test('observer failures propagate after completed native/route work', async () => {
  const r = replay()
  await assert.rejects(run('pathai', r, { onRecords: async () => { await Promise.resolve();throw Error('record sink failed') } }), /record sink failed/)
  const completed = r.requests.length
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(r.requests.length, completed)
})

test('a sitewide native API chunk does not qualify Lyft after its actual careers-search model is removed', async () => {
  const r = replay((url, page) => url === profiles.lyft.primaryURL
    ? editHTML(page, raw => raw.replaceAll('"searchType":"Careers"', '"searchType":"Unrelated"')) : page)
  const jobs = await run('lyft', r)
  assert.equal(r.audits[0].closing.publisherQualified, false)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 170)
})

test('PathAI primary declaration also requires the actual active department-grid target', async () => {
  const r = replay((url, page) => url === profiles.pathai.primaryURL
    ? editHTML(page, raw => raw.replaceAll('id="resourceGrid"', 'id="unrelatedGrid"')) : page)
  const jobs = await run('pathai', r)
  assert.equal(r.audits[0].closing.publisherQualified, false)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 10)
})

for (const scope of ['primary', 'asset']) test('decoded-only ' + scope + ' metadata cannot qualify a publisher beside original native JSON', async () => {
  const target = scope === 'primary' ? profiles.pathai.primaryURL : profiles.pathai.declaration.scriptURL
  const r = replay((url, page) => url === target ? { url, status: page.status, headers: page.headers,
    html: Buffer.from(page.bodyBase64, 'base64').toString('utf8') } : page)
  const jobs = await run('pathai', r)
  assert.equal(r.audits[0].closing.publisherQualified, false)
  assert.equal(jobs.length, 0)
  assert.equal(r.audits[0].observations.length, 10)
})

test('native JSON provenance requires original body bytes beyond matching status and URL metadata', () => {
  assert.throws(() => nativeJSON({ usable: true, transportQualified: true, originalText: '{"jobs":[],"meta":{"total":0}}' }), /original/)
})

test('a denied diagnostic bootstrap host is held without erasing independently bound native/route positives', async () => {
  const r = replay((url, page) => new URL(url).hostname === 'static.careerpuck.com' ? { ...page, status: 403 } : page)
  const jobs = await run('lyft', r, {}, { ...profiles.lyft, countryFilter: 'Global' })
  const expected = fixture.oracle.lyft.records.filter(row => row.kind === 'job')
  assert.equal(jobs.length, expected.length)
  assert.ok(r.audits[0].observations.every(job => job.sourceNativeRoleRouteQualified && job.sourceCurrentNativePostingIdentityQualified))
  assert.ok(jobs.every(job => job.sourceNativeRoleBootstrapAvailable === false && job.sourceNativeHostedPageActivationVerified === false))
  assert.equal(r.requests.filter(url => new URL(url).hostname === 'static.careerpuck.com').length, 1)
  assert.ok(r.audits[0].closing.originalNativeRouteAssets.every(row => row.status === null && row.bodySHA256 === null))
})
