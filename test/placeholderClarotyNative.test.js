import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const folder = new URL('../scraper/claroty/fixtures/current-20261030/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const records = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const CAREERS = 'https://claroty.com/careers', LISTING = 'https://claroty.com/open-positions'
const CLIENT = 'https://claroty.com/build/assets/claroty-9xsMoeZ-.js'
const API = 'https://claroty.com/api/v1/comeet/', FIRST = '66.271', SECOND = 'CE.079'
const FIRST_API = API + 'positions/' + FIRST, FIRST_PAGE = LISTING + '/' + FIRST
const PROOF = Symbol.for('jobverify.official-ats-discovery')
const provider = getScraperCatalog().find(row => row.source === 'claroty')
const run = options => createCatalogScraper(provider).run({ now: () => manifest.capturedAt, ...options })
const originalDetail = JSON.parse(records.find(row => row.requestedURL === FIRST_API).body)
function json(row, change) {
  const data = JSON.parse(row.body)
  const result = change(data)
  return { ...row, body: Buffer.from(JSON.stringify(result === undefined ? data : result)) }
}
function replace(row, old, value) {
  assert.ok(row.body.toString().includes(old), 'Fixture mutation must change captured bytes')
  return { ...row, body: Buffer.from(row.body.toString().replaceAll(old, value)) }
}
function replay(t, change) {
  const calls = [], counts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    assert.equal(init.method, 'GET'); assert.equal(init.body, undefined)
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error')
    const row = records.find(row => row.requestedURL === url)
    assert.ok(row, 'Uncaptured network forbidden: ' + url)
    const occurrence = (counts.get(url) || 0) + 1; counts.set(url, occurrence); calls.push(url)
    const current = change ? change({ ...row }, occurrence) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
// Explicitly synthetic test locations; the captured Claroty inventory has no
// India country selections. Preserve all captured employer text and identities.
function syntheticIndia(row, ids = [FIRST]) {
  if (row.requestedURL === API + 'positions') return json(row, groups => {
    for (const group of groups) for (const post of group.positions) if (ids.includes(post.uid)) post.location = 'India'
  })
  if (row.requestedURL === API + 'locations') return json(row, values => [...values, 'India'])
  if (ids.some(uid => row.requestedURL === API + 'positions/' + uid)) return json(row, post => {
    post.location = { ...post.location, name: 'India', country: 'IN', city: 'Bengaluru', state: 'KA',
      location_uid: 'IN.001', timezone: 'Asia/Kolkata', postal_code: '560001', street_name: null }
  })
  return row
}

test('registered Claroty reads the current primary handoff, all four APIs and all26 API/public details twice', async t => {
  const calls = replay(t), jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 118)
  for (const url of records.map(row => row.requestedURL)) assert.equal(calls.filter(value => value === url).length, 2)
  const proof = jobs[PROOF]
  assert.equal(proof.nativeInventory.observedNativeRoles, 26)
  assert.equal(proof.nativeInventory.observedDepartmentGroups, 14)
  assert.equal(proof.nativeInventory.fullContentRoles, 26)
  assert.equal(proof.nativeInventory.primaryRolePagesValidated, 26)
  assert.equal(proof.nativeInventory.selectedIndiaPostings, 0)
  assert.deepEqual(proof.nativeInventory.unresolvedCountryPostings, [])
  assert.equal(proof.nativeInventory.snapshots, 2)
  assert.equal(proof.binding.nativeCompanyUid, 'F2.004')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(provider.backfillMode, 'live-parser')
})

test('synthetic Claroty India output preserves all original HTML and unknown original dates', async t => {
  replay(t, row => syntheticIndia(row))
  const jobs = await run(), job = jobs[0]
  assert.equal(jobs.length, 1)
  assert.equal(job.jobId, FIRST)
  assert.equal(job.company, 'Claroty')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceUrl, FIRST_PAGE)
  assert.equal(job.applyUrl, FIRST_PAGE)
  assert.equal(job.sourceDescription, originalDetail.details)
  assert.equal(job.jobDescription, originalDetail.details)
  assert.equal(job.nativeDescriptionHTML, originalDetail.details)
  assert.equal(job.nativeHostedUrl, originalDetail.url_comeet_hosted_page)
  assert.equal(job.postingDate, null)
  assert.equal(job.nativePublicationDate, null)
  assert.equal(job.nativeUpdatedAt, null)
  assert.equal(job.nativeLegalEmployer, null)
  assert.equal(job.nativeEmployerBrand, 'Claroty')
  assert.equal(job.remoteStatus, 'Hybrid')
  assert.equal(job.nativeLocation.is_remote, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(job.applicationAccessVerified, false)
  assert.equal(job.applicationSubmitted, false)
})

test('Claroty preserves an absent native employment type rather than inventing full-time status', async t => {
  replay(t, row => syntheticIndia(row, [SECOND]))
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, SECOND)
  assert.equal(jobs[0].employmentType, null)
})

test('Claroty requires the current visible corporate openings handoff', async t => {
  const calls = replay(t, row => row.requestedURL === CAREERS ? replace(row, 'href="/open-positions"', 'href="/retired-openings"') : row)
  await assert.rejects(run(), /handoff|binding|careers/i)
  assert.deepEqual(calls, [CAREERS])
})

test('Claroty refuses a denied primary listing page', async t => {
  replay(t, row => row.requestedURL === LISTING ? { ...row, status: 403 } : row)
  await assert.rejects(run(), /HTTP.*403/i)
})

test('Claroty requires the current primary client bytes rather than interpreting changed JavaScript', async t => {
  replay(t, row => row.requestedURL === CLIENT ? { ...row, body: Buffer.concat([row.body, Buffer.from('\n/* changed consumer */')]) } : row)
  await assert.rejects(run(), /client|contract/i)
})

test('Claroty requires an executable primary module element', async t => {
  replay(t, row => row.requestedURL === LISTING ? replace(row, 'type="module"', 'type="application/json"') : row)
  await assert.rejects(run(), /module|client|executable/i)
})

test('Claroty rejects a changed current company widget account', async t => {
  replay(t, row => row.requestedURL === LISTING ? replace(row, 'data-company-uid="F2.004"', 'data-company-uid="99.BAD"') : row)
  await assert.rejects(run(), /company|account|binding/i)
})

test('Claroty rejects duplicate UIDs before fetching any role detail', async t => {
  const calls = replay(t, row => row.requestedURL === API + 'positions' ? json(row, groups => {
    groups[0].positions[1].uid = FIRST
  }) : row)
  await assert.rejects(run(), /duplicate|identity|UID/i)
  assert.ok(!calls.includes(FIRST_API))
})

test('Claroty rejects a department group/record mismatch', async t => {
  replay(t, row => row.requestedURL === API + 'positions' ? json(row, groups => { groups[0].positions[0].department = 'Other Department' }) : row)
  await assert.rejects(run(), /department|group|identity/i)
})

test('Claroty reconciles the country/location filter with the unfiltered listing', async t => {
  replay(t, row => row.requestedURL === API + 'locations' ? json(row, values => values.filter(value => value !== 'Israel')) : row)
  await assert.rejects(run(), /facet|filter|location|inventory/i)
})

test('Claroty rejects a native detail account different from the current primary widget', async t => {
  replay(t, row => row.requestedURL === FIRST_API ? json(row, post => { post.url_comeet_hosted_page = post.url_comeet_hosted_page.replace('/F2.004/', '/99.BAD/') }) : row)
  await assert.rejects(run(), /account|company|identity/i)
})

test('Claroty rejects a native detail UID that differs from the current listed UID', async t => {
  replay(t, row => row.requestedURL === FIRST_API ? json(row, post => { post.url_comeet_hosted_page = post.url_comeet_hosted_page.replace('/66.271', '/99.BAD') }) : row)
  await assert.rejects(run(), /UID|identity|position/i)
})

test('Claroty rejects a public primary page bound to another role UID', async t => {
  replay(t, row => row.requestedURL === FIRST_PAGE ? replace(row, "comeetPosition('66.271')", "comeetPosition('99.BAD')") : row)
  await assert.rejects(run(), /UID|identity|primary|binding/i)
})

test('Claroty rejects unqualified publication/status fields instead of silently omitting them', async t => {
  replay(t, row => row.requestedURL === FIRST_API ? json(row, post => { post.is_internal = true; post.published_at = '2026-10-30T00:00:00Z' }) : row)
  await assert.rejects(run(), /schema|fields|status|publication/i)
})

test('Claroty does not infer India from remote flags or a missing native country', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FIRST_API ? json(row, post => { post.location.country = null }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.deepEqual(jobs[PROOF].nativeInventory.unresolvedCountryPostings, [FIRST])
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Claroty rejects India country inconsistent with the actual Israel location label', async t => {
  replay(t, row => row.requestedURL === FIRST_API ? json(row, post => { post.location.country = 'IN' }) : row)
  await assert.rejects(run(), /country|location|geography/i)
})

test('Claroty rejects explicit foreign country contradicting a known India city/state pair', async t => {
  replay(t, row => {
    if (row.requestedURL === API + 'positions') return json(row, groups => { groups[0].positions[0].location = 'United States' })
    return row.requestedURL === FIRST_API ? json(row, post => {
      post.location = { ...post.location, name: 'United States', country: 'US', city: 'Pune', state: 'MH', location_uid: 'US.999' }
    }) : row
  })
  await assert.rejects(run(), /country|geography|state/i)
})

test('Claroty requires role responsibilities even when the employer footer is long', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FIRST_API ? json(row, post => {
      post.details = post.details.replace(/<h2>Responsibilities<\/h2>[\s\S]*?<h2>Requirements<\/h2>/, '<h2>Responsibilities</h2><p>Apply here!</p><h2>Requirements</h2>')
    }) : row
  })
  await assert.rejects(run(), /content|responsibilities|description/i)
})

test('Claroty excludes the About Claroty footer when assessing missing role requirements', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FIRST_API ? json(row, post => {
      post.details = post.details.replace(/<h2>Requirements<\/h2>[\s\S]*?<p><strong>About Claroty<\/strong><\/p>/, '<h2>Requirements</h2><p>Apply here!</p><p><strong>About Claroty</strong></p>')
    }) : row
  })
  await assert.rejects(run(), /content|requirements|description/i)
})

test('Claroty reconciles changes to full role content in the closing snapshot', async t => {
  replay(t, (row, occurrence) => row.requestedURL === FIRST_API && occurrence === 2 ? json(row, post => {
    post.details += '<p>Changed original employer content.</p>'
  }) : row)
  await assert.rejects(run(), /changed|closing|reconcil/i)
})

test('Claroty applies output caps after checking all inventory and both full snapshots', async t => {
  const calls = replay(t, row => syntheticIndia(row, [FIRST, SECOND])), jobs = await run({ maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 118)
  assert.equal(jobs[PROOF].nativeInventory.selectedIndiaPostings, 2)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Claroty rejects an upstream HTML response carrying a nominal JSON MIME', async t => {
  replay(t, row => row.requestedURL === API + 'positions' ? { ...row, body: Buffer.from('<html>Maintenance</html>') } : row)
  await assert.rejects(run(), /JSON|response|inventory/i)
})

test('Claroty bounds whole inventory rather than silently truncating native rows', async t => {
  const calls = replay(t)
  await assert.rejects(run({ maxNativeRecords: 10 }), /bound|inventory|records/i)
  assert.ok(!calls.includes(FIRST_API))
})

test('Claroty observes caller cancellation before any HTTP', async t => {
  const calls = replay(t), controller = new AbortController()
  controller.abort(new Error('cancel Claroty'))
  await assert.rejects(run({ signal: controller.signal }), /cancel Claroty/)
  assert.deepEqual(calls, [])
})

test('Claroty bounds response bytes before processing source content', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, body: Buffer.alloc(3 * 1024 * 1024 + 1, 65) } : row)
  await assert.rejects(run(), /byte bound/i)
})

test('Claroty rejects a shared native office UID resolving to conflicting explicit countries', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FIRST_API ? json(row, post => { post.location.location_uid = originalDetail.location.location_uid }) : row
  })
  await assert.rejects(run(), /location UID|conflicting country/i)
})

test('Claroty accepts a valid US Georgia location without confusing the state with a country', async t => {
  replay(t, row => {
    if (row.requestedURL === API + 'positions') return json(row, groups => { groups[0].positions[0].location = 'United States' })
    return row.requestedURL === FIRST_API ? json(row, post => {
      post.location = { ...post.location, name: 'United States', country: 'US', city: 'Atlanta', state: 'GA', location_uid: 'US.999' }
    }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].nativeInventory.fullContentRoles, 26)
})

test('Claroty keeps an empty served API inventory as a coverage gap without a verified-empty claim', async t => {
  const calls = replay(t, row => [API + 'positions', API + 'departments', API + 'locations', API + 'types'].includes(row.requestedURL)
    ? json(row, () => []) : row)
  const jobs = await run(), evidence = readInventoryEvidence(jobs)
  assert.equal(calls.length, 14)
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].nativeInventory.observedNativeRoles, 0)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
})

test('Claroty rejects a changed final HTTP origin rather than accepting a redirect as first-party evidence', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, finalURL: 'https://other.example/careers' } : row)
  await assert.rejects(run(), /redirect|identity/i)
})

test('Claroty cannot qualify its primary client from an inert template', async t => {
  replay(t, row => {
    if (row.requestedURL !== LISTING) return row
    let matches = 0
    const html = row.body.toString().replace(/<script\b[^>]*\bsrc=(["'])https:\/\/claroty\.com\/build\/assets\/claroty-9xsMoeZ-\.js\1[^>]*>[\s\S]*?<\/script\s*>/g, element => {
      matches++; return '<template>' + element + '</template>'
    })
    assert.equal(matches, 1)
    return { ...row, body: Buffer.from(html) }
  })
  await assert.rejects(run(), /client|module|executable/i)
})

for (const hidden of ['', ' hidden']) {
  test('Claroty review rejects an external corporate document base' + hidden, async t => {
    const calls = replay(t, row => row.requestedURL === CAREERS
      ? replace(row, '</head>', '<base' + hidden + ' href="https://other.example/" /></head>') : row)
    await assert.rejects(run(), /base|handoff|binding/i)
    assert.deepEqual(calls, [CAREERS])
  })
}

for (const [city, state] of [['Atlanta', 'GA'], ['London', 'Greater London']]) {
  test('Claroty review rejects India country contradicting the qualified foreign pair ' + city + '/' + state, async t => {
    replay(t, row => {
      row = syntheticIndia(row)
      return row.requestedURL === FIRST_API ? json(row, post => {
        post.location = { ...post.location, city, state, location_uid: 'IN.999' }
      }) : row
    })
    await assert.rejects(run(), /country|city|state|geography/i)
  })
}

test('Claroty review rejects an explicit foreign subdivision prefix under India country', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FIRST_API ? json(row, post => {
      post.location = { ...post.location, city: 'Atlanta', state: 'US-GA', location_uid: 'IN.999' }
    }) : row
  })
  await assert.rejects(run(), /country|state|geography/i)
})

test('Claroty accepts a valid India Goa GA pair without mistaking its code for US Georgia', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL === FIRST_API ? json(row, post => {
      post.location = { ...post.location, city: 'Panaji', state: 'GA' }
    }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Panaji')
  assert.equal(jobs[0].state, 'GA')
})

test('Claroty does not activate a base URL inside an inert corporate template', async t => {
  replay(t, row => row.requestedURL === CAREERS
    ? replace(row, '</head>', '<template><base href="https://other.example/" /></template></head>') : row)
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].nativeInventory.observedNativeRoles, 26)
})
