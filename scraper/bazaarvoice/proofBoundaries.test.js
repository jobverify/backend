import assert from 'node:assert/strict'
import test from 'node:test'
import { readBazaarvoiceRawScripts, bazaarvoiceScriptMode, isReviewedBazaarvoiceClassicScript } from './scriptExecution.js'
import { stripBazaarvoicePrintCSS } from './screenStyles.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

const script = attributes => readBazaarvoiceRawScripts('<script ' + attributes + '>marker()</script>')[0]
for (const [attributes, mode, reviewed] of [
  ['', 'classic', true], ['type="" language="unknown"', 'classic', true],
  ['type="Text/JavaScript"', 'classic', true], ['type=" text/javascript "', 'classic', true],
  ['type="text&#47;javascript"', 'classic', true], ['type="&Tab;text/javascript&Tab;"', 'classic', true],
  ['type="application/x-javascript"', 'classic', false], ['language="JavaScript1.2"', 'classic', false],
  ['type="MoDuLe"', 'module', false], ['type=" module "', 'inert', false],
  ['type=" "', 'inert', false], ['type="application/json"', 'inert', false],
  ['type="text/javascript;charset=utf-8"', 'inert', false], ['language="not-a-browser-language"', 'inert', false],
  ['type="&nbsp;text/javascript"', 'opaque', false], ['type="text/unreviewed-script-alias"', 'opaque', false],
  ['nomodule', 'inert', false],
  ['type="application/json" type="text/javascript"', 'inert', false],
  ['type="text/javascript" type="application/json"', 'classic', true],
]) test('decoded first HTML attributes determine execution and reviewed mode: ' + attributes, () => {
  const node = script(attributes)
  assert.equal(bazaarvoiceScriptMode(node), mode)
  assert.equal(isReviewedBazaarvoiceClassicScript(node), reviewed)
})

for (const [name, html, count] of [
  ['hidden', '<script hidden>marker()</script>', 1],
  ['inert', '<div inert><script>marker()</script></div>', 1],
  ['display none', '<div style="display:none"><script>marker()</script></div>', 1],
  ['template', '<template><script>marker()</script></template><script>active()</script>', 1],
  ['noscript', '<noscript><script>marker()</script></noscript><script>active()</script>', 1],
  ['raw textarea', '<textarea><script>marker()</script></textarea>', 0],
  ['raw iframe fallback', '<iframe><script>marker()</script></iframe>', 0],
  ['HTML comment', '<!-- <script>marker()</script> --><script>active()</script>', 1],
]) test('raw script audit handles ' + name + ' independently of visual visibility', () => {
  assert.equal(readBazaarvoiceRawScripts(html).length, count)
})

test('NBSP stays part of an HTML attribute name and never becomes an ASCII separator', () => {
  const node = script('type\u00a0="application/json"')
  assert.equal(Object.hasOwn(node.attrs, 'type'), false)
  assert.equal(node.attrs['type\u00a0'], 'application/json')
  assert.equal(bazaarvoiceScriptMode(node), 'classic')
})

for (const html of [
  '<!--> <script>marker()</script> -->',
  '<!-- --!><script>marker()</script><!-- -->',
  '<template><script>marker()</script>',
  '<script><!-- <script>marker()</script>',
  '<svg><script>marker()</script></svg>',
]) test('ambiguous raw HTML cannot conceal potential scripts: ' + html.slice(0, 24), () => {
  assert.throws(() => readBazaarvoiceRawScripts(html))
})

test('raw script proof bounds document size and script count', () => {
  assert.throws(() => readBazaarvoiceRawScripts('x'.repeat(2 * 1024 * 1024 + 1)), /bound/)
  assert.throws(() => readBazaarvoiceRawScripts('<script></script>'.repeat(513)), /bound/)
})

for (const [name, css, visible] of [
  ['real print block', '@media print {[data-qa="job-description"]{display:none}}', true],
  ['real screen block', '@media screen {[data-qa="job-description"]{display:none}}', false],
  ['commented print token', '@media screen {/* @media print { */ [data-qa="job-description"]{display:none}}', false],
  ['quoted print token', '.decoration::before {content:"@media print {"} [data-qa="job-description"]{display:none}', false],
  ['adjacent screen block', '@media print {.button{display:none}} @media screen {[data-qa="job-description"]{display:none}}', false],
  ['quoted closing brace in print', '@media print {.decoration::before {content:"}"} [data-qa="job-description"]{display:none}}', true],
]) test('screen projection preserves the actual description visibility: ' + name, () => {
  const doc = readVisibleNativeDocument('<style>' + stripBazaarvoicePrintCSS(css) + '</style><div data-qa="job-description">Full native description</div>', { strict: true })
  assert.equal(doc.nodes(node => node.attrs['data-qa'] === 'job-description').length === 1, visible)
})

test('ambiguous CSS lexical contexts fail the optional visibility proof', () => {
  for (const css of ['/* @media print {', '.decoration{content:"@media print {', '@media print {.button{display:none}', '@media screen {.button{display:none}']) {
    assert.throws(() => stripBazaarvoicePrintCSS(css))
  }
})
