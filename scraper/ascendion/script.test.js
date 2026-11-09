import assert from 'node:assert/strict'
import test from 'node:test'
import { readCaptureBody } from './native-captures/readFixture.js'
const official = async url => {
  const label = url.includes('/who-we-are/careers/') ? 'corporate' : url.includes('/gen/js/') ? 'protocol' : 'careers'
  return readCaptureBody('2026-11-05', `${label}.body.gz`).toString()
}

import {
  buildDetailUrl,
  buildSearchUrl,
  createAscendionScraper,
  extractSearchResults,
} from './script.js'

test('ascendion unwraps nested detail payloads and extracts experience from the job detail content', () => {
  const jobs = extractSearchResults({
    data: {
      positions: [{
        id: '1970324837411069',
        name: 'Java Backend Engineer',
        locations: ['India'],
        postedTs: 1785501259,
        workLocationOption: 'remote_local',
      }],
    },
  }, {
    detailPayloadById: {
      1970324837411069: {
        status: 'success',
        data: {
          displayJobId: 'REQ-1001',
          name: 'Java Backend Engineer',
          locations: ['India'],
          jobDescription: [
            '<div><strong>Minimum Qualifications:</strong></div>',
            '<ul>',
            '<li>Bachelor\'s degree in Computer Science or a related field.</li>',
            '<li>8+ years of experience in Java, Spring Boot, and microservices.</li>',
            '</ul>',
          ].join(''),
          jdHighlight: [
            'Bachelor\'s degree in Computer Science or a related field.',
            '8+ years of experience in Java, Spring Boot, and microservices.',
          ],
        },
      },
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, 'REQ-1001')
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].employmentType, 'Remote Local')
  assert.equal(jobs[0].minimumQualification, 'Bachelor\'s degree in Computer Science or a related field.')
  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.match(jobs[0].jobDescription, /8\+ years of experience in Java, Spring Boot, and microservices\./)
})

test('ascendion scraper hydrates search results with detail payloads before returning jobs', async () => {
  const calls = []
  const jobs = await createAscendionScraper({
    pageSize: 10,
  }).run({
    fetchText: official,
    fetchJson: async (url) => {
      calls.push(url)

      if (url === buildSearchUrl({ start: 1 })) return { status: 200, data: { count: 1, positions: [] } }
      if (url === buildSearchUrl({ start: 0 })) {
        return {
          status: 200,
          data: {
            count: 1,
            positions: [{
              id: '1970324837464309',
              name: 'PLM Architect',
              displayJobId: 'REQ-2002',
              positionUrl: '/careers/job/1970324837464309',
              locations: ['India'],
              postedTs: 1785501259,
              workLocationOption: 'remote_local',
            }],
          },
        }
      }

      if (url === buildDetailUrl('1970324837464309')) {
        return {
          status: 200,
          data: {
            id: '1970324837464309',
            positionUrl: '/careers/job/1970324837464309',
            publicUrl: 'https://jobs.ascendion.com/careers/job/1970324837464309',
            displayJobId: 'REQ-2002',
            name: 'PLM Architect',
            locations: ['India'],
            jobDescription: [
              '<div><strong>About the role</strong></div>',
              '<div>Lead the design of enterprise PLM solutions.</div>',
              '<div><strong>Minimum Qualifications:</strong></div>',
              '<ul><li>8+ years of experience in Product Lifecycle Management (PLM).</li></ul>',
            ].join(''),
            jdHighlight: [
              '8+ years of experience in Product Lifecycle Management (PLM).',
            ],
          },
        }
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.equal(calls.length, 5)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '1970324837464309')
  assert.equal(jobs[0].requisitionId, 'REQ-2002')
  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.match(jobs[0].jobDescription, /Lead the design of enterprise PLM solutions\./)
  assert.match(jobs[0].link, /1970324837464309$/)
})
