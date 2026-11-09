import assert from 'node:assert/strict'
import test from 'node:test'

import { createDarwinboxScraper } from '../../scraper/darwinbox/script.js'

const response = (payload, cookies = [], status = 200) => {
  const headers = new Headers({ 'content-type': 'application/json' })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(payload), { status, headers })
}
const cookieValues = init => Object.fromEntries(String(init.headers.cookie || '').split('; ').filter(Boolean).map(pair => {
  const at = pair.indexOf('=')
  return [pair.slice(0, at), pair.slice(at + 1)]
}))
const record = id => ({ id, title: 'Software Engineer', locations: 'Hyderabad, India', country: 'India', jd: '<p>Build employer software services and maintain the production platform.</p>' })

test('Darwinbox retains API session cookies when the next listing page refreshes only its challenge cookie', async () => {
  let seedCount = 0
  const scraper = createDarwinboxScraper({ pageSize: 1, fetchImpl: async (url, init) => {
    if (init.method === 'GET') {
      seedCount++
      return response({}, seedCount === 1 ? ['session=original; Path=/', 'challenge=first; Path=/'] : ['challenge=second; Path=/'])
    }
    const { page } = JSON.parse(init.body)
    const cookies = cookieValues(init)
    if (page === 2 && (cookies.session !== 'rotated' || cookies.challenge !== 'second')) return response({}, [], 403)
    return response({ status: 'success', job_counts: 2, data: [record(`role-${page}`)] }, page === 1 ? ['session=rotated; Path=/'] : [])
  } })
  const jobs = await scraper.run({ maxPages: 2 })
  assert.deepEqual(jobs.map(job => job.jobId), ['role-1', 'role-2'])
})

test('Darwinbox sends its existing session when refreshing the public careers shell', async () => {
  let seedCount = 0
  const scraper = createDarwinboxScraper({ pageSize: 1, fetchImpl: async (url, init) => {
    if (init.method === 'GET') {
      seedCount++
      if (seedCount > 1 && cookieValues(init).session !== 'original') return response({}, [], 403)
      return response({}, seedCount === 1 ? ['session=original; Path=/'] : ['authorized=yes; Path=/'])
    }
    const { page } = JSON.parse(init.body)
    if (page === 2 && cookieValues(init).authorized !== 'yes') return response({}, [], 403)
    return response({ status: 'success', job_counts: 2, data: [record(`role-${page}`)] })
  } })
  assert.equal((await scraper.run({ maxPages: 2 })).length, 2)
})

test('Darwinbox merges detail cookie rotation and removes deleted or expired cookies', async () => {
  let detailCount = 0
  const scraper = createDarwinboxScraper({ fetchImpl: async (url, init) => {
    if (url.includes('/careers/allJobs')) return response({}, ['session=original; Path=/', 'retired=old; Path=/', 'expired=stale; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'])
    detailCount++
    const cookies = cookieValues(init)
    if (cookies.session !== 'original' || cookies.expired || (detailCount > 1 && (cookies.retired || cookies.challenge !== 'fresh=token'))) return response({}, [], 403)
    return response({ message: { job: [{ id: 'role-1' }] } }, detailCount === 1 ? ['challenge=fresh=token; Path=/', 'retired=; Max-Age=0; Path=/'] : [])
  } })
  await scraper.fetchJobDetailFromApi({ jobId: 'role-1' })
  const detail = await scraper.fetchJobDetailFromApi({ jobId: 'role-1' })
  assert.equal(detail.message.job[0].id, 'role-1')
})

test('Darwinbox replaces a rejected challenge cookie on retry while retaining the application session', async () => {
  let seedCount = 0
  const scraper = createDarwinboxScraper({ fetchImpl: async (url, init) => {
    const cookies = cookieValues(init)
    if (init.method === 'GET') {
      seedCount++
      if (seedCount === 1) return response({}, ['session=keep; Path=/', '__cf_bm=rejected; Path=/'])
      return response({}, cookies.session === 'keep' && !cookies.__cf_bm ? ['__cf_bm=renewed; Path=/'] : [])
    }
    if (cookies.__cf_bm !== 'renewed' || cookies.session !== 'keep') return response({}, [], 403)
    return response({ status: 'success', job_counts: 1, data: [record('role-1')] })
  } })
  assert.equal((await scraper.run({ maxPages: 1 }))[0].jobId, 'role-1')
})
