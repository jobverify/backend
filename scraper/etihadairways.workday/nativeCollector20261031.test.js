import fs from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { run, readEtihadEvidence } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-inputs-20261031.json.gz', import.meta.url)))).packets
const original = JSON.parse(captured[2].body)
const detailId = original.content[0].id
const boardUrl = 'https://careers.smartrecruiters.com/EtihadAirways5'
const api = 'https://api.smartrecruiters.com/v1/companies/EtihadAirways5/postings'

function inputs({ india = false, change = () => {} } = {}) {
  const fixture = { official: captured[0].body, board: captured[1].body, first: JSON.parse(captured[2].body), second: JSON.parse(captured[3].body), detail: JSON.parse(captured[4].body) }
  if (india) {
    // Explicit hypothetical same-shape mutation. The actual104 records are foreign.
    fixture.first.content = [fixture.first.content[0]]
    fixture.first.totalFound = 1
    fixture.second.content = []
    fixture.second.totalFound = 1
    for (const record of [fixture.first.content[0], fixture.detail]) {
      Object.assign(record.location, { city: 'Bengaluru', country: 'in', fullLocation: 'Bengaluru, , India' })
      for (const field of record.customField || []) if (field.fieldId === 'COUNTRY') Object.assign(field, { valueId: 'in', valueLabel: 'India' })
    }
  }
  change(fixture)
  return fixture
}

function transport(fixture, afterRead = () => {}) {
  const calls = []
  let openings = 0
  return {
    calls,
    fetchText: async (url, { signal } = {}) => {
      signal?.throwIfAborted()
      calls.push(url)
      assert.ok([captured[0].url, boardUrl].includes(url), 'Uncaptured native document request')
      return url === boardUrl ? fixture.board : fixture.official
    },
    fetchJson: async (url, { signal } = {}) => {
      signal?.throwIfAborted()
      calls.push(url)
      const address = new URL(url)
      let result
      if (address.pathname === new URL(api).pathname) {
        const offset = Number(address.searchParams.get('offset') || 0)
        if (offset === 0) openings++
        result = structuredClone(offset === 0 ? fixture.first : fixture.second)
        afterRead(result, { closing: openings > 1, offset, url })
      } else {
        assert.equal(url, api + '/' + detailId, 'Uncaptured native role detail request')
        result = structuredClone(fixture.detail)
        afterRead(result, { detail: true, url })
      }
      return result
    },
  }
}

test('actual native104 foreign records survive as observations while zero India remains non-authoritative', async () => {
  const io = transport(inputs())
  const jobs = await run(io)
  assert.equal(jobs.length, 0)
  assert.equal(io.calls.length, 6)
  const observation = readSourceObservationEvidence(jobs, 'etihadairways')
  assert.equal(observation.observedRecordCount, 104)
  assert.equal(observation.observedVacancyCount, 104)
  assert.equal(observation.sourceScopeComplete, false)
  assert.equal(observation.companyGlobalTotal, null)
  assert.equal(observation.companyIndiaTotal, null)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.reportedTotal, 104)
  // Three actual foreign descriptor variants remain unreviewed by the strict
  // name check; their raw two-letter codes do not certify complete India scope.
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(readEtihadEvidence(jobs).unknownCountryRecords, 3)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.verifiedAt, null)
  assert.notEqual(inventory.status, 'verified-empty')
})

test('controlled India mutation uses exact original role criteria and real application URLs', async () => {
  const fixture = inputs({ india: true }), io = transport(fixture)
  const jobs = await run(io)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, detailId)
  assert.equal(jobs[0].requisitionId, fixture.detail.refNumber)
  assert.equal(jobs[0].company, 'Etihad Airways')
  assert.equal(jobs[0].jobDescription, fixture.detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].applyUrl, fixture.detail.applyUrl)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('captured optional raw native qualification remains distinct from a missing full description', async () => {
  const fixture = inputs({ india: true, change: f => { f.detail.jobAd.sections.jobDescription.text = '' } })
  const jobs = await run(transport(fixture))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, '')
  assert.equal(jobs[0].minimumQualification, fixture.detail.jobAd.sections.qualifications.text)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].publicExperienceChecked, false)
})

for (const description of ['<p>TBD</p>', '<section style="display:none"><p>Required experience is listed here.</p></section>']) {
  test('placeholder or permanently hidden full criteria remain genuine partial vacancies: ' + description.slice(0, 24), async () => {
    const fixture = inputs({ india: true, change: f => { f.detail.jobAd.sections.jobDescription.text = description } })
    const jobs = await run(transport(fixture))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobDescription, description.startsWith('<section') ? '' : description)
    assert.equal(jobs[0].sourceNativeDetailRecord.jobAd.sections.jobDescription.text, description)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  })
}

test('hidden primary handoffs cannot activate a native tenant', async () => {
  const fixture = inputs({ change: f => { f.official = f.official.replace(/<a\b[^>]*href="https:\/\/careers\.smartrecruiters\.com\/EtihadAirways5"[^>]*>[\s\S]*?<\/a>/g, whole => '<div hidden>' + whole + '</div>') } })
  const io = transport(fixture)
  await assert.rejects(run(io), /handoff|official/i)
  assert.equal(io.calls.length, 1)
})

test('CSS-hidden whole employer page cannot activate its otherwise exact anchors', async () => {
  const fixture = inputs({ change: f => { f.official += '<style>html {display:none!important}</style>' } }), io = transport(fixture)
  await assert.rejects(run(io), /handoff|official/i)
  assert.equal(io.calls.length, 1)
})

test('wrong reciprocal board identity stops before native API reads', async () => {
  const fixture = inputs({ change: f => { f.board = f.board.replaceAll('https://careers.etihad.com/', 'https://example.com/') } }), io = transport(fixture)
  await assert.rejects(run(io), /reciprocal|identity/i)
  assert.equal(io.calls.length, 2)
})

test('native company ID disagreement cannot borrow the advertised employer name', async () => {
  const fixture = inputs({ change: f => { f.first.content[0].company.identifier = 'OtherTenant' } })
  await assert.rejects(run(transport(fixture)), /identity|company/i)
})

test('repeated native vacancy identity is rejected rather than counted twice', async () => {
  const fixture = inputs({ change: f => { f.first.content[1] = structuredClone(f.first.content[0]) } })
  await assert.rejects(run(transport(fixture)), /repeat|identity/i)
})

test('unrecognized native country remains unknown and cannot certify an India zero', async () => {
  const fixture = inputs({ change: f => { f.first.content[0].location.country = ['in', 'ae'] } })
  const jobs = await run(transport(fixture))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /country-unresolved/)
})

test('a native draft is an observed record without becoming a public vacancy', async () => {
  const fixture = inputs({ change: f => { f.first.content[0].visibility = 'PRIVATE' } })
  const jobs = await run(transport(fixture)), observed = readSourceObservationEvidence(jobs, 'etihadairways')
  assert.equal(jobs.length, 0)
  assert.equal(observed.recordKind, 'mixed')
  assert.equal(observed.observedRecordCount, 104)
  assert.equal(observed.observedVacancyCount, 103)
})

for (const [label, mutate] of [
  ['other tenant application', detail => { detail.applyUrl = detail.applyUrl.replace('/EtihadAirways5/', '/OtherTenant/') }],
  ['other role ID', detail => { detail.id = '1234567890' }],
  ['conflicting worksite', detail => { detail.location.country = 'ae' }],
]) test('controlled India role rejects ' + label + ' before publishing borrowed criteria', async () => {
  const fixture = inputs({ india: true, change: f => { mutate(f.detail) } })
  await assert.rejects(run(transport(fixture)), /identity|country|location/i)
})

test('closing drift remains partial and keeps exact opening observations', async () => {
  const io = transport(inputs(), (payload, phase) => { if (phase.closing && phase.offset === 0) payload.content[0].name += ' changed' })
  const jobs = await run(io)
  assert.equal(readSourceObservationEvidence(jobs, 'etihadairways').observedRecordCount, 104)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /changed|drift|closing/i)
})

test('pre-aborted source preserves the exact frozen reason without native IO', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('exact caller reason'))
  controller.abort(reason)
  const io = transport(inputs())
  await assert.rejects(run({ ...io, signal: controller.signal }), error => error === reason)
  assert.equal(io.calls.length, 0)
})

test('controlled native India code cannot override a contradictory explicit foreign worksite', async () => {
  const fixture = inputs({ india: true, change: f => {
    for (const row of [f.first.content[0], f.detail]) row.location.fullLocation = 'New York, United States'
  } })
  const jobs = await run(transport(fixture))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('a city whose name matches a country does not override explicit native India evidence', async () => {
  const fixture = inputs({ india: true, change: f => {
    for (const row of [f.first.content[0], f.detail]) Object.assign(row.location, { city: 'Georgia', fullLocation: 'Georgia, India' })
  } })
  const jobs = await run(transport(fixture))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'in')
})

for (const field of ['fullLocation', 'address']) test('an intermediate explicit foreign country in native ' + field + ' cannot hide behind India suffix', async () => {
  const fixture = inputs({ india: true, change: f => {
    for (const row of [f.first.content[0], f.detail]) row.location[field] = 'Bengaluru, United States, India'
  } })
  const jobs = await run(transport(fixture))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('normalized full criteria exclude a hidden requirement while retaining exact raw native evidence', async () => {
  const marker = 'HIDDEN_NATIVE_REQUIREMENT_REVIEW_CONTROL'
  const fixture = inputs({ india: true, change: f => {
    f.detail.jobAd.sections.jobDescription.text += '<p style="display:none">' + marker + '</p>'
  } })
  const jobs = await run(transport(fixture))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].jobDescription.includes(marker), false)
  assert.equal(jobs[0].sourceNativeDetailRecord.jobAd.sections.jobDescription.text, fixture.detail.jobAd.sections.jobDescription.text)
  assert.ok(jobs[0].jobDescription.length > 200)
})

for (const [output, section] of [['minimumQualification', 'qualifications'], ['preferredQualification', 'additionalInformation']]) {
  test('normalized ' + output + ' excludes hidden native criteria without losing raw evidence', async () => {
    const marker = 'HIDDEN_QUALIFICATION_FIELD_REVIEW_CONTROL'
    const fixture = inputs({ india: true, change: f => {
      f.detail.jobAd.sections[section].text += '<p hidden>' + marker + '</p>'
    } })
    const jobs = await run(transport(fixture))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(jobs[0][output].includes(marker), false)
    assert.equal(jobs[0].sourceNativeDetailRecord.jobAd.sections[section].text, fixture.detail.jobAd.sections[section].text)
  })
}
