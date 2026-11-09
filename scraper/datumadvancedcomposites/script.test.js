import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Datum Advanced Composites scraper module at ./script.js')
  }
}

test('Datum Advanced Composites sentinel pins the verified unresolved first-party surface', async () => {
  const datum = await loadModule()

  assert.equal(datum.SOURCE, 'datumadvancedcomposites')
  assert.equal(datum.COMPANY, 'Datum Advanced Composites')
  assert.equal(datum.VERIFIED_ON, '2026-07-13')
  assert.equal(
    datum.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy public first-party careers surface was discoverable on July 13, 2026, and the verified canonical company hostnames did not resolve.',
  )
  assert.deepEqual(datum.CAREER_HOSTS, [
    'datumadvancedcomposites.com',
    'www.datumadvancedcomposites.com',
    'datumadvancedcomposites.in',
    'www.datumadvancedcomposites.in',
    'datumadvancedcomposites.co.in',
    'www.datumadvancedcomposites.co.in',
    'datumcomposites.com',
    'www.datumcomposites.com',
    'datumcomposites.in',
    'www.datumcomposites.in',
  ])
  assert.equal(datum.hasResolvableFirstPartyHost([]), false)
  assert.equal(datum.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Datum Advanced Composites sentinel returns no jobs only while all verified first-party hosts remain unresolved', async () => {
  const datum = await loadModule()
  const calls = []

  const jobs = await datum.createDatumAdvancedCompositesScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [datum.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Datum Advanced Composites sentinel fails closed when any verified first-party hostname starts resolving', async () => {
  const datum = await loadModule()

  await assert.rejects(
    datum.createDatumAdvancedCompositesScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Datum Advanced Composites canonical first-party hosts now resolve/i,
  )
})

test('resolveCareerHosts bounds and parallelizes stalled DNS lookups', async () => {
  const datum = await loadModule()
  const calls = []
  const never = (family) => async (host) => {
    calls.push(`${family}:${host}`)
    return new Promise(() => {})
  }
  const startedAt = Date.now()

  const addresses = await datum.resolveCareerHosts(
    ['one.example', 'two.example'],
    {
      resolve4Impl: never('v4'),
      resolve6Impl: never('v6'),
      timeoutMs: 10,
    },
  )

  assert.deepEqual(addresses, [])
  assert.deepEqual(calls.sort(), [
    'v4:one.example',
    'v4:two.example',
    'v6:one.example',
    'v6:two.example',
  ])
  assert.ok(Date.now() - startedAt < 150)
})
