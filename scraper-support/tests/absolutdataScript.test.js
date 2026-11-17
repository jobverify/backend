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

test('Absolutdata historical timeout callback cannot establish current empty inventory', async () => {
 const source=await loadAbsolutdataModule()
 await assert.rejects(source.createAbsolutdataScraper().run({probeUrl:async url=>({url,errorKind:'timeout'})}),/unsupported metadata-free/)
})
test('Absolutdata opaque pre-aborted caller owns cancellation before any transport', async () => {
 const source=await loadAbsolutdataModule(),owner=new AbortController(),reason=Object.freeze({cancel:'absolutdata'});owner.abort(reason)
 await assert.rejects(source.run({signal:owner.signal,fetchImpl:async()=>assert.fail('unexpected fetch')}),value=>value===reason)
})
