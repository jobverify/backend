import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'innspark',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const careersHtml = readFixture('careers.html')
const applyHtml = readFixture('apply.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/innspark/script.js')
  } catch {
    assert.fail('Expected Innspark scraper module at ../../scraper/innspark/script.js')
  }
}

test('Innspark helpers recognize the verified careers and apply surfaces', async () => {
  const innspark = await loadModule()

  assert.equal(innspark.SOURCE, 'innspark')
  assert.equal(innspark.COMPANY, 'Innspark')
  assert.equal(innspark.CAREERS_URL, 'https://innspark.in/careers/')
  assert.equal(innspark.APPLY_URL, 'https://innspark.in/apply/')
  assert.equal(innspark.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(innspark.hasOfficialApplySignal(applyHtml), true)
  assert.equal(innspark.extractCareerJobs(careersHtml).length, 11)
  assert.deepEqual(innspark.extractCareerJobs(careersHtml).slice(0, 4).map((job) => job.title), [
    'Embedded Systems Engineer (Drone / UAS development)',
    'C++ Engineer Qt-based Application Development (Drone / UAS development)',
    'Computer Vision Engineer (Drone / UAS development)',
    'SOC Analyst (L1 / L2)',
  ])
})

test('Innspark run falls back to a tolerant HTTP parser when the live first-party pages return the broken HTTP/1.1 response shape', async () => {
  const innspark = await loadModule()
  const requestedPrimaryUrls = []
  const requestedTolerantUrls = []

  const jobs = await innspark.createInnsparkScraper().run({
    fetchText: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new TypeError('fetch failed | Response does not match the HTTP/1.1 protocol (Missing expected CR after header value)')
    },
    fetchProtocolTolerantText: async (url) => {
      requestedTolerantUrls.push(url)
      if (url === innspark.CAREERS_URL) return careersHtml
      if (url === innspark.APPLY_URL) return applyHtml
      throw new Error(`Unexpected tolerant URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPrimaryUrls, [
    innspark.CAREERS_URL,
    innspark.APPLY_URL,
  ])
  assert.deepEqual(requestedTolerantUrls, [
    innspark.CAREERS_URL,
    innspark.APPLY_URL,
  ])
  assert.equal(jobs.length, 11)
  assert.equal(jobs[0].source, 'innspark')
  assert.equal(jobs[0].link, innspark.APPLY_URL)
  assert.equal(jobs[0].company, 'Innspark')
})

test('Innspark aborts retries when the verified first-party surface still breaks HTTP parsing after fallback', async () => {
  const innspark = await loadModule()
  const requestedUrls = []
  const protocolError = new TypeError('fetch failed')
  protocolError.cause = new Error(
    'Response does not match the HTTP/1.1 protocol (Missing expected CR after header value)',
  )

  await assert.rejects(
    innspark.createInnsparkScraper().run({
      fetchText: async () => {
        throw protocolError
      },
      fetchProtocolTolerantText: async (url) => {
        requestedUrls.push(url)
        throw protocolError
      },
    }),
    (error) => {
      assert.match(error.message, /Innspark verified careers page currently returns a broken HTTP\/1\.1 response/i)
      assert.equal(error.abortRetries, true)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.failureKind, 'network_or_timeout')
      return true
    },
  )

  assert.deepEqual(requestedUrls, [innspark.CAREERS_URL])
})
