import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/unitedalliancetechnology/script.js')
  } catch {
    assert.fail('Expected United Alliance Technology scraper module at ../../scraper/unitedalliancetechnology/script.js')
  }
}

test('United Alliance Technology returns [] only while the exact-name first-party domain remains unresolved', async () => {
  const unitedAlliance = await loadModule()
  const requestedUrls = []

  assert.equal(
    unitedAlliance.isExpectedDomainResolutionFailure(new Error('curl: (6) Could not resolve host: unitedalliancetechnology.com')),
    true,
  )
  assert.equal(
    unitedAlliance.isExpectedDomainResolutionFailure(new Error('getaddrinfo ENOTFOUND unitedalliancetechnology.com')),
    true,
  )

  const jobs = await unitedAlliance.createUnitedAllianceTechnologyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw new Error('curl: (6) Could not resolve host: unitedalliancetechnology.com')
    },
  })

  assert.deepEqual(requestedUrls, ['https://unitedalliancetechnology.com/'])
  assert.deepEqual(jobs, [])
})

test('United Alliance Technology fails closed if the exact-name domain becomes reachable', async () => {
  const unitedAlliance = await loadModule()

  await assert.rejects(
    unitedAlliance.createUnitedAllianceTechnologyScraper().run({
      fetchText: async () => '<html><body><h1>United Alliance Technology Careers</h1></body></html>',
    }),
    /exact-name first-party domain became reachable/i,
  )
})

test('United Alliance Technology rethrows unexpected network failures instead of silently masking them', async () => {
  const unitedAlliance = await loadModule()

  await assert.rejects(
    unitedAlliance.createUnitedAllianceTechnologyScraper().run({
      fetchText: async () => {
        throw new Error('socket hang up')
      },
    }),
    /socket hang up/i,
  )
})

test('United Alliance Technology can recover with browser-backed verification when direct requests fail generically', async () => {
  const unitedAlliance = await loadModule()
  const browserUrls = []

  const jobs = await unitedAlliance.createUnitedAllianceTechnologyScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      throw new Error('getaddrinfo ENOTFOUND unitedalliancetechnology.com')
    },
  })

  assert.deepEqual(browserUrls, [unitedAlliance.OFFICIAL_CAREERS_URL])
  assert.deepEqual(jobs, [])
})
