import assert from 'node:assert/strict'
import test from 'node:test'

const loadTecholutionModule = async () => {
  try {
    return await import('../../scraper/techolution/script.js')
  } catch {
    assert.fail('Expected Techolution scraper module at ../../scraper/techolution/script.js')
  }
}

const listingPayload = {
  data: [
    {
      category: 'Sales and Marketing',
      roles: [
        {
          id: 'a05e1fcd-da75-452c-a045-ae3ac8ff441f',
          roleName: 'Technical Project Manager - Presales & GTM',
          status: 'published',
          locations: 'Hyderabad, India',
          employmentType: 'Full Time',
          createdAt: '2026-04-02T18:18:52.531Z',
          positionStatus: 'Mid-Level',
          skills: {
            foundationalSkills: [
              'Cost Analysis',
              'Financial Planning',
            ],
            behaviouralSkills: ['Ownership'],
            goals: ['Long Term Skills'],
            advancedSkills: ['Proposals'],
          },
          roleDescription:
            '<p>Translate complex business requirements into client-ready technical proposals.</p>',
        },
        {
          id: '258b3240-5e6a-45cc-b04b-156d9278e2f5',
          roleName: 'Sales Executive',
          status: 'published',
          locations: 'Remote, USA',
          employmentType: 'Full Time',
          createdAt: '2026-03-17T15:00:46.933Z',
          positionStatus: 'Senior',
          skills: {
            foundationalSkills: ['Enterprise Sales Background'],
            behaviouralSkills: ['Ownership'],
            goals: [],
            advancedSkills: ['AI sales'],
          },
          roleDescription: '<p>US-only role.</p>',
        },
      ],
    },
    {
      category: 'Project Management',
      roles: [
        {
          id: 'e1e19ce2-c051-4cec-b9cb-2a76665905ec',
          roleName: 'Operations Project Manager',
          status: 'published',
          locations: 'Hyderabad, India',
          employmentType: 'Full Time',
          createdAt: '2026-06-10T07:23:15.918Z',
          positionStatus: 'Mid-Level',
          skills: {
            foundationalSkills: ['Project Management'],
            behaviouralSkills: ['Ownership'],
            goals: [],
            advancedSkills: ['Change Management'],
          },
          roleDescription: '<p>Drive operational excellence across finance and legal workflows.</p>',
        },
      ],
    },
  ],
}

const technicalProjectManagerDetail = {
  details: {
    roleName: 'Technical Project Manager - Presales & GTM',
    location: 'Hyderabad, India (Hybrid)',
    employmentType: 'Full Time',
    positionStatus: 'Mid-Level',
    category: 'Sales and Marketing',
    createdAt: '2026-04-02T18:18:52.531Z',
    jobDescription: {
      roleDescription:
        '<p>Translate complex business requirements into client-ready technical proposals.</p>',
      keyRequirements:
        '<div><li>Create detailed work breakdown structures.</li><li>Build cost models.</li></div>',
      mandatorySkills:
        '<div><li>Translate business problems into technical requirements.</li></div>',
      goodToHaveSkills:
        '<ul><li>Google Cloud Platform and Gemini experience.</li></ul>',
      placement: [
        'roleDescription',
        'keyRequirements',
        'mandatorySkills',
        'goodToHaveSkills',
      ],
    },
    skills: {
      foundationalSkills: [
        'Cost Analysis',
        'Financial Planning',
      ],
      behaviouralSkills: ['Ownership'],
      goals: ['Long Term Skills'],
      advancedSkills: ['Proposals'],
    },
  },
}

const operationsProjectManagerDetail = {
  details: {
    roleName: 'Operations Project Manager',
    location: 'Hyderabad, India',
    employmentType: 'Full Time',
    positionStatus: 'Mid-Level',
    category: 'Project Management',
    createdAt: '2026-06-10T07:23:15.918Z',
    jobDescription: {
      roleDescription: '<p>Drive operational excellence with AI-enabled automation.</p>',
      keyRequirements:
        '<div><li>Manage cross-functional delivery plans.</li></div>',
      mandatorySkills:
        '<div><li>Project Management</li></div>',
      goodToHaveSkills:
        '<ul><li>Finance and legal operations experience.</li></ul>',
      placement: [
        'roleDescription',
        'keyRequirements',
        'mandatorySkills',
        'goodToHaveSkills',
      ],
    },
    skills: {
      foundationalSkills: ['Project Management'],
      behaviouralSkills: ['Ownership'],
      goals: [],
      advancedSkills: ['Change Management'],
    },
  },
}

test('Techolution constants and URL builders stay pinned to the official careers, detail, and apply surfaces', async () => {
  const techolution = await loadTecholutionModule()

  assert.equal(techolution.CAREERS_PAGE_URL, 'https://www.techolution.com/careers/')
  assert.equal(techolution.LISTING_API_URL, 'https://hire.techolution.com/backend/Roles/careers')
  assert.equal(
    techolution.buildDetailApiUrl('a05e1fcd-da75-452c-a045-ae3ac8ff441f'),
    'https://hire.techolution.com/backend/Roles/jobData?id=a05e1fcd-da75-452c-a045-ae3ac8ff441f',
  )
  assert.equal(
    techolution.buildApplyUrl('a05e1fcd-da75-452c-a045-ae3ac8ff441f'),
    'https://hire.techolution.com/video-resume?role=a05e1fcd-da75-452c-a045-ae3ac8ff441f',
  )
  assert.equal(typeof techolution.extractIndiaJobs, 'function')
  assert.equal(typeof techolution.extractJobDetail, 'function')
  assert.equal(typeof techolution.createTecholutionScraper, 'function')
  assert.equal(typeof techolution.run, 'function')
})

test('extractIndiaJobs flattens Techolution category roles and carries category into department', async () => {
  const techolution = await loadTecholutionModule()
  const jobs = techolution.extractIndiaJobs(listingPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Project Manager - Presales & GTM',
    company: 'Techolution',
    department: 'Sales and Marketing',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'a05e1fcd-da75-452c-a045-ae3ac8ff441f',
    requisitionId: 'a05e1fcd-da75-452c-a045-ae3ac8ff441f',
    sourceUrl: 'https://hire.techolution.com/video-resume?role=a05e1fcd-da75-452c-a045-ae3ac8ff441f',
    applyUrl: 'https://hire.techolution.com/video-resume?role=a05e1fcd-da75-452c-a045-ae3ac8ff441f',
    employmentType: 'Full-time',
    experienceRequired: 'Mid-Level',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Cost Analysis',
      'Financial Planning',
      'Proposals',
    ],
    postingDate: '2026-04-02',
    closingDate: null,
    jobDescription: 'Translate complex business requirements into client-ready technical proposals.',
    publicExperienceChecked: true,
  })
  assert.equal(jobs[1].department, 'Project Management')
  assert.equal(jobs[1].title, 'Operations Project Manager')
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('extractJobDetail merges the Techolution detail payload into the shared job shape', async () => {
  const techolution = await loadTecholutionModule()
  const [listingJob] = techolution.extractIndiaJobs(listingPayload)
  const detail = techolution.extractJobDetail(technicalProjectManagerDetail, listingJob)

  assert.equal(detail.title, 'Technical Project Manager - Presales & GTM')
  assert.equal(detail.department, 'Sales and Marketing')
  assert.equal(detail.location, 'Hyderabad, India (Hybrid)')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.jobId, 'a05e1fcd-da75-452c-a045-ae3ac8ff441f')
  assert.equal(detail.applyUrl, listingJob.applyUrl)
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, 'Mid-Level')
  assert.deepEqual(detail.requiredSkills, [
    'Cost Analysis',
    'Financial Planning',
    'Proposals',
  ])
  assert.equal(detail.postingDate, '2026-04-02')
  assert.match(detail.jobDescription, /client-ready technical proposals/i)
  assert.match(detail.jobDescription, /Create detailed work breakdown structures/i)
  assert.match(detail.jobDescription, /Google Cloud Platform and Gemini experience/i)
  assert.equal(detail.publicExperienceChecked, true)
})

test('run fetches the Techolution listing and detail APIs, then decorates India jobs', async () => {
  const techolution = await loadTecholutionModule()
  const requests = []

  const jobs = await techolution.createTecholutionScraper({ maxJobs: 2 }).run({
    fetchJson: async (url) => {
      requests.push(url)

      if (url === techolution.LISTING_API_URL) return listingPayload
      if (url === techolution.buildDetailApiUrl('a05e1fcd-da75-452c-a045-ae3ac8ff441f')) {
        return technicalProjectManagerDetail
      }
      if (url === techolution.buildDetailApiUrl('e1e19ce2-c051-4cec-b9cb-2a76665905ec')) {
        return operationsProjectManagerDetail
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    techolution.LISTING_API_URL,
    techolution.buildDetailApiUrl('a05e1fcd-da75-452c-a045-ae3ac8ff441f'),
    techolution.buildDetailApiUrl('e1e19ce2-c051-4cec-b9cb-2a76665905ec'),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'techolution')
  assert.equal(jobs[0].company, 'Techolution')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
  assert.equal(jobs[1].department, 'Project Management')
  assert.equal(jobs[1].location, 'Hyderabad, India')
  assert.equal(jobs[1].publicExperienceChecked, true)
})
