import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IMAGE your future - and put your IQ to work! Medical Jobs</title>
  </head>
  <body>
    <h1>Jobs at iQ IMAGE</h1>
    <p>Then IMAGE Information Systems is the right place for you!</p>
    <h3>Explore Opportunities</h3>
    <p>We currently don't have any open positions. We'd love for you to check back again soon.</p>
    <a href="https://www.iq-image.com/job/frontend-developer-m-f-d/">Frontend-Developer (m/f/d)</a>
    <p>February 5. 2026</p>
    <a href="https://www.iq-image.com/job/frontend-developer-m-f-d/">View Details</a>
    <a href="https://www.iq-image.com/contact/">Contact Us</a>
  </body>
</html>
`

const emptyCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IMAGE your future - and put your IQ to work! Medical Jobs</title>
  </head>
  <body>
    <h1>Jobs at iQ IMAGE</h1>
    <p>Then IMAGE Information Systems is the right place for you!</p>
    <h3>Explore Opportunities</h3>
    <p>We currently don't have any open positions. We'd love for you to check back again soon.</p>
  </body>
</html>
`

const implicitEmptyCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IMAGE your future - and put your IQ to work! Medical Jobs</title>
  </head>
  <body>
    <h1>Jobs at iQ IMAGE</h1>
    <p>Then IMAGE Information Systems is the right place for you!</p>
    <a href="#jobs">Current Jobs</a>
    <h2>What you can expect from iQ IMAGE</h2>
    <p>Choose your place of work</p>
    <p>Work where you feel most comfortable, in the office or up to 100% from home.</p>
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Frontend-Developer (m/f/d) - IMAGE Information Systems</title>
  </head>
  <body>
    <h1>Frontend-Developer (m/f/d)</h1>
    <p>Frontend-Developer (m/f/d) to start as soon as possible</p>
    <p>
      Welcome to the world of radiological image viewing! We, IMAGE Information Systems Europe GmbH (iQ IMAGE),
      an international manufacturer of software for radiologists, are looking for a front-end developer (m/f/d)
      to join our development team.
    </p>
    <p>Interested? Send your application documents to hr@iq-image.com.</p>
    <p>Location: Rostock, Germany</p>
    <p>Language Skills: German / English</p>
    <p>Working Time: Full Time</p>
    <p>Remote Work: Remote partially possible</p>
    <h3>Application</h3>
    <button>Submit Application</button>
  </body>
</html>
`

const inactiveDetailPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Frontend-Developer (m/f/d) - IMAGE Information Systems</title>
  </head>
  <body>
    <h1>Frontend-Developer (m/f/d)</h1>
    <p>This page no longer accepts applications.</p>
  </body>
</html>
`

const loadImageInformationSystemsModule = async () => {
  try {
    return await import('../../scraper/imageinformationsystems/script.js')
  } catch {
    assert.fail('Expected Image Information Systems scraper module at ../../scraper/imageinformationsystems/script.js')
  }
}

test('Image Information Systems extracts first-party job detail links even when stale no-openings copy remains on the careers page', async () => {
  const imageInformationSystems = await loadImageInformationSystemsModule()

  assert.equal(imageInformationSystems.SOURCE, 'imageinformationsystems')
  assert.equal(imageInformationSystems.COMPANY_NAME, 'Image Information Systems')
  assert.equal(imageInformationSystems.HOMEPAGE_URL, 'https://www.iq-image.com/')
  assert.equal(imageInformationSystems.CAREERS_URL, 'https://www.iq-image.com/join-our-team/')
  assert.equal(imageInformationSystems.VERIFIED_ON, '2026-07-16')
  assert.equal(
    imageInformationSystems.hasVerifiedCareersPageSignal(careersPageHtml),
    true,
  )
  assert.deepEqual(
    imageInformationSystems.extractJobCardsFromCareersPage(careersPageHtml),
    [
      {
        title: 'Frontend-Developer (m/f/d)',
        detailUrl: 'https://www.iq-image.com/job/frontend-developer-m-f-d/',
        postingDate: '2026-02-05',
      },
    ],
  )
  assert.equal(imageInformationSystems.hasActiveApplicationSignal(detailPageHtml), true)
  assert.equal(imageInformationSystems.hasActiveApplicationSignal(inactiveDetailPageHtml), false)
})

test('Image Information Systems maps visible first-party detail pages into active job records', async () => {
  const imageInformationSystems = await loadImageInformationSystemsModule()
  const requestedUrls = []

  const jobs = await imageInformationSystems.createImageInformationSystemsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === imageInformationSystems.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.iq-image.com/job/frontend-developer-m-f-d/') return detailPageHtml
      throw new Error(`Unexpected Image Information Systems URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    imageInformationSystems.CAREERS_URL,
    'https://www.iq-image.com/job/frontend-developer-m-f-d/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Frontend-Developer (m/f/d)')
  assert.equal(jobs[0].company, 'Image Information Systems')
  assert.equal(jobs[0].location, 'Rostock, Germany')
  assert.equal(jobs[0].city, 'Rostock')
  assert.equal(jobs[0].country, 'Germany')
  assert.equal(jobs[0].jobId, 'frontend-developer-m-f-d')
  assert.equal(jobs[0].sourceUrl, 'https://www.iq-image.com/job/frontend-developer-m-f-d/')
  assert.equal(jobs[0].applyUrl, 'https://www.iq-image.com/job/frontend-developer-m-f-d/')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.equal(jobs[0].postingDate, '2026-02-05')
  assert.equal(jobs[0].remoteStatus, 'Hybrid')
  assert.equal(jobs[0].source, 'imageinformationsystems')
  assert.equal(jobs[0].link, 'https://www.iq-image.com/job/frontend-developer-m-f-d/')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.match(jobs[0].jobDescription, /radiological image viewing/i)
})

test('Image Information Systems returns [] when the careers page explicitly says there are no open positions and exposes no detail links', async () => {
  const imageInformationSystems = await loadImageInformationSystemsModule()

  const jobs = await imageInformationSystems.createImageInformationSystemsScraper().run({
    fetchText: async (url) => {
      if (url === imageInformationSystems.CAREERS_URL) return emptyCareersPageHtml
      throw new Error(`Unexpected Image Information Systems URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [])
})

test('Image Information Systems returns [] when the verified careers page shows an implicit empty jobs section with no visible detail links', async () => {
  const imageInformationSystems = await loadImageInformationSystemsModule()

  const jobs = await imageInformationSystems.createImageInformationSystemsScraper().run({
    fetchText: async (url) => {
      if (url === imageInformationSystems.CAREERS_URL) return implicitEmptyCareersPageHtml
      throw new Error(`Unexpected Image Information Systems URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [])
})

test('Image Information Systems fails closed when the careers page or detail page drifts away from the verified first-party application flow', async () => {
  const imageInformationSystems = await loadImageInformationSystemsModule()

  await assert.rejects(
    imageInformationSystems.createImageInformationSystemsScraper().run({
      fetchText: async (url) => {
        if (url === imageInformationSystems.CAREERS_URL) {
          return careersPageHtml.replace('Jobs at iQ IMAGE', 'Join our community')
        }
        throw new Error(`Unexpected Image Information Systems URL: ${url}`)
      },
      now: () => FIXED_SCRAPED_AT,
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    imageInformationSystems.createImageInformationSystemsScraper().run({
      fetchText: async (url) => {
        if (url === imageInformationSystems.CAREERS_URL) return careersPageHtml
        if (url === 'https://www.iq-image.com/job/frontend-developer-m-f-d/') {
          return inactiveDetailPageHtml
        }
        throw new Error(`Unexpected Image Information Systems URL: ${url}`)
      },
      now: () => FIXED_SCRAPED_AT,
    }),
    /application signals/i,
  )
})
