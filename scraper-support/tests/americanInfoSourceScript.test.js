import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/americaninfosource/script.js')
  } catch {
    assert.fail('Expected American InfoSource scraper module at ../../scraper/americaninfosource/script.js')
  }
}

test('American InfoSource validates the verified timeout-only exact-name sentinel surfaces', async () => {
  const americanInfoSource = await loadModule()

  assert.equal(americanInfoSource.isExpectedDormantSurface({ errorKind: 'timeout' }), true)
  assert.equal(americanInfoSource.isExpectedDormantSurface({ status: 404, html: '<html><body>Not Found</body></html>' }), true)
  assert.equal(americanInfoSource.isUnexpectedReachableSurface({ status: 200, html: '<html><body>Jobs</body></html>' }), true)
})

test('American InfoSource run verifies the exact-name root and common careers routes before returning []', async () => {
  const americanInfoSource = await loadModule()
  const requestedUrls = []

  const jobs = await americanInfoSource.createAmericanInfoSourceScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://americaninfosource.com/',
    'https://americaninfosource.com/careers',
    'https://americaninfosource.com/jobs',
    'https://americaninfosource.com/employment',
  ])
  assert.deepEqual(jobs, [])
})

test('American InfoSource fails closed when an exact-name surface becomes reachable', async () => {
  const americanInfoSource = await loadModule()

  await assert.rejects(
    americanInfoSource.createAmericanInfoSourceScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: 200,
        html: '<html><body><a href="/careers/software-engineer">Software Engineer</a></body></html>',
        errorKind: null,
      }),
    }),
    /public jobs surface/i,
  )
})
