import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Roles | Amagi</title>
  </head>
  <body>
    <script src="https://amagi.mynexthire.com/employer/ui/js/jobboard/careers-integration.js"></script>
    <script>
      document.onreadystatechange = function () {
        if (document.readyState === "complete") {
          mnh_ci_onreadystatechange("careers", "amagi");
        }
      };
    </script>
    <iframe id="mnhembedded" src=""></iframe>
  </body>
</html>
`

const listingsPayload = {
  reqDetailsBOList: [
    {
      reqId: 371,
      buName: 'Management - Revenue Operations and Strategy-(T031)',
      reqTitle: 'Marketing Operations Lead (GTM - RevOps)',
      expMin: 1,
      expMax: 4,
      location: 'Bangalore',
      locationAddress: 'Bangalore',
      jdDisplay: 'Drive GTM automation, attribution, and pipeline reporting for Amagi.',
      approvedOn: '2026-06-24T06:18:53.452+0000',
      employmentType: 'full-time',
      locationGroup: ['India'],
      fresher: false,
    },
    {
      reqId: 390,
      buName: 'Process Excellence',
      reqTitle: 'Lead Process Excellence',
      expMin: 5,
      expMax: 10,
      location: 'USA-New York',
      locationAddress: 'USA-New York',
      jdDisplay: 'Lead process excellence for the North America organization.',
      approvedOn: '2026-06-24T06:18:53.452+0000',
      employmentType: 'full-time',
      locationGroup: ['USA'],
      fresher: false,
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/amagi/script.js')
  } catch {
    assert.fail('Expected Amagi Media Labs scraper module at ../../scraper/amagi/script.js')
  }
}

test('Amagi Media Labs helpers stay pinned to the verified MyNextHire shell and listing API from Friday, July 17, 2026', async () => {
  const amagi = await loadModule()

  assert.equal(amagi.SOURCE, 'amagi')
  assert.equal(amagi.COMPANY, 'Amagi Media Labs')
  assert.equal(amagi.CAREERS_URL, 'https://www.amagi.com/careers/open-roles')
  assert.equal(amagi.JOBS_BOARD_URL, 'https://amagi.mynexthire.com/employer/jobs/careers')
  assert.equal(amagi.LISTING_API_URL, 'https://amagi.mynexthire.com/employer/careers/reqlist/get')
  assert.equal(amagi.VERIFIED_ON, '2026-07-17')
  assert.equal(amagi.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(amagi.hasOfficialCareersSignal('<html><body><iframe></iframe></body></html>'), false)
  assert.match(amagi.buildJobUrl(371), /^https:\/\/amagi\.mynexthire\.com\/employer\/jobs\/careers\?src%3Dcareers/i)
  assert.match(amagi.buildApplyUrl(371), /^https:\/\/amagi\.mynexthire\.com\/employer\/jobs\/careers\/apply\?src%3Dcareers/i)
  assert.deepEqual(amagi.extractJobs(listingsPayload), [
    {
      title: 'Marketing Operations Lead (GTM - RevOps)',
      company: 'Amagi Media Labs',
      department: 'Management - Revenue Operations and Strategy-(T031)',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '371',
      requisitionId: '371',
      sourceUrl: amagi.buildJobUrl(371),
      applyUrl: amagi.buildApplyUrl(371),
      employmentType: 'Full-time',
      experienceRequired: '1-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-24T06:18:53.452+0000',
      closingDate: null,
      jobDescription: 'Drive GTM automation, attribution, and pipeline reporting for Amagi.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Amagi Media Labs run validates the verified shell before calling the public listing API', async () => {
  const amagi = await loadModule()
  const requestedUrls = []

  const jobs = await amagi.createAmagiMediaLabsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === amagi.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Amagi URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      assert.equal(url, amagi.LISTING_API_URL)
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(options.body), {
        source: 'careers',
        code: '',
        filterByBuId: -1,
      })
      return listingsPayload
    },
  })

  assert.deepEqual(requestedUrls, [amagi.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'amagi')
  assert.equal(jobs[0].link, amagi.buildApplyUrl(371))
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Amagi Media Labs run fails closed when the verified first-party shell drifts', async () => {
  const amagi = await loadModule()

  await assert.rejects(
    amagi.createAmagiMediaLabsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => listingsPayload,
    }),
    /verified Amagi careers shell/i,
  )
})
