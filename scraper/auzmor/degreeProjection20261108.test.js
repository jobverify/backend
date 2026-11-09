import test from 'node:test'
import assert from 'node:assert/strict'
import { readCurrentJobs } from './nativeJobs.js'

const API = 'https://hire.api.auzmor.com/api/v1/'
const description = 'The publisher describes the complete responsibilities and working conditions for this role. '.repeat(8).trim()
const educationType = 'Native qualification category'
const location = { uuid: 'b'.repeat(32), name: 'Hyderabad, India' }
const department = { uuid: 'c'.repeat(32), name: 'Engineering' }

async function read(overrides = {}) {
  const job = { uuid: 'd'.repeat(32), title: 'Synthetic engineering role',
    state: 'PUBLISHED', status: 'OPEN', publishType: 'External',
    location, department, isRemote: false, employmentTypes: ['Full-time'],
    publishedDate: '2026-11-01T00:00:00.000Z', closedDate: null,
    description: '<p>' + description + '</p>',
    educationQualificationType: educationType, degree: null, ...overrides }
  const calls = []
  const fetchPage = async url => {
    calls.push(url)
    let body
    if (url === API + 'organization/domain/auzmor') {
      body = { uuid: 'a'.repeat(32), name: 'Auzmor', domain: 'auzmor', url: 'auzmor.com' }
    } else if (url === API + 'careers/auzmor/filters') {
      body = { departments: [{ uuid: department.uuid, count: 1 }], locations: [{ uuid: location.uuid, count: 1 }] }
    } else if (url === API + 'careers/auzmor/groupByDepartment?limit=100&offset=0') {
      body = { data: [{ department, count: 1, jobs: [job] }],
        pagination: { totalItems: 1, filterItems: 1, offset: 0, limit: 100 } }
    } else if (url === API + 'getJob/auzmor/' + job.uuid) {
      body = { job, location }
    } else assert.fail('Unexpected synthetic native read: ' + url)
    return { status: 200, url, html: JSON.stringify(body) }
  }
  const jobs = await readCurrentJobs({ fetchPage, now: () => '2026-11-08T00:00:00.000Z' })
  assert.equal(calls.filter(url => url.endsWith('/filters')).length, 2)
  assert.equal(calls.filter(url => url.includes('/groupByDepartment?')).length, 2)
  assert.equal(jobs.length, 1)
  return jobs[0]
}

test('preserves a distinct native degree alongside its separate qualification category and full description', async () => {
  const degree = "Bachelor's degree in a native discipline, or equivalent"
  const job = await read({ degree })
  assert.equal(job.minimumQualification, educationType)
  assert.equal(job.preferredQualification, null)
  assert.equal(job.jobDescription, description + '\n\nDegree: ' + degree)
})

test('preserves a native degree when the publisher supplies no qualification category', async () => {
  const job = await read({ degree: 'Native degree text', educationQualificationType: null })
  assert.equal(job.minimumQualification, null)
  assert.equal(job.jobDescription, description + '\n\nDegree: Native degree text')
})

test('keeps the original description for missing or blank native degrees', async () => {
  for (const degree of [null, undefined, '', ' \t\n ']) {
    const job = await read({ degree })
    assert.equal(job.jobDescription, description)
    assert.equal(job.minimumQualification, educationType)
  }
})

test('refuses an unreviewed structured degree instead of silently dropping or stringifying it', async () => {
  for (const degree of [{ name: 'Unknown shape' }, ['Unknown shape'], 1, true]) {
    await assert.rejects(read({ degree }), /Auzmor native degree/i)
  }
})

test('a degree cannot replace missing native role description content', async () => {
  await assert.rejects(read({ degree: 'Native degree text', description: '<p><br></p>' }), /full description/i)
})
