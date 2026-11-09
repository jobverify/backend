import assert from 'node:assert/strict'
import test from 'node:test'

const loadAarogyaAIModule = async () => {
  try {
    return await import('../../scraper/aarogyaai/script.js')
  } catch {
    return null
  }
}

test('AarogyaAI legacy predicates identify response shapes without proving zero vacancies', async () => {
  const aarogyaAI = await loadAarogyaAIModule()
  assert.ok(aarogyaAI, 'Expected AarogyaAI scraper module at ../../scraper/aarogyaai/script.js')

  assert.equal(aarogyaAI.isExpectedUnreachableSurface({ errorKind: 'timeout' }), true)
  assert.equal(aarogyaAI.isExpectedUnreachableSurface({ errorKind: 'dns' }), false)
  assert.equal(aarogyaAI.isUnexpectedReachableSurface({ status: 200, html: '<html><title>Careers</title></html>' }), true)
  assert.equal(aarogyaAI.isUnexpectedReachableSurface({ errorKind: 'timeout' }), false)
})

test('AarogyaAI stops at the unavailable configured root and preserves unknown inventory', async () => {
  const aarogyaAI = await loadAarogyaAIModule()
  assert.ok(aarogyaAI, 'Expected AarogyaAI scraper module at ../../scraper/aarogyaai/script.js')

  const requestedUrls = []

  await assert.rejects(aarogyaAI.createAarogyaAIScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (
        url === 'https://aarogyaai.com/'
        || url === 'https://aarogyaai.in/'
        || url === 'https://aarogyaai.com/careers'
        || url === 'https://aarogyaai.com/jobs'
        || url === 'https://aarogyaai.in/careers'
        || url === 'https://aarogyaai.in/jobs'
      ) {
        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'timeout',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.failureKind === 'network_or_timeout'
    && error.inventoryEvidence.listingComplete === false
    && error.inventoryEvidence.reportedTotal === null)

  assert.deepEqual(requestedUrls, [
    'https://aarogyaai.com/',
  ])
})

test('AarogyaAI does not treat reachable corporate HTML, job-like HTML or DNS errors as a complete inventory', async () => {
  const aarogyaAI = await loadAarogyaAIModule()
  assert.ok(aarogyaAI, 'Expected AarogyaAI scraper module at ../../scraper/aarogyaai/script.js')

  await assert.rejects(
    aarogyaAI.createAarogyaAIScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://aarogyaai.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>AarogyaAI</title><body>Homepage now responds.</body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'timeout',
        }
      },
    }),
    /official first-party root/i,
  )

  await assert.rejects(
    aarogyaAI.createAarogyaAIScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://aarogyaai.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>Jobs</title><body><a href="/apply">Apply now</a></body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: null,
          html: null,
          errorKind: 'timeout',
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    aarogyaAI.createAarogyaAIScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }),
    }),
    error => error.failureKind === 'network_or_timeout' && error.inventoryEvidence.reportedTotal === null,
  )
})
