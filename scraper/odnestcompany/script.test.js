import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected OdNest Company scraper module at ./script.js')
  }
}

test('OdNest Company sentinel pins the verified no-first-party-host surface from July 13, 2026', async () => {
  const odnest = await loadModule()

  assert.equal(odnest.SOURCE, 'odnestcompany')
  assert.equal(odnest.COMPANY, 'OdNest Company')
  assert.equal(odnest.VERIFIED_ON, '2026-07-13')
  assert.equal(
    odnest.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical OdNest hostnames did not resolve.',
  )
  assert.deepEqual(odnest.CAREER_HOSTS, [
    'odnestcompany.com',
    'www.odnestcompany.com',
    'odnestcompany.in',
    'www.odnestcompany.in',
    'odnestcompany.co.in',
    'www.odnestcompany.co.in',
    'odnest.com',
    'www.odnest.com',
    'odnest.in',
    'www.odnest.in',
  ])
  assert.equal(odnest.hasResolvableFirstPartyHost([]), false)
  assert.equal(odnest.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('OdNest Company sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const odnest = await loadModule()
  const calls = []

  const jobs = await odnest.createOdNestCompanyScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [odnest.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('OdNest Company sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const odnest = await loadModule()

  await assert.rejects(
    odnest.createOdNestCompanyScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /OdNest Company canonical first-party hosts now resolve/i,
  )
})

test('resolveCanonicalHosts bounds and parallelizes stalled DNS lookups', async () => {
  const odnest = await loadModule()
  const calls = []
  const never = (family) => async (host) => {
    calls.push(`${family}:${host}`)
    return new Promise(() => {})
  }
  const startedAt = Date.now()

  const addresses = await odnest.resolveCanonicalHosts(
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
