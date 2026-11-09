import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parse } from 'acorn'

import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { CAREERS_URL, SOURCE, buildDarwinboxJobDetailUrl } from './script.js'

// Reuse the existing unit input bytes without executing the test module.
// These are synthetic native-shape controls, not current public observations.
const existing = fs.readFileSync(new URL('../../scraper-support/tests/HarbingerSystemsScript.test.js', import.meta.url), 'utf8')
const declarations = parse(existing, { ecmaVersion: 'latest', sourceType: 'module' }).body
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const literal = node => {
  if (node.type === 'Literal') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked
  if (node.type === 'ArrayExpression') return node.elements.map(literal)
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(property => {
    assert.equal(property.type, 'Property');assert.equal(property.computed, false)
    return [property.key.name || property.key.value, literal(property.value)]
  }))
  assert.fail('Unsupported existing literal fixture: ' + node.type)
}
const fixture = name => literal(declarations.find(node => node.id.name === name).init)
const careersHtml = fixture('careersHtml'), payload = fixture('darwinboxPayload')
const provider = getScraperCatalog().find(row => row.source === SOURCE)
const run = options => createCatalogScraper(provider).run(options)
const caller = label => ({ controller: new AbortController(), reason: Object.freeze(new Error(label)) })
const replacement = () => Object.assign(new Error('Controlled transport replaced the abort'), { abortRetries: true })
const response = body => {
  const value = new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
  Object.defineProperty(value, 'url', { value: CAREERS_URL })
  return value
}

test('registered Harbinger pre-abort preserves the frozen caller reason before any injected source read', async () => {
  const { controller, reason } = caller('Harbinger injected preabort')
  controller.abort(reason)
  let reads = 0
  await assert.rejects(run({ signal: controller.signal,
    fetchText: async () => { reads++;return careersHtml },
    fetchListingPage: async () => { reads++;return structuredClone(payload) },
  }), error => error === reason)
  assert.equal(reads, 0)
})

test('registered Harbinger default HTTP pre-abort starts no native fetch or listing callback', async t => {
  const { controller, reason } = caller('Harbinger default preabort')
  controller.abort(reason)
  let fetches = 0, listings = 0
  t.mock.method(globalThis, 'fetch', async () => { fetches++;return response(careersHtml) })
  await assert.rejects(run({ signal: controller.signal,
    fetchListingPage: async () => { listings++;return structuredClone(payload) },
  }), error => error === reason)
  assert.equal(fetches, 0);assert.equal(listings, 0)
})

for (const mode of ['fulfilled', 'rejected']) test('Harbinger restores exact caller cancellation after an injected corporate read ' + mode, async () => {
  const { controller, reason } = caller('Harbinger corporate ' + mode)
  let receivedSignal, listings = 0
  await assert.rejects(run({ signal: controller.signal,
    fetchText: async (url, options = {}) => {
      assert.equal(url, CAREERS_URL);receivedSignal = options.signal;controller.abort(reason)
      if (mode === 'rejected') throw replacement()
      return careersHtml
    },
    fetchListingPage: async () => { listings++;return structuredClone(payload) },
  }), error => error === reason)
  assert.equal(receivedSignal, controller.signal);assert.equal(listings, 0)
})

test('Harbinger default fetch forwards caller cancellation through a replacement HTTP error', async t => {
  const { controller, reason } = caller('Harbinger HTTP header cancellation')
  let fetches = 0, listings = 0, requestSignal
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, CAREERS_URL);fetches++;requestSignal = init.signal
    controller.abort(reason);throw replacement()
  })
  await assert.rejects(run({ signal: controller.signal,
    fetchListingPage: async () => { listings++;return structuredClone(payload) },
  }), error => error === reason)
  assert.equal(fetches, 1);assert.equal(listings, 0)
  assert.equal(requestSignal.aborted, true)
})

test('Harbinger default corporate body cannot become success after caller cancellation', async t => {
  const { controller, reason } = caller('Harbinger HTTP body cancellation')
  let bodyReads = 0, listings = 0
  t.mock.method(globalThis, 'fetch', async () => {
    const value = response(careersHtml)
    value.text = async () => { bodyReads++;controller.abort(reason);return careersHtml }
    return value
  })
  await assert.rejects(run({ signal: controller.signal,
    fetchListingPage: async () => { listings++;return structuredClone(payload) },
  }), error => error === reason)
  assert.equal(bodyReads, 1);assert.equal(listings, 0)
})

test('caller cancellation after the corporate read takes priority over a handoff-drift error', async () => {
  const { controller, reason } = caller('Harbinger handoff cancellation')
  let listings = 0
  await assert.rejects(run({ signal: controller.signal,
    fetchText: async () => { controller.abort(reason);return '<html>Unbound corporate body</html>' },
    fetchListingPage: async () => { listings++;return structuredClone(payload) },
  }), error => error === reason)
  assert.equal(listings, 0)
})

for (const mode of ['fulfilled', 'rejected']) test('Harbinger passes caller signal to the real Darwinbox listing stage ' + mode, async () => {
  const { controller, reason } = caller('Harbinger listing ' + mode)
  let receivedSignal, listings = 0
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => careersHtml,
    fetchListingPage: async options => {
      listings++;receivedSignal = options.signal;controller.abort(reason)
      if (mode === 'rejected') throw replacement()
      return structuredClone(payload)
    },
  }), error => error === reason)
  assert.equal(receivedSignal, controller.signal);assert.equal(listings, 1)
})

test('normal missing-signal Harbinger input preserves the existing native job fields and original date', async () => {
  const listingOptions = []
  const jobs = await run({ fetchText: async () => careersHtml,
    fetchListingPage: async options => { listingOptions.push(options);return structuredClone(payload) },
  })
  assert.equal(jobs.length, 1)
  const [job] = jobs, native = payload.data[0]
  assert.equal(job.source, SOURCE);assert.equal(job.company, 'Harbinger Systems')
  assert.equal(job.jobId, native.id);assert.equal(job.title, native.title)
  assert.equal(job.location, native.locations);assert.equal(job.country, native.country)
  assert.equal(job.jobDescription, native.jd);assert.equal(job.postingDate, native.posted_on)
  assert.equal(job.sourceUrl, buildDarwinboxJobDetailUrl(native.id))
  assert.equal(job.applyUrl, job.sourceUrl)
  assert.equal(listingOptions.length, 1);assert.equal(listingOptions[0].signal, undefined)
})

test('an ordinary missing-signal corporate transport error remains the original error', async () => {
  const error = Object.freeze(new Error('Ordinary non-abort corporate failure'))
  await assert.rejects(run({ fetchText: async () => { throw error } }), caught => caught === error)
})

test('an ordinary invalid native corporate handoff still stops before Darwinbox', async () => {
  let listings = 0
  await assert.rejects(run({ fetchText: async () => '<html>Unbound corporate body</html>',
    fetchListingPage: async () => { listings++;return structuredClone(payload) },
  }), /trusted first-party handoff/)
  assert.equal(listings, 0)
})
