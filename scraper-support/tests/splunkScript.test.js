import assert from 'node:assert/strict'
import test from 'node:test'

const LEGACY_ENTRY_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Working at Splunk - Cisco Careers</title>
  </head>
  <body>
    <h1>Build a more resilient digital world with us</h1>
    <a href="https://careers.cisco.com/global/en/splunk/search-page">Search jobs</a>
    <link rel="canonical" href="https://careers.cisco.com/global/en/splunk" />
  </body>
</html>
`

const SEARCH_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Splunk Job Openings - Cisco Careers</title>
  </head>
  <body>
    <script>
      var phApp = phApp || {};
      phApp.ddo = {
        "eagerLoadRefineSearch":{
          "status":200,
          "hits":80,
          "totalHits":80,
          "data":{
            "jobs":[
              {
                "title":"Solution Test Technical Lead | Python/Java Programming | UI Automation | Network Protocols | AWS | Splunk | Kubernetes | Linux | Wireshark | AI - 8 to 12 years - Bangalore",
                "location":"Bangalore, India",
                "city":"Bangalore",
                "country":"India",
                "type":"Full time",
                "jobId":"2021623",
                "reqId":"2021623",
                "postedDate":"2026-08-12T00:00:00.000+0000",
                "applyUrl":"https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/job/Bangalore-India/Solution-Test-Technical-Lead---Python-Java-Programming---UI-Automation---Network-Protocols---AWS---Splunk---Kubernetes---Linux---Wireshark---AI---8-to-12-years---Bangalore_2021623/apply"
              },
              {
                "title":"Account Executive - Splunk",
                "location":"London, United Kingdom",
                "country":"United Kingdom",
                "jobId":"2013485"
              }
            ],
            "aggregations":[
              {"field":"country","value":{"United States of America":38,"Japan":10,"India":1,"United Kingdom":4}},
              {"field":"type","value":{"Full time":80}}
            ]
          },
          "eid":{
            "query":"(title.title_phenom:(\\"Splunk\\"))"
          }
        },
        "jobwidgetsettings":{"status":"success"}
      };
    </script>
    <div data-widget-type="phw-search-results"></div>
    <div data-rk="l-splunk-search-page"></div>
  </body>
</html>
`

const INDIA_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Splunk India Jobs - Cisco Careers</title>
  </head>
  <body>
    <script>
      var phApp = phApp || {};
      phApp.ddo = {
        "eagerLoadRefineSearch":{
          "status":200,
          "hits":1,
          "totalHits":1,
          "data":{
            "jobs":[
              {
                "title":"Solution Test Technical Lead | Python/Java Programming | UI Automation | Network Protocols | AWS | Splunk | Kubernetes | Linux | Wireshark | AI - 8 to 12 years - Bangalore",
                "location":"Bangalore, India",
                "city":"Bangalore",
                "country":"India",
                "type":"Full time",
                "jobId":"2021623",
                "reqId":"2021623",
                "department":"CXEPI-AIOps-COGS-US 2 (Anup Reddy Challa)",
                "category":"Product and Engineering",
                "ml_skills":["python", "playwright", "splunk"],
                "descriptionTeaser":"We are expanding our team.",
                "postedDate":"2026-08-12T00:00:00.000+0000",
                "applyUrl":"https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/job/Bangalore-India/Solution-Test-Technical-Lead---Python-Java-Programming---UI-Automation---Network-Protocols---AWS---Splunk---Kubernetes---Linux---Wireshark---AI---8-to-12-years---Bangalore_2021623/apply",
                "multi_location":["Bangalore, India"],
                "multi_location_array":[{"location":"Bangalore, India"}]
              }
            ],
            "aggregations":[
              {"field":"country","value":{"India":1}},
              {"field":"type","value":{"Full time":1}}
            ],
            "ui_selections":{"country":["India"]}
          },
          "eid":{
            "query":"(title.title_phenom:(\\"Splunk\\") AND country.country_sort:(\\"India\\"))"
          }
        },
        "jobwidgetsettings":{"status":"success"}
      };
    </script>
    <div data-widget-type="phw-search-results"></div>
    <div data-rk="l-splunkindia"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/splunk/script.js')
  } catch {
    assert.fail('Expected Splunk scraper module at ../../scraper/splunk/script.js')
  }
}

test('Splunk helpers recognize the verified first-party entry, global search results, and empty India slice', async () => {
  const splunk = await loadModule()

  assert.equal(splunk.SOURCE, 'splunk')
  assert.equal(splunk.COMPANY, 'Splunk')
  assert.equal(splunk.CAREERS_ENTRY_URL, 'https://www.splunk.com/en_us/careers/search-jobs.hml.html')
  assert.equal(splunk.SEARCH_PAGE_URL, 'https://careers.cisco.com/global/en/splunk/search-page')
  assert.equal(splunk.INDIA_PAGE_URL, 'https://careers.cisco.com/global/en/splunk/india')
  assert.equal(splunk.VERIFIED_ON, '2026-08-14')
  assert.equal(splunk.hasLegacyCareersEntrySignal(LEGACY_ENTRY_HTML), true)
  assert.equal(splunk.hasSearchPageSignal(SEARCH_PAGE_HTML), true)
  assert.equal(splunk.hasIndiaPageSignal(INDIA_PAGE_HTML), true)

  const searchState = splunk.extractRefineSearchState(SEARCH_PAGE_HTML)
  const indiaState = splunk.extractRefineSearchState(INDIA_PAGE_HTML)

  assert.equal(searchState.totalHits, 80)
  assert.equal(indiaState.totalHits, 1)
  assert.equal(splunk.searchPageShowsLiveGlobalResults(searchState), true)
  assert.equal(splunk.indiaPageShowsLiveIndiaResults(indiaState), true)

  const indiaJobs = splunk.extractIndiaJobs(indiaState)
  assert.equal(indiaJobs.length, 1)
  assert.deepEqual(indiaJobs[0], {
    title: 'Solution Test Technical Lead | Python/Java Programming | UI Automation | Network Protocols | AWS | Splunk | Kubernetes | Linux | Wireshark | AI - 8 to 12 years - Bangalore',
    company: 'Splunk',
    department: 'CXEPI-AIOps-COGS-US 2 (Anup Reddy Challa)',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '2021623',
    requisitionId: '2021623',
    sourceUrl: 'https://careers.cisco.com/global/en/job/2021623/Solution-Test-Technical-Lead-Python-Java-Programming-UI-Automation-Network-Protocols-AWS-Splunk-Kubernetes-Linux-Wireshark-AI-8-to-12-years-Bangalore',
    applyUrl: 'https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/job/Bangalore-India/Solution-Test-Technical-Lead---Python-Java-Programming---UI-Automation---Network-Protocols---AWS---Splunk---Kubernetes---Linux---Wireshark---AI---8-to-12-years---Bangalore_2021623/apply',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['python', 'playwright', 'splunk'],
    postingDate: '2026-08-12',
    closingDate: null,
    jobDescription: 'We are expanding our team.',
    locations: ['Bangalore, India'],
  })
})

test('Splunk returns the verified India jobs from the first-party embedded payload', async () => {
  const splunk = await loadModule()
  const requestedUrls = []

  const jobs = await splunk.createSplunkScraper().run({
    now: () => '2026-08-14T17:02:09.529Z',
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === splunk.CAREERS_ENTRY_URL) return LEGACY_ENTRY_HTML
      if (url === splunk.SEARCH_PAGE_URL) return SEARCH_PAGE_HTML
      if (url === splunk.INDIA_PAGE_URL) return INDIA_PAGE_HTML
      throw new Error(`Unexpected Splunk URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    splunk.CAREERS_ENTRY_URL,
    splunk.SEARCH_PAGE_URL,
    splunk.INDIA_PAGE_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '2021623')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'splunk')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-14T17:02:09.529Z')
})

test('Splunk fails closed when the public India slice or global search payload changes materially', async () => {
  const splunk = await loadModule()

  await assert.rejects(
    splunk.createSplunkScraper().run({
      fetchText: async (url) => {
        if (url === splunk.CAREERS_ENTRY_URL) return LEGACY_ENTRY_HTML
        if (url === splunk.SEARCH_PAGE_URL) return SEARCH_PAGE_HTML
        return `
          <html>
            <head><title>Splunk India Jobs - Cisco Careers</title></head>
            <body>
              <script>
                phApp = {
                  ddo: {
                    "eagerLoadRefineSearch":{
                      "status":200,
                      "hits":0,
                      "totalHits":0,
                      "data":{
                        "jobs":[],
                        "aggregations":[{"field":"country","value":{"India":0}}],
                        "ui_selections":{"country":["India"]}
                      },
                      "eid":{"query":"(title.title_phenom:(\\"Splunk\\") AND country.country_sort:(\\"India\\"))"}
                    },
                    "jobwidgetsettings":{"status":"success"}
                  }
                }
              </script>
              <div data-widget-type="phw-search-results"></div>
              <div data-rk="l-splunkindia"></div>
            </body>
          </html>
        `
      },
    }),
    /India results/i,
  )
})
