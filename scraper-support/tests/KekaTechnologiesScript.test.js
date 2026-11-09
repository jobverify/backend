import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html>
  <head>
    <title>Keka Careers</title>
  </head>
  <body>
    <script>
      window.isCareersPage = true
    </script>
    <div class="content-container">
      <script>
        fetch('/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/default.html')
      </script>
    </div>
  </body>
</html>
`

const embeddedCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Keka Embedded Careers</title>
  </head>
  <body>
    <script>
      window.khConfig = {
        identifier: '24040a7e-a7c5-47a5-9cd5-019962c66385',
        domain: 'https://hr.keka.com/careers/',
        portalName: 'default'
      };
    </script>
  </body>
</html>
`

const portalInfoPayload = {
  name: 'Keka Technologies Pvt. Ltd',
  shortName: 'Keka Technologies Pvt. Ltd',
  careersPortalDomain: 'hr.keka.com',
  companyWebsite: 'https://hr.keka.com/careers',
}

const activeJobsPayload = [
  {
    id: '101',
    jobNumber: 'KKA-101',
    title: 'Associate Product Manager',
    departmentName: 'Product',
    experience: '3-6',
    description: 'Own product discovery and roadmap delivery.',
    skillNames: ['Roadmapping', 'Analytics'],
    publishedOn: '2026-08-01T10:00:00.000Z',
    jobType: 2,
    jobLocations: [
      {
        name: 'Hyderabad',
        city: 'Hyderabad',
        state: 'Telangana',
        countryName: 'India',
        countryCode: 'IN',
      },
    ],
  },
  {
    id: '102',
    jobNumber: 'KKA-102',
    title: 'Growth Marketer',
    departmentName: 'Marketing',
    experience: '4+',
    description: 'Drive acquisition and campaign experiments.',
    skillNames: ['Campaigns', 'SEO'],
    publishedOn: '2026-08-02T10:00:00.000Z',
    jobType: 2,
    jobLocations: [
      {
        name: 'Hyderabad',
        city: 'Hyderabad',
        state: 'Telangana',
        countryName: 'India',
        countryCode: 'IN',
      },
    ],
  },
  {
    id: '103',
    jobNumber: 'KKA-103',
    title: 'Senior Product Designer',
    departmentName: 'Design',
    experience: '10+',
    description: 'Lead product design systems work.',
    skillNames: ['Figma', 'Design Systems'],
    publishedOn: '2026-08-03T10:00:00.000Z',
    jobType: 2,
    jobLocations: [
      {
        name: 'Hyderabad',
        city: 'Hyderabad',
        state: 'Telangana',
        countryName: 'India',
        countryCode: 'IN',
      },
    ],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/kekatechnologies/script.js')
  } catch {
    assert.fail('Expected KEKA TECHNOLOGIES scraper module at ../../scraper/kekatechnologies/script.js')
  }
}

test('KEKA TECHNOLOGIES extracts India jobs from the verified Keka shell config and active jobs payload', async () => {
  const keka = await loadModule()

  assert.equal(keka.hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(
    keka.extractEmbeddedCareersDocumentPath(careersShellHtml),
    '/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/default.html',
  )
  assert.deepEqual(keka.extractCareerConfig(embeddedCareersHtml), {
    identifier: '24040a7e-a7c5-47a5-9cd5-019962c66385',
    domain: 'https://hr.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    keka.buildCareerPortalInfoUrl({
      domain: 'https://hr.keka.com/careers/',
      portalName: 'default',
    }),
    'https://hr.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    keka.buildActiveJobsUrl({
      domain: 'https://hr.keka.com/careers/',
      identifier: '24040a7e-a7c5-47a5-9cd5-019962c66385',
      portalName: 'default',
    }),
    'https://hr.keka.com/careers/api/embedjobs/default/active/24040a7e-a7c5-47a5-9cd5-019962c66385',
  )

  assert.deepEqual(keka.extractSearchResults(activeJobsPayload, { domain: 'https://hr.keka.com/careers/' }), [
    {
      title: 'Associate Product Manager',
      company: 'KEKA TECHNOLOGIES',
      department: 'Product',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '101',
      requisitionId: 'KKA-101',
      sourceUrl: 'https://hr.keka.com/careers/jobdetails/101',
      applyUrl: 'https://hr.keka.com/careers/applyjob/101',
      employmentType: 'Full Time',
      experienceRequired: '3-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Roadmapping', 'Analytics'],
      postingDate: '2026-08-01',
      closingDate: null,
      jobDescription: 'Own product discovery and roadmap delivery.',
    },
    {
      title: 'Growth Marketer',
      company: 'KEKA TECHNOLOGIES',
      department: 'Marketing',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '102',
      requisitionId: 'KKA-102',
      sourceUrl: 'https://hr.keka.com/careers/jobdetails/102',
      applyUrl: 'https://hr.keka.com/careers/applyjob/102',
      employmentType: 'Full Time',
      experienceRequired: '4+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Campaigns', 'SEO'],
      postingDate: '2026-08-02',
      closingDate: null,
      jobDescription: 'Drive acquisition and campaign experiments.',
    },
    {
      title: 'Senior Product Designer',
      company: 'KEKA TECHNOLOGIES',
      department: 'Design',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '103',
      requisitionId: 'KKA-103',
      sourceUrl: 'https://hr.keka.com/careers/jobdetails/103',
      applyUrl: 'https://hr.keka.com/careers/applyjob/103',
      employmentType: 'Full Time',
      experienceRequired: '10+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Figma', 'Design Systems'],
      postingDate: '2026-08-03',
      closingDate: null,
      jobDescription: 'Lead product design systems work.',
    },
  ])
})

test('KEKA TECHNOLOGIES run fetches the verified Keka careers shell, embedded config, and active jobs API', async () => {
  const keka = await loadModule()
  const textUrls = []
  const jsonUrls = []

  const jobs = await keka.createKekaTechnologiesScraper().run({
    fetchText: async (url) => {
      textUrls.push(url)
      if (url === keka.CAREERS_URL) return careersShellHtml
      if (url === 'https://hr.keka.com/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/default.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonUrls.push(url)
      if (url === 'https://hr.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfoPayload
      }
      if (url === 'https://hr.keka.com/careers/api/embedjobs/default/active/24040a7e-a7c5-47a5-9cd5-019962c66385') {
        return activeJobsPayload
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(textUrls, [
    keka.CAREERS_URL,
    'https://hr.keka.com/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/default.html',
  ])
  assert.deepEqual(jsonUrls, [
    'https://hr.keka.com/careers/api/organization/default/careerportalinfo',
    'https://hr.keka.com/careers/api/embedjobs/default/active/24040a7e-a7c5-47a5-9cd5-019962c66385',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'KEKA TECHNOLOGIES')
  assert.equal(jobs[0].source, 'kekatechnologies')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
  assert.equal(jobs[0].companyCareerPage, 'https://hr.keka.com/careers/')
  assert.equal(jobs[0].companyDomain, 'hr.keka.com')
  assert.equal(jobs[0].atsPlatform, 'keka-careers-embed-jobs-api')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('KEKA TECHNOLOGIES fails closed when the verified Keka careers host loses its trusted shell markers', async () => {
  const keka = await loadModule()

  await assert.rejects(
    keka.createKekaTechnologiesScraper().run({
      fetchText: async () => '<html><body>No hiring signal</body></html>',
    }),
    /trusted Keka surface|verified careers host/i,
  )
})
