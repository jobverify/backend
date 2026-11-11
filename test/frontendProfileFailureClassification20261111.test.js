import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'
import { run as greatRun } from '../scraper/greatlearning/script.js'
import { run as anandRun } from '../scraper/anandengineeringproductspvtltd/script.js'
import { verifyStyles, verifyCSS } from '../scraper/greatlearning/currentDeclarations.js'
import { document as greatDocument } from '../scraper/greatlearning/currentHtml.js'
import { failure as greatFailure, need as greatNeed, isFailure as greatOwned } from '../scraper/greatlearning/currentErrors.js'
import { readHome, readRoleDeclaration } from '../scraper/anandengineeringproductspvtltd/currentDeclarations.js'
import { failure as anandFailure, need as anandNeed, isFailure as anandOwned } from '../scraper/anandengineeringproductspvtltd/currentErrors.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const fixture = source => {
  const value = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261107/' + source + '-current.json.gz', import.meta.url))))
  for (const packet of value.packets) {
    const bytes = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(bytes.length, packet.bodyBytes)
    assert.equal(sha(bytes), packet.bodySHA256)
  }
  return value
}
const great = fixture('greatlearning'), anand = fixture('anand')
const packet = (data, url) => {
  const value = data.packets.find(row => row.requestedURL === url)
  assert.ok(value, 'Only retained actual packet URLs are read')
  return { ...value, text: Buffer.from(value.bodyBase64, 'base64').toString('utf8') }
}
const GREAT_HOME = 'https://www.mygreatlearning.com/', ANAND_HOME = 'https://anandengg.in/'
const greatHome = packet(great, GREAT_HOME)
const anandHome = packet(anand, ANAND_HOME)
const firstAnand = anand.independentOracle.roles[0]
const anandRole = packet(anand, firstAnand.url)
const anandOrg = readHome(anandHome.text).organization
const soft = { softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' }
const hard = { softFailure: false, upstreamOutage: false, failureKind: 'hard_failure' }
const capture = operation => { try { operation() } catch (error) { return error } assert.fail('The rejected profile must fail closed') }
const assertProfile = (error, owned, message) => {
  assert.ok(error instanceof Error)
  assert.equal(owned(error), true)
  assert.match(error.message, message)
  assert.deepEqual(classifyScraperError(error), soft)
  assert.equal(error.upstreamOutage, false)
  assert.equal(error.nativeRecords, undefined)
}

// Original fixtures are genuine retained packets. All changed documents/models
// below are explicitly authored diagnostics, never new native captures or facts.
const sourceCases = [
  { source: 'Great Learning', run: greatRun, owned: greatOwned, home: GREAT_HOME, body: '<!doctype html><html><head><script type="application/ld+json">{"@type":"Organization"}</script></head><body></body></html>', message: /unreviewed home renderer style inputs/ },
  { source: 'Anand', run: anandRun, owned: anandOwned, home: ANAND_HOME, body: '<!doctype html><html><head><script type="application/ld+json">[]</script></head><body></body></html>', message: /unreviewed native schema shape/ },
]
for (const source of sourceCases) {
  test(source.source + ' public run treats explicit unfamiliar frontend/schema profile as a soft closed hold', async () => {
    let calls = 0, audits = 0, records = 0
    await assert.rejects(source.run({ fetchResponse: async url => {
      calls++
      assert.equal(url, source.home)
      return { status: 200, finalURL: url, contentType: 'text/html', headers: {}, bytes: Buffer.from(source.body) }
    }, onAudit: () => { audits++ }, onRecords: () => { records++ } }), error => {
      assertProfile(error, source.owned, source.message)
      assert.equal(error.nativeOriginalResponses.length, 1)
      assert.equal(error.nativeOriginalResponses[0].bodySHA256, sha(source.body))
      if (source.source === 'Anand') { assert.equal(error.code, 'ANAND_NATIVE_CONTRACT'); assert.equal(error.abortRetries, true) }
      return true
    })
    assert.equal(calls, 1)
    assert.equal(audits, 0)
    assert.equal(records, 0)
  })
  test(source.source + ' local invalid observation clock stays owned and hard before IO', async () => {
    let calls = 0
    await assert.rejects(source.run({ now: 'invalid local clock', fetchResponse: async () => { calls++; assert.fail('No read after invalid local clock') } }), error => {
      assert.equal(source.owned(error), true)
      assert.match(error.message, /invalid observation clock/)
      assert.deepEqual(classifyScraperError(error), hard)
      assert.equal(error.softFailure, undefined)
      return true
    })
    assert.equal(calls, 0)
  })
  test(source.source + ' injected ordinary local TypeError keeps its exact cause and hard classification', async () => {
    const primary = new TypeError('Cannot read properties of undefined (reading localParserField)')
    await assert.rejects(source.run({ fetchResponse: async () => { throw primary } }), error => {
      assert.equal(error.cause, primary)
      assert.deepEqual(classifyScraperError(error), { softFailure: false, upstreamOutage: false, failureKind: 'parser_or_contract_error' })
      assert.equal(primary.softFailure, undefined)
      return true
    })
  })
  for (const [label, reason] of [['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze({ caller: 'opaque reason' })], ['default', undefined]]) {
    test(source.source + ' caller ' + label + ' wins before unfamiliar-profile rejection without metadata mutation', async () => {
      const controller = new AbortController()
      let calls = 0, audits = 0
      await assert.rejects(source.run({ signal: controller.signal, fetchResponse: async url => {
        calls++
        controller.abort(reason)
        return { status: 200, finalURL: url, contentType: 'text/html', headers: {}, bytes: Buffer.from(source.body) }
      }, onAudit: () => { audits++ } }), error => error === controller.signal.reason)
      assert.equal(calls, 1)
      assert.equal(audits, 0)
      if (reason && typeof reason === 'object') assert.equal(Object.hasOwn(reason, 'softFailure'), false)
    })
  }
}

const freshGreat = () => greatDocument(greatHome.text)
const nodes = doc => doc.nodes(node => node.tag === 'root')[0]
const rawNodes = node => typeof node === 'string' ? [] : [node, ...node.children.flatMap(rawNodes)]
const styles = doc => rawNodes(nodes(doc)).filter(node => node.tag === 'style')
for (const [label, change, message] of [
  ['inline style bytes', doc => { styles(doc)[0].raw += '\n' }, /renderer style inputs/],
  ['nonce carrier', doc => { styles(doc).find(node => Object.hasOwn(node.attrs, 'nonce')).attrs.nonce = 'unreviewed-nonce-control' }, /nonce carrier/],
  ['style attributes', doc => { styles(doc)[0].attrs['data-profile-review'] = 'authored' }, /style-element attributes/],
  ['stylesheet declarations', doc => { rawNodes(nodes(doc)).find(node => node.tag === 'link' && node.attrs.rel === 'stylesheet').attrs.media = 'unreviewed-profile-media' }, /stylesheet declarations/],
  ['critical renderer ancestry', doc => { nodes(doc).attrs['data-profile-review'] = 'authored' }, /critical renderer ancestry/],
  ['document base', doc => { nodes(doc).children.push({ tag: 'base', attrs: { href: GREAT_HOME }, children: [] }) }, /document base/],
]) test('Great Learning explicit unreviewed ' + label + ' remains rejected with soft drift metadata', () => {
  const doc = freshGreat()
  change(doc)
  assertProfile(capture(() => verifyStyles(doc, 'home')), greatOwned, message)
})

for (const [kind, url] of [['home', GREAT_HOME], ['careers', GREAT_HOME + 'careers'], ['role', great.independentOracle.roles[0].url]]) {
  test('Great Learning unchanged retained ' + kind + ' profile keeps its exact review output', () => {
    const value = verifyStyles(greatDocument(packet(great, url).text), kind)
    assert.equal(value.programsExecuted, false)
    assert.equal(value.staticDOMMode, 'normal-static-document-no-program-execution')
    assert.ok(value.inlineStyleSHA256.length > 0)
  })
}
test('Great Learning an invalid local renderer kind stays hard', () => {
  const error = capture(() => verifyStyles(freshGreat(), 'not-a-reviewed-local-coordinate'))
  assert.equal(greatOwned(error), true)
  assert.deepEqual(classifyScraperError(error), hard)
  assert.equal(error.softFailure, undefined)
})
test('Great Learning missing local renderer coordinate stays hard', () => {
  const error = capture(() => verifyStyles({ nodes: () => [] }, 'home'))
  assert.match(error.message, /expected one renderer document/)
  assert.deepEqual(classifyScraperError(error), hard)
})
test('Great Learning object renderer coordinate retains its original hard coordinate failure and coercion count', () => {
  let calls = 0
  const coordinate = { toString() { calls++; return 'home' } }
  const error = capture(() => verifyStyles(freshGreat(), coordinate))
  assert.match(error.message, /expected one job-opening-container/)
  assert.deepEqual(classifyScraperError(error), hard)
  assert.equal(calls, 4)
})
test('Great Learning existing changed external CSS classification and rejection remain intact', () => {
  const error = capture(() => verifyCSS(Buffer.from('/* authored unknown external CSS */')))
  assert.deepEqual(classifyScraperError(error), soft)
})

test('Anand retained complete role template remains accepted with its native fields', () => {
  const role = readRoleDeclaration(anandRole.text, firstAnand, anandOrg)
  assert.equal(role.canonicalURL, firstAnand.url)
  assert.equal(role.jsonURL, ANAND_HOME + 'wp-json/wp/v2/job-opening/' + firstAnand.postID)
})
test('Anand explicit unfamiliar outside-criteria template remains rejected with owned soft drift metadata', () => {
  const changed = anandRole.text.replace(/data-elementor-type=(["'])single-post\1/, '$& data-profile-review="authored"')
  assert.notEqual(changed, anandRole.text)
  const error = capture(() => readRoleDeclaration(changed, firstAnand, anandOrg))
  assertProfile(error, anandOwned, /unreviewed native template outside complete criteria column/)
  assert.equal(error.code, 'ANAND_NATIVE_CONTRACT')
  assert.equal(error.abortRetries, true)
})
for (const [source, make, need, owned] of [['Great Learning', greatFailure, greatNeed, greatOwned], ['Anand', anandFailure, anandNeed, anandOwned]]) {
  test(source + ' default failure and need preserve ordinary owned hard errors', () => {
    const direct = make('invalid local coordinate')
    const rejected = capture(() => need(false, 'invalid local coordinate'))
    for (const error of [direct, rejected]) {
      assert.equal(owned(error), true)
      assert.equal(error.softFailure, undefined)
      assert.deepEqual(classifyScraperError(error), hard)
    }
  })
}
