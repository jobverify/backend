import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected PyzqL Ltd scraper module at ./script.js')
  }
}

test('PyzqL Ltd sentinel pins the verified no-first-party-host surface from July 13, 2026', async () => {
  const pyzql = await loadModule()

  assert.equal(pyzql.SOURCE, 'pyzqlltd')
  assert.equal(pyzql.COMPANY, 'PyzqL Ltd')
  assert.equal(pyzql.VERIFIED_ON, '2026-07-13')
  assert.equal(
    pyzql.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical PyzqL Ltd hostnames did not resolve.',
  )
  assert.deepEqual(pyzql.CAREER_HOSTS, [
    'pyzqlltd.com',
    'www.pyzqlltd.com',
    'pyzqlltd.in',
    'www.pyzqlltd.in',
    'pyzqlltd.co.in',
    'www.pyzqlltd.co.in',
    'pyzqltd.com',
    'www.pyzqltd.com',
    'pyzqltd.in',
    'www.pyzqltd.in',
    'pyzqltd.co.in',
    'www.pyzqltd.co.in',
    'pyzql.com',
    'www.pyzql.com',
    'pyzql.in',
    'www.pyzql.in',
    'pyzql.co.in',
    'www.pyzql.co.in',
  ])
  assert.equal(pyzql.hasResolvableFirstPartyHost([]), false)
  assert.equal(pyzql.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('PyzqL Ltd sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const pyzql = await loadModule()
  const calls = []

  const jobs = await pyzql.createPyzqLLtdScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [pyzql.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('PyzqL Ltd sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const pyzql = await loadModule()

  await assert.rejects(
    pyzql.createPyzqLLtdScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /PyzqL Ltd canonical first-party hosts now resolve/i,
  )
})
