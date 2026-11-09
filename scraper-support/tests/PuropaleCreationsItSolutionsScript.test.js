import assert from 'node:assert/strict'
import test from 'node:test'

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/puropalecreationsitsolutions/script.js')
  } catch {
    assert.fail('Expected Puropale Creations & IT Solutions scraper module at ../../scraper/puropalecreationsitsolutions/script.js')
  }
}

test('Puropale Creations & IT Solutions stays fail-closed while the official domain is unreachable', async () => {
  const puropale = await loadScriptModule()

  assert.equal(
    puropale.isUnreachableSurfaceError(new Error('getaddrinfo ENOTFOUND puropale.com')),
    true,
  )

  const jobs = await puropale.run({
    fetchText: async () => {
      throw new Error('getaddrinfo ENOTFOUND puropale.com')
    },
  })

  assert.deepEqual(jobs, [])
})
