import assert from 'node:assert/strict'
import test from 'node:test'

const indiaSearchHtml = `
<html>
  <head><title>Ellucian Careers</title></head>
  <body>
    <script>
      window.searchConfig = {
        "query": {
          "country": "India",
          "internal": "false",
          "separator": "%7C",
          "facetField": "tags2%7Cstate%7Ccity%7Ccountry%7Ctags1"
        },
        "path": "/jobs/locations/country/India",
        "numRowsPerPage": 10
      };
    </script>
  </body>
</html>
`

const samplePayload = {
  jobs: [
    {
      title: 'Senior Software Engineer',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      req_id: '7420',
      slug: '7420',
      apply_url: 'https://careers.ellucian.com/jobs/7420?lang=en-us',
      posted_date: '2026-07-10',
      categories: [{ name: 'Engineering' }],
      description: '<p>Build platform features.</p>',
      employment_type: 'Full Time',
    },
  ],
  totalCount: 1,
}

const loadEllucianModule = async () => import('./script.js')

test('Ellucian Higher Education Systems pins the verified India Jibe search config and jobs api url', async () => {
  const ellucian = await loadEllucianModule()
  const searchConfig = ellucian.extractOfficialSearchConfig(indiaSearchHtml)

  assert.deepEqual(searchConfig, {
    query: {
      country: 'India',
      internal: 'false',
      separator: '%7C',
      facetField: 'tags2%7Cstate%7Ccity%7Ccountry%7Ctags1',
    },
    path: '/jobs/locations/country/India',
    numRowsPerPage: 10,
  })
  assert.equal(ellucian.hasOfficialIndiaSearchSignal(indiaSearchHtml), true)
  assert.equal(
    ellucian.buildJobsApiUrl({ page: 1, searchConfig }),
    'https://careers.ellucian.com/api/jobs?page=1&country=India&internal=false&separator=%7C&facetField=tags2%7Cstate%7Ccity%7Ccountry%7Ctags1',
  )
  assert.deepEqual(ellucian.extractSearchResults(samplePayload), [
    {
      title: 'Senior Software Engineer',
      company: 'Ellucian Higher Education Systems',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '7420',
      requisitionId: '7420',
      sourceUrl: 'https://careers.ellucian.com/jobs/7420?lang=en-us',
      applyUrl: 'https://careers.ellucian.com/jobs/7420?lang=en-us',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-10',
      closingDate: null,
      jobDescription: 'Build platform features.',
    },
  ])
})

test('Ellucian Higher Education Systems run returns [] when the official India Jibe filter is empty', async () => {
  const ellucian = await loadEllucianModule()
  const urls = []
  const jobs = await ellucian.createEllucianHigherEducationSystemsScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => indiaSearchHtml,
    fetchJson: async (url) => {
      urls.push(url)
      return { jobs: [], totalCount: 0 }
    },
  })

  assert.deepEqual(urls, [
    'https://careers.ellucian.com/api/jobs?page=1&country=India&internal=false&separator=%7C&facetField=tags2%7Cstate%7Ccity%7Ccountry%7Ctags1',
  ])
  assert.deepEqual(jobs, [])
})
