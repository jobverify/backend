import assert from 'node:assert/strict'
import test from 'node:test'
import { corporateScriptNodes, createCorporateFeedReader, requireCorporatePublisher } from '../utils/currentCorporateFeed20261118.js'

const initializer = 'setupFilterAndJobs("https://boards-api.greenhouse.io/v1/boards/lob/jobs?content=true","#filter",".jobs")'
for (const script of [`if(0){${initializer}}`, `if(""){${initializer}}`, `if(null){${initializer}}`,
  `if(false){${initializer}}`, `if(unknownRuntimeFlag){${initializer}}`, `false&&${initializer}`,
  `function unused(){${initializer}}`, `while(false){${initializer}}`, `for(;false;){${initializer}}`,
  `function run(){return;${initializer}}run()`, `function run(){throw Error('stopped');${initializer}}run()`,
  `function run(){if(true)return;${initializer}}run()`, `if(enabled){${initializer}}const enabled=true`,
  `function run(){try{return}finally{};${initializer}}run()`,
  `document.getElementById('absent').addEventListener('load',()=>{${initializer}})`,
  `try{const ok=true}catch(error){${initializer}}`]) {
  test('Unreachable or unqualified corporate script branch cannot authorize a feed: ' + script.slice(0, 35), () => {
    const nodes = corporateScriptNodes('<script>' + script + '</script>')
    assert.equal(nodes.filter(n => n.type === 'CallExpression' && n.callee.name === 'setupFilterAndJobs').length, 0)
  })
}

for (const title of ['Globex careers', 'Developers globe careers']) {
  test('Corporate employer identity cannot match Lob inside another word: ' + title, () => {
    assert.throws(() => requireCorporatePublisher('<title>' + title + '</title>', 'Lob'))
  })
}

test('Corporate page callback timeout bounds a hook which never settles', async () => {
  const reader = createCorporateFeedReader('timeout-case', { sourceTimeoutMs: 20, fetchPage: () => new Promise(() => {}) })
  const result = reader.readPage('https://publisher.test/careers')
  const outcome = await Promise.race([result.then(() => 'resolved', error => error.name),
    new Promise(resolve => setTimeout(() => resolve('hung'), 120))])
  assert.equal(outcome, 'TimeoutError')
})

test('Corporate body reads obey caller cancellation even when a stream stalls', async () => {
  const controller = new AbortController(), reason = Error('Caller stopped this source')
  let disposed = false
  const reader = createCorporateFeedReader('body-case', { signal: controller.signal, fetchImpl: async () => ({
    status: 200, url: 'https://publisher.test/careers', headers: new Headers(), body: { getReader: () => ({
      read: () => new Promise(() => {}), cancel: async () => { disposed = true }, releaseLock() {},
    }) },
  }) })
  const result = reader.readPage('https://publisher.test/careers')
  setTimeout(() => controller.abort(reason), 20)
  const outcome = await Promise.race([result.then(() => null, error => error),
    new Promise(resolve => setTimeout(() => resolve('hung'), 120))])
  assert.equal(outcome, reason)
  assert.equal(disposed, true)
})

test('A response acquired after cancellation is disposed without changing the caller abort reason', async () => {
  const controller = new AbortController(), reason = Error('Caller cancelled acquisition')
  let resolveFetch, disposed = false
  const reader = createCorporateFeedReader('late-response-case', { signal: controller.signal,
    fetchImpl: () => new Promise(resolve => { resolveFetch = resolve }) })
  const result = reader.readPage('https://publisher.test/careers')
  await new Promise(resolve => setTimeout(resolve, 5))
  controller.abort(reason)
  await assert.rejects(result, error => error === reason)
  resolveFetch({ body: { cancel: async () => { disposed = true } } })
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(disposed, true)
})
