import assert from 'node:assert/strict'
import test from 'node:test'

const loadDsqSoftwareModule = async () => {
  try {
    return await import('../../scraper/dsqsoftware/script.js')
  } catch {
    assert.fail('Expected DSQ Software scraper module at ../../scraper/dsqsoftware/script.js')
  }
}

test('DSQ Software sentinel pins the verified unresolved first-party URL and host contract', async () => {
  const dsq = await loadDsqSoftwareModule()

  assert.equal(dsq.SOURCE, 'dsqsoftware')
  assert.equal(dsq.COMPANY, 'DSQ Software')
  assert.equal(dsq.VERIFIED_AT, '2026-07-15')
  assert.equal(
    dsq.VERIFIED_SURFACE_SUMMARY,
    'Verified on July 15, 2026 that https://dsqsoftware.com/, https://www.dsqsoftware.com/, https://dsqsoftware.com/careers, https://www.dsqsoftware.com/careers, https://dsqsoftware.com/jobs, https://www.dsqsoftware.com/jobs, https://dsqsoftware.co.in/, https://www.dsqsoftware.co.in/, https://dsqsoftware.co.in/careers, https://www.dsqsoftware.co.in/careers, https://dsqworld.com/, https://www.dsqworld.com/, https://dsqworld.com/careers, and https://www.dsqworld.com/careers were all unreachable because their hostnames did not resolve, while Resolve-DnsName also returned DNS name does not exist for dsqsoftware.com, dsqsoftware.co.in, dsqworld.com, and their www/careers/jobs subdomains. No trustworthy public first-party jobs surface was reachable.',
  )
  assert.deepEqual(dsq.CANDIDATE_FIRST_PARTY_URLS, [
    'https://dsqsoftware.com/',
    'https://www.dsqsoftware.com/',
    'https://dsqsoftware.com/careers',
    'https://www.dsqsoftware.com/careers',
    'https://dsqsoftware.com/jobs',
    'https://www.dsqsoftware.com/jobs',
    'https://dsqsoftware.co.in/',
    'https://www.dsqsoftware.co.in/',
    'https://dsqsoftware.co.in/careers',
    'https://www.dsqsoftware.co.in/careers',
    'https://dsqworld.com/',
    'https://www.dsqworld.com/',
    'https://dsqworld.com/careers',
    'https://www.dsqworld.com/careers',
  ])
  assert.deepEqual(dsq.CANDIDATE_FIRST_PARTY_HOSTS, [
    'dsqsoftware.com',
    'www.dsqsoftware.com',
    'careers.dsqsoftware.com',
    'jobs.dsqsoftware.com',
    'dsqsoftware.co.in',
    'www.dsqsoftware.co.in',
    'careers.dsqsoftware.co.in',
    'jobs.dsqsoftware.co.in',
    'dsqworld.com',
    'www.dsqworld.com',
    'careers.dsqworld.com',
    'jobs.dsqworld.com',
  ])
  assert.equal(dsq.hasResolvableFirstPartyHost([]), false)
  assert.equal(dsq.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('DSQ Software sentinel returns [] only while every verified first-party host remains unresolved', async () => {
  const dsq = await loadDsqSoftwareModule()
  const calls = []

  const jobs = await dsq.createDsqSoftwareScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [dsq.CANDIDATE_FIRST_PARTY_HOSTS])
  assert.deepEqual(jobs, [])
})

test('DSQ Software sentinel fails closed when any verified first-party host starts resolving', async () => {
  const dsq = await loadDsqSoftwareModule()

  await assert.rejects(
    dsq.createDsqSoftwareScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /DSQ Software verified unresolved first-party surface changed|first-party hosts now resolve/i,
  )
})
