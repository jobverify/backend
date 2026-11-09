import assert from 'node:assert/strict'
import test from 'node:test'

const loadSegmentModule = async () => import('../../scraper/segment/script.js')

test('Segment keeps only explicit Twilio Segment roles from the official Twilio jobs API', async () => {
  const segment = await loadSegmentModule()
  const requests = []

  const jobs = await segment.createSegmentScraper({
    now: () => '2026-07-25T00:00:00.000Z',
  }).run({
    fetchJson: async (url) => {
      requests.push(url)

      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 1099557996770,
                displayJobId: '7996770',
                name: 'Staff Software Engineer (L4)',
                locations: ['Remote - India'],
                department: 'Engineering',
              },
              {
                id: 1099558001804,
                displayJobId: '8001804',
                name: 'Senior Engineering Manager (L5)',
                locations: ['Remote - India'],
                department: 'Engineering',
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=1099557996770')) {
        return {
          data: {
            publicUrl: 'https://jobs.twilio.com/careers/job/1099557996770',
            efcustomTextPostDate: ['2026-07-22'],
            jobDescription: '<p>Join the Twilio Segment Data platform and pipelines team.</p>',
          },
        }
      }

      if (url.includes('position_id=1099558001804')) {
        return {
          data: {
            publicUrl: 'https://jobs.twilio.com/careers/job/1099558001804',
            efcustomTextPostDate: ['2026-07-22'],
            jobDescription: '<p>Lead engineering across Twilio data platform teams.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(segment.SOURCE, 'segment')
  assert.equal(segment.COMPANY, 'Segment')
  assert.equal(segment.OFFICIAL_BRAND_NAME, 'Twilio Segment')
  assert.equal(segment.VERIFIED_ON, '2026-07-25')
  assert.equal(segment.isExplicitSegmentRole('<p>Twilio Segment platform</p>'), true)
  assert.equal(segment.isExplicitSegmentRole('<p>Twilio data platform</p>'), false)
  assert.equal(new URL(requests[0]).searchParams.get('query'), 'Segment')
  assert.equal(new URL(requests[0]).searchParams.get('location'), 'India')
  assert.deepEqual(jobs, [
    {
      title: 'Staff Software Engineer (L4)',
      company: 'Segment',
      location: 'Remote - India',
      city: 'Remote',
      country: 'India',
      link: 'https://jobs.twilio.com/careers/job/1099557996770',
      applyUrl: 'https://jobs.twilio.com/careers/job/1099557996770',
      sourceUrl: 'https://jobs.twilio.com/careers/job/1099557996770',
      source: 'segment',
      jobId: 1099557996770,
      requisitionId: '7996770',
      department: 'Engineering',
      employmentType: null,
      experienceRequired: null,
      postingDate: '2026-07-22',
      jobDescription: '<p>Join the Twilio Segment Data platform and pipelines team.</p>',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'Remote',
      scrapedAt: '2026-07-25T00:00:00.000Z',
    },
  ])
})

test('Segment fails closed when the Twilio jobs API contract drifts', async () => {
  const segment = await loadSegmentModule()

  await assert.rejects(
    segment.createSegmentScraper().run({
      fetchJson: async () => ({ data: { count: 1 } }),
    }),
    /data\.positions|contract/i,
  )
})
