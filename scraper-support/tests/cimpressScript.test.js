import assert from 'node:assert/strict'
import test from 'node:test'

const loadCimpressModule = async () => {
  try {
    return await import('../../scraper/cimpress/script.js')
  } catch {
    return null
  }
}

const searchResultsXml = `
  <JobPageVO>
    <startJobIndex>0</startJobIndex>
    <maxJobSize>10</maxJobSize>
    <totalJobCount>15</totalJobCount>
    <jobVoList>
      <jobVoList>
        <jobSeq>887333</jobSeq>
        <jobTitle>Senior Network Engineer</jobTitle>
        <jobLocation></jobLocation>
        <jobReqExp>7 - 10 Years</jobReqExp>
        <jobPostingDate>01-Jul-2026</jobPostingDate>
        <locations>Remote</locations>
        <jobId>887333</jobId>
      </jobVoList>
      <jobVoList>
        <jobSeq>865040</jobSeq>
        <jobTitle>Technical Support Engineer</jobTitle>
        <jobLocation>India</jobLocation>
        <jobReqExp>2 - 4 Years</jobReqExp>
        <jobPostingDate>20-Jun-2026</jobPostingDate>
        <locations>Mumbai</locations>
        <jobId>865040</jobId>
      </jobVoList>
      <jobVoList>
        <jobSeq>777777</jobSeq>
        <jobTitle>Regional Manager</jobTitle>
        <jobLocation>United States</jobLocation>
        <jobReqExp>8 - 10 Years</jobReqExp>
        <jobPostingDate>18-Jun-2026</jobPostingDate>
        <locations>Austin</locations>
        <jobId>777777</jobId>
      </jobVoList>
    </jobVoList>
  </JobPageVO>
`

const detailXml = `
  <CandidateJobVO>
    <jobVO>
      <jobSeq>887333</jobSeq>
      <jobTitle>Senior Network Engineer</jobTitle>
      <jobDesc>&lt;p>Build and support cloud and infrastructure networking across Cimpress businesses.&lt;/p></jobDesc>
      <locations>Remote</locations>
      <jobReqExp>7 - 10 Years</jobReqExp>
      <jobPostingDate>01-Jul-2026</jobPostingDate>
      <jobTypeCustom3>Regular Full Time</jobTypeCustom3>
      <jobSkills>&lt;p>Networking&lt;br>Cloud Infrastructure&lt;/p></jobSkills>
      <bussinessUnit>Technology</bussinessUnit>
      <jobId>887333</jobId>
    </jobVO>
  </CandidateJobVO>
`

test('buildSearchRequestPayload keeps Cimpress listings on the official RippleHire tokenized endpoint contract', async () => {
  const cimpress = await loadCimpressModule()
  assert.ok(cimpress)

  assert.deepEqual(cimpress.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    campaignSeq: '',
    token: '8CyS9IjVDwzIu21jeaJ3',
    source: 'DIRECTCHANNEL',
    pagesize: 10,
  })
})

test('extractSearchResults parses Cimpress RippleHire XML and keeps India and remote India roles while excluding explicit foreign locations', async () => {
  const cimpress = await loadCimpressModule()
  assert.ok(cimpress)

  const jobs = cimpress.extractSearchResults(searchResultsXml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Network Engineer',
    location: 'Remote, India',
    city: 'Remote',
    jobId: '887333',
    requisitionId: '887333',
    sourceUrl: 'https://cimpress.ripplehire.com/candidate/?token=8CyS9IjVDwzIu21jeaJ3&source=DIRECTCHANNEL#detail/job/887333',
    applyUrl: 'https://cimpress.ripplehire.com/candidate/?token=8CyS9IjVDwzIu21jeaJ3&source=DIRECTCHANNEL#apply/job/887333',
    experienceRequired: '7 - 10 Years',
    postingDate: '01-Jul-2026',
    department: null,
  })

  assert.deepEqual(jobs[1], {
    title: 'Technical Support Engineer',
    location: 'Mumbai, India',
    city: 'Mumbai',
    jobId: '865040',
    requisitionId: '865040',
    sourceUrl: 'https://cimpress.ripplehire.com/candidate/?token=8CyS9IjVDwzIu21jeaJ3&source=DIRECTCHANNEL#detail/job/865040',
    applyUrl: 'https://cimpress.ripplehire.com/candidate/?token=8CyS9IjVDwzIu21jeaJ3&source=DIRECTCHANNEL#apply/job/865040',
    experienceRequired: '2 - 4 Years',
    postingDate: '20-Jun-2026',
    department: null,
  })
})

test('extractJobDetail pulls Cimpress description, employment type, and department from RippleHire detail XML', async () => {
  const cimpress = await loadCimpressModule()
  assert.ok(cimpress)

  const detail = cimpress.extractJobDetail(detailXml, {
    title: 'Senior Network Engineer',
    location: 'Remote, India',
    city: 'Remote',
    jobId: '887333',
    requisitionId: '887333',
    sourceUrl: cimpress.buildDetailUrl('887333'),
    applyUrl: cimpress.buildApplyUrl('887333'),
    experienceRequired: '7 - 10 Years',
  })

  assert.equal(detail.title, 'Senior Network Engineer')
  assert.equal(detail.location, 'Remote, India')
  assert.equal(detail.city, 'Remote')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.department, 'Technology')
  assert.match(detail.jobDescription, /cloud and infrastructure networking/i)
  assert.equal(detail.applyUrl, cimpress.buildApplyUrl('887333'))
  assert.equal(detail.sourceUrl, cimpress.buildDetailUrl('887333'))
})

test('run fetches the Cimpress RippleHire listing and detail payloads, then decorates shared runner fields', async () => {
  const cimpress = await loadCimpressModule()
  assert.ok(cimpress)

  const requested = []
  const scraper = cimpress.createCimpressScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === 'https://cimpress.ripplehire.com/candidate/candidatejobsearch') {
        return searchResultsXml
      }

      if (url.includes('jobSeq=887333')) {
        return detailXml
      }

      if (url.includes('jobSeq=865040')) {
        return detailXml
          .replaceAll('887333', '865040')
          .replaceAll('Senior Network Engineer', 'Technical Support Engineer')
          .replaceAll('Remote', 'Mumbai')
          .replace('7 - 10 Years', '2 - 4 Years')
          .replace('Technology', 'Customer Support')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.method), ['POST', 'GET', 'GET'])
  assert.match(requested[0].body, /8CyS9IjVDwzIu21jeaJ3/)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Cimpress India')
  assert.equal(jobs[0].source, 'cimpress')
  assert.equal(jobs[0].link, 'https://cimpress.ripplehire.com/candidate/?token=8CyS9IjVDwzIu21jeaJ3&source=DIRECTCHANNEL#apply/job/887333')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
