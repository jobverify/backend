import assert from 'node:assert/strict'
import test from 'node:test'

const loadCitiusTechModule = async () => {
  try {
    return await import('../../scraper/citiustech/script.js')
  } catch {
    assert.fail('Expected CitiusTech scraper module at ../../scraper/citiustech/script.js')
  }
}

const SEARCH_RESULTS_PAYLOAD = {
  startJobIndex: 0,
  maxJobSize: 10,
  totalJobCount: 68,
  jobVoList: [
    {
      jobSeq: '891631',
      jobTitle: 'Lead Engineer - I_Security Operations Center',
      jobLocation: null,
      jobReqExp: '5 - 7 Years',
      jobPostingDate: null,
      locations: 'CT Pune (E) - EON',
      jobId: '891631',
      bussinessUnit: null,
    },
    {
      jobSeq: '891147',
      jobTitle: 'Technical Specialist_Immigration and Travel',
      jobLocation: '',
      jobReqExp: '10 - 15 Years',
      jobPostingDate: null,
      locations: 'New Jersey',
      jobId: '891147',
      bussinessUnit: null,
    },
    {
      jobSeq: '888644',
      jobTitle: 'Technical Lead - II_ETL',
      jobLocation: null,
      jobReqExp: '7 - 10 Years',
      jobPostingDate: null,
      locations: 'CT Pune Qubix SEZ1',
      jobId: '888644',
      bussinessUnit: null,
    },
  ],
}

const JOB_DETAIL_PAYLOAD = {
  companyVO: {
    companyName: 'CitiusTech',
  },
  jobVO: {
    jobSeq: '891631',
    jobId: '891631',
    jobTitle: 'Lead Engineer - I_Security Operations Center',
    jobDesc: `
      <p><strong>Who we are</strong></p>
      <p>CitiusTech is a global IT services, consulting, and business solutions enterprise 100% focused on the healthcare and life sciences industry.</p>
      <p><strong>Responsibilities: -</strong></p>
      <ul>
        <li>Monitor and analyze security alerts using next-gen SIEM platforms.</li>
        <li>Execute initial incident response actions (containment, enrichment, documentation).</li>
      </ul>
      <p><strong>Experience: -</strong></p>
      <ul>
        <li>5 - 7 Years</li>
      </ul>
      <p><strong>Location: -</strong></p>
      <ul>
        <li>Pune</li>
        <li>Mumbai</li>
        <li>Chennai</li>
      </ul>
      <p><strong>Educational Qualifications: -</strong></p>
      <ul>
        <li>Engineering Degree - BE/ME/BTech/MTech/BSc/MSc.</li>
        <li>Technical certification in multiple technologies is desirable.</li>
      </ul>
      <p><strong>Skills: -</strong></p>
      <p><strong>Mandatory Technical Skills: -</strong></p>
      <ul>
        <li>Security Operations Center (SOC)</li>
      </ul>
      <p><strong>Good to Have Skills: -</strong></p>
      <ul>
        <li>Google Chronicle/SecOps/CrowdStrike</li>
      </ul>
    `,
    jobLocation: 'CT Pune (E) - EON',
    jobReqExp: '5 - 7 Years',
    jobType: 'R',
    jobPostingDate: '08-Jul-2026',
    locations: 'CT Pune (E) - EON',
    bussinessUnit: null,
    jobTypeCustom3: 'Employee',
    jobSkills: '',
    publishDetails: {
      CAREER_SITE: '2026-07-10T12:49:00Z',
    },
  },
}

test('buildSearchRequestPayload keeps CitiusTech listings on the verified public RippleHire board contract', async () => {
  const citiusTech = await loadCitiusTechModule()

  assert.deepEqual(citiusTech.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    token: 'bCKlfz3OO8vQIgiM2vuI',
    source: 'CAREERSITE',
    pagesize: 10,
  })

  assert.deepEqual(citiusTech.buildSearchRequestPayload(3), {
    page: 3,
    search: '*:*',
    token: 'bCKlfz3OO8vQIgiM2vuI',
    source: 'CAREERSITE',
    pagesize: 10,
  })
})

test('isIndiaListing keeps CitiusTech India roles and excludes foreign locations from the public board', async () => {
  const citiusTech = await loadCitiusTechModule()

  assert.equal(citiusTech.isIndiaListing({ location: 'CT Pune (E) - EON' }), true)
  assert.equal(citiusTech.isIndiaListing({ location: 'CT Pune Qubix SEZ1' }), true)
  assert.equal(citiusTech.isIndiaListing({ location: 'New Jersey' }), false)
  assert.equal(citiusTech.isIndiaListing({ location: 'Remote (USA)' }), false)
})

test('extractSearchResults parses CitiusTech RippleHire JSON and filters listings to India roles', async () => {
  const citiusTech = await loadCitiusTechModule()
  const jobs = citiusTech.extractSearchResults(SEARCH_RESULTS_PAYLOAD)

  assert.deepEqual(jobs, [
    {
      title: 'Lead Engineer - I_Security Operations Center',
      location: 'Pune, India',
      city: 'Pune',
      jobId: '891631',
      requisitionId: '891631',
      sourceUrl: 'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#detail/job/891631',
      applyUrl: 'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#apply/job/891631',
      experienceRequired: '5 - 7 Years',
      postingDate: null,
      department: null,
    },
    {
      title: 'Technical Lead - II_ETL',
      location: 'Pune, India',
      city: 'Pune',
      jobId: '888644',
      requisitionId: '888644',
      sourceUrl: 'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#detail/job/888644',
      applyUrl: 'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#apply/job/888644',
      experienceRequired: '7 - 10 Years',
      postingDate: null,
      department: null,
    },
  ])
})

test('extractSearchSummary reads total counts and page offsets from CitiusTech RippleHire JSON', async () => {
  const citiusTech = await loadCitiusTechModule()

  assert.deepEqual(citiusTech.extractSearchSummary(SEARCH_RESULTS_PAYLOAD), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 68,
  })
})

test('extractJobDetail pulls CitiusTech description, qualifications, skills, and apply URLs from the detail payload', async () => {
  const citiusTech = await loadCitiusTechModule()
  const detail = citiusTech.extractJobDetail(JOB_DETAIL_PAYLOAD, {
    title: 'Lead Engineer - I_Security Operations Center',
    location: 'Pune, India',
    city: 'Pune',
    jobId: '891631',
    requisitionId: '891631',
    sourceUrl: citiusTech.buildDetailUrl('891631'),
    applyUrl: citiusTech.buildApplyUrl('891631'),
    experienceRequired: '5 - 7 Years',
  })

  assert.equal(detail.title, 'Lead Engineer - I_Security Operations Center')
  assert.equal(detail.location, 'Pune, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.jobId, '891631')
  assert.equal(detail.requisitionId, '891631')
  assert.equal(detail.department, null)
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5 - 7 Years')
  assert.match(detail.jobDescription, /CitiusTech is a global IT services/i)
  assert.match(detail.jobDescription, /incident response actions/i)
  assert.equal(detail.minimumQualification, 'Engineering Degree - BE/ME/BTech/MTech/BSc/MSc.')
  assert.equal(detail.preferredQualification, 'Technical certification in multiple technologies is desirable.')
  assert.deepEqual(detail.requiredSkills, [
    'Security Operations Center (SOC)',
    'Google Chronicle/SecOps/CrowdStrike',
  ])
  assert.equal(detail.postingDate, '2026-07-10T12:49:00Z')
  assert.equal(detail.applyUrl, citiusTech.buildApplyUrl('891631'))
  assert.equal(detail.sourceUrl, citiusTech.buildDetailUrl('891631'))
})

test('run fetches the CitiusTech RippleHire listing and detail payloads, then decorates shared runner fields', async () => {
  const citiusTech = await loadCitiusTechModule()
  const requested = []

  const jobs = await citiusTech.createCitiusTechScraper().run({
    maxPages: 1,
    fetchJson: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === 'https://citiustech.ripplehire.com/candidate/candidatejobsearch') {
        return SEARCH_RESULTS_PAYLOAD
      }

      if (url.includes('jobSeq=891631')) {
        return JOB_DETAIL_PAYLOAD
      }

      if (url.includes('jobSeq=888644')) {
        return {
          ...JOB_DETAIL_PAYLOAD,
          jobSeq: '888644',
          jobVO: {
            ...JOB_DETAIL_PAYLOAD.jobVO,
            jobSeq: '888644',
            jobId: '888644',
            jobTitle: 'Technical Lead - II_ETL',
            jobLocation: 'CT Pune Qubix SEZ1',
            locations: 'CT Pune Qubix SEZ1',
            jobReqExp: '7 - 10 Years',
            jobPostingDate: '06-Jul-2026',
            publishDetails: {
              CAREER_SITE: '2026-07-06T08:15:00Z',
            },
          },
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.method), ['POST', 'GET', 'GET'])
  assert.match(requested[0].body, /bCKlfz3OO8vQIgiM2vuI/)
  assert.match(requested[0].body, /CAREERSITE/)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'CitiusTech')
  assert.equal(jobs[0].source, 'citiustech')
  assert.equal(
    jobs[0].link,
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#apply/job/891631',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
