import assert from 'node:assert/strict'
import test from 'node:test'

const loadCognidaModule = async () => {
  try {
    return await import('../../scraper/cognida/script.js')
  } catch {
    return null
  }
}

test('extractSearchResults maps Cognida Keka jobs and excludes non-India roles', async () => {
  const cognida = await loadCognidaModule()
  assert.ok(cognida, 'Cognida scraper module must exist')

  const jobs = cognida.extractSearchResults([
    {
      id: 75581,
      title: 'AI Solutions Architect',
      description: '<div>Deliver practical AI solutions for enterprise teams.</div>',
      departmentName: 'AI - AI Solutions',
      jobLocations: [
        {
          name: 'Hyderabad',
          city: 'Hyderabad',
          state: 'TG',
          countryCode: 'IN',
          countryName: 'India',
        },
      ],
      jobType: 2,
      experience: '14',
      jobNumber: '1197',
      salaryRangeFormat: '',
      publishedOn: '2026-06-12T10:41:59.053Z',
      skillNames: ['Python', 'Databricks'],
    },
    {
      id: 75096,
      title: 'AI Solution Architect',
      description: '<div>Support United States customers.</div>',
      departmentName: 'AI - AI Solutions',
      jobLocations: [
        {
          name: 'IL',
          city: 'Lincolnshire',
          state: 'IL',
          countryCode: 'US',
          countryName: 'United States',
        },
      ],
      jobType: 2,
      experience: '14',
      jobNumber: '1196',
      publishedOn: '2026-06-10T16:14:35.917Z',
      skillNames: [],
    },
  ], {
    kekaDomain: 'https://cognida.keka.com/careers/',
  })

  assert.deepEqual(jobs, [
    {
      title: 'AI Solutions Architect',
      company: 'Cognida.ai',
      department: 'AI - AI Solutions',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '75581',
      requisitionId: '1197',
      sourceUrl: 'https://cognida.keka.com/careers/jobdetails/75581',
      applyUrl: 'https://cognida.keka.com/careers/jobdetails/75581',
      employmentType: 'Full Time',
      experienceRequired: '14',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Python', 'Databricks'],
      postingDate: '2026-06-12',
      closingDate: null,
      jobDescription: 'Deliver practical AI solutions for enterprise teams.',
      remoteStatus: 'On-site',
      compensation: null,
    },
  ])
})

test('run fetches Cognida public careers markup and Keka active jobs', async () => {
  const cognida = await loadCognidaModule()
  assert.ok(cognida, 'Cognida scraper module must exist')

  const jobs = await cognida.createCognidaScraper().run({
    fetchText: async (url) => {
      assert.equal(url, cognida.CAREER_PAGE_URL)
      return "<script>window.khConfig = { identifier: '22612058-82aa-4bfd-9017-771ca36cd0e3', domain: 'https://cognida.keka.com/careers/', targetContainer: '#khembedjobs' }</script>"
    },
    fetchJson: async (url) => {
      assert.equal(url, 'https://cognida.keka.com/careers/api/embedjobs/default/active/22612058-82aa-4bfd-9017-771ca36cd0e3')
      return [{
        id: 75581,
        title: 'AI Solutions Architect',
        description: '<div>Deliver practical AI solutions.</div>',
        departmentName: 'AI - AI Solutions',
        jobLocations: [{ name: 'Hyderabad', city: 'Hyderabad', countryCode: 'IN', countryName: 'India' }],
        jobType: 2,
        experience: '14',
        jobNumber: '1197',
        publishedOn: '2026-06-12T10:41:59.053Z',
        skillNames: [],
      }]
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cognida')
  assert.equal(jobs[0].link, 'https://cognida.keka.com/careers/jobdetails/75581')
  assert.equal(jobs[0].company, 'Cognida.ai')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
