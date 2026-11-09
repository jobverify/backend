import assert from 'node:assert/strict'
import test from 'node:test'
import { extractDwrPayload } from '../shared/successFactorsDwr.js'
import { extractDwrPayload as extractVolkswagen } from '../../scraper/volkswagengrouptechnologysolutionsindia/script.js'
import { extractJobsFromJobsScript } from '../../scraper/wazirx/script.js'
import { parseRemoteLiteral, parseDwrData, parseSucuriCookieScript } from '../utils/remoteScriptData.js'
import { extractSucuriCookie } from '../../scraper/onwardtechnologies/script.js'

const response = body => `throw 'allowScriptTagRemoting is false.';${body};dwr.engine._remoteHandleCallback('0','0',{results:{postings:[],postingCount:0}});`
for (const [name, extract] of [['shared', extractDwrPayload], ['Volkswagen', extractVolkswagen]]) {
  test(`${name} DWR rejects host constructor escape without executing a sentinel`, () => {
    delete globalThis.__jobverifyDwrHostExecuted
    try {
      assert.throws(() => extract(response('dwr.engine._remoteHandleCallback.constructor("return globalThis")().__jobverifyDwrHostExecuted=true')))
      assert.equal(globalThis.__jobverifyDwrHostExecuted, undefined)
    } finally { delete globalThis.__jobverifyDwrHostExecuted }
  })
  test(`${name} DWR rejects calls, getters, prototype keys, cycles and oversized input`, () => {
    for (const body of ['var a=(()=>1)()', 'var a={get title(){return 1}}', 'var a={__proto__:{}}', 'var a={};a.constructor={}', 'var a={};a.self=a', 'var a="' + 'x'.repeat(2_100_000) + '"']) {
      assert.throws(() => extract(response(body)))
    }
  })
  test(`${name} DWR preserves declarations, member assignments, references and nested payload`, () => {
    const parsed = extract(`throw 'allowScriptTagRemoting is false.';var s0={},s1={},s2=[];s0.payload=s1;s1.results={postings:s2,postingCount:1};s2[0]={id:'123',title:'Engineer',otherValues:[]};dwr.engine._remoteHandleCallback('0','0',s0);`)
    assert.equal(parsed.results.postings[0].id, '123')
    assert.equal(parsed.results.postingCount, 1)
  })
}

test('WazirX jobs declaration rejects expressions, getters, prototype keys and trailing executable code', () => {
  for (const value of ['{role:(()=>1)()}', '{get role(){return 1}}', '{__proto__:{}}', '{};(()=>1)()', '{value:"' + 'x'.repeat(2_100_000) + '"}']) {
    assert.throws(() => extractJobsFromJobsScript(`const JOB_DATA = ${value};`))
  }
})

test('Sucuri rejects unknown decoded challenge programs and oversized scripts', () => {
  for (const source of ['document.cookie=(function(){return "sucuri_cloudproxy_uuid_test=value"})();', 'document.cookie="sucuri_cloudproxy_uuid_test=value";location.reload.constructor("return 1")();', 'document.cookie="sucuri_cloudproxy_uuid_test=value";var x={get y(){return 1}};', 'x'.repeat(2_100_000)]) {
    assert.throws(() => extractSucuriCookie(`<script>${source}</script>`))
  }
})

test('Astra rejects an unknown Sucuri challenge rather than treating it as an empty careers gate', async () => {
  const { createAstraMicrowaveScraper, isSucuriJavascriptGatePage, HOMEPAGE_URL, ROBOTS_URL } = await import('../../scraper/astramicrowave/script.js')
  const page = {status:307, html:'<title>You are being redirected...</title><noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript><script>String.constructor("return globalThis")();</script>'}
  // Gate classification is independent of decoding the opaque challenge. The
  // data-only decoder still rejects its program; the scraper records a gap.
  assert.throws(() => parseSucuriCookieScript('String.constructor("return globalThis")();'))
  assert.equal(isSucuriJavascriptGatePage(page), true)
  const requested = []
  await assert.rejects(createAstraMicrowaveScraper().run({ fetchPage: async url => {
    requested.push(url)
    return { ...page, url }
  } }), error => {
    assert.equal(error.code, 'ASTRA_MICROWAVE_COVERAGE_GAP')
    assert.equal(error.abortRetries, true)
    assert.equal(error.status, 307)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    assert.equal(error.lifecycleCleanupAllowed, false)
    return true
  })
  assert.deepEqual(requested, [HOMEPAGE_URL, ROBOTS_URL])
})

test('Astra opaque challenge classification never executes a sentinel program', async () => {
  const { isSucuriJavascriptGatePage } = await import('../../scraper/astramicrowave/script.js')
  delete globalThis.__jobverifyAstraChallengeExecuted
  try {
    const html = '<title>You are being redirected...</title><noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript><script>globalThis.__jobverifyAstraChallengeExecuted=true;</script>'
    assert.equal(isSucuriJavascriptGatePage({ status: 307, html }), true)
    assert.equal(globalThis.__jobverifyAstraChallengeExecuted, undefined)
    assert.equal(isSucuriJavascriptGatePage({ status: 200, html }), false)
    assert.equal(isSucuriJavascriptGatePage({ status: 307, html: html + '<h1>Current openings</h1>' }), false)
    assert.equal(globalThis.__jobverifyAstraChallengeExecuted, undefined)
  } finally { delete globalThis.__jobverifyAstraChallengeExecuted }
})

test('bounded literal conversion returns only inert data and preserves supported compiled values', () => {
  const parsed = parseRemoteLiteral('[{active:!0,disabled:!1,count:-2,text:`plain`,nested:[null,true]}]')
  assert.equal(Object.getPrototypeOf(parsed[0]), null)
  assert.equal(parsed[0].active, true)
  assert.equal(parsed[0].disabled, false)
  assert.equal(parsed[0].count, -2)
  assert.deepEqual(parsed[0].nested, [null,true])
  assert.equal(Object.getOwnPropertyDescriptor(parsed[0], 'text').get, undefined)
})

test('bounded literal grammar rejects alternate executable forms and nesting/token limits', () => {
  for (const source of ['[{["title"]:"Engineer"}]', '[{...{title:"Engineer"}}]', '[{title(){return "Engineer"}}]', '[new Date()]', '[import("node:fs")]', '[globalThis.value]', '[`value${1}`]', '[{prototype:1}]', '[{"__pro\\u0074o__":1}]', '['.repeat(90)+'0'+']'.repeat(90), '[' + '0,'.repeat(60_000) + '0]']) {
    assert.throws(() => parseRemoteLiteral(source))
  }
})

test('DWR rejects alternate callbacks, member reads, sparse arrays and expanding reference graphs', () => {
  for (const source of [
    'dwr.engine._remoteHandleCallback.call(null,"0","0",{})',
    'var a={};var b=a.value;dwr.engine._remoteHandleCallback("0","0",{})',
    'var a=[];a[10000]=1;dwr.engine._remoteHandleCallback("0","0",a)',
    'dwr.engine._remoteHandleCallback("0","0",{});dwr.engine._remoteHandleCallback("0","0",{})',
    'var s0=[];' + Array.from({length:20}, (_,i) => `var s${i+1}=[s${i},s${i}];`).join('') + 'dwr.engine._remoteHandleCallback("0","0",s20)',
  ]) assert.throws(() => parseDwrData(source))
})

test('Sucuri accepts fixed string operations and rejects malformed cookie data', () => {
  assert.equal(parseSucuriCookieScript('m=String.fromCharCode(97)+"b";document.cookie="sucuri_cloudproxy_uuid_test="+m+";path=/";location.reload();'), 'sucuri_cloudproxy_uuid_test=ab')
  for (const source of ['document.cookie="other=value";', 'document.cookie="sucuri_cloudproxy_uuid_test=value\\nother";', 'document.cookie="sucuri_cloudproxy_uuid_test="+String.fromCharCode(1);']) assert.throws(() => parseSucuriCookieScript(source))
})

test('literal conversion rejects nonfinite values and unsupported legacy escape encodings', () => {
  for (const source of ['[-1e999]', '["\\141"]']) assert.throws(() => parseRemoteLiteral(source))
})

const repeatedDwrTitle = title => {
  const postings = Array(128).fill('p').join(',')
  return `var s=${JSON.stringify(title)};var p={id:'1',title:s,otherValues:[]};dwr.engine._remoteHandleCallback('0','0',{results:{postingCount:128,postings:[${postings}]}});`
}

test('DWR bounds aggregate expanded ASCII bytes for repeated aliases', () => {
  assert.throws(() => parseDwrData(repeatedDwrTitle('a  '.repeat(40_000))))
  const parsed = parseDwrData(repeatedDwrTitle('a'.repeat(40_000)))
  assert.equal(parsed.results.postings.length, 128)
  assert.equal(parsed.results.postings[0].title.length, 40_000)
})

test('DWR charges UTF-8 bytes for every repeated Unicode alias', () => {
  const unicode = String.fromCodePoint(0x1f600)
  assert.throws(() => parseDwrData(repeatedDwrTitle(unicode.repeat(40_000))))
  const parsed = parseDwrData(repeatedDwrTitle(unicode.repeat(10_000)))
  assert.equal(parsed.results.postings.length, 128)
  assert.equal(parsed.results.postings[127].title, unicode.repeat(10_000))
})
