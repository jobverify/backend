import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { declaredEightfoldRecruitment, readEightfoldRecruitment } from '../scraper-support/utils/recruitmentEightfold.js'
import { parseEightfoldJson, readEightfoldDataCarrier } from '../scraper-support/utils/recruitmentEightfoldData.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-classic-20261111.json.gz', import.meta.url))))
const captures = new Map()
for (const row of fixture.responses) {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
  captures.set(row.phase + ':' + row.requestedURL, { ...row, html: bytes.toString('utf8') })
}
const HOME = fixture.responses.find(row => row.label === 'corporate').url
const BOARD = fixture.responses.find(row => row.label === 'board').url
const ENTRY = fixture.responses.find(row => row.label === 'entry').url
const SELECTED = fixture.responses.find(row => row.label === 'india-list').url
const ROLE = fixture.responses.find(row => row.label === 'role').url
const JOB = fixture.responses.find(row => row.label === 'own-job').url
const INSIGHTS = fixture.responses.find(row => row.label === 'insights').url
const ID = fixture.proof.roleId
const page = (phase, url) => ({ url, status: 200, html: captures.get(phase + ':' + url).html })
const config = { source: 'bayer', companyName: 'Bayer', companyCareerPage: HOME }
const codeCarrier = html => html.match(/<code\b[^>]*\bid="smartApplyData"[^>]*>[\s\S]*?<\/code>/)[0]
const changeModel = (html, mutate) => {
  const carrier = codeCarrier(html), source = carrier.match(/>([\s\S]*)<\/code>/)[1]
  const raw = source.replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  const value = JSON.parse(raw); mutate(value)
  const encoded = JSON.stringify(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&#34;')
  return html.replace(carrier, carrier.replace(source, encoded))
}
const changePosting = (html, mutate) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
  (_, start, raw, end) => { const value = JSON.parse(raw); mutate(value); return start + JSON.stringify(value) + end })
const descriptor = html => declaredEightfoldRecruitment({ ...page('opening', BOARD), ...(html ? { html } : {}) }, config)
const replay = ({ budget = 12, mutate = (_, value) => value, boardHTML } = {}) => {
  const calls = [], counts = new Map([[HOME, 1], [BOARD, 1]]), jobs = [], records = [], inventories = [], unresolved = []
  const current = descriptor(boardHTML)
  const request = async (url, format) => {
    assert.ok(calls.length < budget, 'Current closing reserve must honor the actual request budget')
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); calls.push({ url, format, count })
    const actual = captures.get((count > 1 ? 'closing:' : 'opening:') + url)
    assert.ok(actual, 'Every public endpoint must be declared/captured: ' + url)
    return mutate(url, { ...actual }, count)
  }
  const readPage = async url => { const value = await request(url, 'html'); return { url: value.finalURL, status: value.status, html: value.html } }
  const context = { config, readPage, readRenderer: readPage,
    readNativeJson: async url => { const value = await request(url, 'json-text'); return { url: value.finalURL, status: value.status, text: value.html } },
    permit: () => {}, matchingEmployer: value => value === 'Bayer', addJob: value => jobs.push(value),
    recordRead: value => records.push(value), inventoryRead: value => inventories.push(value), unresolved: value => unresolved.push(value),
    maxPages: 6, maxDetails: 8, remainingRequests: () => budget - calls.length, now: '2026-11-11T05:45:00.000Z',
    officialBinding: { officialURL: HOME, declaredURL: fixture.proof.publishedHandoffOriginal, page: page('opening', HOME) },
    recheckOfficialBinding: async binding => readPage(binding.officialURL) }
  return { descriptor: current, context, calls, jobs, records, inventories, unresolved,
    run: () => readEightfoldRecruitment(current, context) }
}

test('strict native JSON retains punctuation and rejects duplicate keys even when escaped', () => {
  assert.deepEqual(parseEightfoldJson('{"x":"3-5+ years; mandatory: yes","nested":{"id":1}}'),
    { x: '3-5+ years; mandatory: yes', nested: { id: 1 } })
  for (const source of ['{"id":1,"id":2}', '{"id":1,"\\u0069d":2}', '{"nested":{"x":1,"x":1}}'])
    assert.throws(() => parseEightfoldJson(source), /duplicate/i)
})

test('the exact actual self-hidden native data carrier is read only as source-bound data', () => {
  const value = readEightfoldDataCarrier(page('opening', BOARD).html, { id: 'smartApplyData', mountId: 'EFSmartApplyContainer' })
  assert.equal(value.value.domain, 'bayer.com')
  assert.equal(value.value.branding.companyName, 'Bayer')
  assert.equal(value.dataOnly, true)
  assert.equal(value.value.positions.length, 10)
})

for (const [name, mutate] of [
  ['comment substitution', html => html.replace(codeCarrier(html), '<!--' + codeCarrier(html) + '-->')],
  ['template substitution', html => html.replace(codeCarrier(html), '<template>' + codeCarrier(html) + '</template>')],
  ['hidden ancestor', html => html.replace(codeCarrier(html), '<div hidden>' + codeCarrier(html) + '</div>')],
  ['inert ancestor', html => html.replace(codeCarrier(html), '<div inert>' + codeCarrier(html) + '</div>')],
  ['SVG ancestor', html => html.replace(codeCarrier(html), '<svg>' + codeCarrier(html) + '</svg>')],
  ['non-code id shadow', html => html.replace(codeCarrier(html), '<div hidden id="smartApplyData">{}</div>' + codeCarrier(html))],
  ['duplicate actual code id', html => html.replace(codeCarrier(html), codeCarrier(html) + codeCarrier(html))],
  ['duplicate carrier id attribute', html => html.replace('id="smartApplyData"', 'id="smartApplyData" id="other-model"')],
  ['non-code carrier', html => html.replace(codeCarrier(html), codeCarrier(html).replace('<code ', '<div ').replace('</code>', '</div>'))],
  ['inactive mount', html => html.replace('id="EFSmartApplyContainer"', 'hidden id="EFSmartApplyContainer"')],
  ['duplicate mount', html => html.replace('</body>', '<div id="EFSmartApplyContainer"></div></body>')],
  ['stylesheet-hidden mount', html => html.replace('</head>', '<style>#EFSmartApplyContainer{display:none !important}</style></head>')],
  ['stylesheet-hidden ancestor', html => html.replace('</head>', '<style>.wrapper-content{display:none !important}</style></head>')],
]) test('native data authority refuses ' + name, () => {
  const html = page('opening', BOARD).html
  assert.notEqual(mutate(html), html)
  assert.throws(() => readEightfoldDataCarrier(mutate(html), { id: 'smartApplyData', mountId: 'EFSmartApplyContainer' }), /Eightfold|carrier|mount|identity/i)
})

test('current classic descriptor binds only the actual account, employer, active mount and renderer', () => {
  const current = descriptor()
  assert.equal(current.kind, 'eightfold-classic')
  assert.equal(current.origin, 'https://talent.bayer.com')
  assert.equal(current.domain, 'bayer.com')
  assert.equal(current.entryURL, ENTRY)
})

for (const [name, mutate] of [
  ['nomodule renderer', html => html.replace('src="/gen/js/smartApply.', 'nomodule src="/gen/js/smartApply.')],
  ['inactive renderer', html => html.replace('src="/gen/js/smartApply.', 'hidden src="/gen/js/smartApply.')],
  ['foreign account', html => changeModel(html, value => { value.domain = 'other.example' })],
  ['foreign employer', html => changeModel(html, value => { value.branding.companyName = 'Other Employer' })],
  ['authenticated model', html => changeModel(html, value => { value.isUserAuthenticated = true })],
]) test('current classic descriptor withholds ' + name, () => {
  assert.throws(() => descriptor(mutate(page('opening', BOARD).html)), /Eightfold|account|employer|renderer|mode/i)
})

test('one actual India role retains every full criterion and unknown dates while all closing checks fit twelve reads', async () => {
  const r = replay()
  await r.run()
  assert.equal(r.jobs.length, 1)
  const native = r.jobs[0], original = JSON.parse(captures.get('opening:' + JOB).html)
  assert.equal(native.id, String(ID))
  assert.equal(native.title, 'Principal Product Manager IT/OT D-Hub')
  assert.equal(native.employer.name, 'Bayer')
  assert.equal(native.description, original.job_description)
  assert.equal(native.description.includes('YOUR TASKS AND RESPONSIBILITIES'), true)
  assert.equal(native.posted, null)
  assert.equal(native.closing, null)
  assert.equal(native.remoteStatus, null)
  assert.equal(native.legalEmployer, null)
  assert.equal(native.sourceRemoteStatusUnresolved, true)
  assert.equal(native.sourcePublicationDateUnavailable, true)
  assert.equal(native.record.originalNativeRole.t_create, original.t_create)
  assert.equal(native.record.originalNativeRole.t_update, original.t_update)
  assert.equal(native.record.sourceScopeComplete, false)
  assert.equal(native.record.lifecycleCleanupAllowed, false)
  assert.equal(r.records.length, 10)
  assert.equal(r.inventories[0].reportedTotal, 30)
  assert.equal(r.inventories[0].observedRecordCount, 10)
  assert.equal(r.calls.length, 12)
})

test('public head title decodes the publisher HTML character reference exactly once', async () => {
  const r = replay({ mutate: (url, packet) => {
    if (url !== ROLE) return packet
    const html = packet.html.replace(/<title>([\s\S]*?)<\/title>/, (_, title) => '<title>' + title.replace('Product', '&#80;roduct') + '</title>')
    assert.notEqual(html, packet.html, 'Retain the same original role while varying only its real HTML title spelling')
    return { ...packet, html }
  } })
  await r.run()
  assert.equal(r.jobs.length, 1)
  assert.equal(r.jobs[0].title, 'Principal Product Manager IT/OT D-Hub')
})

test('a double-encoded title cannot impersonate the original native role title', async () => {
  const r = replay({ mutate: (url, packet) => url === ROLE ? { ...packet,
    html: packet.html.replace(/<title>([\s\S]*?)<\/title>/, (_, title) => '<title>' + title.replace('Product', '&amp;#80;roduct') + '</title>') } : packet })
  await assert.rejects(r.run(), /title/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, url, mutate] of [
  ['wrong native role id', JOB, value => { value.id = 999999 }],
  ['wrong native title', JOB, value => { value.name = 'Different role' }],
  ['wrong native primary country', JOB, value => { value.location = 'New York,United States' }],
  ['foreign additional country', JOB, value => { value.locations.push('New York,United States') }],
  ['private native mode', JOB, value => { value.isPrivate = true }],
  ['blank full criteria', JOB, value => { value.job_description = '' }],
  ['unreviewed full description override', INSIGHTS, value => { value.job_description = 'Different role criteria' }],
  ['unreviewed customized description', JOB, value => { value.custom_JD.enable = true }],
  ['foreign application origin', JOB, value => { value.apply_redirect_url = 'https://other.example/career?company=C0003153479P&career_job_req_id=896367&career_ns=job_application&source=Eightfold&src=Eightfold' }],
  ['foreign application employer account', JOB, value => { value.apply_redirect_url = value.apply_redirect_url.replace('company=C0003153479P', 'company=OTHER_EMPLOYER') }],
  ['different application requisition', JOB, value => { value.apply_redirect_url = value.apply_redirect_url.replace('career_job_req_id=896367', 'career_job_req_id=999999') }],
]) test('no selected positive survives ' + name, async () => {
  const r = replay({ mutate: (current, packet) => {
    if (current !== url) return packet
    const value = JSON.parse(packet.html); mutate(value)
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /Eightfold|role|identity|country|criteria|description|mode|scope/i)
  assert.equal(r.jobs.length, 0)
})

test('native API duplicate keys cannot be erased by parsed JSON transport', async () => {
  const r = replay({ mutate: (url, packet) => {
    if (url !== JOB) return packet
    const html = packet.html.replace('"id": ' + ID, '"id": 999999, "id": ' + ID)
    assert.notEqual(html, packet.html, 'The actual raw identity mutation must occur')
    return { ...packet, html }
  } })
  await assert.rejects(r.run(), /duplicate/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, before, after] of [
  ['authored experience number', '10 or more years of experience', '9 or more years of experience'],
  ['authored requirement punctuation', '5 or more years of experience', '5+ or more years of experience'],
  ['authored number whitespace', '10 or more years of experience', '1 0 or more years of experience'],
  ['authored reference-code punctuation', 'Reference Code:| 896367', 'Reference Code:| ---896367'],
]) test('schema/native full criteria reconcile every ' + name + ' beyond structural Markdown', async () => {
  const r = replay({ mutate: (url, packet) => {
    if (url !== ROLE) return packet
    const html = changePosting(packet.html, posting => {
      const changed = posting.description.replace(before, after)
      assert.notEqual(changed, posting.description, 'Mutate an actual complete native criterion')
      posting.description = changed
    })
    return { ...packet, html }
  } })
  await assert.rejects(r.run(), /criteria|description/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, mutate] of [
  ['schema employer', html => changePosting(html, posting => { posting.hiringOrganization.name = 'Other Employer' })],
  ['schema primary country', html => changePosting(html, posting => { posting.jobLocation.address.addressCountry.name = 'US' })],
  ['contradictory nested country field', html => changePosting(html, posting => { posting.jobLocation.address.addressCountry.identifier = 'US' })],
  ['schema extra foreign location', html => changePosting(html, posting => { posting.jobLocation = [posting.jobLocation,
    { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: { '@type': 'Country', name: 'US' } } }] })],
  ['native extra unknown country', html => changeModel(html, model => { model.all_applicable_locations[0].country = '' })],
  ['native extra foreign country', html => changeModel(html, model => { model.all_applicable_locations[0].country = 'US' })],
  ['impossible schema date', html => changePosting(html, posting => { posting.datePosted = '2026-02-30T09:05:52' })],
  ['schema publication reinterpretation', html => changePosting(html, posting => { posting.datePosted = '2026-10-28T00:00:00' })],
  ['new authored schema criterion', html => changePosting(html, posting => { posting.experienceRequirements = 'Ten years mandatory.' })],
]) test('own public role withholds ' + name, async () => {
  const r = replay({ mutate: (url, packet) => {
    if (url !== ROLE) return packet
    const html = mutate(packet.html)
    assert.notEqual(html, packet.html, 'Mutate actual current public role evidence')
    return { ...packet, html }
  } })
  await assert.rejects(r.run(), /Eightfold/)
  assert.equal(r.jobs.length, 0)
})

for (const [name, url, mutate] of [
  ['native criteria', JOB, html => { const value = JSON.parse(html); value.job_description += '<p>A new mandatory criterion.</p>'; return JSON.stringify(value) }],
  ['insights override', INSIGHTS, html => { const value = JSON.parse(html); value.job_description = 'New criteria'; return JSON.stringify(value) }],
  ['entry', ENTRY, html => html + '\n// changed source code'],
  ['selected membership', SELECTED, html => changeModel(html, value => { value.positions = value.positions.slice(1) })],
  ['corporate handoff', HOME, html => html.replaceAll('https://talent.bayer.com/careers?domain=bayer.com', 'https://other.example/careers')],
]) test('changed closing ' + name + ' withholds every staged role', async () => {
  const r = replay({ mutate: (current, packet, count) => current === url && count > 1 ? { ...packet, html: mutate(packet.html) } : packet })
  await assert.rejects(r.run(), /Eightfold|closing|renderer|entry|membership|handoff|criteria|description/i)
  assert.equal(r.jobs.length, 0)
})

test('insufficient closing reserve never emits a staged role or invented empty inventory', async () => {
  const r = replay({ budget: 11 })
  await r.run()
  assert.equal(r.jobs.length, 0)
  assert.ok(r.unresolved.some(value => /budget|reserve/.test(value)))
  assert.equal(r.records.length, 10)
  assert.ok(r.calls.length <= 11)
})
