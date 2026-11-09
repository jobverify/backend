import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HashedIn by Deloitte | Digital Product Engineering</title>
  </head>
  <body>
    <main>
      <a href="/careers">Careers</a>
      <h1>Open positions</h1>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a class="careers-hero-button" href="/careers#explore-opportunities">See Current Job Openings</a>
    <section id="explore-opportunities">
      <h2>Explore opportunities</h2>
    </section>
  </body>
</html>
`

const experiencedFeedText = JSON.stringify([
  {
    id: 'tech-architect',
    title: 'Sr. Technology Architect',
    experience: '9-18 years of experience',
    description: 'Lead architecture decisions across products.',
    location: 'Bengaluru',
    detailedJdUrl: 'https://apply.hashedin.com/caf?id=tech-architect',
    lastUpdated: '2026-08-01T00:00:00Z',
  },
])

const loadModule = async () => {
  try {
    return await import('../../scraper/hashedintechnologies/script.js')
  } catch {
    assert.fail('Expected HashedIn Technologies scraper module at ../../scraper/hashedintechnologies/script.js')
  }
}

test('HashedIn Technologies accepts the current careers shell and treats a blank fresher feed as no jobs', async () => {
  const hashedin = await loadModule()

  assert.equal(hashedin.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hashedin.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(hashedin.parseJobsFeedResponseText(''), [])
  assert.equal(
    hashedin.extractJobsFromFeed(hashedin.parseJobsFeedResponseText(experiencedFeedText), 'experienced').length,
    1,
  )
})

test('HashedIn Technologies run validates the current careers shell and parses both job feeds', async () => {
  const hashedin = await loadModule()
  const requestedText = []
  const requestedFeedText = []

  const jobs = await hashedin.createHashedInTechnologiesScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedText.push(url)
      if (url === hashedin.HOMEPAGE_URL) return homepageHtml
      if (url === hashedin.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected HashedIn text URL: ${url}`)
    },
    fetchFeedText: async (url) => {
      requestedFeedText.push(url)
      if (url === hashedin.EXPERIENCED_JOBS_URL) return experiencedFeedText
      if (url === hashedin.FRESHER_JOBS_URL) return ''
      throw new Error(`Unexpected HashedIn feed URL: ${url}`)
    },
  })

  assert.deepEqual(requestedText, [
    hashedin.HOMEPAGE_URL,
    hashedin.CAREERS_URL,
  ])
  assert.deepEqual(requestedFeedText, [
    hashedin.EXPERIENCED_JOBS_URL,
    hashedin.FRESHER_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'hashedintechnologies')
  assert.equal(jobs[0].title, 'Sr. Technology Architect')
  assert.equal(jobs[0].location, 'Bengaluru, India')
})
