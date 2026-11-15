import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {decodeHTMLStrict} from 'entities'
import Job from '../../src/models/Job.js'
import {getSourceDescription} from '../../src/utils/jobSourceContent.js'
import {createNetomiScraper, run} from './script.js'
import {admitNetomiEntityBytes, NETOMI_NATIVE_LIMITS} from './nativeText20261115.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {plain} from '../../scraper-support/native-sources/declaredJobFeeds/nativeData.js'
import {fixture, replayNative, withReplayClock, ids, boardURL, feedURL, nativeFeed} from './fixtures/replayNative20261115.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const original = url => Buffer.from(fixture.captures.find(row => row.bodyBase64 && (row.receipt.requestedUrl ?? row.receipt.requestedURL) === url).bodyBase64, 'base64')
// Diagnostic test offsets derive from each original byte stream, never runtime admissions.
const reviewed = {htmlEntities: Object.fromEntries([boardURL, ...ids.map(id => boardURL + '/' + id)].map(url => {
  const raw = original(url), text = raw.toString('latin1'), pair = /window\.__CF\$cv\$params=\{r:'([^']+)',t:'([^']+)'/.exec(text)
  return [url, {slots: [{byteOffset: pair.index + pair[0].indexOf(pair[1]), byteLength: 16},
    {byteOffset: pair.index + pair[0].indexOf(pair[2]), byteLength: 16}, {byteOffset: text.indexOf('?ray=') + 5, byteLength: 16}]}]
}))}
const roleURL = boardURL + '/' + ids[0]
const collect = (t, replay, options = {}) => withReplayClock(t, () => run({...replay.options, ...options}))
const caught = async operation => {try {await operation()} catch (error) {return error} assert.fail('A held native observation must reject')}

const livePacket = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/netomi-live-durability-20261115.json.gz', import.meta.url))))
const liveReplay = (edit = (url, text) => text, lookupURL = url => url) => {
  const calls = [], uses = new Map()
  return {calls, options: {fetchImpl: async (url, init) => {
    const occurrence = uses.get(url) ?? 0; uses.set(url, occurrence + 1)
    const original = livePacket.captures.filter(row => row.receipt.requestedUrl === lookupURL(url))[occurrence]
    assert.ok(original, 'Only an actual accepted22 response may be replayed: ' + url)
    const bytes = Buffer.from(original.bodyBase64, 'base64')
    assert.equal(sha(bytes), original.originalEntitySHA256)
    const changed = edit(url, bytes.toString('utf8'), occurrence)
    calls.push({url, init, occurrence, synthetic: url !== original.receipt.requestedUrl || changed !== bytes.toString('utf8')})
    const response = new Response(changed, {status: original.receipt.status, headers: original.receipt.headers})
    Object.defineProperty(response, 'url', {value: url})
    return response
  }}}
}

test('durability accepts a complete consistent Unicode title and longer criteria update without another reviewed example', async t => {
  const oldTitle = nativeFeed.find(row => row.id === ids[0]).text
  const title = 'प्रमुख Engineer — 東京 🛰️ / Développement'
  const replay = liveReplay((_url, text) => text.replaceAll(oldTitle, title)
    .replaceAll('Netomi is the leading', 'Netomi is the pioneering enterprise conversational platform, supporting complex multilingual workflows and comprehensive customer operations, and the leading'))
  const jobs = await collect(t, replay, {maxJobs: 1})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, title)
  assert.ok(jobs[0].sourceNativeRecord.description.includes('complex multilingual workflows'))
})

test('genuine accepted22 packet binds every receipt URL/status and exact complete body hash without historical closing reuse', async t => {
  assert.equal(livePacket.provenance.synthetic, false)
  assert.equal(livePacket.captures.length, 22)
  let bytes = 0
  for (const capture of livePacket.captures) {
    const raw = Buffer.from(capture.bodyBase64, 'base64')
    assert.equal(capture.receipt.status, 200)
    assert.equal(capture.receipt.requestedUrl, capture.receipt.url)
    assert.equal(raw.length, capture.receipt.bytes)
    assert.equal(sha(raw), capture.receipt.sha256)
    assert.equal(sha(raw), capture.originalEntitySHA256)
    bytes += raw.length
  }
  assert.equal(bytes, 14944124)
  const replay = liveReplay(), jobs = await collect(t, replay)
  assert.equal(jobs.length, 9)
  assert.equal(replay.calls.length, 22)
  assert.ok(replay.calls.every(call => !call.synthetic))
  assert.deepEqual(new Set(jobs.map(job => job.sourceNativeRecord.lists.length)), new Set([2, 3, 5]))
  const independentEmpty = jobs.find(job => job.sourceNativeRecord.descriptionBodyPlain === '')
  assert.ok(independentEmpty.sourceNativeRecord.descriptionBody.length > 1000)
  assert.match(jobs.sourceAudit.observations.find(row => row.id === independentEmpty.jobId).opening.originalHTML, /<meta name="twitter:description" content="">/)
})

test('synthetic supported UUID and current native calendar change owns returned URLs and exact millisecond precision', async t => {
  const old = nativeFeed.find(row => row.id === ids[0]), newId = 'ac541e12-1234-4567-89ab-cdef01234567'
  const stamp = Date.parse('2026-11-01T12:34:56.789Z'), originalDay = new Date(old.createdAt).toISOString().slice(0, 10)
  const replay = liveReplay((url, text) => {
    text = text.replaceAll(old.id, newId)
    if (url === feedURL) text = text.replaceAll(String(old.createdAt), String(stamp))
    if (url.endsWith(newId)) text = text.replace('"' + originalDay + '"', '"2026-11-01"')
    return text
  }, url => url.replace(newId, old.id))
  const jobs = await collect(t, replay, {maxJobs: 1})
  assert.equal(jobs[0].jobId, newId)
  assert.equal(jobs[0].sourceUrl, boardURL + '/' + newId)
  assert.equal(jobs[0].applyUrl, boardURL + '/' + newId + '/apply')
  assert.equal(jobs[0].sourcePostingDate, stamp)
  assert.equal(jobs[0].postingDate, '2026-11-01T12:34:56.789Z')
  assert.equal(jobs[0].sourceNativeStructuredDatePosted, '2026-11-01')
  assert.ok(replay.calls.every(call => !call.url.endsWith('/apply')))
  assert.equal(replay.calls.filter(call => call.url.endsWith(newId)).length, 2)
})

// Independent byte-range editing for synthetic packets. This emitter does not
// import the runtime profile or any matcher/parser function under test.
const ownedElement = (text, prefix, tag = 'div', from = 0) => {
  const start = text.indexOf(prefix, from); assert.ok(start >= 0, 'Synthetic owner must exist: ' + prefix)
  const tokens = new RegExp('</?' + tag + '\\b[^>]*>', 'g'); tokens.lastIndex = start
  let depth = 0, token
  while ((token = tokens.exec(text))) {
    depth += token[0].startsWith('</') ? -1 : 1
    if (!depth) return {start, end: tokens.lastIndex, raw: text.slice(start, tokens.lastIndex)}
  }
  assert.fail('Synthetic element must be complete')
}
const removeElement = (text, prefix, tag) => {const span = ownedElement(text, prefix, tag); return text.slice(0, span.start) + text.slice(span.end)}
const htmlEscape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

test('synthetic current removal consumes changed card/group/department-option counts without saved inventory keys', async t => {
  const removed = nativeFeed.find(row => row.categories.department === 'People & Culture')
  const replay = liveReplay((url, text) => {
    if (url === feedURL) return JSON.stringify(JSON.parse(text).filter(row => row.id !== removed.id))
    if (url === boardURL) {
      text = removeElement(text, '<div class="postings-group"><div class="large-category-header">People &amp; Culture')
      return removeElement(text, '<li class="group-item" role="group" aria-label="People &amp; Culture"', 'li')
    }
    return text
  })
  const jobs = await collect(t, replay)
  assert.equal(jobs.length, 9)
  assert.equal(jobs.sourceAudit.observedRecordCount, 20)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 11)
  assert.ok(!jobs.sourceAudit.observations.some(row => row.id === removed.id))
})

test('synthetic changed full Unicode categories bind current nested department/team options, card labels and worksite carriers', async t => {
  const replacements = [['Global Services & Delivery', 'ग्राहक Services & Delivery'], ['Agentic Delivery', 'Applied AI & Automation'], ['Gurugram', 'Pune, India']]
  const rewrite = value => typeof value === 'string' ? replacements.reduce((out, [old, next]) => out.replaceAll(old, next), value)
    : Array.isArray(value) ? value.map(rewrite) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, part]) => [key, rewrite(part)])) : value
  const replay = liveReplay((url, text) => {
    if (url === feedURL) return JSON.stringify(rewrite(JSON.parse(text)))
    // Current server uses canonical RFC3986 UTF8 in query slots and HTML escaping in human scalars.
    for (const [old, next] of replacements) {
      text = text.replaceAll('=' + encodeURIComponent(old), '=' + encodeURIComponent(next))
      text = text.replaceAll(htmlEscape(old), htmlEscape(next))
    }
    return text
  })
  const jobs = await collect(t, replay, {maxJobs: 2})
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].sourceNativeRecord.categories.team, 'Applied AI & Automation')
  assert.equal(jobs[1].location, 'Pune, India')
  assert.equal(jobs[1].sourceNativeJobPosting.jobLocation.address.addressLocality, 'Pune, India')
})

test('synthetic tenth supported IN row remains observed and unhydrated under the original actual nine-pair capacity', async t => {
  const base = nativeFeed.find(row => row.id === ids[0]), newId = 'ac541e12-1234-4567-89ab-cdef01234568'
  const extra = {...structuredClone(base), id: newId, text: 'Additional supported current role', hostedUrl: boardURL + '/' + newId, applyUrl: boardURL + '/' + newId + '/apply'}
  const replay = liveReplay((url, text) => {
    if (url === feedURL) {const rows = JSON.parse(text); rows.push(extra); return JSON.stringify(rows)}
    if (url === boardURL) {
      const originalCard = ownedElement(text, '<div class="posting" data-qa-posting-id="' + base.id + '"')
      const card = originalCard.raw.replaceAll(base.id, newId).replaceAll(base.text, extra.text)
      return text.slice(0, originalCard.end) + card + text.slice(originalCard.end)
    }
    return text
  })
  const jobs = await collect(t, replay)
  assert.equal(jobs.length, 9)
  assert.equal(jobs.sourceAudit.observedRecordCount, 22)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 13)
  assert.equal(replay.calls.length, 22)
  assert.ok(replay.calls.every(call => !call.url.includes(newId)))
})

test('synthetic ordinary complete AI business text changes remain retained and close in standard sourceDescription', async t => {
  const replay = liveReplay((url, text) => url === roleURL ? text.replace('We may use artificial intelligence', 'Our hiring team may use artificial intelligence') : text)
  const jobs = await collect(t, replay, {maxJobs: 1})
  assert.ok(jobs[0].sourceAuthoredAIHiringNotice.startsWith('Our hiring team'))
  assert.ok(getSourceDescription(new Job(jobs[0]).toObject()).includes('Our hiring team'))
})

test('synthetic native key order and raw Unicode escapes survive strict standard persistence without object reserialization', async t => {
  const replay = liveReplay((url, text) => {
    if (url !== feedURL) return text
    const rows = JSON.parse(text).map(row => Object.fromEntries(Object.entries(row).reverse()))
    return JSON.stringify(rows).replace('Agentic Engineer Level', '\\u0041gentic Engineer Level')
  })
  const jobs = await collect(t, replay, {maxJobs: 1})
  const standard = new Job(jobs[0]).toObject(), persisted = getSourceDescription(standard)
  const raw = decodeHTMLStrict(/<pre data-carrier="native-row">([\s\S]*?)<\/pre>/.exec(persisted)[1])
  assert.ok(raw.startsWith('{"applyUrl":'))
  assert.ok(raw.includes('\\u0041gentic Engineer Level'))
  assert.deepEqual(JSON.parse(raw), jobs[0].sourceNativeRecord)
  assert.ok(persisted.startsWith(jobs[0].sourceNativeRecord.description))
})

const heldEdit = (name, target, edit, reason) => test('complete current matcher rejects ' + name, async t => {
  let applied = false
  const replay = liveReplay((url, text, occurrence) => {
    if (url !== target) return text
    const changed = edit(text, occurrence); assert.notDeepEqual(changed, text, 'Mutation must affect an actual original'); applied = true; return changed
  })
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.ok(applied)
  const audit = error.nativeCollectionEvidence
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  if (reason) assert.match([error.message, ...audit.issues.map(row => row.issue)].join('\n'), reason)
})
for (const [name, edit] of [
  ['duplicate decoded JSON row key', text => text.replace('"id":', '"i\\u0064":"duplicate","id":')],
  ['extra native key', text => text.replace('[{', '[{"salaryDescription":"unknown",')],
  ['null native string', text => text.replace(/"country":"IN"/, '"country":null')],
  ['noncanonical native epoch spelling', text => text.replace(/"createdAt":(\d+)/, '"createdAt":$1.0')],
  ['unsafe native epoch', text => text.replace(/"createdAt":\d+/, '"createdAt":9007199254740993')],
  ['trailing JSON token', text => text + ' null'],
  ['object literal instead of JSON', text => text.replace('"additionalPlain":', 'additionalPlain:')],
  ['lone escaped Unicode surrogate', text => text.replace(/"country":"IN"/, '"country":"\\ud800"')],
  ['invalid original feed UTF8', text => Buffer.concat([Buffer.from(text.slice(0, -1)), Buffer.from([0xff])])],
  ['extra list object key', text => {const rows = JSON.parse(text); rows[0].lists[0].type = 'new'; return JSON.stringify(rows)}],
  ['missing category field', text => {const rows = JSON.parse(text); delete rows[0].categories.team; return JSON.stringify(rows)}],
  ['plain carrier HTML', text => {const rows = JSON.parse(text); rows[0].descriptionPlain += '<a href="https://other.invalid">Hidden condition</a>'; return JSON.stringify(rows)}],
]) heldEdit(name, feedURL, edit)

for (const [name, edit] of [
  ['duplicate current board card', text => {const card = ownedElement(text, '<div class="posting" data-qa-posting-id="'); return text.slice(0, card.end) + card.raw + text.slice(card.end)}],
  ['missing current board card', text => removeElement(text, '<div class="posting" data-qa-posting-id="')],
  ['duplicate current department group', text => {const group = ownedElement(text, '<div class="postings-group">'); return text.slice(0, group.end) + group.raw + text.slice(group.end)}],
  ['missing current group', text => removeElement(text, '<div class="postings-group">')],
  ['missing leading department declaration', text => removeElement(text, '<div class="large-category-header">')],
  ['duplicate location option', text => {const option = ownedElement(text, '<li><a class="category-link" href="?location=', 'li'); return text.slice(0, option.end) + option.raw + text.slice(option.end)}],
  ['missing team option', text => removeElement(text, '<li><a class="category-link" href="?department=', 'li')],
  ['extra filter option attribute', text => text.replace('href="?location=Gurugram"', 'data-extra="1" href="?location=Gurugram"')],
  ['changed invariant nested noscript filter style', text => text.replace('<noscript><style type="text/css">', '<noscript><style type="text/css"> ')],
  ['changed group ancestor attribute', text => text.replace('<div class="postings-group">', '<div class="postings-group" hidden>')],
]) heldEdit(name, boardURL, edit)

for (const [name, edit] of [
  ['duplicate schema owner', text => {const script = /<script type="application\/ld\+json">[\s\S]*?<\/script>/.exec(text)[0]; return text.replace(script, script + script)}],
  ['decoded duplicate schema key', text => text.replace('"title" :', '"\\u0074itle":"extra","title" :')],
  ['extra JobPosting key', text => text.replace('"datePosted" :', '"validThrough":"2099-01-01","datePosted" :')],
  ['missing AI owner', text => removeElement(text, '<div class="section page-centered" data-qa="ai-disclaimer">')],
  ['duplicate AI owner', text => {const ai = ownedElement(text, '<div class="section page-centered" data-qa="ai-disclaimer">'); return text.slice(0, ai.end) + ai.raw + text.slice(ai.end)}],
  ['duplicate criteria list owner', text => {const list = ownedElement(text, '<div class="section page-centered"><div><h3>'); return text.slice(0, list.end) + list.raw + text.slice(list.end)}],
  ['missing criteria list owner', text => removeElement(text, '<div class="section page-centered"><div><h3>')],
  ['new criteria link', text => text.replace('About the role', 'About the <a href="https://other.invalid">role</a>')],
  ['new criteria media', text => text.replace('About the role', 'About the role<img src="https://other.invalid/criteria.png">')],
  ['new criteria attribute', text => text.replace('<span style="font-size: 16px;">', '<span style="font-size: 16px;" data-extra="x">')],
]) heldEdit(name, roleURL, edit)

const noticeReplay = (notice, plainNotice) => liveReplay((url, text) => {
  if (url === feedURL) {
    const rows = JSON.parse(text), row = rows.find(row => row.id === ids[0]); row.additional += notice; row.additionalPlain += plainNotice
    return JSON.stringify(rows)
  }
  if (url !== roleURL) return text
  const owner = ownedElement(text, '<div class="section page-centered" data-qa="closing-description">')
  text = text.slice(0, owner.end - 6) + notice + text.slice(owner.end - 6)
  const schema = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(text), model = JSON.parse(schema[1])
  const updated = schema[1].replace(JSON.stringify(model.description), JSON.stringify(model.description + notice.replaceAll('<div>', '<p>').replaceAll('</div>', '</p>')))
  return text.replace(schema[1], updated)
})

for (const [name, richNotice, plainNotice] of [
  ['reported foreign Location label', '<div>Location: US.</div>', 'Location: US.'],
  ['unknown labelled worksite', '<div>Location: Unspecified.</div>', 'Location: Unspecified.'],
  ['conflicting India Location label', '<div>Location: Pune, India.</div>', 'Location: Pune, India.'],
  ['BR split Location label', '<div>Loca<br>tion: US.</div>', 'Loca tion: US.'],
  ['entity split Location label', '<div>Locat&#105;on: US.</div>', 'Location: US.'],
]) test('review round1 holds ' + name + ' across consistent full current carriers', async t => {
  const replay = noticeReplay(richNotice, plainNotice)
  let error, returned
  try {returned = await collect(t, replay, {maxJobs: 1})} catch (caught) {error = caught}
  assert.ok(error, 'Conflicting Location must hold; returned ' + returned?.length + ' complete India roles after ' + replay.calls.length + ' reads')
  const audit = error.nativeCollectionEvidence
  assert.match(audit.issues.map(row => row.issue).join('\n'), /Explicit worksite clause conflicts/)
  assert.equal(replay.calls.length, 5)
  assert.equal(audit.nativeInventoryPairComplete, true)
  assert.equal(audit.qualifiedNativeRecordCount, 0)
  assert.equal(audit.returnedNativeIndiaTextRecords, 0)
  assert.ok(audit.rawPages.find(page => page.kind === 'role').originalEntityReviewed)
  const originalRow = audit.opening.fullNativeFeed.find(row => row.id === ids[0])
  assert.ok(originalRow.additional.endsWith(richNotice))
  assert.ok(originalRow.additionalPlain.endsWith(plainNotice))
})

const round1CurrentLocation = nativeFeed.find(row => row.id === ids[0]).categories.location
for (const [name, richNotice, plainNotice] of [
  ['sole current Location label', '<div>Location: ' + round1CurrentLocation + '.</div>', 'Location: ' + round1CurrentLocation + '.'],
  ['BR split sole current Location label', '<div>Loca<br>tion: ' + round1CurrentLocation + '.</div>', 'Loca tion: ' + round1CurrentLocation + '.'],
  ['ordinary nonlocation pronoun', '<div>Please contact us.</div>', 'Please contact us.'],
]) test('review round1 preserves ' + name + ' with complete raw criteria and current closure', async t => {
  const replay = noticeReplay(richNotice, plainNotice), jobs = await collect(t, replay, {maxJobs: 1})
  assert.equal(jobs.length, 1)
  assert.equal(replay.calls.length, 6)
  assert.equal(jobs[0].countryCode, 'IN')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs.sourceAudit.nativeInventoryPairComplete, true)
  assert.equal(jobs.sourceAudit.qualifiedNativeRecordCount, 1)
  assert.ok(jobs[0].sourceNativeRecord.additional.endsWith(richNotice))
  assert.ok(jobs[0].sourceNativeRecord.additionalPlain.endsWith(plainNotice))
  assert.ok(getSourceDescription(new Job(jobs[0]).toObject()).includes(plainNotice))
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [name, richNotice, plainNotice, reason] of [
  ['BR split closure', '<div>This position is<br>closed.</div>', 'This position is closed.', /closed\/filled/],
  ['entity split closure', '<div>This role is c&#108;osed.</div>', 'This role is closed.', /closed\/filled/],
  ['BR split mixed foreign clause', '<div>This role is based in United<br>States; India is also listed.</div>', 'This role is based in United States; India is also listed.', /foreign country/],
  ['entity split mixed foreign clause', '<div>Worksite: Unit&#101;d States; India.</div>', 'Worksite: United States; India.', /foreign country/],
  ['additional India worksite', '<div>Secondary worksite: Pune, India.</div>', 'Secondary worksite: Pune, India.', /worksite/],
  ['explicit labelled foreign ISO country', '<div>Country: US.</div>', 'Country: US.', /country/],
  ['BR split foreign ISO country label', '<div>Coun<br>try: US.</div>', 'Coun try: US.', /country/],
  ['contradictory explicit India worksite', '<div>This role is based in Pune, India.</div>', 'This role is based in Pune, India.', /worksite/],
  ['ordinary intake notice', '<div>This posting is an expression of interest for future opportunities.</div>', 'This posting is an expression of interest for future opportunities.', /intake/],
]) test('current complete role-owned carriers hold ' + name, async t => {
  const replay = noticeReplay(richNotice, plainNotice)
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.match(error.nativeCollectionEvidence.issues.map(row => row.issue).join('\n'), reason)
})

test('a future native timestamp with a consistently future current schema day remains held', async t => {
  const old = nativeFeed.find(row => row.id === ids[0]), stamp = Date.parse('2099-01-01T12:34:56.789Z')
  const replay = liveReplay((url, text) => url === feedURL ? text.replaceAll(String(old.createdAt), String(stamp))
    : url === roleURL ? text.replace('"' + new Date(old.createdAt).toISOString().slice(0, 10) + '"', '"2099-01-01"') : text)
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.match(error.nativeCollectionEvidence.issues[0].issue, /future publication/)
})

test('company boilerplate cannot qualify a newly shrunken current body and one-word criteria sections', async t => {
  const native = structuredClone(nativeFeed.find(row => row.id === ids[0]))
  native.descriptionBody = '<div>Work.</div>'; native.descriptionBodyPlain = 'Work.'
  native.description = native.opening + '<div><br></div>' + native.descriptionBody
  native.descriptionPlain = native.openingPlain + 'Work.'
  native.lists = native.lists.map(section => ({text: section.text, content: '<li>Work.</li>'}))
  const sectionHTML = native.lists.map(section => '<div class="section page-centered"><div><h3>' + htmlEscape(section.text)
    + '</h3><div class="posting-requirements plain-list" data-qa="posting-requirements"><div><ul><li>Work.</li></ul></div></div></div></div>').join('')
  const toP = value => value.replaceAll('<div>', '<p>').replaceAll('</div>', '</p>')
  let schemaDescription = toP(native.description) + '\\n<p></p><p><br></p>'
  native.lists.forEach((section, index) => {schemaDescription += (index ? '<p><br></p>' : '') + '<b>' + htmlEscape(section.text) + '</b><ul><li>Work.</li></ul>'})
  schemaDescription += '<p><br></p><p></p>\\n' + toP(native.additional)
  const replay = liveReplay((url, text) => {
    if (url === feedURL) return JSON.stringify(JSON.parse(text).map(row => row.id === native.id ? native : row))
    if (url !== roleURL) return text
    const owner = ownedElement(text, '<div class="section page-centered" data-qa="job-description">')
    text = text.slice(0, text.indexOf('>', owner.start) + 1) + native.description + text.slice(owner.end - 6)
    const first = ownedElement(text, '<div class="section page-centered"><div><h3>')
    let end = first.end
    for (let index = 1; index < native.lists.length; index++) end = ownedElement(text, '<div class="section page-centered"><div><h3>', 'div', end).end
    text = text.slice(0, first.start) + sectionHTML + text.slice(end)
    text = text.replace(/(<meta name="twitter:description" content=")[^"]*(")/, '$1Work.$2')
      .replace(/(<meta property="og:description" content=")[^"]*(")/, '$1Work.$2')
    const schema = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(text), model = JSON.parse(schema[1])
    return text.replace(schema[1], schema[1].replace(JSON.stringify(model.description), JSON.stringify(schemaDescription)))
  })
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.match(error.nativeCollectionEvidence.issues[0].issue, /Substantive.*role criteria/)
})

test('intrinsic sliced original byte offsets and lengths determine real bytes even with poisoned own getters', async t => {
  const replay = replayNative({mutate: (_url, entity) => {
    const packed = new Uint8Array(entity.bytes.length + 19); packed.set(entity.bytes, 7)
    const view = new Uint8Array(packed.buffer, 7, entity.bytes.length)
    for (const name of ['byteLength', 'byteOffset', 'buffer']) Object.defineProperty(view, name, {get() {throw Error('Poisoned own ' + name)}})
    let delivered = false
    return {...entity, response: {status: 200, url: entity.responseURL, redirected: false, headers: new Headers(entity.headers),
      body: {getReader: () => ({read: async () => delivered ? {done: true} : (delivered = true, {done: false, value: view}), cancel() {}, releaseLock() {}})}}}
  }})
  const jobs = await collect(t, replay, {maxJobs: 0})
  assert.equal(replay.calls.length, 4)
  assert.ok(jobs.sourceAudit.rawPages.every(page => page.entityComplete && page.originalEntityReviewed))
  assert.equal(jobs.sourceAudit.originalEntityBytes, jobs.sourceAudit.rawPages.reduce((sum, page) => sum + Buffer.from(page.bodyBase64, 'base64').length, 0))
})

for (const [name, url, edit] of [
  ['feed-equivalent whitespace', feedURL, text => ' ' + text],
  ['schema-equivalent escaped business string', roleURL, text => text.replace('"title" : "Agentic', '"title" : "\\u0041gentic')],
  ['current board order with the same exact cards', boardURL, text => {
    const first = ownedElement(text, '<div class="posting" data-qa-posting-id="')
    const second = ownedElement(text, '<div class="posting" data-qa-posting-id="', 'div', first.end)
    return text.slice(0, first.start) + second.raw + first.raw + text.slice(second.end)
  }],
]) test('whole raw current closure rejects ' + name + ' drift despite unchanged parsed business facts', async t => {
  let changed = false
  const replay = liveReplay((target, text, occurrence) => {
    if (target !== url || occurrence !== 1) return text
    const result = edit(text); assert.notEqual(result, text); changed = true; return result
  })
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.ok(changed)
  assert.match([error.message, ...error.nativeCollectionEvidence.issues.map(row => row.issue)].join('\n'), /Closing complete raw/)
})

test('actual reduced read capacity reserves the final two current inventory reads after two complete role pairs', async t => {
  const replay = liveReplay(), jobs = await collect(t, replay, {maxRequests: 8})
  assert.equal(jobs.length, 2)
  assert.equal(replay.calls.length, 8)
  assert.deepEqual(replay.calls.slice(-2).map(call => call.url), [boardURL, feedURL])
  assert.equal(jobs.sourceAudit.qualifiedNativeRecordCount, 2)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 19)
  assert.ok(jobs.sourceAudit.observations.filter(row => !row.sourceNativeDataIdentityQualified).every(row => row.heldReason || row.issue))
})

test('actual conservative byte capacity preserves closing inventory instead of starting an unfunded second pair', async t => {
  const replay = liveReplay(), jobs = await collect(t, replay, {maxAggregateBytes: 5 * 1048576})
  assert.equal(jobs.length, 1)
  assert.equal(replay.calls.length, 6)
  assert.deepEqual(replay.calls.slice(-2).map(call => call.url), [boardURL, feedURL])
  assert.ok(jobs.sourceAudit.originalEntityBytes < 5 * 1048576)
})

test('early timer wakes reschedule until monotonic pacing and source deadlines actually expire', async t => {
  let elapsed, reads = 0
  const error = await caught(() => withReplayClock(t, async () => {
    const timer = globalThis.setTimeout, start = performance.now()
    const hook = t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => timer(callback, Math.max(1, Math.floor(ms / 2)), ...args))
    try {return await run({sourceTimeoutMs: 1000, requestTimeoutMs: 1000, fetchImpl: () => {reads++; return new Promise(() => {})}})}
    finally {elapsed = performance.now() - start; hook.mock.restore()}
  }))
  assert.match(error.message, /deadline/)
  assert.equal(reads, 1)
  assert.ok(elapsed >= 1000 && elapsed <= 1100, 'An early timer cannot shorten the monotonic source budget')
})

test('early pacing wakes never start a physical same-origin request before 500ms', async t => {
  const starts = [], replay = liveReplay((url, text) => {starts.push({origin: new URL(url).origin, time: performance.now()}); return text})
  await withReplayClock(t, async () => {
    const timer = globalThis.setTimeout
    const hook = t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => timer(callback, Math.max(1, Math.floor(ms / 2)), ...args))
    try {return await run({...replay.options, maxJobs: 1})} finally {hook.mock.restore()}
  })
  for (const [index, start] of starts.entries()) {
    const previous = starts.slice(0, index).findLast(row => row.origin === start.origin)
    if (previous) assert.ok(start.time - previous.time >= 500)
  }
  assert.equal(replay.calls.length, 6)
})

test('a final records observer crossing the source deadline cannot return apparently qualified jobs', async t => {
  const replay = liveReplay()
  const error = await caught(() => collect(t, replay, {maxJobs: 1, sourceTimeoutMs: 10000, onRecords: () => t.mock.timers.tick(10001)}))
  assert.match(error.message, /Source deadline/)
  assert.equal(replay.calls.length, 6)
})

test('early timer wakes also preserve the independent monotonic 15s request ceiling reduction', async t => {
  let elapsed, reads = 0
  const error = await caught(() => withReplayClock(t, async () => {
    const timer = globalThis.setTimeout, start = performance.now()
    const hook = t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => timer(callback, Math.max(1, Math.floor(ms / 2)), ...args))
    try {return await run({sourceTimeoutMs: 4000, requestTimeoutMs: 1000, fetchImpl: () => {reads++; return new Promise(() => {})}})}
    finally {elapsed = performance.now() - start; hook.mock.restore()}
  }))
  assert.match(error.message, /request deadline/)
  assert.equal(reads, 1)
  assert.ok(elapsed >= 1000 && elapsed <= 1100)
})

test('complete raw authored AI entity spellings survive strict sourceDescription after sidecar removal', async t => {
  const replay = liveReplay((url, text) => url === roleURL ? text.replace('We may use artificial intelligence', 'We may use artificial intellige&#110;ce') : text)
  const jobs = await collect(t, replay, {maxJobs: 1}), persisted = getSourceDescription(new Job(jobs[0]).toObject())
  const raw = decodeHTMLStrict(/<pre data-carrier="authored-list-ai">([\s\S]*?)<\/pre>/.exec(persisted)[1])
  const authored = JSON.parse(raw)
  assert.ok(authored.rawAINotice.includes('intellige&#110;ce'))
  assert.ok(authored.aiNotice.includes('intelligence'))
})

test('current time reservation stops role selection while preserving successful complete closing inventory', async t => {
  const replay = liveReplay((url, text) => {if (url.startsWith(boardURL + '/')) t.mock.timers.tick(1500); return text})
  const jobs = await collect(t, replay, {sourceTimeoutMs: 16000})
  assert.ok(jobs.length >= 1 && jobs.length < 9)
  assert.ok(replay.calls.length < 22)
  assert.deepEqual(replay.calls.slice(-2).map(call => call.url), [boardURL, feedURL])
  assert.equal(jobs.sourceAudit.nativeInventoryPairComplete, true)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount + jobs.length, 21)
  assert.ok(jobs.sourceAudit.issues.some(row => /reservation|deadline/.test(row.issue)))
})

test('durability accepts current native order changes while preserving independent board group order', async t => {
  const replay = liveReplay((url, text) => {
    if (url !== feedURL) return text
    // Order is an independent native business value; the board keeps its own grouping order.
    return JSON.stringify(JSON.parse(text).reverse())
  })
  const jobs = await collect(t, replay, {maxJobs: 1})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, [...nativeFeed].reverse().find(row => row.country === 'IN').id)
})

globalThis.fetch = async () => {throw Error('Network is forbidden; genuine original full Responses only')}
for (const [name, start] of [
  ['factory', options => createNetomiScraper().run(options)],
  ['run', options => run(options)],
  ['registered', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'netomi')).run(options)],
]) test(name + ' retains nine own-native India text observations in the explicitly labelled complete-pair protocol replay', async t => {
  const replay = replayNative({reuseMissingClosing: true})
  const jobs = await withReplayClock(t, () => start(replay.options))
  assert.equal(jobs.length, 9)
  assert.deepEqual(jobs.map(job => job.jobId), ids)
  assert.ok(jobs.every(job => job.sourceNativeDataIdentityQualified && job.sourceCorporateBindingQualified === false && job.sourceFormalLegalEntityQualified === false))
  assert.ok(jobs.every(job => job.sourceOwnDetailAPIVisited === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.ok(replay.calls.every(call => !call.url.startsWith('https://api.lever.co/v0/postings/netomi/')))
  assert.ok(replay.calls.some(call => call.replayReuse), 'Missing historical closing is explicitly labelled replay reuse, never invented evidence')
  assert.equal(fixture.captures.filter(row => row.bodyBase64 === null).length, 2)
})

test('the genuine corpus retains all 98 original bodies and both actual failed attempts', () => {
  assert.equal(fixture.captures.length, 100)
  const entities = fixture.captures.filter(row => row.bodyBase64 !== null)
  assert.equal(entities.length, 98)
  for (const row of entities) assert.equal(sha(Buffer.from(row.bodyBase64, 'base64')), row.originalEntitySHA256, row.evidenceId)
  assert.equal(fixture.captures.filter(row => row.bodyBase64 === null).length, 2)
})

for (const [url, contract] of Object.entries(reviewed.htmlEntities)) test('the complete original segments admit every genuine observation only for ' + url, () => {
  const rows = fixture.captures.filter(row => row.bodyBase64 && (row.receipt.requestedUrl ?? row.receipt.requestedURL) === url)
  assert.ok(rows.length)
  for (const row of rows) assert.equal(admitNetomiEntityBytes(url, Buffer.from(row.bodyBase64, 'base64')), Buffer.from(row.bodyBase64, 'base64').toString('utf8'))
  assert.equal(contract.slots.length, 3)
})

test('a canonical coupled CF data variation preserves every immutable byte without becoming a role date', async t => {
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => {
    const contract = reviewed.htmlEntities[url]
    if (!contract) return entity
    const bytes = Buffer.from(entity.bytes), [r, time, mirrored] = contract.slots
    bytes.write('0123456789abcdef', r.byteOffset, 'ascii')
    bytes.write(Buffer.from('9999999999').toString('base64'), time.byteOffset, 'ascii')
    bytes.write('0123456789abcdef', mirrored.byteOffset, 'ascii')
    return {...entity, bytes}
  }})
  const jobs = await collect(t, replay, {maxJobs: 1})
  assert.equal(jobs[0].sourcePostingDate, nativeFeed.find(row => row.id === ids[0]).createdAt)
  assert.equal(jobs[0].closingDate, null)
  assert.equal(replay.calls.length, 6)
})

for (const [name, mutate] of [
  ['mismatched mirrored ray', (raw, slots) => raw.write('0123456789abcdef', slots[0].byteOffset, 'ascii')],
  ['uppercase ray', (raw, slots) => {raw.write('ABCDEF0123456789', slots[0].byteOffset, 'ascii'); raw.write('ABCDEF0123456789', slots[2].byteOffset, 'ascii')}],
  ['executable ray', (raw, slots) => raw.write("'+alert(1);//xxxx", slots[0].byteOffset, 'ascii')],
  ['noncanonical base64', (raw, slots) => raw.write('MTc5NDY3NTgxNx==', slots[1].byteOffset, 'ascii')],
  ['nondigit timing', (raw, slots) => raw.write(Buffer.from('abcdefghij').toString('base64'), slots[1].byteOffset, 'ascii')],
  ['invalid UTF8 timing', (raw, slots) => {raw[slots[1].byteOffset] = 0xff}],
  ['high byte ray', (raw, slots) => {raw[slots[0].byteOffset] |= 0x80; raw[slots[2].byteOffset] |= 0x80}],
  ['valid UTF8 masquerading as ASCII hex', (raw, slots) => {for (const slot of [slots[0], slots[2]]) Buffer.from([0xe1, 0xb1, 0xb2]).copy(raw, slot.byteOffset)}],
]) test('raw slot admission rejects ' + name, () => {
  const raw = original(roleURL)
  mutate(raw, reviewed.htmlEntities[roleURL].slots)
  assert.throws(() => admitNetomiEntityBytes(roleURL, raw), /coverage gap/i)
})

for (const [name, edit] of [
  ['BOM', bytes => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])],
  ['truncation', bytes => bytes.subarray(0, bytes.length - 1)],
  ['same-size original byte change', bytes => {const raw = Buffer.from(bytes); raw[400] ^= 1; return raw}],
  ['invalid original UTF8', bytes => {const raw = Buffer.from(bytes); raw[400] = 0xff; return raw}],
  ['new external program', bytes => Buffer.from(bytes.toString().replace('</body>', '<script src="https://other.invalid/current.js"></script></body>'))],
  ['changed static analytics program', bytes => Buffer.from(bytes.toString().replace('var gaCode = "";', 'var gaCode = "x";'))],
  ['changed nested CF program', bytes => Buffer.from(bytes.toString().replace('document.createElement(\'iframe\')', 'document.createElement(\'script\')'))],
  ['new inline style', bytes => Buffer.from(bytes.toString().replace('</head>', '<style>.content:after{content:"New mandatory qualification"}</style></head>'))],
  ['hidden criteria ancestor', bytes => Buffer.from(bytes.toString().replace('<body', '<body hidden'))],
  ['changed CSS activation', bytes => Buffer.from(bytes.toString().replace('<body', '<body class="invisible"'))],
  ['unknown template carrier', bytes => Buffer.from(bytes.toString().replace('</body>', '<template><b>Extra qualification</b></template></body>'))],
  ['application form carrier', bytes => Buffer.from(bytes.toString().replace('</body>', '<form><input name="requiredExperience" required></form></body>'))],
  ['closed notice', bytes => Buffer.from(bytes.toString().replace('</body>', '<p>This position is closed. We are no longer accepting applications.</p></body>'))],
  ['new expiry', bytes => Buffer.from(bytes.toString().replace(/"datePosted"\s*:/, '"validThrough":"2099-01-01","datePosted":'))],
  ['employer conflict', bytes => Buffer.from(bytes.toString().replace(/"name"\s*:\s*"Netomi"/, '"name":"Other Employer"'))],
  ['extra descendant in authored AI disclosure', bytes => Buffer.from(bytes.toString().replace('We may use artificial intelligence', '<b>We may use artificial intelligence</b>'))],
]) test('actual original Response holds ' + name + ' and retains company/cleanup uncertainty', async t => {
  let applied = false
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => {
    if (url !== roleURL) return entity
    const bytes = edit(entity.bytes)
    assert.notDeepEqual(bytes, entity.bytes, name + ' must mutate an actual original')
    applied = true
    return {...entity, bytes}
  }})
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.ok(applied)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.nativeCollectionEvidence.nativeInventoryPairComplete, true)
  assert.equal(error.nativeCollectionEvidence.returnedNativeIndiaTextRecords, 0)
  assert.ok(error.nativeCollectionEvidence.issues.length)
})

for (const [name, change] of [
  ['country missing', record => {delete record.country}],
  ['changed own native ID', record => {record.id = '00000000-0000-4000-8000-000000000000'}],
  ['parent employer application route', record => {record.applyUrl = 'https://jobs.lever.co/other/' + record.id + '/apply'}],
  ['new native status', record => {record.status = 'closed'}],
  ['new expiry date', record => {record.validThrough = '2099-01-01'}],
  ['omitted rich criteria carrier', record => {record.descriptionBody = ''}],
  ['alternate criteria carrier', record => {record.descriptionPlain += ' New mandatory licensing requirement.'}],
]) test('current complete feed shape or carrier binding holds ' + name, async t => {
  const replay = replayNative({mutate: (url, entity) => {
    if (url !== feedURL) return entity
    const model = JSON.parse(entity.bytes)
    change(model.find(row => row.id === ids[0]))
    return {...entity, bytes: Buffer.from(JSON.stringify(model))}
  }})
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.match(error.message, /coverage gap/)
  assert.ok(replay.calls.length <= 6)
})

for (const [name, change] of [
  ['country foreign', record => {record.country = 'US'}],
  ['secondary unknown location', record => {record.categories.allLocations.push('Unspecified')}],
]) test('current ' + name + ' stays in the complete audit and is never selected as India', async t => {
  const replay = liveReplay((url, text) => {
    if (url !== feedURL) return text
    const model = JSON.parse(text); change(model.find(row => row.id === ids[0])); return JSON.stringify(model)
  })
  const jobs = await collect(t, replay)
  assert.equal(jobs.length, 8)
  assert.ok(!jobs.some(job => job.jobId === ids[0]))
  assert.equal(jobs.sourceAudit.observedRecordCount, 21)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 13)
  assert.ok(jobs.sourceAudit.observations.find(row => row.id === ids[0]).heldReason)
})

for (const target of [boardURL, feedURL, roleURL]) test('changed closing native record is held for ' + target, async t => {
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => url === target && entity.call.occurrence === 1
    ? {...entity, bytes: Buffer.concat([entity.bytes, Buffer.from(' ')])} : entity})
  const error = await caught(() => collect(t, replay, {maxJobs: 1}))
  assert.equal(error.sourceScopeComplete, false)
  assert.ok(!error.nativeCollectionEvidence.nativeInventoryPairComplete || error.nativeCollectionEvidence.returnedNativeIndiaTextRecords === 0)
})

test('an actual historical failed closing pair yields eight observations and a held ninth, never a made-up closing', async t => {
  const replay = replayNative()
  const jobs = await collect(t, replay)
  assert.equal(jobs.length, 8)
  assert.ok(!jobs.some(row => row.jobId === fixture.historicalMissingIndiaClosingHTML))
  assert.ok(replay.calls.every(row => !row.replayReuse))
  assert.equal(jobs.sourceAudit.issues.length, 1)
  assert.equal(jobs.sourceAudit.nativeInventoryPairComplete, true)
  assert.equal(jobs.sourceAudit.observations.length, 21)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 13)
  assert.equal(jobs.sourceAudit.openingHydratedNativeRecordCount, 9)
  assert.equal(jobs.sourceAudit.qualifiedNativeRecordCount, 8)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('registered source counts a failed opening among unqualified native records instead of planned selection', async t => {
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) =>
    url === roleURL && entity.call.occurrence === 0 ? {...entity, status: 500} : entity})
  const source = createCatalogScraper(getScraperCatalog().find(row => row.source === 'netomi'))
  const jobs = await withReplayClock(t, () => source.run(replay.options))
  assert.equal(jobs.length, 8)
  assert.ok(!jobs.some(job => job.jobId === ids[0]))
  const audit = replay.audits.at(-1)
  assert.equal(audit.selectedNativeIds.length, 9)
  assert.equal(audit.observations.length, 21)
  assert.equal(audit.openingHydratedNativeRecordCount, 8)
  assert.equal(audit.qualifiedNativeRecordCount, 8)
  assert.equal(audit.unhydratedNativeRecordCount, 13)
  assert.equal(audit.unhydratedNativeRecordCount + audit.qualifiedNativeRecordCount, audit.observedRecordCount)
  assert.equal(audit.issues.length, 1)
  assert.ok(!audit.observations.find(row => row.id === ids[0]).sourceNativeDataIdentityQualified)
})

test('full original rich/plain/schema criteria and AI disclosure survive all nine outputs with exact native calendar fields', async t => {
  const replay = replayNative({reuseMissingClosing: true})
  const jobs = await collect(t, replay)
  for (const job of jobs) {
    const record = nativeFeed.find(row => row.id === job.jobId), row = jobs.sourceAudit.observations.find(row => row.id === job.jobId)
    assert.deepEqual(job.sourceNativeRecord, record)
    assert.deepEqual(job.sourceNativeJobPosting, row.opening.schema)
    const values = ['opening', 'descriptionBody', 'description', 'openingPlain', 'descriptionBodyPlain', 'descriptionPlain', 'additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain'].map(key => record[key])
      .concat(record.lists.flatMap(section => [section.text, section.content])).filter(value => typeof value === 'string' && plain(value))
    assert.ok(values.length >= 11)
    assert.ok(job.jobDescription.startsWith(record.description), job.jobId + ' original rich prefix')
    const supplements = Object.fromEntries([...job.jobDescription.matchAll(/<pre data-carrier="([^"]+)">([\s\S]*?)<\/pre>/g)]
      .map(match => [match[1], decodeHTMLStrict(match[2])]))
    assert.deepEqual(JSON.parse(supplements['native-row']), record)
    assert.deepEqual(JSON.parse(supplements.JobPosting), job.sourceNativeJobPosting)
    assert.equal(JSON.parse(supplements['authored-list-ai']).aiNotice, job.sourceAuthoredAIHiringNotice)
    const standard = new Job(job).toObject()
    for (const key of Object.keys(standard)) if (key.startsWith('sourceNative') || key.startsWith('sourceAuthored') || key === 'sourceOriginalEntitySHA256') delete standard[key]
    assert.equal(standard.sourceDescription, job.sourceDescription)
    assert.equal(getSourceDescription(standard), job.sourceDescription)
    assert.ok(!Object.hasOwn(standard, 'sourceNativeRecord'))
    assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry, null)
    assert.equal(job.sourcePostingDate, record.createdAt)
    assert.equal(job.postingDate, new Date(record.createdAt).toISOString())
    assert.equal(job.sourceNativeStructuredDatePosted, job.postingDate.slice(0, 10))
    assert.equal(job.closingDate, null)
    assert.equal(job.countryCode, 'IN')
    assert.equal(job.sourceUrl, record.hostedUrl)
    assert.equal(job.applyUrl, record.applyUrl)
    assert.equal(job.sourceApplicationQualificationComplete, false)
    assert.equal(job.sourceRenderedCriteriaComplete, false)
    assert.equal(job.sourceActivationComplete, false)
    assert.ok(row.opening.originalHTML.includes('ai-disclaimer'))
  }
  assert.equal(jobs.sourceAudit.physicalRequests, 22)
  assert.equal(jobs.sourceAudit.openingHydratedNativeRecordCount, 9)
  assert.equal(jobs.sourceAudit.qualifiedNativeRecordCount, 9)
  assert.equal(jobs.sourceAudit.unhydratedNativeRecordCount, 12)
  assert.equal(jobs.sourceAudit.originalEntityBytes, 14944124)
  assert.equal(readSourceObservationEvidence(jobs, 'netomi').observedVacancyCount, 21)
  assert.equal(readSourceObservationEvidence(jobs, 'netomi').companyIndiaTotal, null)
})

for (const [name, edit, pattern] of [
  ['prefollowed response', entity => ({...entity, redirected: true}), /prefollowed/],
  ['foreign response URL', entity => ({...entity, responseURL: 'https://other.invalid/netomi'}), /Response URL/],
  ['missing response URL', entity => ({...entity, responseURL: ''}), /Response URL/],
  ['HTML wrong MIME', entity => ({...entity, headers: {'content-type': 'application/json'}}), /MIME/],
  ['legacy charset', entity => ({...entity, headers: {'content-type': 'text/html; charset=ISO-8859-1'}}), /charset/],
  ['missing MIME', entity => ({...entity, headers: {}}), /MIME/],
  ['missing original stream', entity => ({...entity, bytes: null}), /stream unavailable/],
  ['ambiguous MIME parameters', entity => ({...entity, headers: {'content-type': 'text/html; charset=utf-8; charset=latin1'}}), /MIME/],
  ['manual redirect', entity => ({...entity, status: 307, headers: {...entity.headers, location: 'https://other.invalid/'}}), /HTTP 307/],
  ['denied public origin', entity => ({...entity, status: 403}), /HTTP 403/],
  ['rate limited public origin', entity => ({...entity, status: 429}), /HTTP 429/],
]) test('real Response transport rejects ' + name + ' after one physical read', async t => {
  const replay = replayNative({mutate: (_url, entity) => edit(entity)})
  const error = await caught(() => collect(t, replay))
  assert.match(error.message, pattern)
  assert.equal(replay.calls.length, 1)
  assert.equal(error.nativeCollectionEvidence.rawPages[0].status, ['manual redirect'].includes(name) ? 307 : name === 'denied public origin' ? 403 : name === 'rate limited public origin' ? 429 : 200)
})

test('original default wire headers, pacing, credentials and no application/extra API reads are retained', async t => {
  const starts = []
  const replay = replayNative({reuseMissingClosing: true, mutate: (url, entity) => {starts.push({origin: new URL(url).origin, at: performance.now()}); return entity}})
  await collect(t, replay)
  for (const {init} of replay.calls) {
    assert.equal(init.credentials, 'omit')
    assert.equal(init.headers['User-Agent'], 'Mozilla/5.0 (compatible; Jobverify scraper)')
    assert.equal(init.headers.Accept, 'text/html,application/json,*/*;q=0.5')
    assert.ok(!Object.keys(init.headers).some(key => /authorization|cookie/i.test(key)))
  }
  for (const [index, start] of starts.entries()) {
    const previous = starts.slice(0, index).findLast(row => row.origin === start.origin)
    if (previous) assert.ok(start.at - previous.at >= 500)
  }
})

for (const [options, expectedJobs, expectedReads] of [
  [{maxJobs: 0}, 0, 4], [{maxJobs: 1}, 1, 6], [{maxRequests: 6}, 1, 6],
  [{maxRequests: 4}, 0, 4], [{maxAggregateBytes: 6 * 1048576}, 1, 6],
  [{maxJobs: Infinity}, 9, 22],
]) test('reduced caller reservation ' + JSON.stringify(options), async t => {
  const replay = replayNative({reuseMissingClosing: true})
  if (expectedJobs === 0 && options.maxJobs !== 0) {
    const error = await caught(() => collect(t, replay, options))
    assert.match(error.message, /zero inventory unverified/)
  } else {
    const jobs = await collect(t, replay, options)
    assert.equal(jobs.length, expectedJobs)
    assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  }
  assert.equal(replay.calls.length, expectedReads)
  assert.equal(replay.calls.at(-2).url, boardURL)
  assert.equal(replay.calls.at(-1).url, feedURL)
})

for (const [key, hard] of Object.entries(NETOMI_NATIVE_LIMITS).filter(([key]) => key !== 'pacingMs')) {
  for (const value of [0, -1, NaN, hard + 1]) test('caller cannot expand or invalidate ' + key + '=' + value, async t => {
    const replay = replayNative()
    await assert.rejects(() => collect(t, replay, {[key]: value}), /Invalid reduced/)
    assert.equal(replay.calls.length, 0)
  })
}

test('caller aggregate too small for opening/closing reservation fails before network', async t => {
  const replay = replayNative()
  await assert.rejects(() => collect(t, replay, {maxAggregateBytes: 1024}), /reservation/)
  assert.equal(replay.calls.length, 0)
})

test('unreviewed full body only injection fails before any fallback', async t => {
  const replay = replayNative()
  await assert.rejects(() => collect(t, replay, {fetchText: async () => original(boardURL).toString()}), /Full original Response/)
  assert.equal(replay.calls.length, 0)
})

for (const [name, options] of [['entity', {maxEntityBytes: 700000}], ['feed', {maxFeedBytes: 1000}]]) test('streaming reduced ' + name + ' cap stops physical acquisition', async t => {
  const replay = replayNative()
  const error = await caught(() => collect(t, replay, options))
  assert.match(error.message, /streaming byte bound/)
  assert.ok(replay.calls.length <= 2)
})

test('preaborted opaque caller reason wins without reads', async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: 'caller'})
  controller.abort(reason)
  const replay = replayNative()
  assert.equal(await caught(() => collect(t, replay, {signal: controller.signal})), reason)
  assert.equal(replay.calls.length, 0)
})

test('opaque cancellation while fetch ignores abort settles and cancels a late original body', async t => {
  const controller = new AbortController(), reason = Object.freeze({opaque: 'during-fetch'})
  let resolveFetch, cancelled = 0, reads = 0
  await withReplayClock(t, async () => {
    const pending = run({signal: controller.signal, fetchImpl: () => {reads++; return new Promise(resolve => {resolveFetch = resolve})}})
    await Promise.resolve(); await Promise.resolve()
    controller.abort(reason)
    assert.equal(await caught(() => pending), reason)
    const response = new Response(new ReadableStream({cancel() {cancelled++}}), {headers: {'content-type': 'text/html'}})
    resolveFetch(response)
    for (let turns = 0; turns < 10; turns++) await Promise.resolve()
  })
  assert.equal(reads, 1)
  assert.equal(cancelled, 1)
})

test('caller cancellation in original body read cancels/releases the reader and retains opaque reason', async t => {
  const controller = new AbortController(), reason = Symbol('during-read')
  let cancelled = 0, locked = true
  const response = {status: 200, url: boardURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => ({read: () => {controller.abort(reason); return new Promise(() => {})}, cancel: () => {cancelled++}, releaseLock: () => {locked = false}})}}
  const error = await caught(() => withReplayClock(t, () => run({signal: controller.signal, fetchImpl: async () => response})))
  assert.equal(error, reason)
  assert.equal(cancelled, 1)
  assert.equal(locked, false)
})

test('source deadline bounds an abort-ignoring transport without retries', async t => {
  let calls = 0
  const error = await caught(() => withReplayClock(t, () => run({sourceTimeoutMs: 1000, fetchImpl: () => {calls++; return new Promise(() => {})}})))
  assert.match(error.message, /deadline/)
  assert.equal(calls, 1)
})

test('request deadline bounds an abort-ignoring transport without expanding source timeout', async t => {
  let calls = 0
  const error = await caught(() => withReplayClock(t, () => run({requestTimeoutMs: 1000, fetchImpl: () => {calls++; return new Promise(() => {})}})))
  assert.match(error.message, /request deadline/)
  assert.equal(calls, 1)
})

test('observers receive detached complete originals and cannot alter the returned authoritative model', async t => {
  const replay = replayNative({reuseMissingClosing: true})
  const jobs = await collect(t, replay, {maxJobs: 1, onAudit: audit => {audit.observations[0].sourceNativeRecord.country = 'US'; audit.rawPages.length = 0},
    onRecords: rows => {rows[0].sourceNativeRecord.id = 'changed'}})
  assert.equal(jobs[0].sourceNativeRecord.country, 'IN')
  assert.equal(jobs.sourceAudit.rawPages.length, 6)
  assert.equal(jobs.sourceAudit.observations[0].sourceNativeRecord.id, nativeFeed[0].id)
})

test('a fully read unreviewed original remains in raw audit while its qualification fails closed', async t => {
  let altered
  const replay = replayNative({mutate: (url, entity) => {
    if (url !== boardURL) return entity
    altered = Buffer.concat([entity.bytes, Buffer.from('<p>Unreviewed native declaration</p>')])
    return {...entity, bytes: altered}
  }})
  const error = await caught(() => collect(t, replay))
  const receipt = error.nativeCollectionEvidence.rawPages[0]
  assert.equal(receipt.entityComplete, true)
  assert.equal(receipt.originalEntityReviewed, false)
  assert.equal(receipt.rawEntitySHA256, sha(altered))
  assert.deepEqual(Buffer.from(receipt.bodyBase64, 'base64'), altered)
})

test('the complete original feed cannot be substituted by an empty, truncated or error inventory', async t => {
  for (const body of ['[]', '{}', '{"error":"unavailable"}']) {
    const replay = replayNative({mutate: (url, entity) => url === feedURL ? {...entity, bytes: Buffer.from(body)} : entity})
    const error = await caught(() => collect(t, replay))
    assert.match(error.message, /inventory|identity conflict/)
    assert.equal(replay.calls.length, 2)
    assert.equal(error.sourceScopeComplete, false)
  }
})

for (const url of [boardURL, feedURL]) test('original response BOM on ' + url + ' is never removed before byte admission', async t => {
  const replay = replayNative({mutate: (candidate, entity) => candidate === url ? {...entity, bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), entity.bytes])} : entity})
  const error = await caught(() => collect(t, replay))
  assert.match(error.message, /BOM/)
  const receipt = error.nativeCollectionEvidence.rawPages.at(-1)
  assert.deepEqual(Buffer.from(receipt.bodyBase64, 'base64').subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]))
})

for (const name of ['HTTP denied', 'bad charset', 'header exception']) test('original body is cancelled before content on ' + name, async t => {
  let cancelled = 0, read = 0
  const response = {status: name === 'HTTP denied' ? 403 : 200, url: boardURL, redirected: false,
    headers: {get() {if (name === 'header exception') throw Error('Original headers unavailable'); return 'text/html; charset=latin1'}},
    body: {cancel() {cancelled++}, getReader() {read++; throw Error('Body must not be read')}}}
  await caught(() => withReplayClock(t, () => run({fetchImpl: async () => response})))
  assert.equal(cancelled, 1)
  assert.equal(read, 0)
})

for (const name of ['oversized intrinsic bytes', 'nonbyte chunk']) test('original stream rejects ' + name + ' and disposes the reader', async t => {
  let cancelled = 0, released = 0
  const value = name === 'nonbyte chunk' ? 'text is not original bytes' : new Uint8Array(1048577)
  if (name !== 'nonbyte chunk') {
    Object.defineProperty(value, 'byteLength', {get() {throw Error('Spoofed length getter must never run')}})
    Object.defineProperty(value, 'buffer', {get() {throw Error('Spoofed backing-buffer getter must never run')}})
  }
  const response = {status: 200, url: boardURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => ({read: async () => ({done: false, value}), cancel: () => {cancelled++}, releaseLock: () => {released++}})}}
  const error = await caught(() => withReplayClock(t, () => run({fetchImpl: async () => response})))
  assert.match(error.message, name === 'nonbyte chunk' ? /byte chunk/ : /streaming byte bound/)
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})

test('opaque cancellation also owns a late asynchronous reader acquisition', async t => {
  const controller = new AbortController(), reason = Object.freeze({late: 'reader'})
  let openReader, cancelled = 0, released = 0
  const response = {status: 200, url: boardURL, redirected: false, headers: new Headers({'content-type': 'text/html'}),
    body: {getReader: () => new Promise(resolve => {openReader = resolve}), cancel: () => {cancelled++}}}
  await withReplayClock(t, async () => {
    const pending = run({signal: controller.signal, fetchImpl: async () => response})
    for (let turns = 0; !openReader && turns < 25; turns++) await Promise.resolve()
    assert.equal(typeof openReader, 'function')
    controller.abort(reason)
    assert.equal(await caught(() => pending), reason)
    openReader({cancel: () => {cancelled++}, releaseLock: () => {released++}})
    for (let turns = 0; turns < 12; turns++) await Promise.resolve()
  })
  assert.equal(cancelled, 2, 'Original response body and late reader are both disposed')
  assert.equal(released, 1)
})

test('opaque caller cancellation wins a concurrently rejected detached audit callback', async t => {
  const replay = replayNative(), controller = new AbortController(), reason = Symbol('audit caller')
  const error = await caught(() => collect(t, replay, {maxJobs: 1, signal: controller.signal,
    onAudit: () => {controller.abort(reason); return Promise.reject(Error('Concurrent observer failure'))}}))
  assert.equal(error, reason)
  assert.equal(replay.calls.length, 6)
})

test('caller cancellation while pacing starts no unreserved second read', async t => {
  const controller = new AbortController(), reason = Object.freeze({pacing: true})
  const replay = replayNative({mutate: (url, entity) => {
    if (url === roleURL) setTimeout(() => controller.abort(reason), 100)
    return entity
  }})
  const error = await caught(() => collect(t, replay, {maxJobs: 1, signal: controller.signal}))
  assert.equal(error, reason)
  assert.equal(replay.calls.filter(row => row.url === roleURL).length, 1)
})

test('a closing explicit denial stops the denied origin without additional selection or retry', async t => {
  const replay = replayNative({mutate: (url, entity) => url === roleURL && entity.call.occurrence === 1 ? {...entity, status: 403} : entity})
  const error = await caught(() => collect(t, replay))
  assert.equal(error.status, 403)
  assert.equal(error.originDenied, true)
  assert.equal(replay.calls.length, 4)
  assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).status, 403)
})

test('registered failure performs zero generic recovery reads despite supplied poison fallback transports', async t => {
  let fallbacks = 0
  const replay = replayNative({mutate: (_url, entity) => ({...entity, bytes: Buffer.concat([entity.bytes, Buffer.from('Unreviewed declaration')])})})
  const provider = getScraperCatalog().find(row => row.source === 'netomi')
  const result = await caught(() => withReplayClock(t, () => createCatalogScraper(provider).run({...replay.options,
    softFailureRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No fallback')}},
    emptyOnlyRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No empty fallback')}}})))
  assert.ok(result)
  assert.equal(fallbacks, 0)
  assert.equal(replay.calls.length, 1)
})

test('registered caller suppression performs zero generic empty recovery reads and retains inventory hold', async t => {
  let fallbacks = 0
  const replay = replayNative(), provider = getScraperCatalog().find(row => row.source === 'netomi')
  const jobs = await withReplayClock(t, () => createCatalogScraper(provider).run({...replay.options, maxJobs: 0,
    softFailureRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No fallback')}},
    emptyOnlyRecovery: {fetchImpl: async () => {fallbacks++; throw Error('No empty fallback')}}}))
  assert.equal(jobs.length, 0)
  assert.equal(fallbacks, 0)
  assert.equal(replay.calls.length, 4)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
