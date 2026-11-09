import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HAL - Hindustan Aeronautics Limited</title>
  </head>
  <body>
    <h1>Come, become a part of the workforce of the nation's prestigious aerospace & defence agency</h1>
    <p>All recruitment notices will be published here.</p>
    <h2>Career Statistics</h2>
    <p>Select Division</p>
    <table>
      <thead>
        <tr>
          <th>Division</th>
          <th>Job Posting Informations</th>
          <th>Floated on</th>
          <th>Due date</th>
        </tr>
      </thead>
    </table>
    <h2>WARNING / CAUTION NOTICE</h2>
  </body>
</html>
`

const careersApiPayload = {
  'banner-img': 'https://hal-india.co.in/backend/wp-content/uploads/2023/09/career3.jpg',
  career: [
    {
      id: '963',
      division_id: '37',
      division: 'Avionics Division, Hyderabad',
      title: 'Engagement of Visiting Consultants Specialist Doctors and Clinical Psychologist on part time basis',
      floated_date: '11-07-2026',
      activeupto: '21-07-2026',
    },
    {
      id: '962',
      division_id: '22',
      division: 'Barrackpore Division',
      title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      floated_date: '09-07-2026',
      activeupto: '24-07-2026',
    },
    {
      id: '878',
      division_id: '25',
      division: 'Accessories Division, Lucknow',
      title: 'List of Provisionally qualified candidates in Written Test different Trades/Disciplines for Engagement of Tenure basis Personnel in Non-Executive Cadre for HAL Accessories Division Lucknow  Avionics Division Korwa along with the schedule for Document Verification.',
      floated_date: '07-01-2026',
      activeupto: '28-07-2026',
    },
    {
      id: '961',
      division_id: '37',
      division: 'Avionics Division, Hyderabad',
      title: 'Provisional Allotment Letter for One Year Apprenticeship Training – ITI Trade Candidates',
      floated_date: '02-07-2026',
      activeupto: '31-07-2026',
    },
    {
      id: '964',
      division_id: '37',
      division: 'Avionics Division, Hyderabad',
      title: 'Provisional Allotment Letter for One Year Apprenticeship Training – Diploma Technician General Stream Graduate and Engineering Graduate Candidates',
      floated_date: '16-07-2026',
      activeupto: '05-08-2026',
    },
  ],
}

const visitingConsultantDetailPayload = {
  career: [
    {
      id: '963',
      division: 'Avionics Division, Hyderabad',
      title: 'Engagement of Visiting Consultants Specialist Doctors and Clinical Psychologist on part time basis',
      floated_date: '11-Jul-2026',
      activeupto: '21-Jul-2026',
      description: 'List of candidates provisionally shortlisted for selection interview',
      job_url: '',
      job_url_info: '',
      file: {
        file: [
          {
            filename: 'https://hal-india.co.in/backend/wp-content/uploads/career/visiting-consultants-shortlist.pdf',
            filesize: '212 KB',
            filetype: 'pdf',
          },
        ],
      },
      corrigendum_file: { corrigendum_data: [] },
    },
  ],
}

const itiApprenticesDetailPayload = {
  career: [
    {
      id: '962',
      division: 'Barrackpore Division',
      title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      floated_date: '09-Jul-2026',
      activeupto: '24-Jul-2026',
      description: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      job_url: '',
      job_url_info: '',
      file: {
        file: [
          {
            filename: 'https://hal-india.co.in/backend/wp-content/uploads/career/ITI Apprenticeship Notification _Bk_1783569291.pdf',
            filesize: '683.35 KB',
            filetype: 'pdf',
          },
        ],
      },
      corrigendum_file: { corrigendum_data: [] },
    },
  ],
}

const qualifiedCandidatesDetailPayload = {
  career: [
    {
      id: '878',
      division: 'Accessories Division, Lucknow',
      title: 'List of Provisionally qualified candidates in Written Test different Trades/Disciplines for Engagement of Tenure basis Personnel in Non-Executive Cadre for HAL Accessories Division Lucknow  Avionics Division Korwa along with the schedule for Document Verification.',
      floated_date: '07-Jan-2026',
      activeupto: '28-Jul-2026',
      description: 'List of Provisionally qualified candidates in Written Test different Trades/Disciplines for Engagement of Tenure basis Personnel in Non-Executive Cadre for HAL Accessories Division Lucknow Avionics Division Korwa along with the schedule for Document Verification.',
      job_url: '',
      job_url_info: '',
      file: { file: [] },
      corrigendum_file: { corrigendum_data: [] },
    },
  ],
}

const itiAllotmentDetailPayload = {
  career: [
    {
      id: '961',
      division: 'Avionics Division, Hyderabad',
      title: 'Provisional Allotment Letter for One Year Apprenticeship Training – ITI Trade Candidates',
      floated_date: '02-Jul-2026',
      activeupto: '31-Jul-2026',
      description: 'Release of ITI Trade Apprentices Merit List',
      job_url: '',
      job_url_info: '',
      file: { file: [] },
      corrigendum_file: { corrigendum_data: [] },
    },
  ],
}

const graduateAllotmentDetailPayload = {
  career: [
    {
      id: '964',
      division: 'Avionics Division, Hyderabad',
      title: 'Provisional Allotment Letter for One Year Apprenticeship Training – Diploma Technician General Stream Graduate and Engineering Graduate Candidates',
      floated_date: '16-Jul-2026',
      activeupto: '05-Aug-2026',
      description: 'Release of Diploma Technician General Stream Graduate and Engineering Graduate Apprentices Merit List',
      job_url: '',
      job_url_info: '',
      file: { file: [] },
      corrigendum_file: { corrigendum_data: [] },
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/hindustanaeronautics/script.js')
  } catch {
    assert.fail('Expected Hindustan Aeronautics scraper module at ../../scraper/hindustanaeronautics/script.js')
  }
}

test('Hindustan Aeronautics pins the verified official careers shell and API endpoints', async () => {
  const hindustanAeronautics = await loadModule()

  assert.equal(hindustanAeronautics.CAREERS_URL, 'https://hal-india.co.in/career')
  assert.equal(
    hindustanAeronautics.CAREERS_API_URL,
    'https://hal-india.co.in/backend/wp-json/hal/v1/career?lang=en',
  )
  assert.equal(
    hindustanAeronautics.CAREER_DETAIL_API_URL,
    'https://hal-india.co.in/backend/wp-json/hal/v1/career_detail?lang=en',
  )
  assert.equal(
    hindustanAeronautics.TODAY_POSTINGS_API_URL,
    'https://hal-india.co.in/backend/wp-json/hal/v1/today_career?lang=en',
  )
  assert.equal(
    hindustanAeronautics.CORRIGENDUM_COUNT_API_URL,
    'https://hal-india.co.in/backend/wp-json/hal/v1/corrigendum_count_career?lang=en',
  )
  assert.equal(hindustanAeronautics.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(hindustanAeronautics.normalizeHalDate('09-07-2026'), '2026-07-09')
  assert.equal(hindustanAeronautics.normalizeHalDate('09-Jul-2026'), '2026-07-09')
})

test('Hindustan Aeronautics extracts current listings and keeps only real open recruitment notices after detail inspection', async () => {
  const hindustanAeronautics = await loadModule()
  const listings = hindustanAeronautics.extractCareerListings(careersApiPayload)

  assert.equal(listings.length, 5)
  assert.deepEqual(
    listings.map((listing) => ({
      id: listing.id,
      division: listing.division,
      title: listing.title,
      floatedDate: listing.floatedDate,
      dueDate: listing.dueDate,
    })),
    [
      {
        id: '963',
        division: 'Avionics Division, Hyderabad',
        title: 'Engagement of Visiting Consultants Specialist Doctors and Clinical Psychologist on part time basis',
        floatedDate: '2026-07-11',
        dueDate: '2026-07-21',
      },
      {
        id: '962',
        division: 'Barrackpore Division',
        title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
        floatedDate: '2026-07-09',
        dueDate: '2026-07-24',
      },
      {
        id: '878',
        division: 'Accessories Division, Lucknow',
        title: 'List of Provisionally qualified candidates in Written Test different Trades/Disciplines for Engagement of Tenure basis Personnel in Non-Executive Cadre for HAL Accessories Division Lucknow  Avionics Division Korwa along with the schedule for Document Verification.',
        floatedDate: '2026-01-07',
        dueDate: '2026-07-28',
      },
      {
        id: '961',
        division: 'Avionics Division, Hyderabad',
        title: 'Provisional Allotment Letter for One Year Apprenticeship Training – ITI Trade Candidates',
        floatedDate: '2026-07-02',
        dueDate: '2026-07-31',
      },
      {
        id: '964',
        division: 'Avionics Division, Hyderabad',
        title: 'Provisional Allotment Letter for One Year Apprenticeship Training – Diploma Technician General Stream Graduate and Engineering Graduate Candidates',
        floatedDate: '2026-07-16',
        dueDate: '2026-08-05',
      },
    ],
  )

  assert.equal(
    hindustanAeronautics.isOpenRecruitmentNotice(listings[0], visitingConsultantDetailPayload.career[0]),
    false,
  )
  assert.equal(
    hindustanAeronautics.isOpenRecruitmentNotice(listings[1], itiApprenticesDetailPayload.career[0]),
    true,
  )
  assert.equal(
    hindustanAeronautics.isOpenRecruitmentNotice(listings[2], qualifiedCandidatesDetailPayload.career[0]),
    false,
  )
  assert.equal(
    hindustanAeronautics.isOpenRecruitmentNotice(listings[3], itiAllotmentDetailPayload.career[0]),
    false,
  )
  assert.equal(
    hindustanAeronautics.isOpenRecruitmentNotice(listings[4], graduateAllotmentDetailPayload.career[0]),
    false,
  )

  const job = hindustanAeronautics.extractJobFromCareerDetail(listings[1], itiApprenticesDetailPayload)
  assert.deepEqual(job, {
    title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
    company: 'Hindustan Aeronautics',
    department: 'Barrackpore Division',
    location: 'Barrackpore Division, India',
    city: 'Barrackpore',
    state: null,
    country: 'India',
    jobId: '962',
    requisitionId: '962',
    sourceUrl: 'https://hal-india.co.in/backend/wp-content/uploads/career/ITI Apprenticeship Notification _Bk_1783569291.pdf',
    applyUrl: 'https://hal-india.co.in/backend/wp-content/uploads/career/ITI Apprenticeship Notification _Bk_1783569291.pdf',
    employmentType: 'Apprenticeship',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: '2026-07-24',
    jobDescription: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
    publicExperienceChecked: true,
  })
})

test('Hindustan Aeronautics run validates the official careers shell, official APIs, and keeps only open notices', async () => {
  const hindustanAeronautics = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await hindustanAeronautics.createHindustanAeronauticsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === hindustanAeronautics.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected Hindustan Aeronautics text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, body: options.body ?? null })
      if (url === hindustanAeronautics.CAREERS_API_URL) return careersApiPayload
      if (url === hindustanAeronautics.CAREER_DETAIL_API_URL && options.body?.id === '963') {
        return visitingConsultantDetailPayload
      }
      if (url === hindustanAeronautics.CAREER_DETAIL_API_URL && options.body?.id === '962') {
        return itiApprenticesDetailPayload
      }
      if (url === hindustanAeronautics.CAREER_DETAIL_API_URL && options.body?.id === '878') {
        return qualifiedCandidatesDetailPayload
      }
      if (url === hindustanAeronautics.CAREER_DETAIL_API_URL && options.body?.id === '961') {
        return itiAllotmentDetailPayload
      }
      if (url === hindustanAeronautics.CAREER_DETAIL_API_URL && options.body?.id === '964') {
        return graduateAllotmentDetailPayload
      }
      throw new Error(`Unexpected Hindustan Aeronautics JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [hindustanAeronautics.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    { url: hindustanAeronautics.CAREERS_API_URL, body: null },
    { url: hindustanAeronautics.CAREER_DETAIL_API_URL, body: { id: '963' } },
    { url: hindustanAeronautics.CAREER_DETAIL_API_URL, body: { id: '962' } },
    { url: hindustanAeronautics.CAREER_DETAIL_API_URL, body: { id: '878' } },
    { url: hindustanAeronautics.CAREER_DETAIL_API_URL, body: { id: '961' } },
    { url: hindustanAeronautics.CAREER_DETAIL_API_URL, body: { id: '964' } },
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      company: 'Hindustan Aeronautics',
      department: 'Barrackpore Division',
      location: 'Barrackpore Division, India',
      city: 'Barrackpore',
      state: null,
      country: 'India',
      jobId: '962',
      requisitionId: '962',
      sourceUrl: 'https://hal-india.co.in/backend/wp-content/uploads/career/ITI Apprenticeship Notification _Bk_1783569291.pdf',
      applyUrl: 'https://hal-india.co.in/backend/wp-content/uploads/career/ITI Apprenticeship Notification _Bk_1783569291.pdf',
      employmentType: 'Apprenticeship',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-09',
      closingDate: '2026-07-24',
      jobDescription: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      publicExperienceChecked: true,
      source: 'hindustanaeronautics',
      link: 'https://hal-india.co.in/backend/wp-content/uploads/career/ITI Apprenticeship Notification _Bk_1783569291.pdf',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Hindustan Aeronautics fails closed when the verified careers shell or API payload drifts', async () => {
  const hindustanAeronautics = await loadModule()

  await assert.rejects(
    hindustanAeronautics.createHindustanAeronauticsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => careersApiPayload,
    }),
    /verified hindustan aeronautics careers page/i,
  )

  await assert.rejects(
    hindustanAeronautics.createHindustanAeronauticsScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async () => ({ career: null }),
    }),
    /verified hindustan aeronautics careers api/i,
  )
})
