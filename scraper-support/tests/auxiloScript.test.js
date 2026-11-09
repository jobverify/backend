import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../utils/inventoryEvidence.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Education Loans - Apply for Student Loan from Auxilo</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="/careers">Careers</a>
      </nav>
    </header>
    <main>
      <h1>Auxilo</h1>
      <p>Education loans that support students and institutions.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Opportunity to join us | Auxilo Finserve</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Browse all available jobs at Auxilo</p>
      <a href="https://app1176.workline.hr/candidate">Click here to View Current Openings</a>
    </main>
  </body>
</html>
`

const currentCareersHtml = careersHtml.replace(
  '<title>Opportunity to join us | Auxilo Finserve</title>',
  '<title>Careers at Auxilo | Join Our Education Finance Team </title>',
)

test('Auxilo accepts the current first-party careers title only with its verified Workline handoff', async () => {
  const auxilo = await import('../../scraper/auxilo/script.js')
  assert.equal(auxilo.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(auxilo.extractJobsBoardEntryUrl(currentCareersHtml), auxilo.JOBS_BOARD_ENTRY_URL)
  assert.equal(auxilo.hasOfficialCareersSignal(currentCareersHtml.replace('app1176.workline.hr', 'other.example')), false)
})

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Auxilo - Workline - Possibilities Infinite</title>
  </head>
  <body>
    <main>
      <h1>Begin your search for greater opportunities</h1>
      <button>Search Jobs</button>
      <button>Post Resume</button>
    </main>
    <script src="GeneralOpenings.js"></script>
  </body>
</html>
`

const listingRecords = [
  {
    Req_No: '2321',
    Position_Name: 'Territory Credit Head - EIL',
    LOCATIONNAME: 'Hyderabad',
    Experience: '8 to 16 years',
    PublishDate: '14-Jul-2026',
    TrackToken: 'b48c8d0a-777c-4046-8617-f41f8bfe5004',
    SearchKeyWord: 'Territory-Credit-Head---EIL-Job-in-Hyderabad-1325',
    Field1: 'Education Institution Loans',
    Field2: 'Hyderabad',
    TimeDiff: 'Posted 7 hours ago',
    FunName: 'Credit - EIL',
    State_Name: 'Telangana',
    Country_Name: 'India',
    GradeName: 'Senior Manager',
    CustomName1: 'PM',
    Business_Name: 'Auxilo',
    No_Of_Vacancies: 1,
  },
  {
    Req_No: '2316',
    Position_Name: 'Office 365 Administrator',
    LOCATIONNAME: 'Mumbai - Corporate Office 1',
    Experience: '0 years',
    PublishDate: '13-Jul-2026',
    TrackToken: '06fe21e0-d262-4b08-b0f3-ccedc41492d9',
    SearchKeyWord: 'Office-365-Administrator-Job-in-Mumbai---Corporate-Office-1-1320',
    Field1: 'Technology',
    Field2: 'Mumbai - Corporate Office 1',
    FunName: 'IT Infrastructure',
    Country_Name: 'India',
    GradeName: 'Executive',
    Business_Name: 'Auxilo',
    No_Of_Vacancies: 1,
  },
]

const jobsApiPayload = {
  d: {
    obj1: JSON.stringify(listingRecords),
    obj2: JSON.stringify([
      {
        Name: 'Location',
        Values: ['Hyderabad', 'Mumbai - Corporate Office 1'],
      },
    ]),
  },
}

const buildDetailHtml = ({ title, reqNo, location, publishDate, trackToken }) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <div>Job Code: ${reqNo}</div>
      <div>Location: ${location}</div>
      <div>Posted Date: ${publishDate}</div>
      <section>
        <h2>Job Description</h2>
        <p>Key Responsibilities</p>
      </section>
      <a href="../Candidate/SignInv1.aspx?PRFCode=${trackToken}&Flag=C&DirectApply=1">Apply for this job</a>
    </main>
  </body>
</html>
`

const buildCurrentDetailHtml = ({ title, reqNo, location, publishDate, trackToken }) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <div>Job Code: ${reqNo}</div>
      <div>Location: ${location}</div>
      <div>Posted Date: ${publishDate}</div>
      <section>
        <h2>Job Description</h2>
        <p>Key Responsibilities</p>
      </section>
      <a href="../Candidate/SignInv1.aspx?PRFCode=${trackToken}&Flag=C&DirectApply=1">Apply Now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/auxilo/script.js')
  } catch {
    assert.fail('Expected Auxilo scraper module at ../../scraper/auxilo/script.js')
  }
}

test('Auxilo pins the verified homepage, careers handoff, Workline board, API payload contract, and detail/apply route patterns', async () => {
  const auxilo = await loadModule()

  assert.equal(auxilo.SOURCE, 'auxilo')
  assert.equal(auxilo.COMPANY, 'Auxilo')
  assert.equal(auxilo.OFFICIAL_BRAND_NAME, 'Auxilo Finserve')
  assert.equal(auxilo.VERIFIED_AT, '2026-10-03')
  assert.equal(auxilo.HOMEPAGE_URL, 'https://www.auxilo.com/')
  assert.equal(auxilo.CAREERS_URL, 'https://www.auxilo.com/careers')
  assert.equal(auxilo.JOBS_BOARD_ENTRY_URL, 'https://app1176.workline.hr/candidate')
  assert.equal(auxilo.JOBS_BOARD_URL, 'https://app1176.workline.hr/Cportal/GeneralOpening.aspx')
  assert.equal(
    auxilo.JOBS_API_URL,
    'https://app1176.workline.hr/CPortal/generalopening.aspx/GetCurrentopening',
  )
  assert.deepEqual(auxilo.JOBS_API_BODY, {
    JDFileName: '',
    OrgCode: '',
    KeyName: '',
  })
  assert.equal(auxilo.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(auxilo.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(auxilo.extractJobsBoardEntryUrl(careersHtml), auxilo.JOBS_BOARD_ENTRY_URL)
  assert.equal(auxilo.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(auxilo.hasVerifiedJobsPayloadContract(jobsApiPayload), true)
  assert.deepEqual(auxilo.extractListingRecords(jobsApiPayload), listingRecords)
  assert.equal(
    auxilo.buildDetailUrl(listingRecords[0]),
    'https://app1176.workline.hr/CandidatePortal/b48c8d0a-777c-4046-8617-f41f8bfe5004/Territory-Credit-Head---EIL-Job-in-Hyderabad-1325',
  )
  assert.equal(
    auxilo.buildApplyUrl(listingRecords[0]),
    'https://app1176.workline.hr/Candidate/SignInv1.aspx?PRFCode=b48c8d0a-777c-4046-8617-f41f8bfe5004&Flag=C&DirectApply=1',
  )

  const detailHtml = buildDetailHtml({
    title: listingRecords[0].Position_Name,
    reqNo: listingRecords[0].Req_No,
    location: listingRecords[0].LOCATIONNAME,
    publishDate: listingRecords[0].PublishDate,
    trackToken: listingRecords[0].TrackToken,
  })

  assert.equal(auxilo.hasOfficialDetailPageSignal(detailHtml, listingRecords[0]), true)
  assert.equal(auxilo.hasOfficialDetailPageSignal(buildCurrentDetailHtml({
    title: listingRecords[0].Position_Name,
    reqNo: listingRecords[0].Req_No,
    location: listingRecords[0].LOCATIONNAME,
    publishDate: listingRecords[0].PublishDate,
    trackToken: listingRecords[0].TrackToken,
  }), listingRecords[0]), true)
  assert.equal(
    auxilo.extractApplyUrl(detailHtml),
    'https://app1176.workline.hr/Candidate/SignInv1.aspx?PRFCode=b48c8d0a-777c-4046-8617-f41f8bfe5004&Flag=C&DirectApply=1',
  )
  assert.deepEqual(
    auxilo.mapListingRecordToJob(listingRecords[0], {
      scrapedAt: '2026-07-15T09:00:00.000Z',
    }),
    {
      title: 'Territory Credit Head - EIL',
      company: 'Auxilo',
      department: 'Credit - EIL',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      sourceUrl:
        'https://app1176.workline.hr/CandidatePortal/b48c8d0a-777c-4046-8617-f41f8bfe5004/Territory-Credit-Head---EIL-Job-in-Hyderabad-1325',
      applyUrl:
        'https://app1176.workline.hr/Candidate/SignInv1.aspx?PRFCode=b48c8d0a-777c-4046-8617-f41f8bfe5004&Flag=C&DirectApply=1',
      jobId: 'auxilo-2321',
      requisitionId: '2321',
      employmentType: null,
      workplaceType: null,
      experienceRequired: '8 to 16 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: [
        'Business: Auxilo',
        'Line of business: Education Institution Loans',
        'Function: Credit - EIL',
        'Location: Hyderabad',
        'Grade: Senior Manager',
        'Open positions: 1',
        'Posted: 14-Jul-2026',
      ].join('\n'),
      source: 'auxilo',
      companyCareerPage: 'https://www.auxilo.com/careers',
      companyDomain: 'auxilo.com',
      atsPlatform: 'workline-public-jobs-api',
      link:
        'https://app1176.workline.hr/Candidate/SignInv1.aspx?PRFCode=b48c8d0a-777c-4046-8617-f41f8bfe5004&Flag=C&DirectApply=1',
      scrapedAt: '2026-07-15T09:00:00.000Z',
    },
  )
})

test('Auxilo run validates the first-party careers handoff, Workline board, public API, and detail apply routes before returning normalized jobs', async () => {
  const auxilo = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await auxilo.createAuxiloScraper({
    now: () => '2026-07-15T10:15:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === auxilo.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === auxilo.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === auxilo.JOBS_BOARD_ENTRY_URL) {
        return { status: 200, url: auxilo.JOBS_BOARD_URL, html: jobsBoardHtml }
      }

      if (url === auxilo.buildDetailUrl(listingRecords[0])) {
        return {
          status: 200,
          url,
          html: buildDetailHtml({
            title: listingRecords[0].Position_Name,
            reqNo: listingRecords[0].Req_No,
            location: listingRecords[0].LOCATIONNAME,
            publishDate: listingRecords[0].PublishDate,
            trackToken: listingRecords[0].TrackToken,
          }),
        }
      }

      if (url === auxilo.buildDetailUrl(listingRecords[1])) {
        return {
          status: 200,
          url,
          html: buildDetailHtml({
            title: listingRecords[1].Position_Name,
            reqNo: listingRecords[1].Req_No,
            location: listingRecords[1].LOCATIONNAME,
            publishDate: listingRecords[1].PublishDate,
            trackToken: listingRecords[1].TrackToken,
          }),
        }
      }

      throw new Error(`Unexpected Auxilo URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      jsonRequests.push({
        url,
        method: options.method || 'GET',
        body: options.body ?? null,
      })

      if (url === auxilo.JOBS_API_URL) {
        return jobsApiPayload
      }

      throw new Error(`Unexpected Auxilo JSON URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    auxilo.HOMEPAGE_URL,
    auxilo.CAREERS_URL,
    auxilo.JOBS_BOARD_ENTRY_URL,
    auxilo.buildDetailUrl(listingRecords[0]),
    auxilo.buildDetailUrl(listingRecords[1]),
  ])
  assert.deepEqual(jsonRequests, [
    {
      url: auxilo.JOBS_API_URL,
      method: 'POST',
      body: JSON.stringify({
        JDFileName: '',
        OrgCode: '',
        KeyName: '',
      }),
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Territory Credit Head - EIL')
  assert.equal(jobs[0].company, 'Auxilo')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-15T10:15:00.000Z')
  assert.equal(jobs[1].title, 'Office 365 Administrator')
  assert.equal(jobs[1].city, 'Mumbai - Corporate Office 1')
  assert.equal(jobs[1].postingDate, '2026-07-13')
})

test('Auxilo fails closed when the homepage, careers handoff, jobs board, API contract, or detail apply route drift', async () => {
  const auxilo = await loadModule()

  await assert.rejects(
    auxilo.createAuxiloScraper().run({
      fetchPage: async (url) => {
        if (url === auxilo.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>' }
        }

        throw new Error(`Unexpected Auxilo URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    auxilo.createAuxiloScraper().run({
      fetchPage: async (url) => {
        if (url === auxilo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auxilo.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              'https://app1176.workline.hr/candidate',
              'https://careers.example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected Auxilo URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    auxilo.createAuxiloScraper().run({
      fetchPage: async (url) => {
        if (url === auxilo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auxilo.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === auxilo.JOBS_BOARD_ENTRY_URL) {
          return { status: 200, url: auxilo.JOBS_BOARD_URL, html: '<html><head><title>Workline</title></head><body>Login</body></html>' }
        }

        throw new Error(`Unexpected Auxilo URL: ${url}`)
      },
    }),
    /verified jobs board/i,
  )

  await assert.rejects(
    auxilo.createAuxiloScraper().run({
      fetchPage: async (url) => {
        if (url === auxilo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auxilo.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === auxilo.JOBS_BOARD_ENTRY_URL) {
          return { status: 200, url: auxilo.JOBS_BOARD_URL, html: jobsBoardHtml }
        }

        throw new Error(`Unexpected Auxilo URL: ${url}`)
      },
      fetchJson: async () => ({ d: { obj1: '{}' } }),
    }),
    /verified jobs api/i,
  )

  await assert.rejects(
    auxilo.createAuxiloScraper().run({
      fetchPage: async (url) => {
        if (url === auxilo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === auxilo.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === auxilo.JOBS_BOARD_ENTRY_URL) {
          return { status: 200, url: auxilo.JOBS_BOARD_URL, html: jobsBoardHtml }
        }

        if (url === auxilo.buildDetailUrl(listingRecords[0])) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Broken detail</title></head><body><h1>Broken detail</h1></body></html>',
          }
        }

        if (url === auxilo.buildDetailUrl(listingRecords[1])) {
          return {
            status: 200,
            url,
            html: buildDetailHtml({
              title: listingRecords[1].Position_Name,
              reqNo: listingRecords[1].Req_No,
              location: listingRecords[1].LOCATIONNAME,
              publishDate: listingRecords[1].PublishDate,
              trackToken: listingRecords[1].TrackToken,
            }),
          }
        }

        throw new Error(`Unexpected Auxilo URL: ${url}`)
      },
      fetchJson: async () => jobsApiPayload,
    }),
    /verified detail page/i,
  )
})

const exerciseInventory = async ({ records = listingRecords, pageOverride, maxJobs, now = () => '2026-10-20T08:30:00.000Z' } = {}) => {
  const auxilo = await loadModule()
  return auxilo.createAuxiloScraper({ now }).run({
    maxJobs,
    fetchPage: async (url) => {
      let page
      if (url === auxilo.HOMEPAGE_URL) page = { status: 200, url, html: homepageHtml }
      else if (url === auxilo.CAREERS_URL) page = { status: 200, url, html: currentCareersHtml }
      else if (url === auxilo.JOBS_BOARD_ENTRY_URL) page = { status: 200, url: auxilo.JOBS_BOARD_URL, html: jobsBoardHtml }
      else {
        const record = records.find((row) => row && auxilo.buildDetailUrl(row) === url)
        assert.ok(record, `Unexpected Auxilo page ${url}`)
        page = { status: 200, url, html: buildCurrentDetailHtml({
          title: record.Position_Name, reqNo: record.Req_No, location: record.LOCATIONNAME,
          publishDate: record.PublishDate, trackToken: record.TrackToken,
        }) }
      }
      return pageOverride ? pageOverride(url, page) : page
    },
    fetchJson: async () => ({ d: { obj1: JSON.stringify(records), obj2: '[]' } }),
  })
}

test('Auxilo retains fresh observed inventory evidence without inventing exhaustive totals', async () => {
  const jobs = await exerciseInventory()
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every((job) => job.sourceListingComplete === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.pagesFetched, 6)
  assert.equal(evidence.surface, 'https://app1176.workline.hr/CPortal/generalopening.aspx/GetCurrentopening')
  assert.equal(evidence.verifiedAt, '2026-10-20T08:30:00.000Z')
  assert.match(evidence.reason, /observedRecords=2; indiaCandidates=2; validatedDetails=2; returnedJobs=2/)
  assert.match(evidence.reason, /exhaustive.*unverified/i)
})

test('Auxilo preserves observed zero without authorizing empty lifecycle reconciliation', async () => {
  const jobs = await exerciseInventory({ records: [] })
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 4)
  assert.equal(evidence.reportedTotal, null)
  assert.match(evidence.reason, /observedRecords=0; indiaCandidates=0; validatedDetails=0; returnedJobs=0/)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
})

test('Auxilo preserves observed counts before the existing India filter and any output cap', async () => {
  const records = [...listingRecords, { ...listingRecords[0], Req_No: 'foreign-1', TrackToken: 'foreign-token', Country_Name: 'United States' }]
  const jobs = await exerciseInventory({ records, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceListingComplete, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 6)
  assert.match(evidence.reason, /observedRecords=3; indiaCandidates=2; validatedDetails=2; returnedJobs=1/)
})

test('Auxilo rejects malformed listing entries instead of silently converting damage into empty inventory', async () => {
  const auxilo = await loadModule()
  for (const row of [null, 42, 'broken', [], {}, { Country_Name: 'United States' }]) {
    assert.throws(() => auxilo.extractListingRecords({ d: { obj1: JSON.stringify([row]), obj2: '[]' } }), /record|shape/i)
  }
  for (const obj2 of ['broken', '{}']) {
    assert.equal(auxilo.hasVerifiedJobsPayloadContract({ d: { obj1: '[]', obj2 } }), false)
  }
})

test('Auxilo rejects duplicate requisitions and application identities instead of emitting ambiguous jobs', async () => {
  await assert.rejects(exerciseInventory({ records: [listingRecords[0], { ...listingRecords[1], Req_No: listingRecords[0].Req_No }] }), /duplicate.*identity/i)
  await assert.rejects(exerciseInventory({ records: [listingRecords[0], { ...listingRecords[1], TrackToken: listingRecords[0].TrackToken }] }), /duplicate.*identity/i)
})

test('Auxilo never returns a partial successful array after a later detail request fails', async () => {
  const auxilo = await loadModule()
  await assert.rejects(exerciseInventory({ pageOverride: (url, page) => url === auxilo.buildDetailUrl(listingRecords[1]) ? { ...page, status: 503 } : page }), /verified detail page/i)
})

test('Auxilo rejects copied official content served after an untrusted redirect', async () => {
  const auxilo = await loadModule()
  for (const target of [auxilo.HOMEPAGE_URL, auxilo.CAREERS_URL, auxilo.buildDetailUrl(listingRecords[0])]) {
    await assert.rejects(exerciseInventory({ pageOverride: (url, page) => url === target ? { ...page, url: 'https://unrelated.example/copied' } : page }), /verified.*(?:homepage|careers|detail)/i)
  }
})

test('Auxilo default JSON transport rejects payloads redirected away from the verified Workline API', async () => {
  const auxilo = await loadModule()
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (url) => {
      if (url === auxilo.HOMEPAGE_URL) return { status: 200, url, text: async () => homepageHtml }
      if (url === auxilo.CAREERS_URL) return { status: 200, url, text: async () => currentCareersHtml }
      if (url === auxilo.JOBS_BOARD_ENTRY_URL) return { status: 200, url: auxilo.JOBS_BOARD_URL, text: async () => jobsBoardHtml }
      assert.equal(url, auxilo.JOBS_API_URL)
      return { status: 200, ok: true, url: 'https://unrelated.example/copied-api', json: async () => ({ d: { obj1: '[]', obj2: '[]' } }) }
    }
    await assert.rejects(auxilo.run(), /API.*redirect|redirect.*API/i)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Auxilo records inventory verification time after the final matching detail succeeds', async () => {
  const times = ['2026-10-20T08:30:00.000Z', '2026-10-20T08:31:00.000Z']
  const jobs = await exerciseInventory({ now: () => times.shift() })
  assert.equal(jobs[1].scrapedAt, '2026-10-20T08:30:00.000Z')
  assert.equal(readInventoryEvidence(jobs).verifiedAt, '2026-10-20T08:31:00.000Z')
})

test('Auxilo observed jobs remain eligible for upserts while incomplete inventory preserves unseen vacancies', async (t) => {
  const { default: mongoose } = await import('mongoose')
  const { default: Job } = await import('../../src/models/Job.js')
  const { saveToDB } = await import('../utils/saveToDB.js')
  const originalState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  t.after(() => {
    if (originalState) Object.defineProperty(mongoose.connection, 'readyState', originalState)
    else delete mongoose.connection.readyState
  })
  t.mock.method(mongoose, 'connect', async () => assert.fail('No database connection is allowed in this test'))
  let writes = []
  t.mock.method(Job, 'bulkWrite', async (operations) => { writes = operations; return { modifiedCount: operations.length, upsertedCount: 0 } })
  t.mock.method(Job, 'deleteMany', () => assert.fail('Incomplete Auxilo inventory must not delete unseen vacancies'))
  t.mock.method(Job, 'updateMany', () => assert.fail('Incomplete Auxilo inventory must not record lifecycle misses'))
  const jobs = await exerciseInventory({ maxJobs: 1 })
  const result = await saveToDB(jobs, 'auxilo', {
    now: '2026-07-15T12:00:00.000Z', enrichPublicExperience: false,
    refreshDatasetSummary: false, enqueueAlerts: false, descriptionRewriteMode: 'off',
  })
  assert.equal(writes.length, 1)
  assert.equal(writes[0].updateOne.update.$set.requisitionId, '2321')
  assert.equal(result.updated, 1)
  assert.equal(result.staleCheckSkipped, true)
  assert.match(result.staleCheckReason, /incomplete/i)
  assert.equal(result.deleted, 0)
  assert.equal(result.missed, 0)
  assert.equal(result.expired, 0)
})
