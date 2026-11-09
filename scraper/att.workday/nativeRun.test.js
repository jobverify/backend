import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

const first = gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261025/att-india5.html.gz', import.meta.url))).toString('utf8')
const indiaUrl = 'https://www.att.jobs/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D'
const now = '2026-10-25T17:50:00.000Z'
async function source() {
  assert.ok(fs.existsSync(new URL('./script.js', import.meta.url)), 'AT&T needs a public native source instead of its empty SpecialInvite Workday inventory')
  return import('./script.js')
}

for (const options of [{maxJobs: 10}, {maxPages: 2}]) {
  test(`AT&T rejects ${Object.keys(options)[0]} truncation before treating the scope as inventory`, async () => {
    const {run} = await source()
    let requests = 0
    await assert.rejects(run({now, ...options, fetch: async url => {
      requests++
      assert.equal(url, indiaUrl)
      return {status: 200, url, text: async () => first}
    }}), /AT&T native.*(?:cap|limit|truncat)/i)
    assert.equal(requests, 1)
  })
}

test('AT&T cancellation prevents the first network request', async () => {
  const {run} = await source()
  const controller = new AbortController()
  controller.abort(Error('Test source cancellation'))
  let requests = 0
  await assert.rejects(run({now, signal: controller.signal, fetch: async () => { requests++ }}), /cancellation/)
  assert.equal(requests, 0)
})

test('AT&T rejects status, redirects and empty bootstrap bodies without returning empty inventory', async () => {
  const {run} = await source()
  for (const response of [
    {status: 403, url: indiaUrl, text: async () => first},
    {status: 200, url: 'https://other.example/', text: async () => first},
    {status: 200, url: indiaUrl, text: async () => ''},
  ]) {
    let requests = 0
    await assert.rejects(run({now, fetch: async () => { requests++; return response }}), /AT&T native/i)
    assert.equal(requests, 1)
  }
})

test('AT&T bounds an injected native body wait and aborts the request signal', async () => {
  const {run} = await source()
  let requestSignal
  await assert.rejects(run({now, timeoutMs: 50, fetch: async (url, init) => {
    requestSignal = init.signal
    return {status: 200, url, text: () => new Promise(() => {})}
  }}), /timeout|deadline|abort/i)
  assert.equal(requestSignal.aborted, true)
})
