import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/gadgeon/script.js')
  } catch {
    return null
  }
}

const listingPageData = {
  url: 'https://www.gadgeon.com/joinus/',
  title: 'Join us - Gadgeon',
  text: `
    Join us
    Current Openings
    Senior Software Engineer
    Kochi, India
    5-8 Years
    Embedded Systems
    Apply Now
    QA Automation Engineer
    Bangalore, India
    3-5 Years
    Quality Engineering
    Apply Now
    Senior Account Manager
    Dubai, United Arab Emirates
    8-10 Years
    Sales
    Apply Now
    careers@gadgeon.com
  `,
  jobs: [
    {
      title: 'Senior Software Engineer',
      location: 'Kochi, India',
      experienceRequired: '5-8 Years',
      department: 'Embedded Systems',
    },
    {
      title: 'QA Automation Engineer',
      location: 'Bangalore, India',
      experienceRequired: '3-5 Years',
      department: 'Quality Engineering',
    },
    {
      title: 'Senior Account Manager',
      location: 'Dubai, United Arab Emirates',
      experienceRequired: '8-10 Years',
      department: 'Sales',
    },
  ],
  links: [
    {
      text: 'Apply Now',
      href: 'mailto:careers@gadgeon.com',
    },
  ],
}

test('Gadgeon recognizes listings while requiring native criteria and country binding before emitting jobs', async () => {
  const gadgeon = await loadModule()
  assert.ok(gadgeon, 'Gadgeon scraper module should load')

  const {
    CAREERS_PAGE_URL,
    COMPANY,
    SOURCE,
    VERIFIED_PAGE_SIGNAL,
    extractJobsFromPageData,
    hasVerifiedCareersSurface,
  } = gadgeon

  assert.equal(SOURCE, 'gadgeon')
  assert.equal(COMPANY, 'Gadgeon')
  assert.equal(CAREERS_PAGE_URL, 'https://www.gadgeon.com/joinus/')
  assert.equal(VERIFIED_PAGE_SIGNAL, 'Current Openings')
  assert.equal(hasVerifiedCareersSurface(listingPageData), true)
  assert.deepEqual(extractJobsFromPageData(listingPageData), [])
})

test('Gadgeon preserves listing-only page collector observations as incomplete evidence', async () => {
  const gadgeon = await loadModule()
  assert.ok(gadgeon, 'Gadgeon scraper module should load')

  const { CAREERS_PAGE_URL, createGadgeonScraper } = gadgeon
  const requestedUrls = []
  const audits = []

  const jobs = await createGadgeonScraper({ maxJobs: 1 }).run({
    collectPageDataImpl: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, CAREERS_PAGE_URL)
      return listingPageData
    },
    onAudit: audit => audits.push(audit),
  })

  assert.deepEqual(requestedUrls, [CAREERS_PAGE_URL])
  assert.equal(jobs.length, 0)
  assert.equal(audits[0].observations.length, 3)
  assert.equal(audits[0].observations[0].original.title, 'Senior Software Engineer')
  assert.equal(audits[0].observations.every(role => role.country === null), true)
})

test('Gadgeon scraper rejects careers pages that no longer match the verified public surface', async () => {
  const gadgeon = await loadModule()
  assert.ok(gadgeon, 'Gadgeon scraper module should load')

  await assert.rejects(
    gadgeon.createGadgeonScraper().run({
      collectPageDataImpl: async () => ({
        title: 'Careers',
        text: 'Open roles',
        jobs: [],
        links: [],
      }),
    }),
    /verified public careers surface/i,
  )
})
