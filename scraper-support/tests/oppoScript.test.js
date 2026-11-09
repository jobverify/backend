import assert from 'node:assert/strict'
import test from 'node:test'

const socialShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>OPPO招聘 - 加入我们 join us</title>
    <script type="module" crossorigin src="/assets/js/oppo-CgxPOmYN.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`

const campusShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>OPPO招聘 - 加入我们 join us</title>
    <script type="module" crossorigin src="/assets/js/campus_oppo-FkBjReNU.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`

const socialPage1 = {
  code: '0',
  data: {
    pageNum: 1,
    pageSize: 2,
    pages: 2,
    total: '3',
    list: [
      {
        positionId: 'social-1',
        publishName: 'India Sales Engineer',
        jobNo: '101001',
        jobCode: 'J260717000001',
        jobName: 'India Sales Engineer',
        workCityCode: 'IN-HR-GGN',
        workCityName: 'Gurugram, India',
        jobType: 'MARKETING',
        minWorkYears: 5,
        maxWorkYears: 8,
        educationRequire: 'UNDERGRADUATE-AND-ABOVE',
        jobDuty: 'Own the India partner channel.',
        workRequire: 'Strong India market experience.',
        publishDate: '2026-07-17',
        recruitType: 'SOCIAL-RECRUITMENT',
        recruitTypeName: '社招',
        top: 'N',
        isDelivery: null,
      },
      {
        positionId: 'social-2',
        publishName: 'Shenzhen Platform Engineer',
        jobNo: '101002',
        jobCode: 'J260717000002',
        jobName: 'Shenzhen Platform Engineer',
        workCityCode: '440300',
        workCityName: '深圳市',
        jobType: 'SOFTWARE',
        minWorkYears: 3,
        maxWorkYears: 6,
        educationRequire: 'UNDERGRADUATE-AND-ABOVE',
        jobDuty: 'China-only role.',
        workRequire: 'China-only role.',
        publishDate: '2026-07-17',
        recruitType: 'SOCIAL-RECRUITMENT',
        recruitTypeName: '社招',
        top: 'N',
        isDelivery: null,
      },
    ],
  },
  msg: 'success',
}

const socialPage2 = {
  code: '0',
  data: {
    pageNum: 2,
    pageSize: 2,
    pages: 2,
    total: '3',
    list: [
      {
        positionId: 'social-3',
        publishName: 'India Intern',
        jobNo: '101003',
        jobCode: 'J260717000003',
        jobName: 'India Intern',
        workCityCode: 'IN-KA-BLR',
        workCityName: 'Bengaluru, India',
        jobType: 'SOFTWARE',
        minWorkYears: 999,
        maxWorkYears: 999,
        educationRequire: 'UNDERGRADUATE-AND-ABOVE',
        jobDuty: 'Support India pilots.',
        workRequire: 'Internship role.',
        publishDate: '2026-07-17',
        recruitType: 'OFFEN-RECRUITMENT',
        recruitTypeName: '日常实习生',
        top: 'N',
        isDelivery: null,
      },
    ],
  },
  msg: 'success',
}

const campusPage1 = {
  code: 0,
  data: {
    records: [
      {
        idProjPosition: 3001,
        projectPositionId: 4001,
        atsProjectPositionId: 5001,
        projectName: '2027 Campus Hiring',
        recruitmentTypeName: '应届生',
        recruitmentType: 'Graduate',
        positionType: 'Software',
        positionTypeName: '软件类',
        positionName: 'India Graduate Engineer',
        positionDesc: 'Build partner tooling for India.',
        positionRequire: 'Strong CS basics.',
        workCityName: 'Bengaluru, India',
        workCityCode: 'IN-KA-BLR',
        releaseTime: '2026-07-17',
        specialRecruitment: '',
      },
      {
        idProjPosition: 3002,
        projectPositionId: 4002,
        atsProjectPositionId: 5002,
        projectName: '2027 Campus Hiring',
        recruitmentTypeName: '应届生',
        recruitmentType: 'Graduate',
        positionType: 'Design',
        positionTypeName: '设计类',
        positionName: 'Dongguan Designer',
        positionDesc: 'China-only role.',
        positionRequire: 'China-only role.',
        workCityName: '东莞市',
        workCityCode: '44190X',
        releaseTime: '2026-07-17',
        specialRecruitment: '',
      },
    ],
    total: 2,
    size: 2,
    current: 1,
    pages: 1,
  },
  msg: 'success',
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/oppo/script.js')
  } catch {
    assert.fail('Expected Oppo scraper module at ../../scraper/oppo/script.js')
  }
}

test('Oppo pins the verified official social and campus shells plus the public jobs APIs', async () => {
  const oppo = await loadScriptModule()

  assert.equal(oppo.SOURCE, 'oppo')
  assert.equal(oppo.COMPANY, 'Oppo')
  assert.equal(oppo.OFFICIAL_BRAND_NAME, 'OPPO')
  assert.equal(oppo.VERIFIED_ON, '2026-07-17')
  assert.equal(oppo.SOCIAL_HOME_URL, 'https://career.oppo.com/official/oppo')
  assert.equal(oppo.CAMPUS_HOME_URL, 'https://careers.oppo.com/university/oppo')
  assert.equal(
    oppo.SOCIAL_API_URL,
    'https://career.oppo.com/ats-candidate-api/open-api/position/queryPositionList',
  )
  assert.equal(
    oppo.CAMPUS_API_URL,
    'https://careers.oppo.com/openapi/position/pageNew',
  )
  assert.equal(oppo.hasOfficialSocialShellSignal(socialShellHtml), true)
  assert.equal(oppo.hasOfficialCampusShellSignal(campusShellHtml), true)
})

test('Oppo extraction keeps only India-located records from both public feeds and derives detail URLs', async () => {
  const oppo = await loadScriptModule()

  assert.deepEqual(oppo.extractIndiaSocialJobs(socialPage1), [
    {
      title: 'India Sales Engineer',
      company: 'Oppo',
      department: 'MARKETING',
      location: 'Gurugram, India',
      city: 'Gurugram',
      state: null,
      country: 'India',
      jobId: 'social-1',
      requisitionId: 'J260717000001',
      sourceUrl: 'https://career.oppo.com/official/oppo/recruitment/post/social-1?recruitType=SOCIAL-RECRUITMENT',
      applyUrl: 'https://career.oppo.com/official/oppo/recruitment/post/social-1?recruitType=SOCIAL-RECRUITMENT',
      employmentType: 'Full-time',
      experienceRequired: '5-8 years',
      minimumQualification: 'UNDERGRADUATE-AND-ABOVE',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-17',
      closingDate: null,
      jobDescription: 'Own the India partner channel.\n\nStrong India market experience.',
      publicExperienceChecked: true,
      remoteStatus: null,
    },
  ])

  assert.deepEqual(oppo.extractIndiaCampusJobs(campusPage1), [
    {
      title: 'India Graduate Engineer',
      company: 'Oppo',
      department: '软件类',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: null,
      country: 'India',
      jobId: '3001',
      requisitionId: '4001',
      sourceUrl: 'https://careers.oppo.com/university/oppo/campus/post/3001?recruitType=Graduate',
      applyUrl: 'https://careers.oppo.com/university/oppo/campus/post/3001?recruitType=Graduate',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-17',
      closingDate: null,
      jobDescription: 'Build partner tooling for India.\n\nStrong CS basics.',
      publicExperienceChecked: true,
      remoteStatus: null,
    },
  ])
})

test('run validates the verified official Oppo shells, paginates both public feeds, and decorates India jobs', async () => {
  const oppo = await loadScriptModule()
  const shellRequests = []
  const apiRequests = []

  const jobs = await oppo.createOppoScraper({ pageSize: 2 }).run({
    fetchText: async (url) => {
      shellRequests.push(url)
      if (url === oppo.SOCIAL_HOME_URL) return socialShellHtml
      if (url === oppo.CAMPUS_HOME_URL) return campusShellHtml
      throw new Error(`Unexpected shell request: ${url}`)
    },
    fetchJson: async (url, body) => {
      apiRequests.push({ url, body })
      if (url === oppo.SOCIAL_API_URL && body.pageNum === 1) return socialPage1
      if (url === oppo.SOCIAL_API_URL && body.pageNum === 2) return socialPage2
      if (url === oppo.CAMPUS_API_URL && body.pageNum === 1) return campusPage1
      throw new Error(`Unexpected API request: ${url} page=${body.pageNum}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(shellRequests, [oppo.SOCIAL_HOME_URL, oppo.CAMPUS_HOME_URL])
  assert.deepEqual(
    apiRequests.map((request) => [request.url, request.body.pageNum]),
    [
      [oppo.SOCIAL_API_URL, 1],
      [oppo.SOCIAL_API_URL, 2],
      [oppo.CAMPUS_API_URL, 1],
    ],
  )
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'oppo')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-17T00:00:00.000Z')
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['India Sales Engineer', 'India Intern', 'India Graduate Engineer'],
  )
})

test('run fails closed when an Oppo official shell drifts or a public API stops returning the verified shape', async () => {
  const oppo = await loadScriptModule()

  await assert.rejects(
    oppo.createOppoScraper().run({
      fetchText: async (url) => {
        if (url === oppo.SOCIAL_HOME_URL) return '<html><body>Unexpected</body></html>'
        return campusShellHtml
      },
      fetchJson: async () => socialPage1,
    }),
    /official OPPO social careers shell/i,
  )

  await assert.rejects(
    oppo.createOppoScraper().run({
      fetchText: async (url) => {
        if (url === oppo.SOCIAL_HOME_URL) return socialShellHtml
        return campusShellHtml
      },
      fetchJson: async (url) => {
        if (url === oppo.SOCIAL_API_URL) return { code: '500', data: null, msg: 'busy' }
        return campusPage1
      },
    }),
    /public social jobs api/i,
  )
})
