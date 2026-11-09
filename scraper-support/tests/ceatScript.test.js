import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

const loadCeatModule = async () => {
  try {
    return await import('../../scraper/ceat/script.js')
  } catch {
    return null
  }
}

const sampleTurboHirePayload = {
  Total: 1,
  Result: [
    {
      JobId: '2c48304f-514e-422b-94bf-d738f570912d',
      JobIdObfuscated: 'PGFHqraKncn9fnokL1Z66CCbMQKrnA2WkPtVDw9mYmOZWXSAJcHsr92GQ7xg3pGA',
      JobCode: '46223',
      JobTitle: 'Manager - Vendor Development (Outsourcing)',
      Department: 'Outsourcing - Vendor Development',
      UpdatedDate: '2026-06-24T06:05:06.1533333',
      PublishedDate: '2026-03-25T10:49:37.1988173Z',
      ExpiryDates: {
        CAREERPAGE: '2026-06-30T18:29:00.904Z',
      },
      Applied: false,
      Location: '[{"Address":"Mumbai Plant","PlaceId":null}]',
      Type: 'UNSPECIFIED',
      JobTypeV2: 'Full Time',
      Experience: {},
      Skills: [
        'Utility',
        'maintainance',
        'Boiler operation',
      ],
      JobDescV2: '<p>Role</p><p>TM Vendor development</p><p>Position Title:</p><p>Manager - Vendor Development - Outsourcing</p>',
    },
  ],
}

test('extractSearchResults maps CEAT TurboHire jobs into the shared scraper fields', async () => {
  const ceat = await loadCeatModule()
  assert.ok(ceat)

  const jobs = ceat.extractSearchResults(sampleTurboHirePayload, { companyName: 'CEAT Limited' })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Manager - Vendor Development (Outsourcing)',
    company: 'CEAT Limited',
    department: 'Outsourcing - Vendor Development',
    location: 'Mumbai Plant',
    city: 'Mumbai Plant',
    jobId: '2c48304f-514e-422b-94bf-d738f570912d',
    requisitionId: '46223',
    sourceUrl: 'https://ceat.turbohire.co/job/publicjobs/PGFHqraKncn9fnokL1Z66CCbMQKrnA2WkPtVDw9mYmOZWXSAJcHsr92GQ7xg3pGA',
    applyUrl: 'https://ceat.turbohire.co/job/publicjobs/PGFHqraKncn9fnokL1Z66CCbMQKrnA2WkPtVDw9mYmOZWXSAJcHsr92GQ7xg3pGA',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Utility',
      'maintainance',
      'Boiler operation',
    ],
    postingDate: '2026-03-25T10:49:37.1988173Z',
    closingDate: '2026-06-30T18:29:00.904Z',
    jobDescription: 'Role TM Vendor development Position Title: Manager - Vendor Development - Outsourcing',
  })
})

test('run obtains a public TurboHire token, posts the observed CEAT filter body, and decorates shared runner fields', async () => {
  const {
    CAREER_PAGE_ID,
    CAREER_PAGE_URL,
    FILTERED_JOBS_URL,
    LIVE_FILTER_BODY,
    NOAUTH_TOKEN_URL,
    createCeatScraper,
  } = await loadCeatModule()
  const requests = []
  const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/ceat/test-data/native-20261102.json.gz',import.meta.url))))
  const nativeListing=JSON.parse(packets.find(row=>row.key==='jobs').body)
  const scraper = createCeatScraper()

  const jobs = await scraper.run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })

      if (url === NOAUTH_TOKEN_URL) {
        return { access_token: 'test-public-token' }
      }

      if (url === FILTERED_JOBS_URL) {
        return nativeListing
      }
      const detail=packets.filter(row=>row.key.startsWith('full-detail-')).map(row=>JSON.parse(row.body))
        .find(row=>url===`https://thapi.azurewebsites.net/api/publicjobs/${row.JobId}?fieldVisibility=CareerPage`)
      if(detail)return detail
      throw new Error(`Unexpected CEAT URL: ${url}`)
    },
    fetchText:async url=>{
      if(url==='https://www.ceat.com/career-landing.html')return packets.find(row=>row.key==='corporate').body
      if(url===CAREER_PAGE_URL)return packets.find(row=>row.key==='board').body
      const index=nativeListing.Result.findIndex(row=>url===`https://ceat.turbohire.co/job/publicjobs/${row.JobIdObfuscated}`)
      assert.ok(index>=0)
      return packets.find(row=>row.key===`public-${index}`).body
    },
  })

  assert.equal(CAREER_PAGE_ID, '4ae530fb-afba-4926-bdf9-9040b0e8774c')
  assert.equal(CAREER_PAGE_URL, 'https://ceat.turbohire.co/careerpage/4ae530fb-afba-4926-bdf9-9040b0e8774c')
  assert.equal(FILTERED_JOBS_URL, 'https://thapi.azurewebsites.net/api/careerpagev2/filteredjobs?orgId=4ae530fb-afba-4926-bdf9-9040b0e8774c&pageType=0')

  assert.equal(requests.length, 8)
  assert.equal(requests[0].url, NOAUTH_TOKEN_URL)
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(requests[0].options.headers.Origin, 'https://ceat.turbohire.co')
  assert.equal(requests[0].options.headers.Referer, CAREER_PAGE_URL)

  assert.equal(requests[1].url, FILTERED_JOBS_URL)
  assert.equal(requests[1].options.method, 'POST')
  assert.equal(requests[1].options.headers.Authorization, 'Bearer test-public-token')
  assert.equal(requests[1].options.headers.Origin, 'https://ceat.turbohire.co')
  assert.equal(requests[1].options.headers.Referer, CAREER_PAGE_URL)
  assert.equal(requests[1].options.body, JSON.stringify(LIVE_FILTER_BODY))

  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].company, 'CEAT Limited')
  assert.equal(jobs[0].source, 'ceat')
  assert.equal(jobs[0].employmentType, null)
  assert.equal(
    jobs[0].applyUrl,
    'https://ceat.turbohire.co/job/publicjobs/YHJA8N0QWQD_cZTtkj8UP7sP48I4A_E3MYD6xJbvwd2oJcyBzZGziE3pPnCRMEWu',
  )
})
