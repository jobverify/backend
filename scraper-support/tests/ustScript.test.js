import assert from 'node:assert/strict'
import test from 'node:test'

const loadUstModule = async () => {
  try {
    return await import('../../scraper/ust/script.js')
  } catch {
    return null
  }
}

const SEARCH_RESULTS_XML = `
<JobPageVO>
  <startJobIndex>0</startJobIndex>
  <maxJobSize>10</maxJobSize>
  <totalJobCount>2</totalJobCount>
  <jobVoList>
    <jobVoList>
      <jobSeq>910101</jobSeq>
      <jobTitle>Lead Engineer - Platform</jobTitle>
      <jobLocation>India</jobLocation>
      <locations>Bangalore</locations>
      <jobId>910101</jobId>
      <jobReqExp>5 - 8 Years</jobReqExp>
      <jobPostingDate>09-Jul-2026</jobPostingDate>
    </jobVoList>
    <jobVoList>
      <jobSeq>910202</jobSeq>
      <jobTitle>Principal Architect</jobTitle>
      <jobLocation>United States</jobLocation>
      <locations>Austin</locations>
      <jobId>910202</jobId>
      <jobReqExp>10 - 12 Years</jobReqExp>
      <jobPostingDate>08-Jul-2026</jobPostingDate>
    </jobVoList>
  </jobVoList>
</JobPageVO>
`

const JOB_DETAIL_XML = `
<CandidateJobVO>
  <jobVO>
    <jobSeq>910101</jobSeq>
    <jobId>910101</jobId>
    <jobTitle>Lead Engineer - Platform</jobTitle>
    <jobLocation>India</jobLocation>
    <locations>Bangalore</locations>
    <bussinessUnit>Digital</bussinessUnit>
    <jobReqExp>5 - 8 Years</jobReqExp>
    <jobTypeCustom3>Regular Full Time</jobTypeCustom3>
    <jobDesc><![CDATA[
      <p>Build modern platform services for enterprise engineering teams.</p>
      <ul>
        <li>Java</li>
        <li>Microservices</li>
        <li>AWS</li>
      </ul>
    ]]></jobDesc>
    <publishDetails>
      <CAREER_SITE>2026-07-09T06:30:00Z</CAREER_SITE>
    </publishDetails>
  </jobVO>
</CandidateJobVO>
`

test('buildSearchRequestPayload keeps UST listings on the verified public RippleHire board contract', async () => {
  const ust = await loadUstModule()
  assert.ok(ust)

  assert.deepEqual(ust.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    token: 'JMZpEHjy6CQQe5dcidgp',
    pagesize: 10,
  })

  assert.deepEqual(ust.buildSearchRequestPayload(3), {
    page: 3,
    search: '*:*',
    token: 'JMZpEHjy6CQQe5dcidgp',
    pagesize: 10,
  })
})

test('isIndiaListing keeps UST India roles and excludes foreign locations', async () => {
  const ust = await loadUstModule()
  assert.ok(ust)

  assert.equal(ust.isIndiaListing({ countryCode: 'India', city: 'Bangalore' }), true)
  assert.equal(ust.isIndiaListing({ countryCode: '', city: 'Pune' }), true)
  assert.equal(ust.isIndiaListing({ countryCode: 'United States', city: 'Austin' }), false)
})

test('extractSearchResults parses UST RippleHire XML and filters listings to India roles', async () => {
  const ust = await loadUstModule()
  assert.ok(ust)

  const jobs = ust.extractSearchResults(SEARCH_RESULTS_XML)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Lead Engineer - Platform',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '910101',
    requisitionId: '910101',
    sourceUrl: 'https://usource.ripplehire.com/candidate/?token=JMZpEHjy6CQQe5dcidgp&lang=en#/detail/job/910101',
    applyUrl: 'https://usource.ripplehire.com/candidate/?token=JMZpEHjy6CQQe5dcidgp&lang=en#/apply/job/910101',
    experienceRequired: '5 - 8 Years',
    postingDate: '09-Jul-2026',
    department: null,
  })
})

test('extractSearchSummary reads total counts and page offsets from UST RippleHire XML', async () => {
  const ust = await loadUstModule()
  assert.ok(ust)

  assert.deepEqual(ust.extractSearchSummary(SEARCH_RESULTS_XML), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 2,
  })
})

test('extractJobDetail pulls UST description, posting date, skills, and apply URLs from the detail XML', async () => {
  const ust = await loadUstModule()
  assert.ok(ust)

  const detail = ust.extractJobDetail(JOB_DETAIL_XML, {
    title: 'Lead Engineer - Platform',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '910101',
    requisitionId: '910101',
    sourceUrl: ust.buildDetailUrl('910101'),
    applyUrl: ust.buildApplyUrl('910101'),
    experienceRequired: '5 - 8 Years',
  })

  assert.equal(detail.title, 'Lead Engineer - Platform')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '910101')
  assert.equal(detail.requisitionId, '910101')
  assert.equal(detail.department, 'Digital')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5 - 8 Years')
  assert.match(detail.jobDescription, /platform services/i)
  assert.deepEqual(detail.requiredSkills, ['Java', 'Microservices', 'AWS'])
  assert.equal(detail.postingDate, '2026-07-09T06:30:00Z')
  assert.equal(detail.applyUrl, ust.buildApplyUrl('910101'))
  assert.equal(detail.sourceUrl, ust.buildDetailUrl('910101'))
})

test('run fetches the UST RippleHire listing and detail payloads, then decorates shared runner fields', async () => {
  const ust = await loadUstModule()
  assert.ok(ust)

  const requested = []
  const scraper = ust.createUstScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === 'https://usource.ripplehire.com/candidate/candidatejobsearch') {
        return SEARCH_RESULTS_XML
      }

      if (url.includes('jobSeq=910101')) {
        return JOB_DETAIL_XML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.method), ['POST', 'GET'])
  assert.match(requested[0].body, /JMZpEHjy6CQQe5dcidgp/)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'UST')
  assert.equal(jobs[0].source, 'ust')
  assert.equal(
    jobs[0].link,
    'https://usource.ripplehire.com/candidate/?token=JMZpEHjy6CQQe5dcidgp&lang=en#/apply/job/910101',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
