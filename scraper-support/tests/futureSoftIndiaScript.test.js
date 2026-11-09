import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/futuresoftindia/script.js')
  } catch {
    assert.fail('Expected FutureSoft India scraper module at ../../scraper/futuresoftindia/script.js')
  }
}

const zeroRowsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Propel Your Career with Futuresoft India | Career at FS</title>
  </head>
  <body>
    <main>
      <h1>Careers at FutureSoft India</h1>
      <select name="job-title">
        <option>Technical Project Manager</option>
        <option>Node JS Developer</option>
        <option>Java Developer</option>
      </select>
      <select name="location">
        <option>Bangalore</option>
        <option>Chennai</option>
        <option>Noida</option>
      </select>
      <table>
        <thead>
          <tr>
            <th>Job Code</th>
            <th>Job Title</th>
            <th>Location</th>
            <th>Experience (Yrs)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <script>
        fetch('/Careers/GetAllRequisitions')
      </script>
    </main>
  </body>
</html>
`

const examplePayload = {
  data: [
    {
      iClientRecruitmentId: 101,
      JobCode: 'FSI-001',
      JobTitle: 'Node JS Developer',
      LocationName: 'Noida',
      Experience: '4',
      Queue: 'Engineering',
      ShortDescription: 'Node.js, Express',
      DetailedJD: '<p>Build backend services.</p>',
    },
  ],
  recordsTotal: 1,
  recordsFiltered: 1,
}

const emptyPayload = {
  data: [],
  recordsTotal: 0,
  recordsFiltered: 0,
}

test('FutureSoft India helpers stay pinned to the verified first-party careers page and public jobs API contract', async () => {
  const futureSoft = await loadModule()

  assert.equal(futureSoft.SOURCE, 'futuresoftindia')
  assert.equal(futureSoft.COMPANY, 'FutureSoft India')
  assert.equal(futureSoft.CAREERS_URL, 'https://futuresoftindia.com/careers/')
  assert.equal(futureSoft.JOBS_API_URL, 'https://futuresoftindia.com/Careers/GetAllRequisitions')
  assert.equal(futureSoft.VERIFIED_ON, '2026-07-17')
  assert.equal(futureSoft.hasVerifiedCareersSignal(zeroRowsHtml), true)
  assert.equal(futureSoft.hasVerifiedJobsTableShellSignal(zeroRowsHtml), true)
  assert.equal(futureSoft.hasVerifiedJobsPayloadContract(examplePayload), true)
  assert.deepEqual(futureSoft.extractJobRecords(examplePayload), examplePayload.data)
  assert.deepEqual(
    futureSoft.mapRecordToJob(examplePayload.data[0], {
      scrapedAt: '2026-07-17T10:00:00.000Z',
    }),
    {
      title: 'Node JS Developer',
      company: 'FutureSoft India',
      department: 'Engineering',
      location: 'Noida, India',
      city: 'Noida',
      state: null,
      country: 'India',
      jobId: 'futuresoftindia-101',
      requisitionId: 'FSI-001',
      sourceUrl:
        'https://futuresoftindia.com/Careers/ShowViewAndApplyJob?iClientRecruitmentId=101&jobtitle=Node%20JS%20Developer&type=view',
      applyUrl:
        'https://futuresoftindia.com/Careers/ShowViewAndApplyJob?iClientRecruitmentId=101&jobtitle=Node%20JS%20Developer&type=apply',
      employmentType: null,
      experienceRequired: '4',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Node.js', 'Express'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build backend services.',
      remoteStatus: 'On-site',
      source: 'futuresoftindia',
      link:
        'https://futuresoftindia.com/Careers/ShowViewAndApplyJob?iClientRecruitmentId=101&jobtitle=Node%20JS%20Developer&type=apply',
      scrapedAt: '2026-07-17T10:00:00.000Z',
    },
  )
})

test('FutureSoft India returns [] when the verified careers page remains stable and the public jobs payload is empty', async () => {
  const futureSoft = await loadModule()
  const requested = []

  const jobs = await futureSoft.createFutureSoftIndiaScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      assert.equal(url, futureSoft.CAREERS_URL)
      return zeroRowsHtml
    },
    fetchJson: async (url, body) => {
      requested.push(url)
      assert.equal(url, futureSoft.JOBS_API_URL)
      assert.equal(String(body), String(futureSoft.buildJobsApiBody()))
      return emptyPayload
    },
  })

  assert.deepEqual(requested, [
    futureSoft.CAREERS_URL,
    futureSoft.JOBS_API_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('FutureSoft India fails closed when the verified careers page or jobs payload drifts', async () => {
  const futureSoft = await loadModule()

  await assert.rejects(
    futureSoft.createFutureSoftIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified FutureSoft India careers page/i,
  )

  await assert.rejects(
    futureSoft.createFutureSoftIndiaScraper().run({
      fetchText: async () => zeroRowsHtml,
      fetchJson: async () => ({ broken: true }),
    }),
    /jobs payload/i,
  )
})
