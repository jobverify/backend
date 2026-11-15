import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createFlyweisTechnologyScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz', import.meta.url))))
const original = Object.fromEntries(fixture.packets.map(packet => {
  const body = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), packet.bodySHA256)
  return [packet.url, { ...packet, html: body.toString('utf8') }]
}))
const react = 'https://flyweis.technology/careers/senior-react-developer'
function run(change = () => {}, options = {}) {
  const packets = structuredClone(original), calls = [], visits = new Map()
  return { calls, jobs: createFlyweisTechnologyScraper().run({ now: fixture.capturedAt, ...options, fetchImpl: async (url, init) => {
    url = String(url); calls.push({ url, init })
    const visit = (visits.get(url) || 0) + 1; visits.set(url, visit)
    const packet = structuredClone(packets[url]); assert.ok(packet, 'Declared current native read: ' + url)
    change(packet, url, visit)
    const response = new Response(packet.html, { status: packet.status, headers: packet.headers })
    Object.defineProperty(response, 'url', { value: url }); return response
  } }) }
}

test('Flyweis current native source retains complete visible criteria for six own typed India roles', async () => {
  const result = run(), jobs = await result.jobs
  assert.equal(jobs.length, 6)
  const role = jobs.find(job => job.sourceUrl === react)
  assert.ok(role)
  assert.match(role.jobDescription, /Bachelor.s degree in Computer Science/)
  assert.match(role.jobDescription, /Minimum 3\+ years of React development experience/)
  assert.match(role.jobDescription, /Redux Toolkit/)
  assert.ok(role.jobDescription.length > role.sourceNativeJobPosting.description.length)
  assert.ok(jobs.every(job => job.country === 'India' && job.company === 'Flyweis Technology'
    && job.sourceDetailComplete === true && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(result.calls.filter(call => call.url === react).length >= 2)
  assert.ok(result.calls.every(call => call.init.method === 'GET' && call.init.redirect === 'manual' && call.init.credentials === 'omit'))
  assert.ok(result.calls.every(call => !call.url.endsWith('/apply')))
})

for (const [name, change] of [
  ['corporate handoff hidden by CSS', (p, url) => { if (url === 'https://www.flyweis.technology/') p.html = p.html.replace('</head>', '<style>a{display:none!important}</style></head>') }],
  ['inert corporate handoff', (p, url) => { if (url === 'https://www.flyweis.technology/') p.html = p.html.replace(/<a\b[^>]*href="\/careers"[^>]*>[\s\S]*?<\/a>/g, m => '<template>' + m + '</template>') }],
  ['unknown stylesheet', (p, url) => { if (url.endsWith('.css')) p.html += 'body{display:none}' }],
  ['listing duplicate', (p, url) => { if (url === 'https://flyweis.technology/careers') p.html = p.html.replaceAll('/careers/nodejs-developer', '/careers/senior-react-developer') }],
  ['missing own full description', (p, url) => { if (url.startsWith('https://flyweis.technology/careers/')) p.html = p.html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/, '<article></article>') }],
  ['hidden own full description', (p, url) => { if (url.startsWith('https://flyweis.technology/careers/')) p.html = p.html.replace('<article ', '<article hidden ') }],
  ['schema employer conflict', (p, url) => { if (url.startsWith('https://flyweis.technology/careers/')) p.html = p.html.replaceAll('"name":"Flyweis Technology"', '"name":"Other Company"') }],
  ['schema country conflict', (p, url) => { if (url.startsWith('https://flyweis.technology/careers/')) p.html = p.html.replaceAll('"addressCountry":"IN"', '"addressCountry":"US"') }],
  ['nested employer context override', (p, url) => { if (url === react) p.html = p.html.replaceAll('"hiringOrganization":{', '"hiringOrganization":{"@context":"https://unrelated.invalid/context",') }],
  ['nested workplace context override', (p, url) => { if (url === react) p.html = p.html.replaceAll('"jobLocation":{', '"jobLocation":{"@context":"https://unrelated.invalid/context",') }],
  ['nested address context override', (p, url) => { if (url === react) p.html = p.html.replaceAll('"address":{', '"address":{"@context":"https://unrelated.invalid/context",') }],
  ['empty qualifications section', (p, url) => { if (url === react) p.html = p.html.replace(/(<h2>Qualifications<\/h2>)<ul\b[^>]*>[\s\S]*?<\/ul>/, '$1<ul></ul>') }],
  ['empty responsibilities section', (p, url) => { if (url === react) p.html = p.html.replace(/(<h2>Key responsibilities<\/h2>)<ul\b[^>]*>[\s\S]*?<\/ul>/, '$1<ul></ul>') }],
  ['unknown additional native criteria', (p, url) => { if (url === react) p.html = p.html.replaceAll('"datePosted":', '"responsibilities":"Mandatory additional native criteria", "datePosted":') }],
  ['missing native country', (p, url) => { if (url.startsWith('https://flyweis.technology/careers/')) p.html = p.html.replaceAll('"addressCountry":"IN"', '"addressCountry":""') }],
  ['expired role', (p, url) => { if (url.startsWith('https://flyweis.technology/careers/')) p.html = p.html.replaceAll('"datePosted":', '"validThrough":"2020-01-01","datePosted":') }],
  ['closing authored criteria drift', (p, url, visit) => { if (url === react && visit > 1) p.html = p.html.replaceAll('Redux Toolkit', 'Additional mandatory certification') }],
  ['closing membership drift', (p, url, visit) => { if (url === 'https://flyweis.technology/careers' && visit > 1) p.html = p.html.replaceAll('/careers/qa-engineer', '/careers/changed-role') }],
]) test('Flyweis withholds ' + name, async () => {
  await assert.rejects(run(change).jobs, /Flyweis/i)
})

test('Flyweis honors cancellation before any public read', async () => {
  const controller = new AbortController(); controller.abort(Error('cancelled current Flyweis capture'))
  const result = run(undefined, { signal: controller.signal })
  await assert.rejects(result.jobs, /cancelled current Flyweis capture/)
  assert.equal(result.calls.length, 0)
})

for (const notice of ['This job is not available.', 'This position has been filled.', 'This position is currently unavailable.'])
  for (const closingOnly of [false, true]) test(`Flyweis holds an active notice in the current own main outside authored article (${closingOnly ? 'closing only' : 'opening and closing'}): ${notice}`, async () => {
    let mutations = 0
    const result = run((packet, url, visit) => {
      if (url !== react || closingOnly && visit !== 2) return
      const original = packet.html
      packet.html = original.replace(/<main\b[^>]*>/i, tag => tag + '<p>' + notice + '</p>')
      assert.notEqual(packet.html, original)
      assert.ok(packet.html.indexOf(notice) < packet.html.indexOf('<article'))
      mutations++
    })
    await assert.rejects(result.jobs, /native vacancy closed/i)
    assert.ok(mutations > 0)
  })

for (const notice of ['<p hidden>This job is not available.</p>', '<template><p>This position has been filled.</p></template>'])
  test('Flyweis preserves hidden/inert unavailability prose outside its own full article: ' + notice, async () => {
    const result = run((packet, url) => {
      if (url === react) packet.html = packet.html.replace(/<main\b[^>]*>/i, tag => tag + notice)
    })
    const jobs = await result.jobs
    assert.equal(jobs.length, 6)
    assert.ok(jobs.find(job => job.sourceUrl === react).jobDescription.includes('Redux Toolkit'))
  })
