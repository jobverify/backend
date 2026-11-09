import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { decodeNativeEntities } from '../utils/activeNativeHtml.js'

const fixtures = Object.fromEntries(['circleci', 'sentry'].map(source => [source, JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../scraper/${source}/test-data/native-current-20261102.json.gz`, import.meta.url))))]))
const circleciDetail = JSON.parse(fs.readFileSync(new URL('../../scraper/circleci/test-data/native-application-detail-20261102.json', import.meta.url), 'utf8'))
const astroChange = (fixture, change) => {
  fixture.responses.corporate = fixture.responses.corporate.replace(/(\bprops=")([^"]*)(")/, (whole, before, body, after) => {
    const json = JSON.parse(decodeNativeEntities(body))
    change(json)
    return before + JSON.stringify(json).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + after
  })
}
const makeIndia = (source, fixture) => {
  const record = fixture.responses.inventory.jobs[0]
  if (source === 'circleci') {
    record.location.name = 'Bengaluru, India'
    record.offices = [{ id: 9000000001, name: 'Bengaluru', location: 'Bengaluru, Karnataka, India', child_ids: [], parent_id: null }]
    const pattern = new RegExp('(<a\\b[^>]*href="/careers/jobs/' + record.id + '/\\?gh_jid=' + record.id + '"[^>]*>[\\s\\S]*?<p\\b[^>]*>)([\\s\\S]*?)(</p>)')
    assert.match(fixture.responses.corporate, pattern)
    fixture.responses.corporate = fixture.responses.corporate.replace(pattern, (_, before, value, after) => before + record.location.name + after)
  } else {
    record.location = 'Bengaluru, Karnataka, India'
    record.address = { postalAddress: { addressCountry: 'India', addressRegion: 'Karnataka', addressLocality: 'Bengaluru' } }
    astroChange(fixture, props => {
      const row = props.jobs[1].find(tuple => tuple[1].id[1] === record.id)[1]
      row.info[1].locationName = [0, record.location]
      row.info[1].locationIds[1].primaryLocationId = [0, '00000000-0000-4000-8000-000000000001']
      props.jobsByLocation[1].push([0, { id: [0, '00000000-0000-4000-8000-000000000001'], name: [0, record.location] }])
    })
    replaceSentryVisibleLocation(fixture, record.id, record.location)
  }
  return record
}
const replaceSentryVisibleLocation = (fixture, id, location) => {
  const pattern = new RegExp('(<a\\b[^>]*href="/careers/' + id + '/"[^>]*>[\\s\\S]*?<span\\b[^>]*class="[^"]*_jobLocation_[^"]*"[^>]*>)([\\s\\S]*?)(</span>)')
  assert.match(fixture.responses.corporate, pattern)
  fixture.responses.corporate = fixture.responses.corporate.replace(pattern, (_, before, value, after) => before + location + after)
}
async function exercise(t, source, { change = () => {}, closingChange = null, closingDetailChange = null, options = {} } = {}) {
  const fixture = structuredClone(fixtures[source]); change(fixture)
  const provider = getScraperCatalog().find(provider => provider.source === source)
  const calls = [], seen = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input); init.signal?.throwIfAborted(); calls.push({ url, init })
    const count = (seen.get(url) || 0) + 1; seen.set(url, count)
    let body, kind = 'text/html'
    if (source === 'circleci') {
      if (url === 'https://circleci.com/careers/jobs/') body = fixture.responses.corporate
      else if (url === 'https://boards-api.greenhouse.io/v1/boards/circleci/jobs?content=true') { body = structuredClone(fixture.responses.inventory); kind = 'application/json'; if (count > 1) closingChange?.(body) }
      else if (url === 'https://circleci.com/careers/jobs/8770606002/?gh_jid=8770606002') body = fixture.responses.role
      else if (/^https:\/\/circleci\.com\/careers\/jobs\/\d+\/\?gh_jid=\d+$/.test(url)) {
        // The archived fixture contains one genuine corporate detail. Other
        // archived rows use explicit controlled documents to exercise the
        // repaired whole-cohort protocol, never as current publisher proof.
        const id = Number(new URL(url).searchParams.get('gh_jid'))
        const record = fixture.responses.inventory.jobs.find(row => row.id === id)
        assert.ok(record)
        const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
        body = `<html><head><title>CircleCI controlled role</title><link rel="canonical" href="${escape(url)}"></head><body><h1>${escape(record.title)}</h1><p>${escape(record.location.name)}</p><article data-proofer-ignore>${decodeNativeEntities(record.content)}</article><div id="grnhse_app"></div><script src="https://boards.greenhouse.io/embed/job_board/js?for=circleci"></script></body></html>`
      }
      else if (/^https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/circleci\/jobs\/\d+\?questions=true$/.test(url)) {
        const id = Number(new URL(url).pathname.split('/').at(-1)), record = fixture.responses.inventory.jobs.find(record => record.id === id)
        assert.ok(record)
        body = { ...structuredClone(circleciDetail), ...structuredClone(record), company_name: 'CircleCI' }
        if (fixture.detailChange) fixture.detailChange(body)
        if (count > 1) closingDetailChange?.(body)
        if (fixture.detailStatus) { const result = new Response('{}', { status: fixture.detailStatus, headers: { 'content-type': 'application/json' } }); Object.defineProperty(result, 'url', { value: url }); return result }
        kind = 'application/json'
      }
      else throw new Error('Unexpected CircleCI URL: ' + url)
    } else {
      if (['https://sentry.io/careers', 'https://sentry.io/careers/'].includes(url)) body = fixture.responses.corporate
      else if (url === 'https://api.ashbyhq.com/posting-api/job-board/sentry') { body = structuredClone(fixture.responses.inventory); kind = 'application/json'; if (count > 1) closingChange?.(body) }
      else throw new Error('Unexpected Sentry URL: ' + url)
    }
    const response = new Response(typeof body === 'string' ? body : JSON.stringify(body), { headers: { 'content-type': kind } })
    Object.defineProperty(response, 'url', { value: url === 'https://sentry.io/careers' ? 'https://sentry.io/careers/' : url })
    return response
  })
  const jobs = await createCatalogScraper(provider).run(options)
  return { jobs, fixture, calls }
}

for (const [source, count] of [['circleci', 14], ['sentry', 40]]) {
  test(source + ' catalog publishes current native extraction while retaining unresolved inventory guards', () => {
    const provider = getScraperCatalog().find(provider => provider.source === source)
    assert.equal(provider.adapter, 'script')
    assert.match(provider.atsPlatform, /greenhouse|ashby/)
    assert.equal(provider.sourceScopeComplete, false)
    assert.equal(provider.lifecycleCleanupAllowed, false)
    assert.equal(provider.verifiedPublicJobCount, null)
    assert.equal(provider.verifiedIndiaJobCount, null)
    assert.equal(provider.verifiedAt, null)
  })
  test(source + ' currently retains native board count and unresolved geography without a verified India zero', async t => {
    const { jobs, calls } = await exercise(t, source)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, count)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
    assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/)
    assert.equal(calls.filter(call => /boards-api|api.ashbyhq/.test(call.url)).length, source === 'circleci' ? 2 + count * 2 : 2)
  })
  test(source + ' recovers a new explicit India role with full native criteria and original publication', async t => {
    let record
    const { jobs } = await exercise(t, source, { change: fixture => { record = makeIndia(source, fixture) } })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, String(record.id))
    assert.equal(jobs[0].country, 'India')
    assert.ok(jobs[0].sourceDescription.length > 1000)
    assert.equal(jobs[0].sourceDetailComplete, source === 'sentry')
    if (source === 'circleci') {
      assert.equal(jobs[0].fullNativeAuthoredCriteriaAvailable, false)
      assert.equal(jobs[0].nativeCriteriaVisibilityQualified, false)
      assert.equal(jobs[0].nativeModelClosingReconciled, true)
    }
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(Date.parse(jobs[0].postingDate), Date.parse(record.first_published || record.publishedAt))
    assert.ok(jobs[0].sourceNativeInventory)
  })
  test(source + ' rejects duplicate native role identity', async t => {
    await assert.rejects(exercise(t, source, { change: f => { f.responses.inventory.jobs[1] = structuredClone(f.responses.inventory.jobs[0]) } }))
  })
  test(source + ' closing criteria drift cannot emit stale native rows', async t => {
    await assert.rejects(exercise(t, source, { closingChange: body => { const r = body.jobs[0]; if (source === 'circleci') r.content += '&lt;p&gt;Additional mandatory certificate.&lt;/p&gt;'; else r.descriptionHtml += '<p>Additional mandatory certificate.</p>' } }))
  })
  test(source + ' cancellation precedes all corporate and native HTTP', async t => {
    const provider = getScraperCatalog().find(provider => provider.source === source)
    const reason = new Error('cancel ' + source); let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Unexpected request') })
    await assert.rejects(createCatalogScraper(provider).run({ signal: AbortSignal.abort(reason) }), error => error === reason)
    assert.equal(calls, 0)
  })
}

test('CircleCI rejects an active embed for a foreign native board', async t => {
  await assert.rejects(exercise(t, 'circleci', { change: f => { f.responses.role = f.responses.role.replace('js?for=circleci', 'js?for=foreign') } }))
})
test('CircleCI comment-only native board embed cannot bind the employer', async t => {
  await assert.rejects(exercise(t, 'circleci', { change: f => { f.responses.role = f.responses.role.replace('<script src="https://boards.greenhouse.io/embed/job_board/js?for=circleci"></script>', '<!-- <script src="https://boards.greenhouse.io/embed/job_board/js?for=circleci"></script> -->') } }))
})
test('CircleCI rejects a first-party-looking native role URL with the wrong role ID', async t => {
  await assert.rejects(exercise(t, 'circleci', { change: f => { f.responses.inventory.jobs[0].absolute_url = 'https://circleci.com/careers/jobs/999/?gh_jid=999' } }))
})
test('CircleCI retains its13 corporate cards versus14 native postings as a coverage disagreement', async t => {
  const { jobs } = await exercise(t, 'circleci', { change: f => { makeIndia('circleci', f) } })
  assert.equal(jobs[0].sourceNativeInventory.corporateRoleCount, 13)
  assert.equal(jobs[0].sourceNativeInventory.nativeRoleCount, 14)
  assert.match(readInventoryEvidence(jobs).reason, /corporate-native-count-disagreement/)
})
test('Sentry hidden hydrated opening island cannot bind the Ashby employer', async t => {
  await assert.rejects(exercise(t, 'sentry', { change: f => { f.responses.corporate = f.responses.corporate.replace('<astro-island', '<astro-island style="opacity:0"') } }))
})
test('Sentry rejects a foreign employer application URL in its own hydrated role', async t => {
  await assert.rejects(exercise(t, 'sentry', { change: f => { astroChange(f, p => { p.jobs[1][0][1].info[1].applyLink[1] = 'https://jobs.ashbyhq.com/foreign/' + p.jobs[1][0][1].id[1] }) } }))
})
test('Sentry city-only India text cannot acquire country from a mapper default', async t => {
  const { jobs } = await exercise(t, 'sentry', { change: f => {
    const record = f.responses.inventory.jobs[0]; record.location = 'Bengaluru'; record.address = null
    astroChange(f, p => { p.jobs[1].find(tuple => tuple[1].id[1] === record.id)[1].info[1].locationName = [0, 'Bengaluru'] })
    replaceSentryVisibleLocation(f, record.id, 'Bengaluru')
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('Sentry missing native NY country stays unresolved without city or employer-HQ inference', async t => {
  const { jobs } = await exercise(t, 'sentry', { change: f => { makeIndia('sentry', f) } })
  assert.ok(jobs[0].sourceNativeInventory.unresolvedCountryRoleIds.includes('960b966a-849f-421f-8c75-72924f28293e'))
})

test('Sentry requests the current canonical trailing-slash careers entry directly', async t => {
  const { calls } = await exercise(t, 'sentry')
  assert.equal(calls[0].url, 'https://sentry.io/careers/')
})

test('CircleCI retains job-owned required response questions separately from full JD and generic contacts', async t => {
  const { jobs, calls } = await exercise(t, 'circleci', { change: f => { makeIndia('circleci', f) } })
  assert.ok(jobs[0].sourceNativeDetailPayload)
  assert.ok(jobs[0].sourceNativeApplicationQuestions.some(question => question.label === 'First Name'))
  assert.ok(!jobs[0].sourceApplicationQuestions.some(question => /First Name|Last Name|Email|Phone|pronouns|LinkedIn|Website/i.test(question.label)))
  const question = jobs[0].sourceApplicationQuestions.find(question => /eligible to work/.test(question.label))
  assert.equal(question.required, true)
  assert.ok(question.fields.length > 0)
  assert.equal(question.requiredAnswer, undefined)
  assert.equal(calls.filter(call => /\?questions=true$/.test(call.url)).length, 28)
})
test('CircleCI stops at a public detail denial without manufacturing partial closing proof', async t => {
  await assert.rejects(exercise(t, 'circleci', { change: f => { makeIndia('circleci', f); f.detailStatus = 403 } }), error => {
    assert.equal(error.code, 'CIRCLECI_NATIVE_CONTRACT')
    assert.equal(error.nativeOriginalResponses.at(-1).status, 403)
    const urls = error.nativeOriginalResponses.map(p => p.requestedURL)
    assert.equal(new Set(urls).size, urls.length)
    return true
  })
})
test('CircleCI rejects wrong own native detail role identity', async t => {
  await assert.rejects(exercise(t, 'circleci', { change: f => { makeIndia('circleci', f); f.detailChange = detail => { detail.id = 999 } } }))
})
test('CircleCI closing required-response question drift cannot certify earlier role detail', async t => {
  await assert.rejects(exercise(t, 'circleci', { change: f => { makeIndia('circleci', f) }, closingDetailChange: body => { body.questions.push({ label: 'Do you hold the required licence?', required: true, fields: [{ type: 'input_text', name: 'question_99990001' }] }) } }))
})
