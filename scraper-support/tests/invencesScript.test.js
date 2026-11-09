import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  './fixtures/invences',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careerHtml = readFixture('career.html')
const currentHomepageHtml = '<title>Connectivity &amp; Data Center Infrastructure | Invences</title><nav>Solutions Services Products Industries Contact</nav><h1>Engineering intelligent infrastructure.</h1><p>info@invences.com</p><footer>2026 Invences</footer>'

const loadInvencesModule = async () => {
  try {
    return await import('../../scraper/invences/script.js')
  } catch {
    assert.fail('Expected Invences scraper module at ../../scraper/invences/script.js')
  }
}

test('Invences validates the official homepage and career table before extracting jobs', async () => {
  const invences = await loadInvencesModule()

  assert.equal(invences.HOMEPAGE_URL, 'https://invences.com/')
  assert.equal(invences.CAREERS_URL, 'https://invences.com/career')
  assert.equal(invences.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(invences.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(invences.hasOfficialCareersSignal(careerHtml), true)

  assert.deepEqual(invences.extractJobs(careerHtml), [
    {
      title: 'Systems Engineer',
      company: 'Invences Inc.',
      department: null,
      location: 'Dallas, TX',
      city: 'Dallas',
      state: 'TX',
      country: 'United States',
      jobId: 'invences-systems-engineer-2025-12-01',
      requisitionId: 'invences-systems-engineer-2025-12-01',
      sourceUrl: 'https://invences.com/careers/Systems-Engineer-2025-12-01',
      applyUrl: 'https://invences.com/careers/Systems-Engineer-2025-12-01',
      employmentType: 'Remote',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-12-18',
      closingDate: null,
      jobDescription: 'Official Invences Inc. opening for Systems Engineer in Dallas, TX.',
    },
    {
      title: 'Cloud Engineer',
      company: 'Invences Inc.',
      department: null,
      location: 'Dallas, TX',
      city: 'Dallas',
      state: 'TX',
      country: 'United States',
      jobId: 'invences-cloud-engineer',
      requisitionId: 'invences-cloud-engineer',
      sourceUrl: 'https://invences.com/careers/Cloud-Engineer',
      applyUrl: 'https://invences.com/careers/Cloud-Engineer',
      employmentType: 'On-site',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-12-17',
      closingDate: null,
      jobDescription: 'Official Invences Inc. opening for Cloud Engineer in Dallas, TX.',
    },
  ])
})

test('Invences scraper fetches the verified homepage and careers page and decorates extracted jobs', async () => {
  const invences = await loadInvencesModule()
  const requestedUrls = []

  const jobs = await invences.createInvencesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === invences.HOMEPAGE_URL) return homepageHtml
      if (url === invences.CAREERS_URL) return careerHtml

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    invences.HOMEPAGE_URL,
    invences.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Invences returns an empty discovery snapshot when the current official homepage has retired its careers handoff', async () => {
  const invences = await loadInvencesModule()
  const requestedUrls = []

  const jobs = await invences.createInvencesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === invences.HOMEPAGE_URL) return currentHomepageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [invences.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Invences makes no first-party request when the caller signal is already aborted', async () => {
  const invences = await loadInvencesModule()
  const controller = new AbortController()
  const reason = new Error('runner stopped before Invences started')
  controller.abort(reason)
  let requests = 0

  await assert.rejects(invences.createInvencesScraper().run({
    signal: controller.signal,
    fetchText: async () => {
      requests += 1
      return homepageHtml
    },
  }), (error) => error === reason)

  assert.equal(requests, 0)
})

test('Invences preserves cancellation that arrives during the homepage response', async () => {
  const invences = await loadInvencesModule()
  const controller = new AbortController()
  const reason = new Error('runner stopped during Invences homepage')
  const requestedUrls = []

  await assert.rejects(invences.createInvencesScraper().run({
    signal: controller.signal,
    fetchText: async (url, options) => {
      requestedUrls.push(url)
      assert.equal(options.signal, controller.signal)
      controller.abort(reason)
      return homepageHtml
    },
  }), (error) => error === reason)

  assert.deepEqual(requestedUrls, ['https://invences.com/'])
})

test('Invences preserves cancellation that arrives during the careers handoff response', async () => {
  const invences = await loadInvencesModule()
  const controller = new AbortController()
  const reason = new Error('runner stopped during Invences careers handoff')
  const requestedUrls = []

  await assert.rejects(invences.createInvencesScraper().run({
    signal: controller.signal,
    fetchText: async (url, options) => {
      requestedUrls.push(url)
      assert.equal(options.signal, controller.signal)
      if (url === 'https://invences.com/') return homepageHtml
      if (url === 'https://invences.com/career') {
        controller.abort(reason)
        return careerHtml
      }
      throw new Error(`Unexpected URL ${url}`)
    },
  }), (error) => error === reason)

  assert.deepEqual(requestedUrls, [
    'https://invences.com/',
    'https://invences.com/career',
  ])
})

test('Invences preserves the caller abort reason when a fetch rejects after cancellation', async () => {
  const invences = await loadInvencesModule()
  const controller = new AbortController()
  const reason = new Error('runner stopped while Invences fetch was failing')
  const secondaryError = new Error('socket closed after cancellation')

  await assert.rejects(invences.createInvencesScraper().run({
    signal: controller.signal,
    fetchText: async (url, options) => {
      assert.equal(url, 'https://invences.com/')
      assert.equal(options.signal, controller.signal)
      controller.abort(reason)
      throw secondaryError
    },
  }), (error) => error === reason)
})

test('Invences scraper fails closed when the verified careers table contract changes', async () => {
  const invences = await loadInvencesModule()

  await assert.rejects(
    invences.createInvencesScraper().run({
      fetchText: async (url) => {
        if (url === invences.HOMEPAGE_URL) return homepageHtml

        return `
          <html>
            <head><title>Invences - Career</title></head>
            <body>
              <h2>Join our team</h2>
              <p>No openings today.</p>
            </body>
          </html>
        `
      },
    }),
    /verified careers surface/i,
  )
})
