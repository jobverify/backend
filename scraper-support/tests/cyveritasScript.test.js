import assert from 'node:assert/strict'
import test from 'node:test'

const loadCyveritasModule = async () => {
  try {
    return await import('../../scraper/cyveritas/script.js')
  } catch {
    assert.fail('Expected Cyveritas scraper module at ../../scraper/cyveritas/script.js')
  }
}

test('Cyveritas sentinel pins the verified unresolved first-party URL and host contract', async () => {
  const cyveritas = await loadCyveritasModule()

  assert.equal(cyveritas.SOURCE, 'cyveritas')
  assert.equal(cyveritas.COMPANY, 'Cyveritas Risk Advisory Pvt. Ltd')
  assert.equal(cyveritas.VERIFIED_AT, '2026-08-01')
  assert.equal(
    cyveritas.VERIFIED_SURFACE_SUMMARY,
    'Verified on Saturday, August 1, 2026 that Cyveritas public references still pointed to https://cyveritas.com/, but https://cyveritas.com/, https://cyveritas.com/careers, https://www.cyveritas.com/, and https://www.cyveritas.com/careers were unreachable because their hostnames did not resolve, while Resolve-DnsName returned DNS name does not exist for cyveritas.com and www.cyveritas.com. No newer first-party replacement domain or trustworthy public jobs surface could be verified.',
  )
  assert.deepEqual(cyveritas.CANDIDATE_FIRST_PARTY_URLS, [
    'https://cyveritas.com/',
    'https://cyveritas.com/careers',
    'https://www.cyveritas.com/',
    'https://www.cyveritas.com/careers',
  ])
  assert.deepEqual(cyveritas.CANDIDATE_FIRST_PARTY_HOSTS, [
    'cyveritas.com',
    'www.cyveritas.com',
  ])
  assert.equal(cyveritas.isExpectedUnresolvedHostError(new Error('getaddrinfo ENOTFOUND cyveritas.com')), true)
  assert.equal(cyveritas.isExpectedUnresolvedHostError(new Error('DNS name does not exist')), true)
  assert.equal(cyveritas.isExpectedUnresolvedHostError(new Error('queryA ETIMEOUT cyveritas.com')), true)
  assert.equal(cyveritas.isExpectedUnresolvedHostError(new Error('queryA ECONNREFUSED cyveritas.com')), true)
  assert.equal(cyveritas.isExpectedUnresolvedHostError(new Error('socket hang up')), false)
  assert.equal(cyveritas.hasResolvableFirstPartyHost([]), false)
  assert.equal(cyveritas.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Cyveritas sentinel returns [] only while every verified first-party host remains unresolved', async () => {
  const cyveritas = await loadCyveritasModule()
  const calls = []

  const jobs = await cyveritas.createCyveritasScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [cyveritas.CANDIDATE_FIRST_PARTY_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Cyveritas sentinel fails closed when any verified first-party host starts resolving', async () => {
  const cyveritas = await loadCyveritasModule()

  await assert.rejects(
    cyveritas.createCyveritasScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Cyveritas verified unresolved first-party surface changed|exact-name hosts now resolve/i,
  )
})

test('Cyveritas sentinel rethrows unexpected resolver failures instead of masking them', async () => {
  const cyveritas = await loadCyveritasModule()

  await assert.rejects(
    cyveritas.createCyveritasScraper().run({
      resolveHosts: async () => {
        throw new Error('DNS server timeout')
      },
    }),
    /DNS server timeout/i,
  )
})
