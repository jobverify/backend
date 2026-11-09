import assert from 'node:assert/strict'
import test from 'node:test'

const loadAmmachiModule = async () => {
  try {
    return await import('../../scraper/ammachilabs/script.js')
  } catch {
    return null
  }
}

test('extractSearchResults maps the Ammachi Labs WordPress jobs API into shared scraper fields', async () => {
  const ammachi = await loadAmmachiModule()
  assert.ok(ammachi)

  const jobs = ammachi.extractSearchResults([
    {
      id: 58601,
      link: 'https://ammachilabs.org/job/field-investigator/',
      date_gmt: '2026-05-26T04:41:14',
      title: { rendered: 'Field Investigator' },
      position_title: 'Field Investigator in Wayanad district, Kerala',
      position_employment_type: ['FULL_TIME'],
      position_job_location: '',
      position_description: '<p>Lead community eye-care programs.</p>',
      position_responsibilities: '<ul><li>Coordinate field visits</li></ul>',
      position_qualifications: '<ul><li>BSW/MSW preferred</li></ul>',
    },
    {
      id: 58602,
      link: 'https://ammachilabs.org/job/remote-learning-designer/',
      date_gmt: '2026-05-20T06:00:00',
      title: { rendered: 'Remote Learning Designer' },
      position_title: 'Remote Learning Designer',
      position_employment_type: ['CONTRACTOR'],
      position_job_location: 'Remote, India',
      position_description: '<p>Create digital learning experiences.</p>',
      position_responsibilities: '<ul><li>Collaborate with content teams</li></ul>',
      position_qualifications: '<ul><li>Instructional design experience</li></ul>',
    },
    {
      id: 58603,
      link: 'https://ammachilabs.org/job/researcher-in-virtual-reality/123',
      date_gmt: '2026-05-18T06:00:00',
      title: { rendered: 'Researcher in Virtual Reality' },
      position_title: 'Researcher in Virtual Reality, Augmented Reality, and Simulation-Based Learning',
      position_employment_type: ['FULL_TIME'],
      position_job_location: '',
      position_description: '<p>Research technology-enhanced learning.</p>',
      position_responsibilities: '',
      position_qualifications: '',
    },
  ])

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Field Investigator in Wayanad district, Kerala',
    company: 'Ammachi Labs',
    department: null,
    location: 'Wayanad district, Kerala',
    city: 'Wayanad district',
    country: null,
    jobId: '58601',
    requisitionId: null,
    sourceUrl: 'https://ammachilabs.org/job/field-investigator/',
    applyUrl: 'https://ammachilabs.org/job/field-investigator/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-26T04:41:14.000Z',
    closingDate: null,
    jobDescription: 'Lead community eye-care programs. Responsibilities Coordinate field visits Qualifications BSW/MSW preferred',
    remoteStatus: null,
  })
  assert.equal(jobs[1].title, 'Remote Learning Designer')
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(jobs[1].employmentType, 'Contract')
  assert.equal(jobs[2].location, null)
  assert.equal(jobs[2].city, null)
  assert.equal(jobs[2].remoteStatus, null)
})

import {nativeFixture} from '../../scraper/alohatechnology/nativeFixture.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
test('run reads current native archive, authoritative API and all full details before returning lab-scoped candidates',async()=>{
 const source=await loadAmmachiModule(),fixture=nativeFixture(new URL('../../scraper/ammachilabs/x.js',import.meta.url)),calls=[],reports=[]
 const jobs=await source.run({fetchPage:async u=>{calls.push(u);return fixture.fetchPage(u)},onAudit:r=>reports.push(r)})
 assert.equal(source.buildSearchUrl(),source.JOBS_API_URL);assert.equal(calls.filter(u=>u===source.JOBS_API_URL).length,2)
 assert.equal(jobs.length,22);assert.equal(readSourceObservationEvidence(jobs,'ammachilabs').observedVacancyCount,23)
 assert.equal(reports[0].scopeGapRecords[0].jobId,'26893');assert.match(reports[0].scopeGapRecords[0].nativeEmployerName,/CWEGE/)
 assert.ok(jobs.every(j=>j.source==='ammachilabs'&&j.requisitionId===null&&j.country===null&&j.sourceDetailComplete))
})
