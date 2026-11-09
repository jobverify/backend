import assert from 'node:assert/strict'
import test from 'node:test'

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About us | Sify Technologies</title>
  </head>
  <body>
    <nav>
      <a href="/marketplace">Marketplace</a>
      <a href="/investors">Investors</a>
      <a href="https://sifycareer.tallite.com/">Careers</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <h1>Driving Business Transformation Across Industries</h1>
    <p>India's only organically grown ICT company, Sify Technologies grew forward from being an infrastructure focused company.</p>
  </body>
</html>
`

const DETAIL_DESCRIPTION_HTML = `
<table>
  <tbody>
    <tr>
      <td>
        <ul>
          <li>Responsible for participating in the Business Requirements Document (BRD) review and Functional Design Document review meetings.</li>
          <li>Configure and manage Firewalls &amp; IPS across the network.</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td>
        <div><b><u>Skills Required</u></b></div>
        <ul>
          <li>Hands on experience on Fortinet, IPS, Checkpoint Firewall &amp; Cisco FTD.</li>
          <li>Sound knowledge on Security Products &amp; Firewall.</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td>
        <div>Qualifications:</div>
        <ul>
          <li>Minimum qualification should be B.E / B. Tech/ MCA/ BCA/ BSc(IT)/ MSc(IT)</li>
          <li>Certification - CCNP Security or equivalent professional level certification from Fortinet.</li>
          <li>Must have ability to support flexible schedule in support of 7x24 operations.</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>
`

const LIST_REQUEST_PAYLOAD = {
  search: '',
  resId: 0,
  sellerShortCode: 'SIF',
  expFrom: 0,
  expTo: null,
  jobType: null,
  location: null,
  currency: 2,
  minSalary: 0,
  maxSalary: 0,
  scale: 5,
  startPage: 1,
  limit: 10,
  myJobs: 0,
  clients: null,
  sortBy: 1,
  salaryRange: null,
  locationId: null,
  jobTypeId: null,
  industryId: null,
  industries: null,
  experienceId: null,
}

const LIST_RESPONSE_PAYLOAD = {
  count: 34,
  limit: '10',
  list: [{
    productCode: '18687',
    productName: 'Assistant Manager-Network Projects',
    sellerCompanyName: 'Network Managed Services',
    experience: '6 - 15',
    productCodeText: 'SIFY/6778/2026',
    keySkills: 'Firewall, Firewall - Checkpoint, Firewall - Cisco ASA, Firewall - Cisco FMC & FTD 4245, Firewall / VPN tunnel, IPS (TippingPoint), IPS policy',
    certiKeywords: 'Network Security, Firewall, IPS',
    postedDate: '2026-07-14 08:27:34',
    jobLocation: 'Mumbai',
  }],
  tableLayoutList: [],
}

const DETAIL_REQUEST_PAYLOAD = {
  resId: null,
  sellerShortCode: 'SIF',
  productCode: '18687',
}

const DETAIL_RESPONSE_PAYLOAD = {
  detail: {
    productCode: 18687,
    productName: 'Assistant Manager-Network Projects',
    description: DETAIL_DESCRIPTION_HTML,
    expFrom: 6,
    expTo: 15,
    jobType: '',
    productCodeText: 'SIFY/6778/2026',
    jobLocation: 'Mumbai',
    branchName: 'Navi mumbai, Maharashtra, India',
    keySkills: 'Firewall, Firewall - Checkpoint, Firewall - Cisco ASA, Firewall - Cisco FMC & FTD 4245, Firewall / VPN tunnel, IPS (TippingPoint), IPS policy',
    certiKeywords: 'Network Security, Firewall, IPS',
    postedDate: '2026-07-14 08:27:34',
    Requirement_Client_Name: 'Network Managed Services (NEMS)',
    reqCompanyTitle: 'Sify Digital Services Limited',
    reqRegionTitle: 'IN',
  },
  careerPortalJobDetailHTMLView: '',
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sifytechnologies/script.js')
  } catch {
    assert.fail('Expected Sify Technologies scraper module at ../../scraper/sifytechnologies/script.js')
  }
}

test('Sify Technologies stays pinned to the verified first-party Tallite endpoints and public encrypted payload contract', async () => {
  const sifyTechnologies = await loadScriptModule()

  assert.equal(sifyTechnologies.SOURCE, 'sifytechnologies')
  assert.equal(sifyTechnologies.COMPANY_NAME, 'Sify Technologies')
  assert.equal(sifyTechnologies.VERIFIED_ON, '2026-07-26')
  assert.equal(sifyTechnologies.ABOUT_URL, 'https://www.sifytechnologies.com/about-us/')
  assert.equal(sifyTechnologies.CAREERS_URL, 'https://sifycareer.tallite.com/')
  assert.equal(sifyTechnologies.JOBS_PAGE_URL, 'https://sifycareer.tallite.com/jobs')
  assert.equal(sifyTechnologies.SELLER_SHORT_CODE, 'SIF')
  assert.equal(
    sifyTechnologies.LIST_API_URL,
    'https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_list?lngId=1&sellerShortCode=SIF',
  )
  assert.equal(
    sifyTechnologies.DETAIL_API_URL,
    'https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_detail?lngId=1&sellerShortCode=SIF',
  )
  assert.equal(sifyTechnologies.hasOfficialAboutPageSignal(ABOUT_HTML), true)
  assert.deepEqual(sifyTechnologies.buildListRequestPayload(), LIST_REQUEST_PAYLOAD)
  assert.deepEqual(sifyTechnologies.buildDetailRequestPayload('18687'), DETAIL_REQUEST_PAYLOAD)
  assert.deepEqual(
    sifyTechnologies.decryptTalliteEnvelope(sifyTechnologies.encryptTallitePayload(LIST_REQUEST_PAYLOAD)),
    LIST_REQUEST_PAYLOAD,
  )
})

test('Sify Technologies normalizes Tallite listing payloads into first-party public job summaries', async () => {
  const sifyTechnologies = await loadScriptModule()
  const jobs = sifyTechnologies.extractCareerListings(LIST_RESPONSE_PAYLOAD)

  assert.deepEqual(jobs, [{
    title: 'Assistant Manager-Network Projects',
    company: 'Sify Technologies',
    department: 'Network Managed Services',
    location: 'Mumbai',
    city: 'Mumbai',
    country: 'India',
    jobId: '18687',
    requisitionId: 'SIFY/6778/2026',
    sourceUrl: 'https://sifycareer.tallite.com/job/18687?name=Assistant%20Manager-Network%20Projects',
    applyUrl: 'https://sifycareer.tallite.com/job/18687?name=Assistant%20Manager-Network%20Projects',
    employmentType: null,
    experienceRequired: '6 - 15 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Firewall',
      'Firewall - Checkpoint',
      'Firewall - Cisco ASA',
      'Firewall - Cisco FMC & FTD 4245',
      'Firewall / VPN tunnel',
      'IPS (TippingPoint)',
      'IPS policy',
      'Network Security',
      'IPS',
    ],
    postingDate: '2026-07-14',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  }])
})

test('Sify Technologies enriches Tallite detail payloads into India-only jobs', async () => {
  const sifyTechnologies = await loadScriptModule()
  const listing = sifyTechnologies.extractCareerListings(LIST_RESPONSE_PAYLOAD)[0]
  const detail = sifyTechnologies.extractJobDetail(DETAIL_RESPONSE_PAYLOAD, listing)

  assert.equal(detail.title, 'Assistant Manager-Network Projects')
  assert.equal(detail.company, 'Sify Technologies')
  assert.equal(detail.department, 'Network Managed Services (NEMS)')
  assert.equal(detail.location, 'Navi mumbai, Maharashtra, India')
  assert.equal(detail.city, 'Navi mumbai')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '18687')
  assert.equal(detail.requisitionId, 'SIFY/6778/2026')
  assert.equal(
    detail.applyUrl,
    'https://sifycareer.tallite.com/job/18687?name=Assistant%20Manager-Network%20Projects',
  )
  assert.equal(detail.employmentType, null)
  assert.equal(detail.experienceRequired, '6 - 15 years')
  assert.match(detail.minimumQualification, /B\.E \/ B\. Tech\/ MCA\/ BCA\/ BSc\(IT\)\/ MSc\(IT\)/)
  assert.match(detail.minimumQualification, /Certification - CCNP Security/i)
  assert.equal(detail.preferredQualification, null)
  assert.ok(detail.requiredSkills.includes('Firewall - Checkpoint'))
  assert.ok(detail.requiredSkills.includes('Network Security'))
  assert.equal(detail.postingDate, '2026-07-14')
  assert.equal(detail.closingDate, null)
  assert.match(detail.jobDescription, /Business Requirements Document \(BRD\)/i)
  assert.match(detail.jobDescription, /Configure and manage Firewalls & IPS across the network/i)
})

test('Sify Technologies run verifies the official first-party careers handoff before calling the public encrypted APIs', async () => {
  const sifyTechnologies = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonCalls = []

  const jobs = await sifyTechnologies.createSifyTechnologiesScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-26T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === sifyTechnologies.ABOUT_URL) return ABOUT_HTML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJsonCalls.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      if (url === sifyTechnologies.LIST_API_URL) {
        return {
          status: true,
          message: 'Data loaded successfully',
          data: sifyTechnologies.encryptTallitePayload(LIST_RESPONSE_PAYLOAD).data,
          error: null,
        }
      }

      if (url === sifyTechnologies.DETAIL_API_URL) {
        return {
          status: true,
          message: 'Data loaded successfully',
          data: sifyTechnologies.encryptTallitePayload(DETAIL_RESPONSE_PAYLOAD).data,
          error: null,
        }
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [sifyTechnologies.ABOUT_URL])
  assert.equal(requestedJsonCalls.length, 2)
  assert.equal(requestedJsonCalls[0].url, sifyTechnologies.LIST_API_URL)
  assert.equal(requestedJsonCalls[0].method, 'POST')
  assert.deepEqual(
    sifyTechnologies.decryptTalliteEnvelope(requestedJsonCalls[0].body),
    LIST_REQUEST_PAYLOAD,
  )
  assert.equal(requestedJsonCalls[1].url, sifyTechnologies.DETAIL_API_URL)
  assert.equal(requestedJsonCalls[1].method, 'POST')
  assert.deepEqual(
    sifyTechnologies.decryptTalliteEnvelope(requestedJsonCalls[1].body),
    DETAIL_REQUEST_PAYLOAD,
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sifytechnologies')
  assert.equal(jobs[0].company, 'Sify Technologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-26T00:00:00.000Z')
})

test('Sify Technologies fails closed when the verified about page or encrypted Tallite payload contract drifts', async () => {
  const sifyTechnologies = await loadScriptModule()

  await assert.rejects(
    sifyTechnologies.createSifyTechnologiesScraper({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ({ status: true, data: sifyTechnologies.encryptTallitePayload(LIST_RESPONSE_PAYLOAD).data }),
    }).run(),
    /verified official Sify about page/i,
  )

  await assert.rejects(
    sifyTechnologies.createSifyTechnologiesScraper({
      fetchText: async () => ABOUT_HTML,
      fetchJson: async (url) => {
        if (url === sifyTechnologies.LIST_API_URL) {
          return { status: true, data: sifyTechnologies.encryptTallitePayload({ count: 34, limit: '10', list: [] }).data }
        }

        return { status: true, data: sifyTechnologies.encryptTallitePayload(DETAIL_RESPONSE_PAYLOAD).data }
      },
    }).run(),
    /public Tallite job list payload/i,
  )
})
