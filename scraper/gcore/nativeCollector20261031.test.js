import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as gcore from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/native-cohort-20261031.json.gz', import.meta.url))))
for (const file of Object.values(fixture.files)) assert.equal(crypto.createHash('sha256').update(file.body).digest('hex'), file.sha256)
const rawListing = JSON.parse(fixture.files['primary-browser/native-page-listing.json'].body)
const capturedRows = rawListing.content.slice(0, 2)
const details = Object.fromEntries(capturedRows.map(row => [row.id, JSON.parse(fixture.files['detail-cohort/detail-' + row.id + '.json'].body)]))
const officialURL = 'https://gcore.com/careers', boardURL = 'https://careers.smartrecruiters.com/Gcore'
const apiURL = 'https://api.smartrecruiters.com/v1/companies/Gcore/postings'
const setIndia = record => {
  // Hypothetical typed-India mutation of this captured role shape. This is not
  // evidence that this native ID currently advertises an India worksite.
  record.location = { ...record.location, country: 'in', city: 'Bengaluru', fullLocation: 'Bengaluru, India' }
  if (typeof record.location.address === 'string') record.location.address = 'Bengaluru, India'
  for (const field of record.customField || []) if (field.fieldId === 'COUNTRY') {
    field.valueId = 'in'; field.valueLabel = 'India'
  }
}
const replay = async ({ india = false, mutateRows, mutateDetail, mutateOfficial, mutateBoard, closing, signal, maxJobs, operation = gcore.run } = {}) => {
  // Selected-cohort totals below are controlled, not native company totals.
  const rows = structuredClone(capturedRows), nativeDetails = structuredClone(details), events = []
  if (india) { setIndia(rows[0]); setIndia(nativeDetails[rows[0].id]) }
  mutateRows?.(rows)
  for (const [id, detail] of Object.entries(nativeDetails)) mutateDetail?.(detail, id)
  let listings = 0
  const jobs = await operation({ signal, maxJobs,
    fetchText: async url => {
      events.push({ kind: 'preflight', url })
      if (url === officialURL) return mutateOfficial ? mutateOfficial(fixture.files['primary-capture/official-careers.txt'].body) : fixture.files['primary-capture/official-careers.txt'].body
      assert.equal(url, boardURL)
      return mutateBoard ? mutateBoard(fixture.files['primary-browser/ats-document.html'].body) : fixture.files['primary-browser/ats-document.html'].body
    },
    fetchJson: async url => {
      const address = new URL(url)
      assert.equal(address.origin, 'https://api.smartrecruiters.com')
      if (address.pathname === '/v1/companies/Gcore/postings') {
        const phase = listings++ ? 'closing' : 'opening'
        events.push({ kind: 'listing', phase, url })
        const payload = { offset: 0, limit: 100, totalFound: rows.length, content: structuredClone(rows) }
        return phase === 'closing' && closing ? closing(payload) : payload
      }
      const id = address.pathname.match(/^\/v1\/companies\/Gcore\/postings\/(\d+)$/)?.[1]
      assert.ok(Object.hasOwn(nativeDetails, id), 'No invented native request: ' + url)
      events.push({ kind: 'detail', id, url })
      return structuredClone(nativeDetails[id])
    },
  })
  return { jobs, events, rows, nativeDetails }
}

test('Gcore replaces its sentinel with opening/details/closing native collection and honest foreign-row observations', async () => {
  const { jobs, events } = await replay()
  assert.equal(jobs.length, 0)
  assert.deepEqual(events.map(event => event.kind), ['preflight', 'preflight', 'listing', 'detail', 'detail', 'listing'])
  assert.deepEqual(events.filter(event => event.kind === 'listing').map(event => event.phase), ['opening', 'closing'])
  assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.observedRecordCount, 2)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.companyIndiaTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(gcore.readGcoreEvidence?.(jobs)?.explicitIndiaRecords, 0)
})

test('a hypothetical explicit same-role typed India record keeps exact captured JD and native identity fields', async () => {
  const { jobs, rows, nativeDetails } = await replay({ india: true })
  assert.equal(jobs.length, 1)
  const native = nativeDetails[rows[0].id], [job] = jobs
  assert.equal(job.jobId, native.id)
  assert.equal(job.requisitionId, native.refNumber)
  assert.equal(job.title, native.name)
  assert.equal(job.location, native.location.fullLocation)
  assert.equal(job.country, native.location.country)
  assert.equal(job.jobDescription, native.jobAd.sections.jobDescription.text)
  assert.equal(job.minimumQualification, native.jobAd.sections.qualifications.text)
  assert.equal(job.preferredQualification, native.jobAd.sections.additionalInformation.text)
  assert.equal(job.sourceUrl, native.postingUrl)
  assert.equal(job.applyUrl, native.applyUrl)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, mutateRows, mutateDetail] of [
  ['missing country despite India label', rows => { delete rows[0].location.country }, detail => { if (detail.id === capturedRows[0].id) delete detail.location.country }],
  ['unknown country code', rows => { rows[0].location.country = 'zz' }, detail => { if (detail.id === capturedRows[0].id) detail.location.country = 'zz' }],
  ['unpublished native record', rows => { rows[0].visibility = 'PRIVATE' }, detail => { if (detail.id === capturedRows[0].id) detail.visibility = 'PRIVATE' }],
]) test('Gcore cannot qualify ' + name + ' from a provider India default', async () => {
  const { jobs } = await replay({ india: true, mutateRows, mutateDetail })
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.observedRecordCount, 2)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
})

for (const body of ['', 'TBD', '<p>TBD</p>', '<div hidden>Develop production systems.</div>', '<style>.criteria{display:none}</style><p class="criteria">Develop production systems.</p>']) {
  test('Gcore preserves missing/placeholder/hidden native JD as unresolved without inventing content: ' + JSON.stringify(body), async () => {
    const { jobs, rows, nativeDetails } = await replay({ india: true, mutateDetail: detail => {
      if (detail.id === capturedRows[0].id) detail.jobAd.sections.jobDescription.text = body
    } })
    // Identity, explicit workplace and application remain bound even when the
    // original JD cannot qualify. Retain that vacancy as incomplete.
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, rows[0].id)
    assert.equal(jobs[0].title, rows[0].name)
    assert.equal(jobs[0].location, rows[0].location.fullLocation)
    assert.equal(jobs[0].applyUrl, nativeDetails[rows[0].id].applyUrl)
    assert.equal(jobs[0].jobDescription, /hidden|display:none/.test(body) ? '' : body)
    assert.equal(jobs[0].sourceNativeDetailRecord.jobAd.sections.jobDescription.text, body)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].publicExperienceChecked, false)
    assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
    assert.equal(gcore.readGcoreEvidence?.(jobs)?.missingCriteriaRecords, 1)
    assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.observedRecordCount, 2)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  })
}

for (const phase of ['listing', 'detail']) for (const field of ['postingUrl', 'applyUrl', 'ref']) for (const issue of ['foreign tenant', 'wrong role']) {
  test('Gcore rejects every supplied ' + phase + ' ' + field + ' with ' + issue, async () => {
    const mutate = record => {
      const current = field === 'ref' ? record.ref || apiURL + '/' + record.id
        : record[field] || details[record.id][field]
      record[field] = issue === 'foreign tenant' ? current.replace('/Gcore/', '/OtherCompany/') : current.replace(record.id, record.id + '0')
    }
    await assert.rejects(replay(phase === 'listing' ? { mutateRows: rows => mutate(rows[0]) }
      : { mutateDetail: detail => { if (detail.id === capturedRows[0].id) mutate(detail) } }), /Gcore.*(?:identity|URL|tenant)/i)
  })
}

for (const [name, options] of [
  ['wrong native detail ID', { mutateDetail: detail => { detail.id += '0' } }],
  ['case-changed company tenant', { mutateRows: rows => { rows[0].company.identifier = 'gcore' } }],
  ['contradictory native requisition', { mutateDetail: detail => { detail.refNumber += '-other' } }],
  ['contradictory native typed country', { india: true, mutateDetail: detail => { if (detail.id === capturedRows[0].id) detail.location.country = 'us' } }],
  ['foreign primary handoff', { mutateOfficial: html => html.replaceAll(boardURL, boardURL + 'OtherCompany') }],
  ['missing observed menu toggle', { mutateOfficial: html => html.replaceAll('Toggle menu', 'unrelated control') }],
  ['explicitly hidden native handoff', { mutateOfficial: html => html.replaceAll('href="' + boardURL + '"', 'style="display:none" href="' + boardURL + '"') }],
  ['unbound ATS shell', { mutateBoard: () => '<html><h1>Careers at Gcore</h1></html>' }],
]) test('Gcore fails closed for ' + name, async () => {
  await assert.rejects(replay(options), /Gcore.*(?:identity|country|handoff|company|board|tenant)/i)
})

for (const field of ['fullLocation', 'address']) test('Gcore rejects an explicit foreign country component in a controlled native India ' + field, async () => {
  const { jobs } = await replay({ india: true,
    mutateRows: rows => { rows[0].location[field] = 'Bengaluru, United States, India' },
    mutateDetail: detail => { if (detail.id === capturedRows[0].id) detail.location[field] = 'Bengaluru, United States, India' },
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Gcore keeps hidden native requirements out of complete normalized criteria while retaining full raw bytes', async () => {
  const marker = 'GCORE_HIDDEN_NATIVE_REQUIREMENT_REVIEW_CONTROL'
  const { jobs, rows, nativeDetails } = await replay({ india: true,
    mutateDetail: detail => { if (detail.id === capturedRows[0].id) detail.jobAd.sections.jobDescription.text += '<p style="display:none">' + marker + '</p>' },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].jobDescription.includes(marker), false)
  assert.equal(jobs[0].sourceNativeDetailRecord.jobAd.sections.jobDescription.text, nativeDetails[rows[0].id].jobAd.sections.jobDescription.text)
})

for (const [output, section] of [['minimumQualification', 'qualifications'], ['preferredQualification', 'additionalInformation']]) {
  test('Gcore normalized ' + output + ' excludes hidden content and preserves full raw criteria', async () => {
    const marker = 'GCORE_HIDDEN_QUALIFICATION_FIELD_REVIEW_CONTROL'
    const { jobs, rows, nativeDetails } = await replay({ india: true, mutateDetail: detail => {
      if (detail.id === capturedRows[0].id) detail.jobAd.sections[section].text += '<p hidden>' + marker + '</p>'
    } })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(jobs[0][output].includes(marker), false)
    assert.equal(jobs[0].sourceNativeDetailRecord.jobAd.sections[section].text, nativeDetails[rows[0].id].jobAd.sections[section].text)
  })
}

for (const selector of ['html', 'body', 'gcore-mobile-menu', '.gc-mobile-menu__row--expandable', '.gc-menu-link-item', 'button[aria-label="Toggle menu"]']) {
  test('the observed collapsed Gcore menu cannot override permanent author CSS hiding ' + selector, async () => {
    await assert.rejects(replay({ mutateOfficial: html => html.replace(/<head\b[^>]*>/i,
      '$&<style>' + selector + '{display:none!important}</style>') }), /Gcore.*handoff/i)
  })
}

for (const selector of ['html', 'h1,h2,h3', 'a']) {
  test('the reciprocal Gcore board proof respects permanent author CSS hiding ' + selector, async () => {
    await assert.rejects(replay({ mutateBoard: html => html.replace(/<head\b[^>]*>/i,
      '$&<style>' + selector + '{display:none!important}</style>') }), /Gcore.*(?:board|identity)/i)
  })
}

test('unrelated hidden author-CSS elements do not erase the captured ordinary Gcore menu control', async () => {
  const { jobs } = await replay({ mutateOfficial: html => html.replace(/<head\b[^>]*>/i,
    '$&<style>.not-the-gcore-navigation{display:none!important}</style>') })
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore').observedVacancyCount, 2)
})

for (const mutation of ['duplicate', 'important', 'conditional', 'extra-opacity']) {
  test('the bound Gcore closed-root projection preserves ' + mutation + ' author hiding', async () => {
    await assert.rejects(replay({ mutateOfficial: html => {
      const rule = html.match(/\.gc-mobile-menu\[[^\]]+\]\{display:none;[^}]*\}/)?.[0]
      assert.ok(rule, 'Captured native fixed/flex closed-root rule must exist')
      const selector = rule.slice(0, rule.indexOf('{'))
      if (mutation === 'important') return html.replace(rule, rule.replace('display:none;', 'display:none!important;'))
      if (mutation === 'conditional') return html.replace(rule, '@media (min-width:1px){' + rule + '}')
      return html.replace(/<head\b[^>]*>/i, '$&<style>' + selector
        + (mutation === 'duplicate' ? '{display:none}' : '{opacity:0}') + '</style>')
    } }), /Gcore.*(?:handoff|control)/i)
  })
}

test('a permanently opacity-zero Gcore body cannot supply the ordinary menu handoff', async () => {
  await assert.rejects(replay({ mutateOfficial: html => html.replace(/<body\b/i, '<body style="opacity:0"') }), /Gcore.*handoff/i)
})

test('an unrelated hidden Products toggle does not invalidate the bound About/Open positions control', async () => {
  const { jobs } = await replay({ mutateOfficial: html => {
    const changed = html.replace(/<button\b[^>]*class="[^"]*gc-mobile-menu__toggle[^"]*"[^>]*>[\s\S]*?<\/button>/g,
      button => /\bProducts\b/.test(button) ? button.replace('<button ', '<button style="opacity:0" ') : button)
    assert.ok(changed !== html, 'Captured Products toggle must actually be hidden by this control')
    return changed
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore').observedVacancyCount, 2)
})

for (const stage of ['after-headers', 'during-body']) {
  test('Gcore preserves its exact own request deadline despite a replacement transport failure ' + stage, async () => {
    const originalTimeout = AbortSignal.timeout, originalFetch = globalThis.fetch
    const controller = new AbortController(), reason = Object.freeze(new DOMException('Gcore request deadline', 'TimeoutError'))
    const replacement = new Error('Body transport replaced the deadline')
    let requests = 0, bodyReads = 0
    AbortSignal.timeout = milliseconds => milliseconds === 15000 ? controller.signal : originalTimeout(milliseconds)
    globalThis.fetch = async () => {
      requests++
      const response = new Response('unread native response', { status: 200 })
      if (stage === 'after-headers') controller.abort(reason)
      response.text = async () => { bodyReads++; controller.abort(reason); throw replacement }
      return response
    }
    try {
      await assert.rejects(gcore.run(), error => error === reason)
      assert.equal(requests, 1)
      assert.equal(bodyReads, stage === 'after-headers' ? 0 : 1)
    } finally { AbortSignal.timeout = originalTimeout; globalThis.fetch = originalFetch }
  })
}

test('caller lifecycle reason takes precedence when own body deadline and caller cancellation both fire', async () => {
  const originalTimeout = AbortSignal.timeout, originalFetch = globalThis.fetch
  const deadline = new AbortController(), caller = new AbortController()
  const callerReason = Object.freeze(new Error('Gcore caller cancellation')), ownReason = Object.freeze(new DOMException('Request deadline', 'TimeoutError'))
  AbortSignal.timeout = milliseconds => milliseconds === 15000 ? deadline.signal : originalTimeout(milliseconds)
  globalThis.fetch = async () => {
    const response = new Response('unread native response', { status: 200 })
    response.text = async () => { deadline.abort(ownReason); caller.abort(callerReason); throw new Error('Replacement body failure') }
    return response
  }
  try { await assert.rejects(gcore.run({ signal: caller.signal }), error => error === callerReason) }
  finally { AbortSignal.timeout = originalTimeout; globalThis.fetch = originalFetch }
})

test('Gcore closing drift retains the opening role as partial with its unchanged native fields', async () => {
  const { jobs } = await replay({ india: true, closing: payload => { payload.content[0].name += ' changed'; return payload } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, capturedRows[0].name)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('a Gcore output cap cannot certify zero or discard observed native counts', async () => {
  const { jobs } = await replay({ india: true, maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.observedRecordCount, 2)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.match(readInventoryEvidence(jobs)?.reason || '', /cap/)
})

test('Gcore caller cancellation stops before any native request and preserves the exact reason', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('caller stopped Gcore'))
  controller.abort(reason)
  await assert.rejects(replay({ signal: controller.signal }), error => error === reason)
})

test('effective registered Gcore path retains typed global observations when zero India rows qualify', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'gcore')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /scraper[\\/]gcore[\\/]script\.js$/)
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.notEqual(provider.backfillMode, 'sentinel')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedOn, null)
  const { jobs, events } = await replay({ operation: options => createCatalogScraper(provider).run(options) })
  assert.equal(jobs.length, 0)
  assert.equal(events.filter(event => event.kind === 'detail').length, 2)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.observedRecordCount, 2)
  assert.equal(readSourceObservationEvidence(jobs, 'gcore')?.companyGlobalTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
})

test('duplicate native listing IDs fail before duplicate hydration can hide an inventory gap', async () => {
  await assert.rejects(replay({ mutateRows: rows => { rows[1] = structuredClone(rows[0]) } }), /repeated|duplicate/i)
})

test('malformed closing native total retains the opening role only as partial', async () => {
  const { jobs } = await replay({ india: true, closing: payload => { payload.totalFound = 'NaN'; return payload } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, capturedRows[0].name)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(gcore.readGcoreEvidence(jobs).nativeEnumerationComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('a supplied contradictory typed country field never supplies an India default', async () => {
  const baseline = await replay({ india: true })
  const { jobs } = await replay({ india: true, mutateRows: rows => {
    const field = rows[0].customField.find(value => value.fieldId === 'COUNTRY')
    field.valueId = 'us'; field.valueLabel = 'United States'
  } })
  assert.equal(jobs.length, 0)
  // The other captured foreign row already has Cyprus country with a literal
  // Poland/Serbia address. Keep that uncertainty, plus this new contradiction.
  assert.equal(gcore.readGcoreEvidence(jobs).unknownCountryRecords, gcore.readGcoreEvidence(baseline.jobs).unknownCountryRecords + 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
