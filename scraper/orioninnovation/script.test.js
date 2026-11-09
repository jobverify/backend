import assert from 'node:assert/strict'
import test from 'node:test'

const loadOrionInnovationModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life at Orion - Orion Innovation</title>
  </head>
  <body>
    <main>
      <h1>Where people grow and innovation thrives</h1>
      <p>A global community shaping what’s next.</p>
      <a href="https://www.orioninnovation.com/careers/job/">Explore Opportunities</a>
      <h2>Join us</h2>
      <p>Explore open roles today.</p>
    </main>
  </body>
</html>
`

const openJobsPageData = {
  url: 'https://www.orioninnovation.com/careers/job/',
  title: 'Job - Orion Innovation',
  text: `
    Open Jobs
    79 Open Positions
    GitHub Platform Lead
    Location: India, US
    Category: Delivery
    Product Owner
    Location: Chennai, Tamil Nadu, India
    Category: Delivery
    AI Engineer
    Location: Mumbai, Maharashtra
    Category: Delivery
    DevOps Manager
    Location: Iselin, NJ
    Category: Technology and Engineering
    Load more
  `,
  links: [
    {
      text: 'GitHub Platform Lead',
      href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620001006',
    },
    {
      text: 'Product Owner',
      href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620002006',
    },
    {
      text: 'AI Engineer',
      href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620003006',
    },
    {
      text: 'DevOps Manager',
      href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620004006',
    },
  ],
}

const renderedJobCards = [
  {
    title: 'GitHub Platform Lead',
    location: 'India, US',
    category: 'Delivery',
    workType: null,
    href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620001006',
  },
  {
    title: 'Product Owner',
    location: 'Chennai, Tamil Nadu, India',
    category: 'Delivery',
    workType: null,
    href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620002006',
  },
  {
    title: 'AI Engineer',
    location: 'Mumbai, Maharashtra',
    category: 'Delivery',
    workType: null,
    href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620003006',
  },
  {
    title: 'DevOps Manager',
    location: 'Iselin, NJ',
    category: 'Technology and Engineering',
    workType: null,
    href: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620004006',
  },
]

test('Orion Innovation validates the verified official careers and open-jobs surfaces', async () => {
  const orion = await loadOrionInnovationModule()
  assert.ok(orion, 'Expected Orion Innovation scraper module at ./script.js')

  assert.equal(orion.SOURCE, 'orioninnovation')
  assert.equal(orion.COMPANY, 'Orion Innovation')
  assert.equal(orion.CAREERS_PAGE_URL, 'https://www.orioninnovation.com/careers/life-at-orion/')
  assert.equal(orion.OPEN_JOBS_URL, 'https://www.orioninnovation.com/careers/job/')
  assert.equal(orion.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(orion.hasOfficialOpenJobsSignal(openJobsPageData), true)
})

test('Orion Innovation normalizes rendered official job cards and keeps India coverage only', async () => {
  const orion = await loadOrionInnovationModule()
  assert.ok(orion, 'Expected Orion Innovation scraper module at ./script.js')

  assert.deepEqual(orion.extractJobsFromCards(renderedJobCards), [
    {
      title: 'GitHub Platform Lead',
      company: 'Orion Innovation',
      department: 'Delivery',
      location: 'India, US',
      city: 'Remote',
      country: 'India',
      jobId: '4620001006',
      requisitionId: '4620001006',
      sourceUrl: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620001006',
      applyUrl: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620001006',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Product Owner',
      company: 'Orion Innovation',
      department: 'Delivery',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId: '4620002006',
      requisitionId: '4620002006',
      sourceUrl: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620002006',
      applyUrl: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620002006',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'AI Engineer',
      company: 'Orion Innovation',
      department: 'Delivery',
      location: 'Mumbai, Maharashtra',
      city: 'Mumbai',
      country: 'India',
      jobId: '4620003006',
      requisitionId: '4620003006',
      sourceUrl: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620003006',
      applyUrl: 'https://www.orioninnovation.com/careers/job/?gh_jid=4620003006',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Orion Innovation runs through the verified browser-backed public jobs surface', async () => {
  const orion = await loadOrionInnovationModule()
  assert.ok(orion, 'Expected Orion Innovation scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await orion.createOrionInnovationScraper({ maxJobs: 2 }).run({
    collectPageDataImpl: async (_page, url) => {
      requestedUrls.push(url)
      if (url === orion.CAREERS_PAGE_URL) {
        return {
          url,
          title: 'Life at Orion - Orion Innovation',
          text: 'Where people grow and innovation thrives Explore Opportunities Join us Explore open roles today.',
          links: [{ text: 'Explore Opportunities', href: orion.OPEN_JOBS_URL }],
        }
      }

      if (url === orion.OPEN_JOBS_URL) return openJobsPageData

      throw new Error(`Unexpected Orion Innovation fixture URL: ${url}`)
    },
    readRenderedJobCardsImpl: async () => renderedJobCards,
    launchBrowserImpl: async () => ({ close: async () => {} }),
    createOptimizedPageImpl: async () => ({}),
  })

  assert.deepEqual(requestedUrls, [
    orion.CAREERS_PAGE_URL,
    orion.OPEN_JOBS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'orioninnovation')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Orion Innovation API-only collection does not require browser hooks', async () => {
  const orion = await loadOrionInnovationModule()
  assert.ok(orion, 'Expected Orion Innovation scraper module at ./script.js')

  const jobs = await orion.createOrionInnovationScraper({ maxJobs: 1 }).run({
    collectPageDataImpl: async (_page, url) => {
      if (url === orion.CAREERS_PAGE_URL) {
        return {
          url,
          title: 'Life at Orion - Orion Innovation',
          text: 'Where people grow and innovation thrives Explore Opportunities Join us Explore open roles today.',
          links: [{ text: 'Explore Opportunities', href: orion.OPEN_JOBS_URL }],
        }
      }

      return openJobsPageData
    },
    readRenderedJobCardsImpl: async () => renderedJobCards,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'orioninnovation')
})
