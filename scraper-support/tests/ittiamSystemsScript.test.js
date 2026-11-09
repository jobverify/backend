import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'ittiamsystems')
const renderedCareersHtml = readFileSync(path.join(fixturesDir, 'careers-rendered.html'), 'utf8')

const loadIttiamSystemsModule = async () => {
  try {
    return await import('../../scraper/ittiamsystems/script.js')
  } catch {
    assert.fail('Expected Ittiam Systems scraper module at ../../scraper/ittiamsystems/script.js')
  }
}

const createPagePayload = (renderedHtml = renderedCareersHtml) => ([{
  link: 'https://www.ittiam.com/careers/',
  title: { rendered: 'Careers' },
  content: { rendered: renderedHtml },
}])

test('Ittiam Systems scraper recognizes the verified first-party careers surface and parses current opportunities', async () => {
  const ittiam = await loadIttiamSystemsModule()

  assert.equal(ittiam.SOURCE, 'ittiamsystems')
  assert.equal(ittiam.COMPANY, 'Ittiam Systems')
  assert.equal(ittiam.HOMEPAGE_URL, 'https://www.ittiam.com/')
  assert.equal(ittiam.CAREERS_PAGE_URL, 'https://www.ittiam.com/careers/')
  assert.equal(
    ittiam.CAREERS_PAGE_API_URL,
    'https://www.ittiam.com/wp-json/wp/v2/pages?slug=careers&per_page=20',
  )
  assert.equal(ittiam.hasOfficialCareersSignal(renderedCareersHtml), true)

  const jobs = ittiam.extractCurrentOpportunities(renderedCareersHtml)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Android Security (Senior Engineer / Lead Engineer / Lead)',
    'Engineer, Video Codecs',
    'System Administrator',
  ])
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka')
  assert.equal(jobs[0].experienceRequired, '2 - 5 Years')
  assert.equal(jobs[0].minimumQualification, 'BE/BTech/MTech Degree in computer science / electronics and communications with a minimum of 7.5 CGPA')
  assert.equal(jobs[0].applyUrl, 'mailto:talent@ittiam.com')
  assert.equal(jobs[0].sourceUrl, ittiam.CAREERS_PAGE_URL)
  assert.equal(jobs[2].employmentType, 'Contract')
  assert.equal(jobs[2].minimumQualification, 'Diploma/Graduation and relevant certified courses.')
  assert.match(jobs[2].jobDescription, /Kubernite/i)
})

test('Ittiam Systems scraper returns the parsed jobs and decorates them with scraper metadata', async () => {
  const ittiam = await loadIttiamSystemsModule()
  const requestedUrls = []

  const jobs = await ittiam.createIttiamSystemsScraper().run({
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === ittiam.CAREERS_PAGE_API_URL) {
        return createPagePayload()
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [ittiam.CAREERS_PAGE_API_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Ittiam Systems')
  assert.equal(jobs[0].source, 'ittiamsystems')
  assert.equal(jobs[0].link, 'mailto:talent@ittiam.com')
  assert.equal(jobs[0].sourceUrl, ittiam.CAREERS_PAGE_URL)
  assert.equal(jobs[0].applyUrl, 'mailto:talent@ittiam.com')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Ittiam Systems scraper fails closed when the verified careers payload changes', async () => {
  const ittiam = await loadIttiamSystemsModule()

  await assert.rejects(
    ittiam.createIttiamSystemsScraper().run({
      fetchJson: async () => ([{
        link: 'https://www.ittiam.com/careers/',
        title: { rendered: 'Careers' },
        content: { rendered: '<div>Unrelated content</div>' },
      }]),
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    ittiam.createIttiamSystemsScraper().run({
      fetchJson: async () => ([{
        link: 'https://www.ittiam.com/careers/',
        title: { rendered: 'Careers' },
        content: { rendered: renderedCareersHtml.replace('Current Opportunities', 'Open Roles') },
      }]),
    }),
    /verified official careers surface/i,
  )
})
