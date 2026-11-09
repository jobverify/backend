import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectOfficialPage, inspectNativeClient } from './nativeBinding.js'
import { primary, client, packets, changedPacket, fixtureReader } from './test-data/fixture.mjs'
import { collect } from './native.js'
const official = source => inspectOfficialPage(source || primary.body)
const binding = source => inspectNativeClient(source || client.body, official())
const replace = (source, before, after) => { assert.ok(source.includes(before), before); return source.replace(before, after) }

test('actual official page binds one visible native hook, publisher, script and literal account', () => {
  const proof = official()
  assert.equal(proof.account, 542477); assert.equal(proof.hostId, 'whr_embed_hook')
  assert.equal(proof.scriptURL, 'https://www.workable.com/assets/embed.js')
  assert.equal(proof.canonical, 'https://flatgigs.com/career/')
  assert.equal(proof.publisherQualified, true); assert.equal(proof.reciprocalDomainQualified, false)
})
test('actual native client supplies only the observed routes and optional detail capability', () => {
  const proof = binding()
  assert.equal(proof.titlesURL, 'https://apply.workable.com/api/v1/widget/accounts/542477?origin=embed&callback=whrcallback')
  assert.equal(proof.detailsURL, proof.titlesURL + '&details=true')
  assert.equal(proof.hostSelector, '#whr_embed_hook'); assert.equal(proof.callback, 'whrcallback')
  assert.deepEqual(proof.detailModes, ['descriptions', 'description', 'all', 'true'])
  assert.equal(proof.runtimeExecuted, false); assert.equal(proof.fullDescriptionRendered, false)
})
test('a controlled zero-argument ordinary ready callback uses the same finite literal contract', () => {
  assert.equal(official(replace(primary.body, 'whr(document).ready(() => {', 'whr(document).ready(function() {')).account, 542477)
})
for (const [name, before, after] of [
  ['canonical', 'href="https://flatgigs.com/career/"', 'href="https://other.invalid/career/"'],
  ['publisher title', '<title>Career - Flatgigs</title>', '<title>Career - Other</title>'],
  ['account', 'whr_embed(542477,', 'whr_embed(542478,'],
  ['dynamic account', 'whr_embed(542477,', 'whr_embed(account,'],
  ['domain override', '"base":"jobs"', '"domain":"https://other.invalid","base":"jobs"'],
  ['target override', '"base":"jobs"', '"target":"#other","base":"jobs"'],
  ['duplicate option', '"base":"jobs"', '"base":"other","base":"jobs"'],
  ['wrong options', '"detail":"titles"', '"detail":"all"'],
  ['async script', 'src="https://www.workable.com/assets/embed.js"', 'async src="https://www.workable.com/assets/embed.js"'],
  ['deferred script', 'src="https://www.workable.com/assets/embed.js"', 'defer src="https://www.workable.com/assets/embed.js"'],
  ['nomodule script', 'src="https://www.workable.com/assets/embed.js"', 'nomodule src="https://www.workable.com/assets/embed.js"'],
  ['shadowed callback', 'whr(document).ready(() => {', 'whr(document).ready((whr_embed) => {'],
  ['nonterminating initializer prefix', 'whr(document).ready(() => {', 'while(true){};whr(document).ready(() => {'],
  ['nonterminating callback suffix', '"grouping":"none"});', '"grouping":"none"});while(true){}'],
  ['early callback return', 'whr(document).ready(() => {', 'whr(document).ready(() => {return;'],
]) test('official binding rejects ' + name, () => assert.throws(() => official(replace(primary.body, before, after))))
for (const attributes of ['hidden', 'aria-hidden="true"', 'style="display:none"', 'style="opacity:0"', 'class="md:nfd-hidden"']) test('hidden hook cannot admit the API route: ' + attributes, () => {
  assert.throws(() => official(replace(primary.body, 'id="whr_embed_hook"', 'id="whr_embed_hook" ' + attributes)))
})
test('a hidden duplicate hook cannot establish an exact native target', () => {
  assert.throws(() => official(primary.body.replace('</body>', '<div hidden id="whr_embed_hook"></div></body>')))
})
test('duplicate actual initializer and an active global override remain ambiguous', () => {
  const script = '<script>whr(document).ready(()=>{whr_embed(542477,{"base":"jobs","detail":"titles","zoom":"country","grouping":"none"})});</script>'
  assert.throws(() => official(primary.body.replace('</body>', script + '</body>')))
  assert.throws(() => official(primary.body.replace('</body>', '<script>whr_embed=()=>null</script></body>')))
})
test('comments, quoted code and an uncalled function cannot replace the actual initializer', () => {
  const text = '\n  whr(document).ready(() => {\n    whr_embed(542477, {"base":"jobs","detail":"titles","zoom":"country","grouping":"none"});\n  });\n'
  for (const replacement of ['/*' + text + '*/', '"whr_embed(542477,{})";', 'function unused(){' + text + '}']) assert.throws(() => official(replace(primary.body, text, replacement)))
})
for (const [name, mutate] of [
  ['program prefix loop', source => 'while(true){};' + source],
  ['program suffix loop', source => source + ';while(true){}'],
  ['immediate owner suffix loop', source => replace(source, 'n(n.s=191)})();', 'n(n.s=191);while(true){};})();')],
  ['shadowed immediate owner', source => replace(source, '(()=>{var e=', '((window)=>{var e=')],
  ['unreachable entry module', source => replace(source, 'n(851),n(555),n(227),n(990)', 'return;n(851),n(555),n(227),n(990)')],
  ['nonterminating protocol owner', source => replace(source, 'window.whr_embed=function(e,t){', 'window.whr_embed=function(e,t){while(true){};')],
  ['unknown protocol owner call', source => replace(source, 'window.whr_embed=function(e,t){', 'window.whr_embed=function(e,t){spin();')],
  ['domain', source => replace(source, 't.domain||"https://apply.workable.com"', 't.domain||"https://other.invalid"')],
  ['detail suffix', source => source.replaceAll('"&details=true"', '"&detail=guessed"')],
  ['callback URL', source => source.replaceAll('?origin=embed&callback=whrcallback', '?origin=embed&callback=other')],
  ['unknown JSONP request option', source => replace(source, 'callback:"whrcallback",cache:', 'beforeSend:()=>false,callback:"whrcallback",cache:')],
]) test('native client contract rejects ' + name, () => assert.throws(() => binding(mutate(client.body))))
test('native client cannot select an API template from a string-only replacement', () => {
  assert.throws(() => binding(JSON.stringify(client.body) + ';'))
})
for (const [name, before, after] of [
  ['unknown evaluated grouping initializer', 'Object.freeze({DEPARTMENT:"department",LOCATION:"location"})', 'Object.freeze(spin())'],
  ['unknown evaluated request option', 'callback:"whrcallback",cache:!0', 'callback:"whrcallback",cache:spin()'],
  ['hoisted client namespace shadow', "var a='    <ul", "var whr='',a='    <ul"],
  ['missing namespace startup dependency', 'n(851),n(555),n(227),n(990)', 'n(851),n(227),n(990)'],
]) test('native client finite admission rejects ' + name, () => assert.throws(() => binding(replace(client.body, before, after))))

const addScript = script => replace(primary.body, '</body>', script + '</body>')
const actualInitializer = primary.body.match(/<script type="text\/javascript" charset="utf-8">[\s\S]*?<\/script>/)?.[0]
assert.ok(actualInitializer)
for (const [name, script] of [
  ['plain global replacement', '<script>window.whr_embed=function(){return null;};</script>'],
  ['escaped string property', '<script>window["w\\u0068r_embed"]=function(){return null;};</script>'],
  ['escaped identifier property', '<script>window.w\\u0068r_embed=function(){return null;};</script>'],
  ['hidden script replacement', '<script hidden>window.whr_embed=function(){return null;};</script>'],
  ['inline CSS hidden script replacement', '<script style="display:none">window.whr_embed=function(){return null;};</script>'],
  ['hidden wrapper replacement', '<div hidden><script>window.whr_embed=function(){return null;};</script></div>'],
  ['CSS-hidden wrapper with escaped replacement', '<div class="md:nfd-hidden"><script>window["w\\u0068r_embed"]=function(){return null;};</script></div>'],
]) test('executable script semantics rejects ' + name + ' without executing native code', () => {
  assert.throws(() => official(addScript(script)), /conflicting.*binding/)
})
for (const [name, wrapped] of [
  ['hidden script element', actualInitializer.replace('<script ', '<script hidden ')],
  ['CSS-hidden script wrapper', '<div class="md:nfd-hidden">' + actualInitializer + '</div>'],
]) test('finite native initializer remains executable inside a ' + name, () => {
  const proof = official(replace(primary.body, actualInitializer, wrapped))
  assert.equal(proof.account, 542477); assert.equal(proof.hostId, 'whr_embed_hook'); assert.equal(proof.runtimeExecuted, false)
})
for (const [name, inert] of [
  ['template replacement', '<template><script>window.whr_embed=function(){return null;};</script></template>'],
  ['template duplicate initializer', '<template>' + actualInitializer + '</template>'],
  ['non-JavaScript replacement data', '<script type="application/json">window["w\\u0068r_embed"]=null;</script>'],
]) test('genuinely inert ' + name + ' cannot replace or duplicate an existing native binding', () => {
  assert.equal(official(addScript(inert)).account, 542477)
})
for (const [name, inert] of [
  ['template', '<template>' + actualInitializer + '</template>'],
  ['non-JavaScript data type', actualInitializer.replace('type="text/javascript"', 'type="application/json"')],
  ['module execution type', actualInitializer.replace('type="text/javascript"', 'type="module"')],
  ['conditional nomodule execution', actualInitializer.replace('<script ', '<script nomodule ')],
]) test('a ' + name + ' cannot establish the synchronous classic initializer', () => {
  assert.throws(() => official(replace(primary.body, actualInitializer, inert)))
})
test('decoded escaped initializer identifiers use the same finite AST contract', () => {
  const escaped = actualInitializer.replace('whr(document)', 'w\\u0068r(document)').replace('whr_embed(', 'w\\u0068r_embed(')
  assert.equal(official(replace(primary.body, actualInitializer, escaped)).account, 542477)
})
for (const [name, script] of [
  ['potential executable module replacement', '<script type="module">window["w\\u0068r_embed"]=null;</script>'],
  ['unsupported direct script type', '<script type="text/unqualified">window.whr_embed=null;</script>'],
  ['unsupported object fallback context', '<object><script>window.whr_embed=null;</script></object>'],
  ['unresolved computed namespace write', '<script>window["w"+"hr_embed"]=function(){return null;};</script>'],
  ['unresolved explicit namespace mutator', '<script>Object.defineProperty(window,"w"+"hr_embed",{value:function(){return null;}});</script>'],
]) test(name + ' cannot be silently excluded from binding qualification', () => {
  assert.throws(() => official(addScript(script)))
})
for (const statement of ['window["w\\u0068r_embed"]=function(){return null;};', 'window.w\\u0068r_embed=function(){return null;};']) test('coordinator stops at the official response for an active decoded replacement: ' + statement, async () => {
  const changed = { ...changedPacket(primary, addScript('<script>' + statement + '</script>')), evidenceOrigin: 'CONTROLLED_SCRIPT_BINDING_MUTATION_NOT_A_NATIVE_CAPTURE' }
  const reader = fixtureReader({}, [changed, ...packets.slice(1)])
  await assert.rejects(collect({ fetchPacket: reader.read }), /conflicting.*binding/)
  assert.deepEqual(reader.seen.map(row => row.url), ['https://flatgigs.com/career/'])
})

// These mutate retained primary bytes as controlled syntax cases, not native captures.
const unresolvedDirectWrite = reference => "const key='whr_'+'embed';" + reference + '[key]=function(){return null;};'
for (const reference of ['window', '(window)', '((window))', '(globalThis)', '((self))', '(this)', '( /* controlled */ w\\u0069ndow /* controlled */ )', '(window\n)']) test('direct namespace write reaches the AST guard through parentheses: ' + JSON.stringify(reference), () => {
  assert.throws(() => official(addScript('<script>' + unresolvedDirectWrite(reference) + '</script>')), /conflicting.*binding/)
})
test('parenthesized namespace with a known unrelated literal property does not invent a widget conflict', () => {
  const proof = official(addScript('<script>(window)["flatgigs_unit_only_other"] = null;</script>'))
  assert.equal(proof.account, 542477); assert.equal(proof.runtimeExecuted, false)
})
for (const [name, inert] of [
  ['template', '<template><script>' + unresolvedDirectWrite('(window)') + '</script></template>'],
  ['data block', '<script type="application/json">' + unresolvedDirectWrite('(window)') + '</script>'],
]) test('parenthesized namespace text inside an inert ' + name + ' cannot replace an executable binding', () => {
  assert.equal(official(addScript(inert)).account, 542477)
})
for (const wrapper of ['hidden', 'class="md:nfd-hidden"']) test('parenthesized namespace write remains executable inside wrapper ' + wrapper, () => {
  assert.throws(() => official(addScript('<div ' + wrapper + '><script>' + unresolvedDirectWrite('(window)') + '</script></div>')), /conflicting.*binding/)
})
for (const reference of ['window', '(window)']) test('paired direct namespace coordinator stops before the client/API: ' + reference, async t => {
  const html = addScript('<script>' + unresolvedDirectWrite(reference) + '</script>')
  const controlled = { ...changedPacket(primary, html), evidenceOrigin: 'CONTROLLED_DIRECT_NAMESPACE_PARENTHESES_NOT_A_NATIVE_CAPTURE' }, reader = fixtureReader({}, [controlled, ...packets.slice(1)])
  let jobs, error
  try { jobs = await collect({ fetchPacket: reader.read }) } catch (caught) { error = caught }
  t.diagnostic(JSON.stringify({ reference, nativeReads: reader.seen.map(row => row.url), rejected: Boolean(error), controlledRows: jobs?.length ?? null, handoffFlags: jobs?.map(job => job.nativePublisherHandoffQualified) ?? null, runtimeExecuted: false }))
  assert.ok(error, 'unresolved direct namespace write must withhold the handoff')
  assert.deepEqual(reader.seen.map(row => row.url), ['https://flatgigs.com/career/'])
})
