import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createUdaanScraper } from './script.js'

const root = 'https://udaan.com/'
const fixture = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`,import.meta.url))))
const official = '<title>Udaan - B2B Buying for Retailers</title><h1>India’s Largest eB2B Platform for Small Businesses Owners</h1><a href="/about-us">About us</a>'
const response = (body, url, status = 200, location = null) => ({body, url, status, headers:{get:key => key.toLowerCase() === 'location' ? location : null}, text:async () => body})
const gap = error => {
  assert.equal(error.code, 'UDAAN_COVERAGE_GAP')
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.lifecycleCleanupAllowed, false)
  return true
}

test('real official commerce page binds its icon-only LinkedIn employer handoff', async () => {
  const raw = fixture('official-responses')
  const calls = []
  await assert.rejects(createUdaanScraper().run({fetchImpl:async url => {
    calls.push(url)
    return url === root ? response(raw[0].body,url) : response('blocked',url,429)
  }}), error => {gap(error); assert.equal(error.inventoryEvidence.firstParty,true); return true})
  assert.deepEqual(calls,[root,'https://www.linkedin.com/company/udaan/'])
})

test('real employer-filtered no-match response remains a company inventory coverage gap', async () => {
  const official = fixture('official-responses')
  const company = fixture('native-company')
  const listing = fixture('native-jobs')[0]
  const calls = []
  await assert.rejects(createUdaanScraper().run({fetchImpl:async url => {
    calls.push(url)
    const r = [...official,company,listing].find(r => r.url === url)
    assert.ok(r,`Unexpected request ${url}`)
    return response(r.body,url,r.status)
  }}),error => {
    gap(error)
    assert.match(error.message,/employer-filtered India search has no matches/)
    assert.equal(error.inventoryEvidence.pagesFetched,3)
    assert.equal(error.retainedResponses.length,3)
    return true
  })
  assert.equal(calls.at(-1), listing.url)
})

test('retained raw native bodies match manifest gzip and uncompressed SHA256', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest.json',import.meta.url)))
  const sha = body => createHash('sha256').update(body).digest('hex')
  for (const f of manifest.fixtures) {
    const zipped = readFileSync(new URL(`./fixtures/${f.file}`,import.meta.url)), raw = gunzipSync(zipped)
    assert.equal(sha(zipped),f.gzipSHA256)
    assert.equal(sha(raw),f.rawSHA256)
    assert.equal(raw.length,f.rawBytes)
    let records = JSON.parse(raw)
    if (!Array.isArray(records)) records = [records]
    for (const [index,r] of records.entries()) if (r.body != null) assert.equal(sha(r.body),f.responses[index].bodySHA256)
  }
})

test('Udaan makes a fresh official request and never certifies absent listings as empty', async () => {
  const calls = []
  await assert.rejects(createUdaanScraper().run({fetchImpl:async url => {
    calls.push(url)
    if (url === root) return response(official, url)
    if (url === 'https://udaan.com/careers') return response('', url, 302, 'https://careers.udaan.com/')
    throw new Error('DNS unavailable')
  }}), error => {
    gap(error)
    assert.equal(error.inventoryEvidence.firstParty, true)
    assert.ok(error.retainedResponses.some(r => r.url === root && r.body === official))
    return true
  })
  assert.deepEqual(calls, [root, 'https://udaan.com/careers', 'https://careers.udaan.com/'])
})

test('wrong or hidden-only commerce identity never initiates a careers request', async () => {
  for (const body of ['<h1>Udaan charity</h1>', `<template>${official}</template>`, '<script>India’s Largest eB2B Platform for Small Businesses Owners</script>']) {
    let count = 0
    await assert.rejects(createUdaanScraper().run({fetchImpl:async url => {count++; return response(body,url)}}), gap)
    assert.equal(count, 1)
  }
})

test('untrusted careers redirects are not fetched', async () => {
  const calls = []
  await assert.rejects(createUdaanScraper().run({fetchImpl:async url => {
    calls.push(url)
    return url === root ? response(official,url) : response('',url,302,'https://udaan-charity.example/jobs')
  }}),gap)
  assert.equal(calls.length,2)
})

test('HTTP errors, final URL changes, empty and oversized official bodies are typed gaps', async () => {
  for (const r of [response('blocked',root,403), response(official,'https://udaan.org/'), response('',root), response('x'.repeat(5000001),root)]) {
    await assert.rejects(createUdaanScraper().run({fetchImpl:async () => r}),gap)
  }
})

test('one aggregate deadline bounds request and body stalls', async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async url => ({url,status:200,text:async () => new Promise(() => {})})]) {
    await assert.rejects(createUdaanScraper().run({fetchImpl,timeoutMs:15}),gap)
  }
})

test('caller cancellation is preserved exactly before, during request and during body', async () => {
  for (const stage of ['before','request','body']) {
    const controller = new AbortController(), reason = {stage}
    if (stage === 'before') controller.abort(reason)
    await assert.rejects(createUdaanScraper().run({signal:controller.signal,fetchImpl:async url => {
      if (stage === 'request') {controller.abort(reason); return new Promise(() => {})}
      return {url,status:200,text:async () => {controller.abort(reason); return new Promise(() => {})}}
    }}),error => error === reason)
  }
})
