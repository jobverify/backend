import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE network tripwire') }
const native = await import('../../scraper/bluebinaries/script.js')
const { visibleText, visibleDocument } = await import('../../scraper/bluebinaries/nativeVisibility.js')
const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
const home = '<title>BlueBinaries</title><a href="https://www.bluebinaries.com/become-a-bluebee/">Become A BlueBee</a>'
const card = ({ id = 'bb-in-1', location = 'Chennai, India', title = 'Platform Engineer', more = '' } = {}) => `<div class="acc-job-post"><div class="job-details" ${id ? `data-attribute="${id}"` : ''}><div class="job-role"><h3>${title}</h3><span>Posted on 25-Oct-2026</span></div><div class="job-location"><span>${location}</span></div></div><div class="job-requirements" id="${id}"><p>Build &amp; ship reliable systems.</p><div><p>Experience: 4 years</p><p>Qualification: BTech</p></div><p>Retain literal &amp;lt;sample&amp;gt;.</p><ul><li>Own incident response.</li></ul><p hidden>Hidden criteria must not leak.</p><template>Inert content must not leak.</template>${more}<a href="https://www.bluebinaries.com/application/?posting=${id}">Click Here To Apply</a></div></div>`
const page = content => `<title>Become A Bluebee - BlueBinaries</title><section id="job-posts-container" class="job-posts">${content}</section><script>$(".job-details").on("click",function(){ $("#"+$(this).attr("data-attribute")).toggle(500); });</script>`
const registered = () => createCatalogScraper(getScraperCatalog().find(p => p.source === 'bluebinaries'))

test('Blue Binaries retains nested full criteria and decodes HTML leaves once', () => {
  const [job] = native.extractJobEntries(page(card()))
  assert.match(job.jobDescription, /Qualification: BTech/)
  assert.match(job.jobDescription, /Own incident response\./)
  assert.match(job.jobDescription, /literal &lt;sample&gt;/)
  assert.doesNotMatch(job.jobDescription, /Hidden criteria|Inert content/)
  assert.equal(job.country, 'India')
  assert.equal(job.requisitionId, null)
  assert.equal(job.experienceRequired, '4 years')
  assert.equal(job.minimumQualification, 'BTech')
  assert.equal(job.applyUrl, 'https://www.bluebinaries.com/application/?posting=bb-in-1')
  const [technical] = native.extractJobEntries(page(card({ more: '<p>10&deg;C &micro;F &sup2; &#128;</p>' })))
  assert.match(technical.jobDescription, /10\u00b0C \u00b5F \u00b2 \u20ac/)
})

test('Blue Binaries never makes a city or title slug into country or posting identity', () => {
  assert.equal(native.isIndiaLocation('Chennai'), false)
  assert.equal(native.isIndiaLocation('BlueBinaries India Pvt Ltd, Troy, MI'), false)
  assert.equal(native.extractJobEntries(page(card({ location: 'Chennai' })))[0].country, null)
  assert.equal(native.extractJobEntries(page(card({ id: '' }))).length, 0)
})

test('Blue Binaries never calls a numeric next-page link a terminal board', async () => {
  let audit
  await registered().run({ fetchPage: async url => ({ status: 200, url, body: url === 'https://www.bluebinaries.com/' ? home : page(card() + '<a href="?page=2">2</a>') }), onAudit: value => { audit = value } })
  assert.equal(audit.scopeComplete, false)
  assert.equal(audit.cleanupEligible, false)
})

test('Blue Binaries registered transport reconciles all native roles before a cap', async () => {
  let reads = 0, audit
  const html = page(card() + card({ id: 'bb-in-2', title: 'Second Engineer' }))
  const jobs = await registered().run({ maxJobs: 1, now: () => '2026-10-27T00:00:00Z', fetchPage: async url => { reads++; return { status: 200, url, body: url === 'https://www.bluebinaries.com/' ? home : html, contentType: 'text/html' } }, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 1)
  assert.equal(audit.observedGlobalCount, 2)
  assert.equal(audit.closingReconciled, true)
  assert.equal(audit.outputCapped, true)
  assert.equal(jobs[0].sourceCleanupEligible, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(reads, 4)
})

test('Blue Binaries duplicate IDs and changed closing criteria prevent complete inventory', async () => {
  let careerReads = 0, audit
  const jobs = await registered().run({ fetchPage: async url => ({ status: 200, url, body: url === 'https://www.bluebinaries.com/' ? home : page(card({ id: 'same' }) + card({ id: 'same', title: ++careerReads === 1 ? 'Other Engineer' : 'Changed Engineer' })), contentType: 'text/html' }), onAudit: value => { audit = value } })
  assert.equal(audit.observedGlobalCount, 2)
  assert.equal(audit.closingReconciled, false)
  assert.equal(audit.scopeComplete, false)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Blue Binaries stops at first public denial', async () => {
  for (const [status, body] of [[403, '<title>Access denied</title>'], [200, '<title>Attention Required! | Cloudflare</title>']]) {
    let reads = 0
    await assert.rejects(registered().run({ fetchPage: async url => { reads++; return { url, status, body } } }), /denied/i)
    assert.equal(reads, 1)
  }
})

test('Blue Binaries resolves a named role worksite only through a unique current declared country', async () => {
  for (const conflict of [false, true]) {
    let audit
    const contact = '<title>Connect To Us - BlueBinaries</title><div class="accordion-item"><h2><button>USA</button></h2><div><p>Michigan</p><p>100 W Big Beaver Rd, Suite 200, Troy, MI 48084</p></div></div>' + (conflict ? '<div class="accordion-item"><h2><button>India</button></h2><p>Troy, MI 48084</p></div>' : '')
    const jobs = await registered().run({ fetchPage: async url => ({ status: 200, url, body: url === 'https://www.bluebinaries.com/' ? home + '<a href="https://www.bluebinaries.com/connect-to-us/">Connect To Us</a>' : url.endsWith('/connect-to-us/') ? contact : page(card({ location: 'BlueBinaries Engineering and Solutions Inc., Troy, MI' })) }), onAudit: value => { audit = value } })
    assert.equal(jobs.length, 0)
    assert.equal(audit.nativeJobs[0].country, conflict ? null : 'United States')
    if (!conflict) { assert.equal(audit.nativeJobs[0].city, 'Troy'); assert.equal(audit.nativeJobs[0].state, 'MI') }
    assert.equal(audit.nativeJobs[0].sourceNativeCountryEvidence.basis, conflict ? null : 'current-employer-exact-worksite')
  }
})

test('Blue Binaries keeps opaque RGB and HSL criteria visible and complete', () => {
  for (const color of ['rgb(0,0,0)', 'hsl(0 0% 0%)', 'hsl(0,0%,0%)', 'rgba(0,0,0,1)', 'hsla(0,0%,0%,1)', 'rgb(0 0 0 / 1)']) {
    const result = visibleText(`<p style="color:${color}">Visible qualification.</p>`)
    assert.equal(result.unresolved, false, color)
    assert.equal(result.text, 'Visible qualification.', color)
  }
})

test('Blue Binaries excludes or withholds transparent RGB and HSL criteria', () => {
  for (const color of ['rgb(0 0 0 / 0)', 'rgba(0,0,0,0)', 'hsl(0 0% 0% / 0)', 'hsla(0,0%,0%,0)', 'rgb(0 0 0 / 0%)']) {
    const result = visibleText(`<p style="color:${color}">HIDDEN</p><p>Visible criteria.</p>`)
    assert.equal(result.text?.includes('HIDDEN') ?? false, false, color)
    assert.ok(result.unresolved || result.text === 'Visible criteria.', color)
  }
})

test('Blue Binaries applies the zero clamp to negative opacity and retains positive opacity', () => {
  for (const opacity of ['-1', '-1%', '-.5', '-0.5%', '-1e0', '-1e2%']) {
    const result = visibleText(`<p style="opacity:${opacity}">SYNTHETIC HIDDEN</p><p>VISIBLE</p>`)
    assert.equal(result.text, 'VISIBLE', opacity)
    assert.equal(result.unresolved, false, opacity)
  }
  for (const opacity of ['1', '0.25', '25%', '150%', '1e-1']) assert.equal(visibleText(`<p style="opacity:${opacity}">VISIBLE</p>`).text, 'VISIBLE', opacity)
  assert.equal(visibleText('<style>.zero{opacity:-1;visibility:visible}</style><p class="zero">SYNTHETIC HIDDEN</p><p>VISIBLE</p>').text, 'VISIBLE')
})

test('Blue Binaries preserves uncertainty for a descendant visibility override within the criteria scope', () => {
  const result = visibleText('<p style="visibility:hidden">HIDDEN<span style="visibility:visible">VISIBLE</span></p>')
  assert.ok(result.unresolved || result.text === 'VISIBLE')
  assert.equal(result.text?.includes('HIDDEN') ?? false, false)
  const doc = visibleDocument('<nav style="visibility:hidden">HIDDEN<span style="visibility:visible">Navigation</span></nav><article id="criteria">Visible criteria.</article>', n => n.attrs.id === 'criteria')
  assert.equal(doc.unresolved, false)
  assert.equal(doc.text(doc.nodes(n => n.attrs.id === 'criteria')[0]), 'Visible criteria.')
})
