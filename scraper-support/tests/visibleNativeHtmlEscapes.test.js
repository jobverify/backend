import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readVisibleNativeDocument } from '../utils/visibleNativeHtml.js'

const receipt = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/visibleNativeHtmlEscapes/flatgigs-primary-20261031.json.gz', import.meta.url))))
const body = Buffer.from(receipt.rawBodyBase64, 'base64'), html = body.toString('utf8')
assert.equal(body.length, receipt.bytes)
assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
assert.equal(receipt.sha256, 'd752cf531e02f0224788641f7738444b08c1b3ce233bebb634373ab2d72504e4')
const hostCount = source => readVisibleNativeDocument(source, { strict: true }).nodes(node => node.attrs.id === 'whr_embed_hook').length
const links = (source, strict = true) => readVisibleNativeDocument('<!doctype html>' + source, { strict }).nodes(node => node.tag === 'a').map(node => node.attrs.href)
const pair = (selector, literal, strict = true) => links('<style>' + selector + '{display:none!important}</style><a class="' + literal + '" href="hidden">Hidden</a><a class="unrelated" href="visible">Visible</a>', strict)

test('actual Flatgigs primary retains its native host despite an unrelated escaped responsive class', () => assert.equal(hostCount(html), 1))
test('actual Flatgigs host with the literal escaped class remains hidden', () => {
  const changed = html.replace('id="whr_embed_hook"', 'id="whr_embed_hook" class="md:nfd-hidden"')
  assert.notEqual(changed, html)
  assert.equal(hostCount(changed), 0)
})
test('actual Flatgigs ancestor with the literal escaped class remains hidden', () => {
  const changed = html.replace('class="entry-content"', 'class="entry-content md:nfd-hidden"')
  assert.notEqual(changed, html)
  assert.equal(hostCount(changed), 0)
})
for (const strict of [false, true]) {
  test('escaped colon matches only its complete literal class in mode ' + strict, () => assert.deepEqual(pair(String.raw`.md\:hidden`, 'md:hidden', strict), ['visible']))
  test('an absent escaped class does not hide arbitrary nodes in mode ' + strict, () => assert.deepEqual(links(String.raw`<style>.md\:hidden{display:none}</style><a class="md" href="visible">Visible</a>`, strict), ['visible']))
  test('escaped ancestor stays limited to its literal matching scope in mode ' + strict, () => {
    const source = String.raw`<style>.sm\:hidden .job{display:none}</style><div class="sm:hidden"><a class="job" href="hidden">Hidden</a><a href="ordinary">Ordinary</a></div><a class="job" href="visible">Visible</a>`
    assert.deepEqual(links(source, strict), ['ordinary', 'visible'])
  })
}
test('class names retain exact case after decoding escapes', () => assert.deepEqual(links(String.raw`<style>.md\:hidden{display:none}</style><a class="MD:hidden" href="visible">Visible</a><a class="md:hidden" href="hidden">Hidden</a>`), ['visible']))
test('escaped ID retains exact case and HTML type names retain existing casing', () => assert.deepEqual(links(String.raw`<style>A#role\:one{display:none}</style><a id="role:one" href="hidden">Hidden</a><a id="ROLE:one" href="visible">Visible</a>`), ['visible']))
test('a decoded type inside the native DOM vocabulary matches exactly', () => assert.deepEqual(links(String.raw`<style>di\76  .job{display:none}</style><div><a class="job" href="hidden">Hidden</a></div><section><a class="job" href="visible">Visible</a></section>`), ['visible']))
for (const [selector, tag] of [[String.raw`di\-`, 'di-'], [String.raw`di\:`, 'di:']]) test('an escaped type with a suffix truncated by the native DOM stays conservative: ' + selector, () => assert.deepEqual(links('<style>' + selector + ' .job{display:none}</style><' + tag + '><a class="job" href="hidden">Hidden</a></' + tag + '><a href="visible">Visible</a>'), ['visible']))
for (const [selector, tag] of [[String.raw`di\.v`, 'di.v'], [String.raw`di\e9`, 'dié'], [String.raw`di\7c v`, 'di|v']]) test('an escaped type outside native DOM vocabulary stays conservative: ' + selector, () => assert.deepEqual(links('<style>' + selector + '  .job{display:none}</style><' + tag + '><a class="job" href="hidden">Hidden</a></' + tag + '><a href="visible">Visible</a>'), ['visible']))
for (const [selector, literal] of [
  [String.raw`.md\3a hidden`, 'md:hidden'],
  [String.raw`.md\00003a hidden`, 'md:hidden'],
  [String.raw`.md\3Ahidden`, 'md:hidden'],
  [String.raw`.\31 23`, '123'],
  [String.raw`.\00003123`, '123'],
  [String.raw`.a\00003ab`, 'a:b'],
  [String.raw`.caf\e9`, 'café'],
  [String.raw`.a\3ab`, 'a' + String.fromCodePoint(0x3ab)],
]) test('hex escape denotes its full literal identifier: ' + selector, () => assert.deepEqual(pair(selector, literal), ['visible']))
test('hex escape greediness does not create a colon token from a different code point', () => assert.deepEqual(links(String.raw`<style>.a\3ab{display:none}</style><a class="a:b" href="visible">Visible</a>`), ['visible']))
for (const separator of [' ', '\t', '\n', '\r\n', '\f']) test('one hex delimiter is consumed inside its compound: ' + JSON.stringify(separator), () => {
  const source = '<style>.x\\3a' + separator + '.job{display:none}</style><div class="x:"><a class="job" href="nested">Nested</a></div><a class="x: job" href="hidden">Hidden</a><a href="visible">Visible</a>'
  assert.deepEqual(links(source), ['nested', 'visible'])
})
test('a second whitespace after a hex delimiter remains a descendant combinator', () => assert.deepEqual(links('<style>.x\\3a  .job{display:none}</style><div class="x:"><a class="job" href="hidden">Hidden</a><a href="ordinary">Ordinary</a></div><a class="job" href="visible">Visible</a>'), ['ordinary', 'visible']))
for (const [escaped, literal] of [
  [String.raw`a\.b`, 'a.b'], [String.raw`a\#b`, 'a#b'], [String.raw`a\,b`, 'a,b'],
  [String.raw`a\>b`, 'a>b'], [String.raw`a\+b`, 'a+b'], [String.raw`a\~b`, 'a~b'],
  [String.raw`a\[b\]`, 'a[b]'], [String.raw`a\{b\}`, 'a{b}'], [String.raw`a\(b\)`, 'a(b)'],
  [String.raw`a\:before`, 'a:before'], [String.raw`path\\name`, String.raw`path\name`],
]) test('escaped punctuation stays in one class token: ' + escaped, () => assert.deepEqual(pair('.' + escaped, literal), ['visible']))
test('escaped commas do not split selector lists in either mode', () => {
  const source = String.raw`<style>.a\,b, .other{display:none}</style><a class="a,b" href="hidden">Hidden</a><a class="a" href="visible">Visible</a><a class="other" href="other-hidden">Other</a>`
  assert.deepEqual(links(source), ['visible']); assert.deepEqual(links(source, false), ['visible'])
})
test('escaped combinators cannot manufacture an ancestor relationship', () => assert.deepEqual(links(String.raw`<style>.a\>b .job{display:none}</style><div class="a>b"><a class="job" href="hidden">Hidden</a></div><div class="a"><div class="b"><a class="job" href="visible">Visible</a></div></div>`), ['visible']))
test('escaped braces stay in selector identifiers and cannot damage the following rule', () => assert.deepEqual(links(String.raw`<style>.a\{b\}{display:none}.other{opacity:0}</style><a class="a{b}" href="hidden">Hidden</a><a class="other" href="other-hidden">Other</a><a href="visible">Visible</a>`), ['visible']))
for (const escape of [String.raw`\0`, String.raw`\d800`, String.raw`\110000`]) test('out-of-range escaped code point follows CSS replacement semantics: ' + escape, () => assert.deepEqual(pair('.x' + escape, 'x\uFFFD'), ['visible']))
for (const [escape, code] of [[String.raw`\a0 `, 0xa0], [String.raw`\2003 `, 0x2003], [String.raw`\b `, 0xb]]) test('non-ASCII-HTML-whitespace code point remains inside its literal class token: ' + code.toString(16), () => assert.deepEqual(pair('.x' + escape + 'y', 'x' + String.fromCodePoint(code) + 'y'), ['visible']))
for (const invalidCodeUnit of ['\u0000', '\ud800']) test('CSS input preprocessing preserves replacement semantics for escaped raw code unit ' + invalidCodeUnit.charCodeAt(0).toString(16), () => assert.deepEqual(pair('.x\\' + invalidCodeUnit, 'x\uFFFD'), ['visible']))
test('an escaped trailing whitespace belongs to an ID rather than a selector combinator', () => assert.deepEqual(links('<style>#x\\ {display:none}</style><a id="x " href="hidden">Hidden</a><a id="x" href="visible">Visible</a>'), ['visible']))
test('a hex-escaped pseudo-element colon remains literal identifier content', () => assert.deepEqual(pair(String.raw`.x\3a before`, 'x:before'), ['visible']))
test('a real pseudo-element after an escaped class cannot hide its originating element', () => assert.deepEqual(links(String.raw`<style>.x\:y::before{opacity:0}</style><a class="x:y" href="visible">Visible</a>`), ['visible']))
test('unknown pseudo constraints remain conservative within their known escaped-class scope', () => assert.deepEqual(links(String.raw`<style>.x\:y:unknown(.anything){display:none}</style><a class="x:y" href="hidden">Hidden</a><a href="visible">Visible</a>`), ['visible']))
test('unsupported namespace syntax containing an escape remains unqualified', () => assert.ok(!links(String.raw`<style>*|.x\:y .job{display:none}</style><div><a class="job" href="hidden">Hidden</a></div>`).includes('hidden')))
for (const newline of ['\n', '\r', '\r\n', '\f']) test('invalid backslash-newline escape stays conservative: ' + JSON.stringify(newline), () => assert.deepEqual(links('<style>.absent\\' + newline + '{display:none}</style><a href="unqualified">Unqualified</a>'), []))
test('unsupported escaped attribute values cannot expose a potentially hidden matching class', () => assert.ok(!links(String.raw`<style>.x\:y[data-state="a\:b"]{display:none}</style><a class="x:y" data-state="a:b" href="hidden">Hidden</a>`).includes('hidden')))
test('ordinary attribute constraints remain applied after a literal escaped class', () => assert.deepEqual(links(String.raw`<style>.x\:y[data-state=hidden]{display:none}</style><a class="x:y" data-state="hidden" href="hidden">Hidden</a><a class="x:y" data-state="visible" href="visible">Visible</a>`), ['visible']))
test('escaped backslash before a closing attribute quote does not swallow the target selector', () => assert.deepEqual(links(String.raw`<style>[data-state="a\\"] .x\:y{display:none}</style><div data-state="a\"><a class="x:y" href="hidden">Hidden</a><a href="visible">Visible</a></div>`), ['visible']))
for (const order of [0, 1]) test('matching hidden escaped classes stay unqualified despite visible specificity/cascade candidate order ' + order, () => {
  const hide = String.raw`.x\:y{display:none!important}`, show = '#role{display:block!important}'
  assert.deepEqual(links('<style>' + (order ? show + hide : hide + show) + '</style><a id="role" class="x:y" href="hidden">Hidden</a>'), [])
})
for (const condition of ['@media print', '@supports(display:no-such-value)']) test('conditional hiding remains conservative for matching escaped classes: ' + condition, () => {
  assert.deepEqual(links('<style>' + condition + String.raw`{.x\:y{display:none}}</style><a class="x:y" href="hidden">Hidden</a><a href="visible">Visible</a>`), ['visible'])
})

for (const code of [0xa0, 0x2003]) test('raw non-CSS whitespace stays inside the escaped class token: ' + code.toString(16), () => {
  const char = String.fromCodePoint(code)
  assert.deepEqual(links('<style>.md\\:one' + char + 'two{display:none}</style><a class="md:one' + char + 'two" href="hidden">Hidden</a><a href="visible">Visible</a>'), ['visible'])
})
test('unsupported raw vertical tab cannot prove an escaped hiding constraint inapplicable', () => {
  assert.equal(links('<style>.md\\:one\vtwo{display:none}</style><a class="md:one\vtwo" href="hidden">Hidden</a><a href="visible">Visible</a>').includes('hidden'), false)
})
test('attribute word matching after an escaped class uses CSS whitespace', () => {
  const token = 'one\u00a0two'
  assert.deepEqual(links('<style>.md\\:one[data-label~="' + token + '"]{display:none}</style><a class="md:one" data-label="' + token + '" href="hidden">Hidden</a><a href="visible">Visible</a>'), ['visible'])
})

{
const raw = String.raw
const reviewedAbsenceCases = [
  { id: 'named-colon-class-regression', css: raw`.md\:hidden{display:none}`, attributes: 'class="md&colon;hidden"', expectedVisible: false, browser: true },
  { id: 'decimal-colon-class-control', css: raw`.md\:hidden{display:none}`, attributes: 'class="md&#58;hidden"', expectedVisible: false, browser: true },
  { id: 'named-colon-id-regression', css: raw`#role\:one{display:none}`, attributes: 'id="role&colon;one"', expectedVisible: false, browser: true },
  { id: 'numeric-colon-id-control', css: raw`#role\:one{display:none}`, attributes: 'id="role&#x3a;one"', expectedVisible: false, browser: true },
  { id: 'named-nbsp-class-regression', css: raw`.role\a0{display:none}`, attributes: 'class="role&nbsp;"', expectedVisible: false, browser: true },
  { id: 'numeric-nbsp-class-control', css: raw`.role\a0{display:none}`, attributes: 'class="role&#160;"', expectedVisible: false, browser: true },
  { id: 'named-nbsp-id-regression', css: raw`#role\a0{display:none}`, attributes: 'id="role&nbsp;"', expectedVisible: false, browser: true },
  { id: 'numeric-nbsp-id-control', css: raw`#role\a0{display:none}`, attributes: 'id="role&#160;"', expectedVisible: false, browser: true },
  { id: 'raw-nul-class-regression', css: raw`.role\0{display:none}`, attributes: 'class="role\u0000"', expectedVisible: false, browser: true },
  { id: 'replacement-class-control', css: raw`.role\0{display:none}`, attributes: 'class="role\ufffd"', expectedVisible: false, browser: true },
  { id: 'raw-nul-id-regression', css: raw`#role\0{display:none}`, attributes: 'id="role\u0000"', expectedVisible: false, browser: true },
  { id: 'replacement-id-control', css: raw`#role\0{display:none}`, attributes: 'id="role\ufffd"', expectedVisible: false, browser: true },
]
const reviewedHTMLFor = row => '<!doctype html><style>' + row.css + '</style><main><a data-probe="target" href="https://example.invalid/native-role" ' + row.attributes + '>Native role criteria</a></main>'

for (const strict of [false, true]) for (const row of reviewedAbsenceCases) test('reviewed exact attribute absence regression ' + row.id + ' strict=' + strict, () => {
  const document = readVisibleNativeDocument(reviewedHTMLFor(row), { strict })
  assert.equal(document.nodes(node => node.attrs['data-probe'] === 'target').length, 0)
})
}

{
  const raw = String.raw
  const controlledCases = [
    { id: 'numeric-nul-class', css: raw`.role\0{display:none}`, attributes: 'class="role&#0;"' },
    { id: 'numeric-nul-id', css: raw`#role\0{display:none}`, attributes: 'id="role&#x0;"' },
    { id: 'numeric-surrogate-class', css: raw`.role\0{display:none}`, attributes: 'class="role&#xd800;"' },
    { id: 'numeric-surrogate-id', css: raw`#role\0{display:none}`, attributes: 'id="role&#55296;"' },
    { id: 'numeric-windows1252-class', css: raw`.role\20ac{display:none}`, attributes: 'class="role&#x80;"' },
    { id: 'numeric-windows1252-id', css: raw`#role\20ac{display:none}`, attributes: 'id="role&#128;"' },
    { id: 'semicolonless-nbsp-class', css: raw`.role\a0{display:none}`, attributes: 'class="role&nbsp"' },
    { id: 'semicolonless-nbsp-id', css: raw`#role\a0{display:none}`, attributes: 'id="role&nbsp"' },
    { id: 'one-pass-entity-class', css: raw`.literal\&nbsp\;{display:none}`, attributes: 'class="literal&#38;nbsp;"' },
    { id: 'one-pass-entity-id', css: raw`#literal\&nbsp\;{display:none}`, attributes: 'id="literal&#38;nbsp;"' },
    { id: 'raw-cr-id', css: raw`#role\a name{display:none}`, attributes: 'id="role\rname"' },
    { id: 'unquoted-nbsp-class-boundary', css: raw`.role\a0 name{display:none}`, attributes: 'class=role\u00a0name' },
    { id: 'unquoted-nbsp-id-boundary', css: raw`#role\a0 name{display:none}`, attributes: 'id=role\u00a0name' },
    { id: 'unquoted-vt-class-boundary', css: raw`.role\b name{display:none}`, attributes: 'class=role\vname' },
    { id: 'unquoted-vt-id-boundary', css: raw`#role\b name{display:none}`, attributes: 'id=role\vname' },
    { id: 'bound-attribute-after-escaped-class', css: raw`.md\:hidden[data-label="role "]{display:none}`, attributes: 'class="md:hidden" data-label="role&nbsp;"' },
  ]
  for (const strict of [false, true]) for (const row of controlledCases) test('controlled attribute-ambiguity guard ' + row.id + ' strict=' + strict, () => {
    const document = readVisibleNativeDocument('<!doctype html><style>' + row.css + '</style><a data-probe="target" ' + row.attributes + '>Native role criteria</a>', { strict })
    assert.equal(document.nodes(node => node.attrs['data-probe'] === 'target').length, 0)
  })
  for (const strict of [false, true]) {
    test('ambiguity stays within its field/value and unrelated ASCII classes retain absence proof strict=' + strict, () => {
      const source = raw`<style>.md\:hidden{display:none}</style><a class="md&colon;hidden" href="hidden">Hidden</a><a class="unrelated" href="visible">Visible</a>`
      assert.deepEqual(links(source, strict), ['visible'])
    })
    test('an ambiguous ID cannot change an unambiguous class comparison strict=' + strict, () => {
      assert.deepEqual(links(raw`<style>.md\:hidden{display:none}</style><a id="role&colon;one" class="unrelated" href="visible">Visible</a>`, strict), ['visible'])
    })
    test('a literal ampersand identifier still supplies a genuine hidden match strict=' + strict, () => {
      assert.deepEqual(links(raw`<style>.literal\&x{display:none}</style><a class="literal&x" href="hidden">Hidden</a><a class="unrelated" href="visible">Visible</a>`, strict), ['visible'])
    })
    test('an entity-like boundary cannot mint exact escaped-identifier absence strict=' + strict, () => {
      assert.equal(links(raw`<style>.md\:hidden{display:none}</style><a class="md&colon=hidden" href="unknown">Unknown</a>`, strict).includes('unknown'), false)
    })
  }
  test('unsupported overflowing numeric HTML reference remains a fail-closed parser error', () => {
    assert.throws(() => readVisibleNativeDocument(raw`<style>.role\0{display:none}</style><a class="role&#x110000;">Unknown</a>`, { strict: true }), RangeError)
  })
}
