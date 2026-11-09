import assert from 'node:assert/strict'
import test from 'node:test'

const loadPropTimesModule = async () => {
  try {
    return await import('../../scraper/proptimes/script.js')
  } catch {
    return null
  }
}

test('hasPublicCareerHost distinguishes between unresolved and reachable Prop Times hosts', async () => {
  const propTimes = await loadPropTimesModule()
  assert.ok(propTimes)

  assert.equal(propTimes.hasPublicCareerHost([]), false)
  assert.equal(propTimes.hasPublicCareerHost(['203.0.113.10']), true)
})

test('run returns no jobs when the Prop Times domain has no public host records', async () => {
  const propTimes = await loadPropTimesModule()
  assert.ok(propTimes)

  const requestedUrls = []
  const jobs = await propTimes.createPropTimesScraper().run({
    resolveAddresses: async () => [],
    fetchText: async (url) => {
      requestedUrls.push(url)
      return '<html><head><title>Prop Times</title></head><body></body></html>'
    },
  })

  assert.deepEqual(requestedUrls, [])
  assert.deepEqual(jobs, [])
})
