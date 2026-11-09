import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as collector from './nativeJobs.js'
import manifest from './test-data/renderer-manifest-20261103.js'
const gzip = fs.readFileSync(new URL('./test-data/renderer-20261103.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(gzip).digest('hex'), manifest.fixtureSha256)
const fixture = JSON.parse(gunzipSync(gzip))
for (const asset of [...fixture.css, fixture.client]) assert.equal(createHash('sha256').update(asset.body).digest('hex'), asset.sha256)
const context = () => collector.createBirlaRendererContext?.({ stylesheets: fixture.css, client: fixture.client.body }) || { unimplemented: true }
const withDescription = html => ({ ...fixture.cases[0].row, jobDescription: html })

test('native renderer recovery preserves exact complete text for every supported nonempty description', () => {
  assert.equal(fixture.cases.length, 161)
  assert.ok(fixture.baselines.every(row => row.sameText && row.liveText === row.replayText))
  const rendererContext = context(), recovered = fixture.cases.filter(row => row.expectedComplete)
  assert.equal(recovered.length, manifest.expectedComplete)
  for (const sample of recovered) {
    const job = collector.mapBirlaRole(sample.row, { rendererContext })
    assert.equal(job.sourceDetailComplete, true, sample.row.jobCode)
    assert.equal(job.sourceNativeDescriptionProjection.text, sample.expectedText, sample.row.jobCode)
    assert.equal(job.sourceNativeDescriptionProjection.inputSha256, sample.inputSha256, sample.row.jobCode)
    assert.equal(job.nativeDescriptionHtml, sample.row.jobDescription)
    assert.equal(job.requisitionId, null)
    assert.equal(job.requisitionCode, null)
  }
})

test('expired blob images, negative-side scrolling and fixed-width clipping remain exact per-posting gaps', () => {
  const rendererContext = context(), unresolved = fixture.cases.filter(row => !row.expectedComplete)
  assert.equal(unresolved.length, 20)
  for (const sample of unresolved) {
    const job = collector.mapBirlaRole(sample.row, { rendererContext })
    assert.equal(job.sourceDetailComplete, false)
    assert.ok(job.sourceNativeDescriptionProjection.gaps.length, sample.row.jobCode)
  }
})

test('unsupported native renderer CSS cannot authorize advanced description recovery', () => {
  const changed = fixture.css.map((asset,index) => index ? asset : { ...asset, body: asset.body + '.job-data{display:none}' })
  const rendererContext = collector.createBirlaRendererContext?.({ stylesheets: changed, client: fixture.client.body })
  assert.equal(collector.mapBirlaRole(fixture.cases[0].row, { rendererContext }).sourceDetailComplete, false)
})

test('source recovery preserves prose and decodes HTML entities exactly once', () => {
  const html = '<p style="mso-border-alt:solid black .5pt">Use style="font-family: Arial"; &amp;lt; remains literal, &alpha; is Greek.</p>'
  const job = collector.mapBirlaRole(withDescription(html), { rendererContext: context() })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceNativeDescriptionProjection.text, 'Use style="font-family: Arial"; &lt; remains literal, α is Greek.')
})

test('visibility, arbitrary clipping, negative offscreen layout and unknown CSS retain controls', () => {
  const rendererContext = context()
  const hidden = collector.mapBirlaRole(withDescription('<p style="opacity:0">Hidden eligibility</p><p style="mso-border-alt:solid black .5pt">Visible public responsibilities and requirements.</p>'), { rendererContext })
  assert.ok(!hidden.jobDescription.includes('Hidden eligibility'))
  for (const html of [
    '<div style="width:10px;height:10px;overflow:hidden;mso-border-alt:solid black .5pt">Long mandatory qualification which is clipped.</div>',
    '<p style="margin-left:-99999px;mso-border-alt:solid black .5pt">Mandatory offscreen qualification.</p>',
    '<p style="position:absolute;left:-99999px;mso-border-alt:solid black .5pt">Unknown layout.</p>',
    '<style>.candidate{display:none}</style><p class="candidate">Hidden requirement.</p>',
    '<p style="font-size-adjust:0;mso-border-alt:solid black .5pt">Unproved zero-size text.</p>',
  ]) assert.equal(collector.mapBirlaRole(withDescription(html), { rendererContext }).sourceDetailComplete, false, html)
})

test('table text credits require supported inherited font and wrapping bounds', () => {
  const rendererContext = context()
  const table = (ancestor, cell = '', span = '') => '<div style="' + ancestor + '"><table style="border:0"><tr><td style="padding:0;border:0;' + cell + '"><span style="font-family:Arial;' + span + '">ABCDEFGHIJKLMNOPQRSTUVWXYZ</span></td><td style="padding:0;border:0"><div style="margin-left:-8px;mso-border-alt:solid black .5pt">Mandatory eligibility</div></td></tr></table></div>'
  assert.equal(collector.mapBirlaRole(withDescription(table('font-size:16px')), { rendererContext }).sourceDetailComplete, true)
  for (const html of [table('font-size:1px'), table('font-size:16px;letter-spacing:-5px'),
    table('font-size:16px', 'word-break:break-all'), table('font-size:16px', '', 'font-stretch:condensed'),
    table('font-size:16px', '', 'display:inline-block;width:1px')]) {
    assert.equal(collector.mapBirlaRole(withDescription(html), { rendererContext }).sourceDetailComplete, false, html)
  }
})

test('reviewed copied Word and Excel classes are inert only within the proved native CSS context', () => {
  const rendererContext = context()
  const html = '<table><tr><td class="xl64"><p class="NormalTextRun SCXW28960072 BCX8">Public full mandatory criteria remain visible.</p></td></tr></table>'
  assert.equal(collector.mapBirlaRole(withDescription(html), { rendererContext }).sourceDetailComplete, true)
  for (const unsafe of ['<a class="xl64">Unreviewed anchor class behavior.</a>', '<p class="unreviewedCustomClass">Unreviewed criterion style.</p>']) {
    assert.equal(collector.mapBirlaRole(withDescription(unsafe), { rendererContext }).sourceDetailComplete, false)
  }
})

test('native table header cells receive no invented data-cell padding credit', () => {
  const rendererContext = context()
  const html = tag => '<table><tr><' + tag + '></' + tag + '><td style="padding:0;border:0"><div style="margin-left:-8px;mso-border-alt:solid black .5pt">Mandatory eligibility</div></td></tr></table>'
  assert.equal(collector.mapBirlaRole(withDescription(html('td')), { rendererContext }).sourceDetailComplete, true)
  assert.equal(collector.mapBirlaRole(withDescription(html('th')), { rendererContext }).sourceDetailComplete, false)
})

test('full-inventory renderer controls preserve every additional copied-class text and retain missing media or clipped criteria', () => {
  const rendererContext = context()
  assert.equal(fixture.additionalCases.length, 89)
  assert.equal(fixture.inertClassProof.verified, true)
  assert.equal(fixture.inertClassProof.references.every(row=>row.selectors.length===0), true)
  assert.equal(fixture.additionalCases.filter(row=>row.expectedComplete).length, 34)
  for (const sample of fixture.additionalCases) {
    const job = collector.mapBirlaRole(sample.row, { rendererContext })
    assert.equal(job.sourceDetailComplete, sample.expectedComplete, sample.row.jobCode)
    if (sample.expectedComplete) assert.equal(job.sourceNativeDescriptionProjection.text, sample.expectedText, sample.row.jobCode)
    else assert.ok(job.sourceNativeDescriptionProjection.gaps.length, sample.row.jobCode)
    assert.equal(job.nativeDescriptionHtml, sample.row.jobDescription)
  }
})

for (const [name,html] of [
  ['header uses its own actual width','<h2 style="font-family:Inter-Bold;font-size:14px;line-height:18px;white-space:nowrap;max-width:100%;overflow:hidden;width:1px">Mandatory safety certification</h2><p>Build reliable public services and satisfy all role qualification criteria.</p>'],
  ['inline flex uses its own actual width','<div style="width:712px"><span style="display:inline-flex;max-width:100%;overflow:hidden;width:1px">Mandatory criteria</span></div><p>Build reliable public services and satisfy all role qualification criteria.</p>'],
  ['child paragraphs inherit negative text indentation','<div style="margin-left:100px;text-indent:-100px"><p style="margin-left:-80px;mso-border-alt:solid black .5pt">Mandatory qualification requires current professional certification.</p></div>'],
  ['inline descendants retain the first-line negative indentation','<div style="margin-left:100px;text-indent:-100px"><span style="margin-left:-80px;mso-border-alt:solid black .5pt">Certification</span></div>'],
  ['child block indentation is applied once','<div style="text-indent:100px"><p style="margin-left:-180px;mso-border-alt:solid black .5pt">Certification</p></div>'],
]) test(name, () => {
  assert.equal(collector.mapBirlaRole(withDescription(html), { rendererContext:context() }).sourceDetailComplete, false)
})
