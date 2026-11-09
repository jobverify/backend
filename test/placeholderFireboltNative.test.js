import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const folder = new URL('../scraper/firebolt/fixtures/current-20261030/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const records = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const CAREERS = 'https://www.firebolt.io/careers'
const ACCOUNT = 'https://www.comeet.com/jobs/firebolt/26.004'
const CLIENT = 'https://www.comeet.com/common/careers.js?rc-314-0'
const FIRST = '05.865', SECOND = 'E2.A5D', UNKNOWN = '63.F1C'
const PROOF = Symbol.for('jobverify.official-ats-discovery')
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'firebolt'))
  .run({ now: () => manifest.capturedAt, ...options })
function assignments(row) {
  const html = row.body.toString(), d = readNativeDocument(html)
  const script = d.nodes(n => n.tag === 'script' && !n.attrs.src && /\bCOMPANY_DATA\s*=/.test(n.raw || ''))[0]
  assert.ok(script, 'Complete native literal bootstrap expected in fixture')
  const nodes = parse(script.raw, { ecmaVersion: 'latest' }).body.map(n => n.type === 'ExpressionStatement' ? n.expression : null)
    .filter(n => n?.type === 'AssignmentExpression' && ['COMPANY_DATA', 'COMPANY_POSITIONS_DATA', 'POSITION_DATA'].includes(n.left?.name))
  return { html, script, nodes, data: Object.fromEntries(nodes.map(n => [n.left.name, JSON.parse(script.raw.slice(n.right.start, n.right.end))])) }
}
const accountData = assignments(records.find(row => row.requestedURL === ACCOUNT)).data
const nativeFirst = accountData.COMPANY_POSITIONS_DATA.find(row => row.uid === FIRST)
const firstURL = nativeFirst.url_comeet_hosted_page
function native(row, change) {
  const { html, script, nodes, data } = assignments(row)
  change(data)
  let raw = script.raw
  for (const node of [...nodes].sort((a, b) => b.right.start - a.right.start)) {
    raw = raw.slice(0, node.right.start) + JSON.stringify(data[node.left.name]).replaceAll('<', '\\u003c') + raw.slice(node.right.end)
  }
  return { ...row, body: Buffer.from(html.replace(script.raw, raw)) }
}
const text = (row, old, value) => ({ ...row, body: Buffer.from(row.body.toString().replaceAll(old, value)) })
function replay(t, change) {
  const calls = [], counts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    assert.equal(init.method || 'GET', 'GET'); assert.equal(init.body, undefined)
    const row = records.find(row => row.requestedURL === url)
    assert.ok(row, 'Uncaptured native HTTP forbidden: ' + url)
    const occurrence = (counts.get(url) || 0) + 1; counts.set(url, occurrence); calls.push(url)
    const current = change ? change({ ...row, body: Buffer.from(row.body) }, occurrence) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
// Synthetic test locations, not observed India Firebolt openings. Native
// company/root/detail structures and employer content remain complete.
function syntheticIndia(row, ids = [FIRST]) {
  if (!row.requestedURL.startsWith(ACCOUNT)) return row
  return native(row, data => {
    const entries = data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]
    for (const post of entries) if (ids.includes(post.uid)) post.location = {
      ...post.location, country: 'IN', name: 'Bengaluru, Karnataka, India', city: 'Bengaluru', state: 'KA',
      postal_code: '560001', street_name: null, location_uid: 'IN.001', timezone: 'Asia/Kolkata',
    }
  })
}

test('registered Firebolt enumerates all three native postings and preserves unresolved country/content instead of certifying zero', async t => {
  const calls = replay(t), jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 12)
  assert.equal(calls.filter(url => url === ACCOUNT).length, 2)
  assert.equal(calls.filter(url => url === CLIENT).length, 2)
  const proof = jobs[PROOF]
  assert.equal(proof.nativeInventory.observedNativePostings, 3)
  assert.equal(proof.nativeInventory.locatedRolesWithFullContent, 2)
  assert.equal(proof.nativeInventory.snapshots, 2)
  assert.deepEqual(proof.nativeInventory.unresolvedCountryPostings, [UNKNOWN])
  assert.deepEqual(proof.nativeInventory.incompleteContentPostings, [UNKNOWN])
  assert.deepEqual(proof.binding.matchedRoleIds, [FIRST, SECOND])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(getScraperCatalog().find(row => row.source === 'firebolt').backfillMode, 'live-parser')
})

test('synthetic India native posting retains original sections and revision without inventing publication', async t => {
  replay(t, row => syntheticIndia(row))
  const jobs = await run(), job = jobs[0]
  assert.equal(jobs.length, 1)
  assert.equal(job.jobId, FIRST)
  assert.equal(job.company, 'Firebolt')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.postingDate, null)
  assert.equal(job.nativeUpdatedAt, '2026-08-26T06:50:40Z')
  assert.equal(job.nativeEmployerBrand, 'Firebolt')
  assert.equal(job.nativeLegalEmployer, null)
  assert.deepEqual(job.nativeDescriptionSections, nativeFirst.custom_fields.details)
  for (const field of nativeFirst.custom_fields.details) assert.ok(job.sourceDescription.includes(field.value))
  assert.equal(job.remoteStatus, 'Hybrid')
  assert.equal(job.nativeLocation.is_remote, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(job.applicationSubmitted, false)
  assert.equal(job.sourceUrl, firstURL)
})

test('Firebolt requires a current visible corporate native handoff', async t => {
  const calls = replay(t, row => row.requestedURL === CAREERS ? text(row, 'www.comeet.com/jobs/firebolt/', 'retired.example/jobs/firebolt/') : row)
  await assert.rejects(run(), /corporate|binding|handoff/i)
  assert.deepEqual(calls, [CAREERS])
})

test('Firebolt does not use a denied corporate response as an empty jobs result', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, status: 403 } : row)
  await assert.rejects(run(), /HTTP.*403/i)
})

for (const [field, value] of [['company_uid', '99.BAD'], ['name', 'Other Employer'], ['website', 'https://other.example/']]) {
  test('Firebolt rejects changed native company identity: ' + field, async t => {
    replay(t, row => row.requestedURL === ACCOUNT ? native(row, data => { data.COMPANY_DATA[field] = value }) : row)
    await assert.rejects(run(), /company|employer|identity|reciprocal/i)
  })
}

test('Firebolt requires the current advertised native client data contract', async t => {
  replay(t, row => row.requestedURL === CLIENT ? text(row, 'model.companyPositions=tResponseCompanyPositions(window.COMPANY_POSITIONS_DATA)', 'model.companyPositions=[]') : row)
  await assert.rejects(run(), /client|contract/i)
})

test('Firebolt rejects duplicate native position identities', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? native(row, data => { data.COMPANY_POSITIONS_DATA[2].uid = FIRST }) : row)
  await assert.rejects(run(), /identity|duplicate|uid/i)
})

test('Firebolt will not fetch a native detail declared internal by the account list', async t => {
  const calls = replay(t, row => row.requestedURL === ACCOUNT ? native(row, data => { data.COMPANY_POSITIONS_DATA.find(p => p.uid === FIRST).is_internal = true }) : row)
  await assert.rejects(run(), /internal|private|public/i)
  assert.ok(!calls.includes(firstURL))
})

test('Firebolt rejects a changed detail position identity', async t => {
  replay(t, row => row.requestedURL === firstURL ? native(row, data => { data.POSITION_DATA.uid = '99.BAD' }) : row)
  await assert.rejects(run(), /position|uid|identity/i)
})

test('Firebolt rejects an empty native list while current corporate role handoffs remain', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? native(row, data => { data.COMPANY_POSITIONS_DATA = [] }) : row)
  await assert.rejects(run(), /binding|handoff|list|inventory/i)
})

test('Firebolt rejects explicit India country conflicting with the actual Germany location label', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
    for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location.country = 'IN'
  }) : row)
  await assert.rejects(run(), /country|geography|location/i)
})

test('Firebolt does not turn missing native country into India through a remote flag', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
    for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location.country = null
  }) : row)
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.deepEqual(jobs[PROOF].nativeInventory.unresolvedCountryPostings, [FIRST, UNKNOWN])
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Firebolt requires substantive native content before emitting an India record', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.custom_fields.details.find(f => f.name === 'Description').value = ''
    }) : row
  })
  await assert.rejects(run(), /description|content/i)
})

test('Firebolt reconciles native description changes in a closing detail snapshot', async t => {
  replay(t, (row, occurrence) => row.requestedURL === firstURL && occurrence === 2 ? native(row, data => {
    data.POSITION_DATA.custom_fields.details[0].value += '<p>Updated native responsibilities.</p>'
  }) : row)
  await assert.rejects(run(), /changed|reconcil|content/i)
})

test('Firebolt native bootstrap is parsed as data and never executed', async t => {
  globalThis.__comeet_executed = false
  t.after(() => { delete globalThis.__comeet_executed })
  replay(t, row => {
    if (row.requestedURL !== ACCOUNT) return row
    const { html, script, nodes } = assignments(row), node = nodes.find(n => n.left.name === 'COMPANY_DATA')
    const raw = script.raw.slice(0, node.right.start) + '(globalThis.__comeet_executed=true,' + script.raw.slice(node.right.start, node.right.end) + ')' + script.raw.slice(node.right.end)
    return { ...row, body: Buffer.from(html.replace(script.raw, raw)) }
  })
  await assert.rejects(run(), /literal|bootstrap|data|expression/i)
  assert.equal(globalThis.__comeet_executed, false)
})

test('Firebolt rejects a second assignment that would overwrite native company identity', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? text(row, 'DETECTED_COUNTRY =', 'COMPANY_DATA.name="Other Employer";DETECTED_COUNTRY =') : row)
  await assert.rejects(run(), /literal|bootstrap|assignment|identity/i)
})

test('Firebolt output limits are applied after all current native data and closing checks', async t => {
  const calls = replay(t, row => syntheticIndia(row, [FIRST, SECOND])), jobs = await run({ maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 12)
  assert.equal(jobs[PROOF].nativeInventory.selectedIndiaPostings, 2)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Firebolt observes caller cancellation before sending native HTTP', async t => {
  const calls = replay(t), controller = new AbortController()
  controller.abort(new Error('cancel Firebolt'))
  await assert.rejects(run({ signal: controller.signal }), /cancel Firebolt/)
  assert.deepEqual(calls, [])
})

test('Firebolt bounds the response body before parsing its bootstrap', async t => {
  replay(t, row => row.requestedURL === CAREERS ? { ...row, body: Buffer.alloc(3 * 1024 * 1024 + 1, 65) } : row)
  await assert.rejects(run(), /byte bound/i)
})

test('Firebolt country checks do not mistake a valid US state for a separate country', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
    for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location = {
      ...post.location, name: 'Atlanta, Georgia, United States', country: 'US', city: 'Atlanta', state: 'GA', location_uid: 'US.001',
    }
  }) : row)
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].nativeInventory.locatedRolesWithFullContent, 2)
})

test('Firebolt rejects an explicit foreign country with a contradictory India city and state', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
    for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location = {
      ...post.location, name: 'Bengaluru, Karnataka', country: 'US', city: 'Bengaluru', state: 'KA', location_uid: 'US.001',
    }
  }) : row)
  await assert.rejects(run(), /country|state|geography/i)
})

test('Firebolt rejects one native location UID resolving to two conflicting countries', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location.location_uid = 'F2.208'
    }) : row
  })
  await assert.rejects(run(), /country|location|geography/i)
})

test('Firebolt rejects explicit India country with a remote label scoped to Germany', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location.name = 'Remote (Germany)'
    }) : row
  })
  await assert.rejects(run(), /country|location|geography/i)
})

test('Firebolt accepts an explicit and consistent native remote India country scope', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location.name = 'Remote (India)'
    }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Remote (India)')
})

function clientElement(row, change) {
  let matches = 0
  const html = row.body.toString().replace(/<script\b(?=[^>]*\bsrc=["']\/common\/careers\.js\?)[^>]*>[\s\S]*?<\/script\s*>/gi, element => {
    matches++; return change(element)
  })
  assert.equal(matches, 1, 'Current native client element expected')
  return { ...row, body: Buffer.from(html) }
}

test('Firebolt review rejects employer boilerplate as a complete role description', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) {
        post.custom_fields.details.find(f => f.name === 'Description').value = data.COMPANY_DATA.description
        post.custom_fields.details.find(f => f.name === 'Requirements').value = ''
      }
    }) : row
  })
  await assert.rejects(run(), /description|content/i)
})

test('Firebolt review rejects a separate script mutating native public visibility before any detail fetch', async t => {
  const calls = replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script>if (POSITION_DATA) POSITION_DATA.is_internal=true; if (COMPANY_POSITIONS_DATA) COMPANY_POSITIONS_DATA.forEach(function(p){p.is_internal=true;});</script>' + element) : row)
  await assert.rejects(run(), /script|bootstrap|mutation|native data/i)
  assert.ok(!calls.includes(firstURL))
})

test('Firebolt review requires an executable native client element', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? clientElement(row, element =>
    element.replace('type="text/javascript"', 'type="application/json"')) : row)
  await assert.rejects(run(), /client|executable/i)
})

test('Firebolt review rejects explicit US country contradicting Pune in Maharashtra', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
    for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location = {
      ...post.location, country: 'US', name: 'Pune, Maharashtra, United States', city: 'Pune', state: 'MH', location_uid: 'US.001',
    }
  }) : row)
  await assert.rejects(run(), /country|state|geography/i)
})

for (const attribute of ['nomodule', 'async', 'defer', 'type="module"']) {
  test('Firebolt requires its qualified classic synchronous client: ' + attribute, async t => {
    replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? clientElement(row, element =>
      element.replace('type="text/javascript"', attribute)) : row)
    await assert.rejects(run(), /client|executable/i)
  })
}

test('Firebolt requires native data to exist before its client executes', async t => {
  replay(t, row => {
    if (row.requestedURL !== ACCOUNT) return row
    const { html, script } = assignments(row)
    return clientElement({ ...row, body: Buffer.from(html.replace(script.raw, '')) }, element => element + '<script>' + script.raw + '</script>')
  })
  await assert.rejects(run(), /bootstrap.*precede|client/i)
})

test('Firebolt detects escaped native global access in a separate module script', async t => {
  const calls = replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    element + '<script type="module">window["POSITION_\\u0044ATA"]={is_internal:true};</script>') : row)
  await assert.rejects(run(), /script|native data/i)
  assert.ok(!calls.includes(firstURL))
})

test('Firebolt ignores inert JSON referring to native globals', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? clientElement(row, element =>
    '<script type="application/json">{"POSITION_DATA":{"is_internal":true}}</script>' + element) : row)
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].nativeInventory.locatedRolesWithFullContent, 2)
})

test('Firebolt content gate excludes normalized employer boilerplate and a short application prompt', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) {
        post.custom_fields.details.find(f => f.name === 'Description').value = '<section>' + data.COMPANY_DATA.description.toUpperCase() + '</section><p>Apply here!</p>'
      }
    }) : row
  })
  await assert.rejects(run(), /description|content/i)
})

test('Firebolt accepts native India Pune and Maharashtra without changing the source location', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) post.location = {
        ...post.location, name: 'Pune, Maharashtra, India', city: 'Pune', state: 'IN-MH',
      }
    }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Pune')
  assert.equal(jobs[0].state, 'IN-MH')
})

test('Firebolt delta rejects the actual role field company introduction without role content', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) {
        const description = post.custom_fields.details.find(f => f.name === 'Description')
        description.value = description.value.split('<p><strong>About the role</strong></p>')[0]
        post.custom_fields.details.find(f => f.name === 'Requirements').value = ''
      }
    }) : row
  })
  await assert.rejects(run(), /description|content/i)
})

test('Firebolt delta detects a visually hidden executable script changing posting visibility', async t => {
  const calls = replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script hidden>if(POSITION_DATA)POSITION_DATA.is_internal=true;for(const p of COMPANY_POSITIONS_DATA||[])p.is_internal=true;</script>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
  assert.ok(!calls.includes(firstURL))
})

test('Firebolt delta detects constant template literal references to native data', async t => {
  const calls = replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script>if(window[`POSITION_DATA`])window[`POSITION_DATA`].is_internal=true;for(const p of window[`COMPANY_POSITIONS_DATA`]||[])p.is_internal=true;</script>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
  assert.ok(!calls.includes(firstURL))
})

test('Firebolt detects executable scripts inside a visually hidden parent', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<div style="display:none"><script>POSITION_DATA=null;COMPANY_POSITIONS_DATA=[];</script></div>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
})

test('Firebolt does not execute or qualify native changes inside an inert template', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? clientElement(row, element =>
    '<template><script>POSITION_DATA=null;COMPANY_POSITIONS_DATA=[];</script></template>' + element) : row)
  const jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].nativeInventory.observedNativePostings, 3)
})

test('Firebolt detects statically concatenated native global property names', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script>window["POSITION"+"_DATA"]={is_internal:true};</script>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
})

test('Firebolt does not count the employer introduction toward a short role section', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) {
        const description = post.custom_fields.details.find(f => f.name === 'Description')
        description.value = description.value.split('<p><strong>About the role</strong></p>')[0] + '<p><strong>About the role</strong></p><p>Apply here!</p>'
      }
    }) : row
  })
  await assert.rejects(run(), /description|content/i)
})

test('Firebolt followup starts role content after the actual DOM heading rather than earlier prose', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(ACCOUNT) ? native(row, data => {
      for (const post of data.COMPANY_POSITIONS_DATA || [data.POSITION_DATA]) if (post.uid === FIRST) {
        const description = post.custom_fields.details.find(f => f.name === 'Description')
        description.value = '<p>Read about the role below.</p>' + description.value.split('<p><strong>About the role</strong></p>')[0] + '<p><strong>About the role</strong></p><p>Apply here!</p>'
        post.custom_fields.details.find(f => f.name === 'Requirements').value = ''
      }
    }) : row
  })
  await assert.rejects(run(), /description|content/i)
})

test('Firebolt followup inspects module scripts even with the nomodule attribute', async t => {
  const calls = replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script type="module" nomodule>if(POSITION_DATA)POSITION_DATA.is_internal=true;for(const p of COMPANY_POSITIONS_DATA||[])p.is_internal=true;</script>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
  assert.ok(!calls.includes(firstURL))
})

test('Firebolt inspects executable legacy JavaScript MIME types', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script type="text/ecmascript">POSITION_DATA=null;COMPANY_POSITIONS_DATA=[];</script>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
})

test('Firebolt inspects executable legacy language attributes', async t => {
  replay(t, row => row.requestedURL === ACCOUNT ? clientElement(row, element =>
    '<script language="javascript1.5">POSITION_DATA=null;COMPANY_POSITIONS_DATA=[];</script>' + element) : row)
  await assert.rejects(run(), /script|native data/i)
})

test('Firebolt ignores a classic nomodule script in the qualified modern client environment', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? clientElement(row, element =>
    '<script nomodule>POSITION_DATA=null;COMPANY_POSITIONS_DATA=[];</script>' + element) : row)
  const jobs = await run()
  assert.equal(jobs[PROOF].nativeInventory.observedNativePostings, 3)
})

test('Firebolt does not treat a script type with MIME parameters as executable JavaScript', async t => {
  replay(t, row => row.requestedURL.startsWith(ACCOUNT) ? clientElement(row, element =>
    '<script type="text/javascript; charset=utf-8">POSITION_DATA=null;COMPANY_POSITIONS_DATA=[];</script>' + element) : row)
  const jobs = await run()
  assert.equal(jobs[PROOF].nativeInventory.observedNativePostings, 3)
})

test('Firebolt requires an inline bootstrap without even an empty external src attribute', async t => {
  replay(t, row => {
    if (row.requestedURL !== ACCOUNT) return row
    const { html, script } = assignments(row)
    return clientElement({ ...row, body: Buffer.from(html.replace(script.raw, '')) }, element => '<script src="">' + script.raw + '</script>' + element)
  })
  await assert.rejects(run(), /bootstrap|script/i)
})
