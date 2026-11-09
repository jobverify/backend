import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { captureCurrentPublicScope } from './publicScope.js'

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/current-native-20261101.json.gz', import.meta.url))))
const opening = captured.audit.openingEmployerHtml, closing = captured.audit.closingEmployerHtml

test('same actual Dataiku page qualifies across genuine Flight packet order and reference renumbering', () => {
  const a = captureCurrentPublicScope(opening), b = captureCurrentPublicScope(closing)
  assert.equal(a.qualified, true)
  assert.equal(b.qualified, true)
  assert.equal(a.fingerprint, b.fingerprint)
  assert.equal(a.flightRecords, 42)
  assert.equal(b.flightRecords, 42)
  assert.notEqual(a.flightPackets, b.flightPackets, 'real stream packet counts differ')
})

for (const [label, extra] of [
  ['visible custom recruiting link', '<a href="https://careers.dataiku.com/roles">Open positions</a>'],
  ['hidden script mutation', '<script hidden>window.currentJobs = [];</script>'],
  ['CSS-hidden script mutation', '<script style="display:none">window.currentJobs = [];</script>'],
  ['abrupt comment with another hiring surface', '<!--><a href="https://careers.dataiku.com/roles">Open positions</a><!-- -->'],
  ['alternate comment boundary', '<!-- changed--!><a href="https://careers.dataiku.com/roles">Open positions</a><!-- -->'],
  ['inline child document', '<iframe srcdoc="&lt;a href=&quot;https://jobs.lever.co/dataiku&quot;&gt;Open positions&lt;/a&gt;"></iframe>'],
  ['image recruiting control', '<input type="image" alt="Open positions" formaction="https://external.example/search">'],
  ['hidden accessible name', '<span id="&nbsp;" hidden>Open positions</span><a href="https://external.example/search" aria-labelledby="&nbsp;">Learn more</a>'],
]) test('current public scope is withdrawn for ' + label, () => {
  const changed = opening.replace('</body>', extra + '</body>')
  assert.notEqual(changed, opening)
  assert.equal(captureCurrentPublicScope(changed).qualified, false)
})

test('ordinary inert comments cannot change the approved current public scope', () => {
  const changed = opening.replace('</body>', '<!-- ordinary inert review marker --></body>')
  assert.equal(captureCurrentPublicScope(changed).qualified, true)
})

for (const [label, change] of [
  ['nonexecuting Flight record', html => html.replace('<script>self.__next_f.push(', '<script type="application/json">self.__next_f.push(')],
  ['unreviewed Flight mutation', html => html.replace(/(<script>self\.__next_f\.push\([\s\S]*?\);?)(<\/script>)/,
    '$1;window.currentJobs=[];$2')],
  ['noncanonical script closing', html => html.replace('</script>', '</script data-review>')],
  ['employer handoff removed', html => html.replaceAll('https://job-boards.greenhouse.io/dataiku', 'https://job-boards.greenhouse.io/other')],
]) test('scope rejects ' + label, () => {
  const changed = change(opening)
  assert.notEqual(changed, opening)
  assert.equal(captureCurrentPublicScope(changed).qualified, false)
})
