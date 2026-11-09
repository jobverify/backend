import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head><title>Careers | Century Ply</title></head>
    <body>
      <a href="https://centuryply.x0pa.ai/public/microsites/centuryplycareers">Current Openings</a>
      <p>Explore opportunities with CenturyPly.</p>
    </body>
  </html>
`

const listingsPayload = {
  count: 1,
  data: [
    {
      id: 4674269,
      job_title: 'Area Sales Manager',
      location: 'Kolkata',
      open_date: '2026-07-12T00:00:00.000Z',
      category: 'Sales',
      customJobFields: {
        BusinessUnit: 'Plywood',
        Department: 'Sales',
        Branch: 'Kolkata',
        Category: 'Field Sales',
      },
    },
  ],
}

const detailPayload = {
  data: {
    id: 4674269,
    job_title: 'Area Sales Manager',
    location: 'Kolkata',
    jobDesc: '<p>Lead channel sales for the region.</p><ul><li>Distributor management</li></ul>',
    jobRequirement: 'MBA preferred',
    experience: '5-8 years',
    customJobFields: {
      BusinessUnit: 'Plywood',
      Department: 'Sales',
      Branch: 'Kolkata',
      Category: 'Field Sales',
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/centuryplyboards/script.js')
  } catch {
    assert.fail('Expected Century Plyboards scraper module at ../../scraper/scraper/centuryplyboards/script.js')
  }
}

test('Century Plyboards verifies the official careers handoff and builds the public X0PA URLs', async () => {
  const century = await loadModule()

  assert.equal(century.SOURCE, 'centuryplyboards')
  assert.equal(century.COMPANY, 'Century Plyboards')
  assert.equal(century.CAREERS_URL, 'https://www.centuryply.com/careers')
  assert.equal(century.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    century.buildListingApiUrl({ skip: 10, limit: 10 }),
    'https://centuryply.x0pa.ai/roboroy/api/v2/microsite/mst/centuryplycareers/jobs?skip=10&limit=10&orderKey=open_date%3Adesc',
  )
  assert.equal(
    century.buildDetailApiUrl(4674269),
    'https://centuryply.x0pa.ai/roboroy/api/v1/jobs/4674269?jobId=4674269',
  )
  assert.equal(
    century.buildPublicJobUrl(4674269),
    'https://centuryply.x0pa.ai/public/r/job/4674269?micrositeId=centuryplycareers',
  )
})

test('extractSearchResults and extractJobDetail map X0PA records into the shared job shape', async () => {
  const century = await loadModule()
  const listings = century.extractSearchResults(listingsPayload)

  assert.equal(listings.length, 1)
  assert.deepEqual(listings[0], {
    title: 'Area Sales Manager',
    company: 'Century Plyboards',
    department: 'Sales',
    location: 'Kolkata, India',
    city: 'Kolkata',
    state: null,
    country: 'India',
    jobId: '4674269',
    requisitionId: '4674269',
    sourceUrl: 'https://centuryply.x0pa.ai/public/r/job/4674269?micrositeId=centuryplycareers',
    applyUrl: 'https://centuryply.x0pa.ai/public/r/job/4674269?micrositeId=centuryplycareers',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-12',
    closingDate: null,
    jobDescription: null,
    businessUnit: 'Plywood',
    branch: 'Kolkata',
    category: 'Field Sales',
  })

  const detail = century.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.experienceRequired, '5-8 years')
  assert.equal(detail.minimumQualification, 'MBA preferred')
  assert.match(detail.jobDescription, /Lead channel sales for the region\./)
  assert.match(detail.jobDescription, /Distributor management/)
})

test('run paginates Century Plyboards listings and hydrates detail records', async () => {
  const century = await loadModule()
  const requests = []

  const jobs = await century.createCenturyPlyboardsScraper().run({
    fetchText: async (url) => {
      requests.push({ type: 'text', url })
      if (url === century.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requests.push({ type: 'json', url })
      if (url === century.buildListingApiUrl({ skip: 0, limit: 10 })) return listingsPayload
      if (url === century.buildDetailApiUrl(4674269)) return detailPayload
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { type: 'text', url: century.CAREERS_URL },
    { type: 'json', url: century.buildListingApiUrl({ skip: 0, limit: 10 }) },
    { type: 'json', url: century.buildDetailApiUrl(4674269) },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'centuryplyboards')
  assert.equal(jobs[0].link, 'https://centuryply.x0pa.ai/public/r/job/4674269?micrositeId=centuryplycareers')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
