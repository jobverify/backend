import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'inspireai',
)

const officialCareersHtml = readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')

const loadInspireAiModule = async () => {
  try {
    return await import('../../scraper/inspireai/script.js')
  } catch {
    assert.fail('Expected Inspire AI scraper module at ../../scraper/inspireai/script.js')
  }
}

test('Inspire AI validates the verified official careers accordion and extracts current public non-India roles', async () => {
  const inspireAi = await loadInspireAiModule()

  assert.equal(inspireAi.SOURCE, 'inspireai')
  assert.equal(inspireAi.COMPANY, 'Inspire AI')
  assert.equal(inspireAi.CAREERS_URL, 'https://inspireai.com/careers/')
  assert.equal(inspireAi.hasOfficialCareersSignal(officialCareersHtml), true)

  assert.deepEqual(inspireAi.extractPublicListings(officialCareersHtml), [
    {
      title: 'Senior Consultant - Contact Centre, Voice & AI CX',
      location: 'UK, Europe, South Africa, or CET-aligned remote',
      applyUrl: 'https://mission-control-mvp.vercel.app/?utm_source=website&utm_medium=careers-page&utm_campaign=cc-voice-06-2026',
      sourceUrl: 'https://inspireai.com/careers/',
      employmentType: null,
      remoteStatus: 'Hybrid',
      country: null,
      city: null,
    },
    {
      title: 'Salesforce Sales Executive - UKI',
      location: 'UK',
      applyUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdWziPVAhCOGEx2tXT0UkY50T8mWrFzUAlUIRfoOQUUXI93CQ/viewform',
      sourceUrl: 'https://inspireai.com/careers/',
      employmentType: 'Full-time',
      remoteStatus: 'Remote',
      country: 'United Kingdom',
      city: null,
    },
    {
      title: 'Senior Consultant - SA',
      location: 'South Africa',
      applyUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfh4sQny6RN0W21rNZvb31dAdBx1lb-9ieDagsy472I3xjVQg/viewform?pli=1',
      sourceUrl: 'https://inspireai.com/careers/',
      employmentType: 'Full-time',
      remoteStatus: 'Remote',
      country: 'South Africa',
      city: null,
    },
    {
      title: 'Senior Salesforce Consultant - NL',
      location: 'Netherlands',
      applyUrl: 'https://forms.gle/R7dzBjT4PE1gJNqN9',
      sourceUrl: 'https://inspireai.com/careers/',
      employmentType: null,
      remoteStatus: 'Remote',
      country: 'Netherlands',
      city: null,
    },
  ])
})

test('Inspire AI run returns an honest zero-job result while the verified official careers page exposes no India roles', async () => {
  const inspireAi = await loadInspireAiModule()
  const requestedUrls = []

  const jobs = await inspireAi.createInspireAiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [inspireAi.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Inspire AI fails closed when the verified official careers accordion changes', async () => {
  const inspireAi = await loadInspireAiModule()

  await assert.rejects(
    inspireAi.createInspireAiScraper().run({
      fetchText: async () => '<html><body><h1>Join us</h1></body></html>',
    }),
    /verified official careers surface/i,
  )
})
