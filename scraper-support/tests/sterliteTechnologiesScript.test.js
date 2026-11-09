import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HANDOFF_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join STL Tech | Life at STL Tech | Careers</title>
  </head>
  <body>
    <h1>We are STLers</h1>
    <h2>WORLD OF OPPORTUNITIES</h2>
    <h2>Join us</h2>
    <p>85% of our employees feel that STL is a great place to be.</p>
    <a href="https://stltech.ripplehire.com/candidate/?source=CAREERSITE&amp;token=v0cOTxD3fgZqIF393gqj#list">
      Apply for your next job here
    </a>
    <footer>&copy; 2026-27 STL Tech All Rights Reserved.</footer>
  </body>
</html>
`

const RIPPLEHIRE_BOARD_HTML = `
<!doctype html>
<html>
  <head>
    <title>STL and STL Digital Careers | Latest jobs at STL and STL Digital - Ripplehire.com</title>
    <meta name="description" content="STL and STL Digital latest job openings at Mumbai, Bangalore, London, Chicago, Gurgaon">
    <script>var googleJobPosting = false;</script>
  </head>
  <body>
    <input type="hidden" id="token" value="v0cOTxD3fgZqIF393gqj"/>
    <input type="hidden" id="source" value="CAREERSITE"/>
  </body>
</html>
`

const SEARCH_RESULTS_XML = `
<JobPageVO>
  <startJobIndex>0</startJobIndex>
  <maxJobSize>10</maxJobSize>
  <totalJobCount>104</totalJobCount>
  <jobVoList>
    <jobVoList>
      <jobSeq>888717</jobSeq>
      <jobTitle>Engineering Manager</jobTitle>
      <jobLocation>Ahmedabad</jobLocation>
      <jobReqExp>10+ Years</jobReqExp>
      <locations>Ahmedabad</locations>
      <jobCode>IND/01/SDTL//19244</jobCode>
      <jobId>888717</jobId>
    </jobVoList>
    <jobVoList>
      <jobSeq>463281</jobSeq>
      <jobTitle>Senior Executive</jobTitle>
      <jobLocation></jobLocation>
      <jobReqExp>3 - 6 Years</jobReqExp>
      <locations>Nizamabad</locations>
      <jobCode>5725</jobCode>
      <jobId>463281</jobId>
    </jobVoList>
    <jobVoList>
      <jobSeq>999001</jobSeq>
      <jobTitle>Principal Architect</jobTitle>
      <jobLocation>Chicago</jobLocation>
      <jobReqExp>10 - 12 Years</jobReqExp>
      <locations>Chicago</locations>
      <jobCode>USA/01/ARCH/1</jobCode>
      <jobId>999001</jobId>
    </jobVoList>
    <jobVoList>
      <jobSeq>873668</jobSeq>
      <jobTitle>Sr Tech Lead</jobTitle>
      <jobLocation>Bhubaneswar</jobLocation>
      <jobReqExp>8 - 12 Years</jobReqExp>
      <locations>Bhubaneswar, Jharsuguda</locations>
      <jobCode>IND/17/SDTL/NR/12189</jobCode>
      <jobId>873668</jobId>
    </jobVoList>
  </jobVoList>
</JobPageVO>
`

const ENGINEERING_MANAGER_DETAIL_XML = `
<CandidateJobVO>
  <jobVO>
    <jobSeq>888717</jobSeq>
    <jobId>888717</jobId>
    <jobTitle>Engineering Manager</jobTitle>
    <jobLocation>Ahmedabad</jobLocation>
    <locations>Ahmedabad</locations>
    <bussinessUnit>STL Digital</bussinessUnit>
    <jobReqExp>10+ Years</jobReqExp>
    <jobType>R</jobType>
    <jobTypeCustom3>Permanent</jobTypeCustom3>
    <jobPostingDate>29-Jun-2026</jobPostingDate>
    <jobDesc><![CDATA[
      <p><strong>Who We Are</strong> at <strong>STL Digital</strong>.</p>
      <p><strong>Required Qualifications</strong></p>
      <ul>
        <li>Strong C++ development experience.</li>
        <li>Deep protocol understanding of SIP and RTP/RTCP.</li>
      </ul>
      <p>1. Clear communication skills.</p>
      <p>2. Linux and networking fundamentals.</p>
    ]]></jobDesc>
    <publishDetails>
      <CAREER_SITE>2026-07-16T10:19:38Z</CAREER_SITE>
    </publishDetails>
  </jobVO>
</CandidateJobVO>
`

const SENIOR_EXECUTIVE_DETAIL_XML = `
<CandidateJobVO>
  <jobVO>
    <jobSeq>463281</jobSeq>
    <jobId>463281</jobId>
    <jobTitle>Senior Executive</jobTitle>
    <jobLocation>Nizamabad</jobLocation>
    <locations>Nizamabad</locations>
    <bussinessUnit>Network Services</bussinessUnit>
    <jobReqExp>3 - 6 Years</jobReqExp>
    <jobType>R</jobType>
    <jobTypeCustom3></jobTypeCustom3>
    <jobPostingDate>13-Feb-2023</jobPostingDate>
    <jobDesc><![CDATA[
      <p>Support access network field operations.</p>
      <ul>
        <li>Field maintenance</li>
        <li>Stakeholder coordination</li>
      </ul>
    ]]></jobDesc>
  </jobVO>
</CandidateJobVO>
`

const SR_TECH_LEAD_DETAIL_XML = `
<CandidateJobVO>
  <jobVO>
    <jobSeq>873668</jobSeq>
    <jobId>873668</jobId>
    <jobTitle>Sr Tech Lead</jobTitle>
    <jobLocation>Bhubaneswar</jobLocation>
    <locations>Bhubaneswar, Jharsuguda</locations>
    <bussinessUnit>STL Digital</bussinessUnit>
    <jobReqExp>8 - 12 Years</jobReqExp>
    <jobType>R</jobType>
    <jobTypeCustom3>Probationer</jobTypeCustom3>
    <jobPostingDate>15-May-2026</jobPostingDate>
    <jobDesc><![CDATA[
      <p>Lead delivery for telecom integration programs.</p>
      <ul>
        <li>Program leadership</li>
        <li>Telecom delivery</li>
      </ul>
    ]]></jobDesc>
  </jobVO>
</CandidateJobVO>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sterlitetechnologies/script.js')
  } catch {
    assert.fail('Expected Sterlite Technologies scraper module at ../../scraper/sterlitetechnologies/script.js')
  }
}

test('Sterlite Technologies helpers stay pinned to the verified STL careers handoff plus live public RippleHire board contract', async () => {
  const sterliteTechnologies = await loadModule()

  assert.equal(sterliteTechnologies.SOURCE, 'sterlitetechnologies')
  assert.equal(sterliteTechnologies.COMPANY_NAME, 'Sterlite Technologies')
  assert.equal(sterliteTechnologies.OFFICIAL_BRAND_NAME, 'STL Tech')
  assert.equal(sterliteTechnologies.VERIFIED_ON, '2026-08-05')
  assert.equal(sterliteTechnologies.CAREERS_URL, 'https://stl.tech/life/')
  assert.equal(
    sterliteTechnologies.LINKED_JOBS_PORTAL_URL,
    'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#list',
  )
  assert.equal(
    sterliteTechnologies.JOB_BOARD_URL,
    'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE',
  )
  assert.equal(
    sterliteTechnologies.JOBS_API_URL,
    'https://stltech.ripplehire.com/candidate/candidatejobsearch',
  )
  assert.equal(sterliteTechnologies.LINKED_JOBS_PORTAL_HOST, 'stltech.ripplehire.com')
  assert.equal(sterliteTechnologies.PORTAL_ORIGIN, 'https://stltech.ripplehire.com')
  assert.equal(sterliteTechnologies.TOKEN, 'v0cOTxD3fgZqIF393gqj')
  assert.equal(sterliteTechnologies.PORTAL_SOURCE, 'CAREERSITE')
  assert.equal(sterliteTechnologies.hasOfficialCareersSignal(CAREERS_HANDOFF_HTML), true)
  assert.equal(
    sterliteTechnologies.hasOfficialCareersSignal('<html><body><h1>Join us</h1></body></html>'),
    false,
  )
  assert.equal(sterliteTechnologies.hasEnumerablePublicJobsSignal(CAREERS_HANDOFF_HTML), false)
  assert.equal(sterliteTechnologies.hasEnumerablePublicJobsSignal(RIPPLEHIRE_BOARD_HTML), true)
  assert.equal(sterliteTechnologies.hasRippleHireSearchResultsSignal(SEARCH_RESULTS_XML), true)
  assert.equal(sterliteTechnologies.hasRippleHireSearchResultsSignal('<html>not xml</html>'), false)
})

test('isIndiaListing keeps STL India roles, including the live Nizamabad legacy requisition, and excludes foreign locations', async () => {
  const sterliteTechnologies = await loadModule()

  assert.equal(
    sterliteTechnologies.isIndiaListing({
      jobCode: 'IND/01/SDTL//19244',
      jobLocation: 'Ahmedabad',
      locations: 'Ahmedabad',
    }),
    true,
  )
  assert.equal(
    sterliteTechnologies.isIndiaListing({
      jobCode: '5725',
      jobLocation: '',
      locations: 'Nizamabad',
    }),
    true,
  )
  assert.equal(
    sterliteTechnologies.isIndiaListing({
      jobCode: 'USA/01/ARCH/1',
      jobLocation: 'Chicago',
      locations: 'Chicago',
    }),
    false,
  )
})

test('extractSearchResults parses Sterlite RippleHire XML and filters listings to India roles', async () => {
  const sterliteTechnologies = await loadModule()

  const jobs = sterliteTechnologies.extractSearchResults(SEARCH_RESULTS_XML)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Engineering Manager',
    location: 'Ahmedabad, India',
    city: 'Ahmedabad',
    jobId: '888717',
    requisitionId: '888717',
    sourceUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#detail/job/888717',
    applyUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#apply/job/888717',
    experienceRequired: '10+ Years',
    postingDate: null,
    department: null,
    jobCode: 'IND/01/SDTL//19244',
  })
  assert.deepEqual(jobs[1], {
    title: 'Senior Executive',
    location: 'Nizamabad, India',
    city: 'Nizamabad',
    jobId: '463281',
    requisitionId: '463281',
    sourceUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#detail/job/463281',
    applyUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#apply/job/463281',
    experienceRequired: '3 - 6 Years',
    postingDate: null,
    department: null,
    jobCode: '5725',
  })
  assert.deepEqual(jobs[2], {
    title: 'Sr Tech Lead',
    location: 'Bhubaneswar, Jharsuguda, India',
    city: 'Bhubaneswar, Jharsuguda',
    jobId: '873668',
    requisitionId: '873668',
    sourceUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#detail/job/873668',
    applyUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#apply/job/873668',
    experienceRequired: '8 - 12 Years',
    postingDate: null,
    department: null,
    jobCode: 'IND/17/SDTL/NR/12189',
  })
})

test('extractSearchSummary reads total counts and page offsets from Sterlite RippleHire XML', async () => {
  const sterliteTechnologies = await loadModule()

  assert.deepEqual(sterliteTechnologies.extractSearchSummary(SEARCH_RESULTS_XML), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 104,
  })
})

test('extractJobDetail pulls Sterlite description, posting date, department, skills, and apply URLs from the detail XML', async () => {
  const sterliteTechnologies = await loadModule()

  const detail = sterliteTechnologies.extractJobDetail(ENGINEERING_MANAGER_DETAIL_XML, {
    title: 'Engineering Manager',
    location: 'Ahmedabad, India',
    city: 'Ahmedabad',
    jobId: '888717',
    requisitionId: '888717',
    sourceUrl: sterliteTechnologies.buildDetailUrl('888717'),
    applyUrl: sterliteTechnologies.buildApplyUrl('888717'),
    experienceRequired: '10+ Years',
  })

  assert.equal(detail.title, 'Engineering Manager')
  assert.equal(detail.location, 'Ahmedabad, India')
  assert.equal(detail.city, 'Ahmedabad')
  assert.equal(detail.jobId, '888717')
  assert.equal(detail.requisitionId, '888717')
  assert.equal(detail.department, 'STL Digital')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '10+ Years')
  assert.match(detail.jobDescription, /Who We Are/i)
  assert.deepEqual(detail.requiredSkills, [
    'Strong C++ development experience.',
    'Deep protocol understanding of SIP and RTP/RTCP.',
    'Clear communication skills.',
    'Linux and networking fundamentals.',
  ])
  assert.equal(detail.postingDate, '2026-07-16T10:19:38Z')
  assert.equal(detail.applyUrl, sterliteTechnologies.buildApplyUrl('888717'))
  assert.equal(detail.sourceUrl, sterliteTechnologies.buildDetailUrl('888717'))
  assert.equal(detail.publicExperienceChecked, true)
})

test('run verifies the STL careers handoff, fetches the RippleHire listings and details, and decorates shared job fields', async () => {
  const sterliteTechnologies = await loadModule()
  const requested = []
  const scraper = sterliteTechnologies.createSterliteTechnologiesScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === sterliteTechnologies.CAREERS_URL) {
        return CAREERS_HANDOFF_HTML
      }

      if (url === sterliteTechnologies.JOBS_API_URL) {
        return SEARCH_RESULTS_XML
      }

      if (url.includes('jobSeq=888717')) {
        return ENGINEERING_MANAGER_DETAIL_XML
      }

      if (url.includes('jobSeq=463281')) {
        return SENIOR_EXECUTIVE_DETAIL_XML
      }

      if (url.includes('jobSeq=873668')) {
        return SR_TECH_LEAD_DETAIL_XML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.method), ['GET', 'POST', 'GET', 'GET', 'GET'])
  assert.match(requested[1].body, /v0cOTxD3fgZqIF393gqj/)
  assert.match(requested[1].body, /CAREERSITE/)
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Sterlite Technologies')
  assert.equal(jobs[0].source, 'sterlitetechnologies')
  assert.equal(
    jobs[0].link,
    'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#apply/job/888717',
  )
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[2].employmentType, 'Full-time')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[2].publicExperienceChecked, true)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run accepts the current stl.tech timeout when the linked RippleHire board and APIs still validate', async () => {
  const sterliteTechnologies = await loadModule()
  const requested = []
  const scraper = sterliteTechnologies.createSterliteTechnologiesScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === sterliteTechnologies.CAREERS_URL) {
        const error = new TypeError('fetch failed')
        error.cause = new Error('Connect Timeout Error (attempted address: stl.tech:443, timeout: 10000ms)')
        throw error
      }

      if (url === sterliteTechnologies.LINKED_JOBS_PORTAL_URL) {
        return RIPPLEHIRE_BOARD_HTML
      }

      if (url === sterliteTechnologies.JOBS_API_URL) {
        return SEARCH_RESULTS_XML
      }

      if (url.includes('jobSeq=888717')) {
        return ENGINEERING_MANAGER_DETAIL_XML
      }

      if (url.includes('jobSeq=463281')) {
        return SENIOR_EXECUTIVE_DETAIL_XML
      }

      if (url.includes('jobSeq=873668')) {
        return SR_TECH_LEAD_DETAIL_XML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.url), [
    sterliteTechnologies.CAREERS_URL,
    sterliteTechnologies.LINKED_JOBS_PORTAL_URL,
    sterliteTechnologies.JOBS_API_URL,
    `${sterliteTechnologies.PORTAL_ORIGIN}${sterliteTechnologies.DETAIL_PATH}?token=${sterliteTechnologies.TOKEN}&source=${sterliteTechnologies.PORTAL_SOURCE}&lang=en&jobSeq=888717`,
    `${sterliteTechnologies.PORTAL_ORIGIN}${sterliteTechnologies.DETAIL_PATH}?token=${sterliteTechnologies.TOKEN}&source=${sterliteTechnologies.PORTAL_SOURCE}&lang=en&jobSeq=463281`,
    `${sterliteTechnologies.PORTAL_ORIGIN}${sterliteTechnologies.DETAIL_PATH}?token=${sterliteTechnologies.TOKEN}&source=${sterliteTechnologies.PORTAL_SOURCE}&lang=en&jobSeq=873668`,
  ])
  assert.equal(jobs.length, 3)
})
