import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, HOME_URL, CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/corporate-handoff-20261031.json.gz', import.meta.url))))
const current=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/easemytrip-native-quality.json.gz',import.meta.url)))).packets
const office=current.find(q=>q.requestedURL.endsWith('/contact-us.html'))
packets.push({url:office.requestedURL,finalUrl:office.finalURL,status:office.status,contentType:office.contentType,body:office.bodyText})
const ABOUT = 'https://www.easemytrip.com/about-us.html'
const STYLE = 'https://css.emtcontent.com/career/career-new-stylesheet.css'
const replay = (change = packet => packet) => {
  const calls = []
  return { calls, minIntervalMs:0, fetchImpl: async url => {
    calls.push(url)
    const found = packets.find(packet => packet.url === url)
    assert.ok(found, 'Uncaptured current EaseMyTrip URL: ' + url)
    const packet = change(structuredClone(found))
    const response = new Response(packet.body, { status: packet.status, headers: { 'content-type': packet.contentType } })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  } }
}

test('the current corporate navigation supplies an active careers handoff when root HTML is an Angular shell', async () => {
  const options = replay(), jobs = await run(options), evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 10)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.ok(jobs.every(job => job.country === 'India' && job.postingDate === null && job.requisitionId === null))
  assert.ok(options.calls.includes(ABOUT) && options.calls.includes(STYLE))
  assert.ok(options.calls.indexOf(ABOUT) < options.calls.indexOf(CAREERS_URL))
  assert.ok(options.calls.filter(url => url.startsWith('https://fonts.googleapis.com/')).length === 2)
  assert.ok(options.calls.every(url => !/assets\/js\//.test(url)), 'published client programs are never executed or used as anchor evidence')
})

for (const [name, mutate] of [
  ['hidden careers anchor', p => { if (p.url === ABOUT) p.body = p.body.replace('<a href="' + CAREERS_URL + '">Career</a>', '<a hidden href="' + CAREERS_URL + '">Career</a>'); return p }],
  ['hidden navigation ancestor', p => { if (p.url === ABOUT) p.body = p.body.replace('<div class="nav-menu">', '<div hidden class="nav-menu">'); return p }],
  ['commented careers link', p => { if (p.url === ABOUT) p.body = p.body.replace('<a href="' + CAREERS_URL + '">Career</a>', '<!-- <a href="' + CAREERS_URL + '">Career</a> -->'); return p }],
  ['foreign handoff', p => { if (p.url === ABOUT) p.body = p.body.replace('href="' + CAREERS_URL + '"', 'href="https://other.example/career.html"'); return p }],
  ['changed corporate identity', p => { if (p.url === ABOUT) p.body = p.body.replace('About Us and Company Profile - EaseMyTrip.com', 'About Another Company'); return p }],
  ['changed corporate canonical', p => { if (p.url === ABOUT) p.body = p.body.replace('rel="canonical" href="' + ABOUT + '"', 'rel="canonical" href="https://other.example/about-us.html"'); return p }],
  ['external CSS hides navigation', p => { if (p.url === STYLE) p.body += '\n.nav-menu { display: none !important; }'; return p }],
  ['inline CSS hides navigation', p => { if (p.url === ABOUT) p.body = p.body.replace('</head>', '<style>nav{opacity:0}</style></head>'); return p }],
  ['desktop media hides navigation', p => { if (p.url === STYLE) p.body += '\n@media screen and (min-width:1000px){nav{visibility:hidden}}'; return p }],
  ['an unknown media condition may hide navigation', p => { if (p.url === STYLE) p.body += '\n@media (prefers-color-scheme:dark){nav{display:none}}'; return p }],
  ['a fixed navigation moved outside the viewport', p => { if (p.url === STYLE) p.body += '\n.nav-menu{position:fixed;right:100%}'; return p }],
  ['a clipped navigation ancestor', p => { if (p.url === ABOUT) p.body = p.body.replace('<nav class=', '<nav style="height:0;overflow:hidden" class='); return p }],
  ['a presentation-hidden style still applies', p => { if (p.url === ABOUT) p.body = p.body.replace('</head>', '<style hidden>nav{display:none}</style></head>'); return p }],
  ['an imported stylesheet hides navigation', p => { if (p.url.startsWith('https://fonts.googleapis.com/')) p.body += '\nnav{display:none}'; return p }],
  ['a CSS variable makes visibility unproved', p => { if (p.url === STYLE) p.body += '\n.nav-menu{display:var(--menu-display)}'; return p }],
  ['an untrusted new stylesheet origin', p => { if (p.url === ABOUT) p.body = p.body.replace('</head>', '<link rel="stylesheet" href="https://other.example/hidden.css"></head>'); return p }],
  ['a stylesheet served as successful HTML', p => { if (p.url === STYLE) p.contentType = 'text/html'; return p }],
  ['a gated homepage rather than the normal client shell', p => { if (p.url === HOME_URL) p.status = 307; return p }],
]) test('current corporate handoff rejects ' + name, async () => {
  await assert.rejects(run(replay(mutate)), error => error.code === 'EASEMYTRIP_COVERAGE_GAP')
})

test('an unrelated hidden corporate component does not hide the native top navigation', async () => {
  const jobs = await run(replay(p => { if (p.url === STYLE) p.body += '\n.unrelated-modal{display:none}'; return p }))
  assert.equal(jobs.length, 10)
})

test('a mobile-only hiding rule cannot conceal the observed desktop handoff', async () => {
  const jobs = await run(replay(p => { if (p.url === STYLE) p.body += '\n@media screen and (max-width:700px){nav{display:none}}'; return p }))
  assert.equal(jobs.length, 10)
})
