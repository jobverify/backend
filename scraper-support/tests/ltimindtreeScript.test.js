import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIndiaSearchUrl,
  buildSearchRequestPayload,
  buildDetailUrl,
  buildApplyUrl,
  createLtimindtreeScraper,
} from '../../scraper/ltimindtree/script.js'

const listing = (id, city = 'Bengaluru') => `<jobVoList><jobSeq>${id}</jobSeq><jobTitle>Specialist ${id}</jobTitle><jobLocation>India</jobLocation><locations>${city}</locations><jobId>REQ-${id}</jobId></jobVoList>`
const page = (start, total, rows) => `<JobPageVO><startJobIndex>${start}</startJobIndex><maxJobSize>2</maxJobSize><totalJobCount>${total}</totalJobCount>${rows.join('')}</JobPageVO>`
const detail = (id) => `<CandidateJobVO><companyVO><companyCd>LTIMINDIA</companyCd></companyVO><jobVO><jobSeq>${id}</jobSeq><jobTitle>Specialist ${id}</jobTitle><jobId>REQ-${id}</jobId><locations>Bengaluru</locations><jobDesc><![CDATA[Build and maintain software services for clients.]]></jobDesc><jobReqExp>5 - 7 Years</jobReqExp><jobType>Permanent</jobType></jobVO></CandidateJobVO>`

test('LTIMindtree uses the India Ripplehire board linked by the official LTM careers page', () => {
  assert.equal(buildIndiaSearchUrl(), 'https://ltimindtree.ripplehire.com/candidate/?token=xviyQvbnyYZdGtozXoNm&lang=en&source=CAREERSITE#list/geo=India')
  assert.deepEqual(buildSearchRequestPayload(1, 2), {
    page: 1, search: '*:*', token: 'xviyQvbnyYZdGtozXoNm', source: 'CAREERSITE', pagesize: 2, geo: 'India',
  })
  assert.match(buildDetailUrl('898694'), /#detail\/job\/898694$/)
  assert.match(buildApplyUrl('898694'), /#apply\/job\/898694$/)
})

test('LTIMindtree paginates the complete India count and fetches each description', async () => {
  const calls = []
  const jobs = await createLtimindtreeScraper().run({
    pageSize: 2,
    detailConcurrency: 2,
    fetchText: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.endsWith('/candidatejobsearch')) {
        const params = JSON.parse(new URLSearchParams(options.body).get('careerSiteUrlParams'))
        if (params.page === 0) return page(0, 3, [listing('1'), listing('2')])
        if (params.page === 1) return page(2, 3, [listing('3')])
      }
      const id = new URL(url).searchParams.get('jobSeq')
      if (id) return detail(id)
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map(job => job.jobId), ['1', '2', '3'])
  assert.equal(jobs[0].source, 'ltimindtree')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].company, 'LTIMindtree')
  assert.equal(jobs[0].requisitionId, 'REQ-1')
  assert.match(jobs[0].jobDescription, /Build and maintain/)
  assert.equal(jobs[0].link, buildApplyUrl('1'))
  assert.equal(jobs[0].sourceUrl, buildDetailUrl('1'))
  assert.equal(calls.filter(call => call.url.endsWith('/candidatejobsearch')).length, 4)
})

test('LTIMindtree rejects a truncated or duplicated India listing page', async () => {
  for (const broken of [page(0, 2, [listing('1')]), page(0, 2, [listing('1'), listing('1')])]) {
    await assert.rejects(
      createLtimindtreeScraper().run({ pageSize: 2, fetchText: async () => broken }),
      /incomplete|duplicate/i,
    )
  }
})

test('LTIMindtree rejects a missing job description', async () => {
  await assert.rejects(
    createLtimindtreeScraper().run({
      pageSize: 2,
      fetchText: async (url) => url.endsWith('/candidatejobsearch')
        ? page(0, 1, [listing('1')])
        : '<CandidateJobVO><companyVO><companyCd>LTIMINDIA</companyCd></companyVO><jobVO><jobSeq>1</jobSeq><jobDesc/></jobVO></CandidateJobVO>',
    }),
    /incomplete job detail/i,
  )
})

test('LTIMindtree retains an unspecified role separately without inventing its country', async () => {
  const unspecified = '<jobVoList><jobSeq>1</jobSeq><jobTitle>Specialist</jobTitle><jobLocation/><locations>Select Location</locations><jobId>1</jobId></jobVoList>'
  const jobs = await createLtimindtreeScraper().run({
    pageSize: 2,
    fetchText: async url => url.endsWith('/candidatejobsearch')
      ? page(0, 1, [unspecified])
      : detail('1').replace('<locations>Bengaluru</locations>', '<locations>Select Location</locations>'),
  })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeInventory.nativeRoles[0].country, null)
  assert.equal(jobs.nativeInventory.nativeRoles[0].location, null)
  assert.equal(jobs.nativeInventory.nativeRoles[0].city, null)
  assert.deepEqual(jobs.nativeInventory.unresolvedIds, ['1'])
})

test('LTIMindtree preserves text in encoded descriptions with a stray angle bracket', async () => {
  const jobs = await createLtimindtreeScraper().run({
    pageSize: 2,
    fetchText: async url => url.endsWith('/candidatejobsearch')
      ? page(0, 1, [listing('1')])
      : detail('1').replace('Build and maintain software services for clients.', '&lt;\n&lt;li>Build and maintain software services for clients.&lt;/li>'),
  })
  assert.match(jobs[0].jobDescription, /Build and maintain software services for clients/)
})
