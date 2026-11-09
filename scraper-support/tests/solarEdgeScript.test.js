import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadSolarEdgeModule = async () => {
  try {
    return await import('../../scraper/solaredge/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'solaredge',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('extractDrupalSettings and extractIndiaPositions read India roles from the official SolarEdge careers page payload', async () => {
  const solarEdge = await loadSolarEdgeModule()
  assert.ok(solarEdge)

  const settings = solarEdge.extractDrupalSettings(readFixture('careers.html'))
  const positions = solarEdge.extractIndiaPositions(settings)

  assert.equal(typeof settings, 'object')
  assert.equal(positions.length, 3)
  assert.deepEqual(positions[0], {
    title: 'Finance - Implementer',
    department: 'IS',
    city: 'Bangalore',
    country: 'India',
    jobId: 'F8E5F',
    requisitionId: 'F8E5F',
  })
})

test('extractJobListings maps SolarEdge India roles into the shared listing contract', async () => {
  const solarEdge = await loadSolarEdgeModule()
  assert.ok(solarEdge)

  const jobs = solarEdge.extractJobListings(readFixture('careers.html'))

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Finance - Implementer',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'F8E5F',
    requisitionId: 'F8E5F',
    sourceUrl: 'https://corporate.solaredge.com/en/careers/open-positions?position=comeet-F8E5F',
    applyUrl: 'https://corporate.solaredge.com/en/careers/open-positions?position=comeet-F8E5F',
    department: 'IS',
    employmentType: null,
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: 'On-site',
  })
})

test('run fetches the official SolarEdge careers page and decorates shared runner fields', async () => {
  const solarEdge = await loadSolarEdgeModule()
  assert.ok(solarEdge)

  const requested = []
  const jobs = await solarEdge.createSolarEdgeScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === solarEdge.CAREERS_URL) return readFixture('careers.html')
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [solarEdge.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'SolarEdge')
  assert.equal(jobs[0].source, 'solaredge')
  assert.equal(
    jobs[0].link,
    'https://corporate.solaredge.com/en/careers/open-positions?position=comeet-F8E5F',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
