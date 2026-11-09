import assert from 'node:assert/strict'
import test from 'node:test'

const loadAbsolutdataModule = async () => {
  try {
    return await import('../../scraper/absolutdata/script.js')
  } catch {
    assert.fail('Expected Absolutdata scraper module at ../../scraper/absolutdata/script.js')
  }
}

test('Absolutdata validates the verified timeout-only first-party surface for the current no-public-jobs state', async () => {
  const absolutdata = await loadAbsolutdataModule()

  assert.equal(absolutdata.SOURCE, 'absolutdata')
  assert.equal(absolutdata.COMPANY, 'Absolutdata')
  assert.equal(absolutdata.COMPANY_DOMAIN, 'absolutdata.com')
  assert.equal(absolutdata.VERIFIED_AT, '2026-07-14')
  assert.deepEqual(absolutdata.FIRST_PARTY_ROOT_URLS, [
    'https://absolutdata.com/',
    'https://www.absolutdata.com/',
  ])
  assert.deepEqual(absolutdata.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://absolutdata.com/careers',
    'https://www.absolutdata.com/careers',
    'https://absolutdata.com/jobs',
    'https://www.absolutdata.com/jobs',
  ])
  assert.equal(absolutdata.isExpectedUnreachableSurface({ errorKind: 'timeout' }), true)
  assert.equal(absolutdata.isExpectedUnreachableSurface({ errorKind: 'dns' }), false)
  assert.equal(
    absolutdata.isUnexpectedReachableSurface({ status: 200, html: '<html><title>Careers</title></html>' }),
    true,
  )
  assert.equal(absolutdata.isUnexpectedReachableSurface({ errorKind: 'timeout' }), false)
})

test('Absolutdata run verifies the exact-name first-party roots and common careers routes before returning []', async () => {
  const absolutdata = await loadAbsolutdataModule()
  const requestedUrls = []

  const jobs = await absolutdata.createAbsolutdataScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (
        url === 'https://absolutdata.com/'
        || url === 'https://www.absolutdata.com/'
        || url === 'https://absolutdata.com/careers'
        || url === 'https://www.absolutdata.com/careers'
        || url === 'https://absolutdata.com/jobs'
        || url === 'https://www.absolutdata.com/jobs'
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
  })

  assert.deepEqual(requestedUrls, [
    'https://absolutdata.com/',
    'https://www.absolutdata.com/',
    'https://absolutdata.com/careers',
    'https://www.absolutdata.com/careers',
    'https://absolutdata.com/jobs',
    'https://www.absolutdata.com/jobs',
  ])
  assert.deepEqual(jobs, [])
})

test('Absolutdata fails closed when a first-party root or common careers route becomes reachable', async () => {
  const absolutdata = await loadAbsolutdataModule()

  await assert.rejects(
    absolutdata.createAbsolutdataScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://absolutdata.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>Absolutdata</title><body>Homepage now responds.</body></html>',
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
    absolutdata.createAbsolutdataScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://www.absolutdata.com/jobs') {
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
    absolutdata.createAbsolutdataScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }),
    }),
    /verified unreachable surface/i,
  )
})
