import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://ecmdata.com/, https://www.ecmdata.com/, https://ecmdata.com/careers, https://www.ecmdata.com/careers, https://ecmdata.com/jobs, https://www.ecmdata.com/jobs, https://ecmdata.com/robots.txt, and https://www.ecmdata.com/robots.txt each returned Cloudflare 522 during live checks, while https://ecmdata.in/, https://www.ecmdata.in/, https://ecmdata.co.in/, https://www.ecmdata.co.in/, https://ecmdataindia.com/, and https://www.ecmdataindia.com/ did not resolve. Bing exact-phrase result feeds for ECM Data returned only enterprise-content-management acronym results rather than a company-owned surface. No trustworthy public first-party jobs surface was reachable for ECM Data.'

const loadEcmDataModule = async () => {
  try {
    return await import('../../scraper/ecmdata/script.js')
  } catch {
    assert.fail('Expected ECM Data scraper module at ../../scraper/ecmdata/script.js')
  }
}

test('ECM Data sentinel pins the verified unavailable first-party URLs, unresolved hosts, and no-public-jobs summary', async () => {
  const ecmData = await loadEcmDataModule()

  assert.equal(ecmData.SOURCE, 'ecmdata')
  assert.equal(ecmData.COMPANY, 'ECM Data')
  assert.equal(ecmData.COMPANY_DOMAIN, 'ecmdata.com')
  assert.equal(ecmData.VERIFIED_AT, '2026-07-15')
  assert.equal(ecmData.VERIFIED_SURFACE_SUMMARY, VERIFIED_SURFACE_SUMMARY)
  assert.deepEqual(ecmData.CLOUDFLARE_522_URLS, [
    'https://ecmdata.com/',
    'https://www.ecmdata.com/',
    'https://ecmdata.com/careers',
    'https://www.ecmdata.com/careers',
    'https://ecmdata.com/jobs',
    'https://www.ecmdata.com/jobs',
    'https://ecmdata.com/robots.txt',
    'https://www.ecmdata.com/robots.txt',
  ])
  assert.deepEqual(ecmData.UNRESOLVED_VARIANT_HOSTS, [
    'ecmdata.in',
    'www.ecmdata.in',
    'ecmdata.co.in',
    'www.ecmdata.co.in',
    'ecmdataindia.com',
    'www.ecmdataindia.com',
  ])
  assert.equal(
    ecmData.isExpectedCloudflare522Surface({
      status: 522,
      headers: { server: 'cloudflare' },
    }),
    true,
  )
  assert.equal(
    ecmData.isExpectedCloudflare522Surface({
      status: 522,
      headers: { server: 'nginx' },
    }),
    false,
  )
  assert.equal(
    ecmData.isExpectedUnavailableExactNameSurface({
      status: null,
      headers: {},
      errorKind: 'timeout',
    }),
    true,
  )
  assert.equal(ecmData.hasResolvableVariantHost([]), false)
  assert.equal(ecmData.hasResolvableVariantHost(['104.21.42.20']), true)
})

test('ECM Data sentinel returns [] only while the exact-name surface stays on Cloudflare 522 and India variants stay unresolved', async () => {
  const ecmData = await loadEcmDataModule()
  const requestedUrls = []
  const requestedHosts = []

  const jobs = await ecmData.createEcmDataScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      return {
        url,
        finalUrl: url,
        status: 522,
        headers: { server: 'cloudflare' },
        html: 'error code: 522',
        errorKind: null,
      }
    },
    resolveHosts: async (hosts) => {
      requestedHosts.push([...hosts])
      return []
    },
  })

  assert.deepEqual(requestedUrls, ecmData.CLOUDFLARE_522_URLS)
  assert.deepEqual(requestedHosts, [ecmData.UNRESOLVED_VARIANT_HOSTS])
  assert.deepEqual(jobs, [])
})

test('ECM Data sentinel fails closed when any pinned 522 surface changes or an India variant host starts resolving', async () => {
  const ecmData = await loadEcmDataModule()

  await assert.rejects(
    ecmData.createEcmDataScraper().run({
      probeUrl: async (url) => {
        if (url === ecmData.CLOUDFLARE_522_URLS[0]) {
          return {
            url,
            finalUrl: url,
            status: 200,
            headers: { server: 'cloudflare' },
            html: '<html><title>ECM Data</title></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: 522,
          headers: { server: 'cloudflare' },
          html: 'error code: 522',
          errorKind: null,
        }
      },
      resolveHosts: async () => [],
    }),
    /verified exact-name first-party surface changed|public jobs surface/i,
  )

  await assert.rejects(
    ecmData.createEcmDataScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: 522,
        headers: { server: 'cloudflare' },
        html: 'error code: 522',
        errorKind: null,
      }),
      resolveHosts: async () => ['104.21.42.20'],
    }),
    /India exact-name variant hosts now resolve/i,
  )

  const jobs = await ecmData.createEcmDataScraper().run({
    probeUrl: async (url) => ({
      url,
      finalUrl: url,
      status: null,
      headers: {},
      html: null,
      errorKind: 'timeout',
    }),
    resolveHosts: async () => [],
  })

  assert.deepEqual(jobs, [])
})
