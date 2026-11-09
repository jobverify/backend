import assert from 'node:assert/strict'
import test from 'node:test'

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>LogiNext | Join Our Team | Job Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Build something you love</h1>
      <a href="https://loginext.hire.trakstar.com">find jobs</a>
    </main>
    <script>
      self.__next_f.push([1,"e:[[\\"$\\",\\"$L13\\",null,{\\"category\\":\\"primary\\",\\"asLink\\":true,\\"href\\":\\"https://loginext.hire.trakstar.com\\",\\"size\\":\\"large\\",\\"children\\":\\"find jobs\\"}],[\\"$\\",\\"$L14\\",\\"technology\\",{\\"id\\":\\"technology\\",\\"department\\":\\"Technology\\",\\"noOfPositions\\":2,\\"roles\\":[{\\"id\\":\\"technology-senior-software-engineer\\",\\"title\\":\\"Senior Software Developer\\",\\"description\\":\\"If you want to Co-Lead the development efforts, and write awesome codes in Java.\\",\\"location\\":\\"Mumbai\\",\\"link\\":\\"https://loginext.recruiterbox.com/jobs/fk01is7/\\"},{\\"id\\":\\"technology-technical-content-writer\\",\\"title\\":\\"Technical Content Writer\\",\\"description\\":\\"\\\\\\"If you can't explain it to a six year old, you don't understand it yourself.\\\\\\"\\",\\"location\\":\\"Mumbai\\",\\"link\\":\\"https://loginext.recruiterbox.com/jobs/fk0jckw\\"}] }],[\\"$\\",\\"$L14\\",\\"business\\",{\\"id\\":\\"business\\",\\"department\\":\\"Business\\",\\"noOfPositions\\":1,\\"roles\\":[{\\"id\\":\\"business-senior-key-account_manager\\",\\"title\\":\\"Senior Key Account Manager\\",\\"description\\":\\"Enterprise Account Manager role.\\",\\"location\\":\\"Chicago\\",\\"link\\":\\"https://loginext.recruiterbox.com/jobs/fk01lta/\\"}]}]]"])
    </script>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/loginext/script.js')
  } catch {
    assert.fail('Expected LogiNext scraper module at ../../scraper/loginext/script.js')
  }
}

test('LogiNext helpers stay pinned to the verified first-party job roles page and embedded role contract', async () => {
  const logiNext = await loadScriptModule()

  assert.equal(logiNext.SOURCE, 'loginext')
  assert.equal(logiNext.COMPANY, 'LogiNext')
  assert.equal(logiNext.OFFICIAL_BRAND_NAME, 'LogiNext')
  assert.equal(logiNext.VERIFIED_ON, '2026-07-16')
  assert.equal(logiNext.JOBS_PAGE_URL, 'https://www.loginextsolutions.com/job-roles')
  assert.equal(logiNext.TRAKSTAR_ROOT_URL, 'https://loginext.hire.trakstar.com/')
  assert.equal(logiNext.hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.equal(logiNext.isIndiaLocation('Mumbai'), true)
  assert.equal(logiNext.isIndiaLocation('Chicago'), false)

  assert.deepEqual(
    logiNext.extractEmbeddedRoleRecords(jobsPageHtml),
    [
      {
        department: 'Technology',
        id: 'technology-senior-software-engineer',
        title: 'Senior Software Developer',
        description: 'If you want to Co-Lead the development efforts, and write awesome codes in Java.',
        location: 'Mumbai',
        link: 'https://loginext.recruiterbox.com/jobs/fk01is7/',
      },
      {
        department: 'Technology',
        id: 'technology-technical-content-writer',
        title: 'Technical Content Writer',
        description: `"If you can't explain it to a six year old, you don't understand it yourself."`,
        location: 'Mumbai',
        link: 'https://loginext.recruiterbox.com/jobs/fk0jckw',
      },
      {
        department: 'Business',
        id: 'business-senior-key-account_manager',
        title: 'Senior Key Account Manager',
        description: 'Enterprise Account Manager role.',
        location: 'Chicago',
        link: 'https://loginext.recruiterbox.com/jobs/fk01lta/',
      },
    ],
  )

  assert.deepEqual(
    logiNext.mapRoleRecordToJob(
      {
        department: 'Technology',
        id: 'technology-senior-software-engineer',
        title: 'Senior Software Developer',
        description: 'If you want to Co-Lead the development efforts, and write awesome codes in Java.',
        location: 'Mumbai',
        link: 'https://loginext.recruiterbox.com/jobs/fk01is7/',
      },
      {
        scrapedAt: '2026-07-16T11:00:00.000Z',
      },
    ),
    {
      title: 'Senior Software Developer',
      company: 'LogiNext',
      department: 'Technology',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      sourceUrl: 'https://loginext.recruiterbox.com/jobs/fk01is7/',
      applyUrl: 'https://loginext.recruiterbox.com/jobs/fk01is7/',
      jobId: 'loginext-technology-senior-software-engineer',
      requisitionId: 'technology-senior-software-engineer',
      employmentType: null,
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Team: Technology',
        'Location: Mumbai',
        '',
        'If you want to Co-Lead the development efforts, and write awesome codes in Java.',
      ].join('\n'),
      publicExperienceChecked: true,
      source: 'loginext',
      companyCareerPage: 'https://www.loginextsolutions.com/job-roles',
      companyDomain: 'loginextsolutions.com',
      atsPlatform: 'first-party-nextjs-page-with-recruiterbox-links',
      link: 'https://loginext.recruiterbox.com/jobs/fk01is7/',
      scrapedAt: '2026-07-16T11:00:00.000Z',
    },
  )
})

test('LogiNext infers experience from substantive embedded role descriptions and marks rich no-years descriptions as checked', async () => {
  const logiNext = await loadScriptModule()

  const withExperience = logiNext.mapRoleRecordToJob(
    {
      department: 'Technology',
      id: 'technology-tech-lead-java',
      title: 'Tech Lead - Java',
      description:
        'If you are a person who can lead the back-end architectural efforts, mentor engineers, and bring 6+ years of experience building large-scale Java systems, then we must talk.',
      location: 'Mumbai',
      link: 'https://loginext.recruiterbox.com/jobs/fk01ts4/',
    },
    { scrapedAt: '2026-07-16T12:00:00.000Z' },
  )

  const verifiedMissing = logiNext.mapRoleRecordToJob(
    {
      department: 'Technology',
      id: 'technology-senior-ui-developer',
      title: 'Senior UI Developer',
      description:
        'If you are a technically savvy and experienced Senior UI Developer who loves taking up front-end development challenges, building polished interfaces, collaborating with product teams, and improving component quality, then we look forward to hearing from you.',
      location: 'Mumbai',
      link: 'https://loginext.recruiterbox.com/jobs/fk01i2h/',
    },
    { scrapedAt: '2026-07-16T12:00:00.000Z' },
  )

  assert.equal(withExperience?.experienceRequired, '6+ years')
  assert.equal(withExperience?.publicExperienceChecked, false)
  assert.equal(verifiedMissing?.experienceRequired, null)
  assert.equal(verifiedMissing?.publicExperienceChecked, true)
})

test('LogiNext run validates the official page and returns normalized India roles only', async () => {
  const logiNext = await loadScriptModule()
  const pageRequests = []

  const jobs = await logiNext.createLogiNextScraper({
    now: () => '2026-07-16T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === logiNext.JOBS_PAGE_URL) {
        return { status: 200, url, html: jobsPageHtml }
      }

      throw new Error(`Unexpected LogiNext URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [logiNext.JOBS_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.link]),
    [
      ['Senior Software Developer', 'Mumbai, India', 'https://loginext.recruiterbox.com/jobs/fk01is7/'],
      ['Technical Content Writer', 'Mumbai, India', 'https://loginext.recruiterbox.com/jobs/fk0jckw'],
    ],
  )
  assert.ok(jobs.every((job) => job.country === 'India'))
  assert.ok(jobs.every((job) => job.scrapedAt === '2026-07-16T12:00:00.000Z'))
})

test('LogiNext fails closed when the official page or embedded role data drifts', async () => {
  const logiNext = await loadScriptModule()

  await assert.rejects(
    logiNext.createLogiNextScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: logiNext.JOBS_PAGE_URL,
        html: '<html><head><title>Unexpected</title></head><body>No jobs here</body></html>',
      }),
    }),
    /verified jobs page/i,
  )

  await assert.rejects(
    logiNext.createLogiNextScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: logiNext.JOBS_PAGE_URL,
        html: jobsPageHtml.replaceAll('https://loginext.recruiterbox.com/jobs/', 'https://example.com/jobs/'),
      }),
    }),
    /verified jobs page/i,
  )
})
