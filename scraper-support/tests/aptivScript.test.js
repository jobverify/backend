import assert from 'node:assert/strict'
import test from 'node:test'

const loadAptivModule = async () => {
  try {
    return await import('../../scraper/aptiv/script.js')
  } catch {
    assert.fail('Expected Aptiv scraper module at ../../scraper/scraper/aptiv/script.js')
  }
}

const sampleListing = {
  created_moment: ['2026-06-28T17:33:49.658-07:00'],
  pbu: ['ECG Connection Systems PBU'],
  primarylocation: ['Kochi, Kerala, India'],
  jobfamily: ['Finance Support / Administration'],
  jobfamilygroup: ['Finance'],
  link: ['https://www.aptiv.com/en/jobs/search/open-positions/J000700459'],
  primarystate: ['Kerala'],
  primarycity: ['Kochi'],
  jobdescription: ['<p>Finance Analyst</p><p>Experience:<br />2-5 years of relevant experience</p>'],
  category: ['Finance'],
  city: ['Kochi'],
  citycountry: ['Kochi|India'],
  state: ['Kerala'],
  title: ['Finance Analyst'],
  primarycountry: ['India'],
  location: ['Kochi, Kerala, India'],
  country: ['India'],
  jobrequisitionid: ['J000700459'],
  externalapplyurl: ['https://aptiv.wd5.myworkdayjobs.com/APTIV_CAREERS/job/Kochi-India/Finance-Analyst_J000700459/apply'],
}

test('buildSearchRequestPayload keeps Aptiv queries on the official HawkSearch India flow', async () => {
  const { SEARCH_API_URL, buildSearchRequestPayload } = await loadAptivModule()

  assert.equal(SEARCH_API_URL, 'https://aptivcareers.searchapi-na.hawksearch.com/api/v2/search/')
  assert.deepEqual(buildSearchRequestPayload(), {
    ClientData: {
      UserAgent: null,
      VisitId: null,
      VisitorId: null,
      Custom: { custom: 'en' },
    },
    Keyword: '',
    FacetSelections: {
      country: ['India'],
    },
    PageNo: 1,
    IndexName: '',
    IgnoreSpellcheck: false,
    IsInPreview: true,
    ClientGuid: '28fad22cfe584b879917858203dd97ce',
    Is100CoverageTurnedOn: false,
  })
  assert.equal(buildSearchRequestPayload({ pageNo: 3 }).PageNo, 3)
})

test('normalizeJobListing maps Aptiv HawkSearch documents into the shared scraper fields', async () => {
  const { normalizeJobListing } = await loadAptivModule()
  const job = normalizeJobListing(sampleListing)

  assert.deepEqual(job, {
    title: 'Finance Analyst',
    company: 'Aptiv',
    location: 'Kochi, Kerala, India',
    city: 'Kochi',
    country: 'India',
    link: 'https://www.aptiv.com/en/jobs/search/open-positions/J000700459',
    applyUrl: 'https://aptiv.wd5.myworkdayjobs.com/APTIV_CAREERS/job/Kochi-India/Finance-Analyst_J000700459/apply',
    sourceUrl: 'https://www.aptiv.com/en/jobs/search/open-positions/J000700459',
    source: 'aptiv',
    jobId: 'J000700459',
    requisitionId: 'J000700459',
    department: 'Finance',
    employmentType: null,
    experienceRequired: '2-5 years of relevant experience',
    jobDescription: '<p>Finance Analyst</p><p>Experience:<br />2-5 years of relevant experience</p>',
    publicExperienceChecked: true,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-28T17:33:49.658-07:00',
    scrapedAt: job.scrapedAt,
  })
})

test('run paginates Aptiv HawkSearch results and respects maxJobs', async () => {
  const {
    SEARCH_API_URL,
    buildSearchRequestPayload,
    createAptivScraper,
  } = await loadAptivModule()
  const scraper = createAptivScraper()
  const requests = []

  const jobs = await scraper.run({
    maxPages: 2,
    maxJobs: 2,
    fetchJson: async (url, options) => {
      requests.push({
        url,
        method: options.method,
        headers: options.headers,
        body: JSON.parse(options.body),
      })

      if (options.body === JSON.stringify(buildSearchRequestPayload({ pageNo: 1 }))) {
        return {
          Pagination: {
            NofPages: 3,
            CurrentPage: 1,
          },
          Results: [
            { Document: sampleListing },
            {
              Document: {
                ...sampleListing,
                title: ['Senior Software Engineer'],
                primarylocation: ['Bengaluru, Karnataka, India'],
                primarycity: ['Bengaluru'],
                location: ['Bengaluru, Karnataka, India'],
                category: ['Software Engineering'],
                jobrequisitionid: ['J000700460'],
                link: ['https://www.aptiv.com/en/jobs/search/open-positions/J000700460'],
                externalapplyurl: ['https://aptiv.wd5.myworkdayjobs.com/APTIV_CAREERS/job/Bengaluru-India/Senior-Software-Engineer_J000700460/apply'],
              },
            },
          ],
        }
      }

      throw new Error(`Unexpected Aptiv request: ${options.body}`)
    },
  })

  assert.deepEqual(requests, [
    {
      url: SEARCH_API_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-HawkSearch-ClientGuid': '28fad22cfe584b879917858203dd97ce',
      },
      body: buildSearchRequestPayload({ pageNo: 1 }),
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'aptiv')
  assert.equal(jobs[0].jobId, 'J000700459')
  assert.equal(jobs[1].jobId, 'J000700460')
  assert.equal(jobs[1].location, 'Bengaluru, Karnataka, India')
})
