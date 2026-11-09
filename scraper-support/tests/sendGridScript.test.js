import assert from 'node:assert/strict'
import test from 'node:test'

const loadSendGridModule = async () => import('../../scraper/sendgrid/script.js')

test('SendGrid keeps only explicit SendGrid roles from the official Twilio jobs API', async () => {
  const sendgrid = await loadSendGridModule()
  const requests = []

  const jobs = await sendgrid.createSendGridScraper({
    now: () => '2026-07-25T00:00:00.000Z',
  }).run({
    fetchJson: async (url) => {
      requests.push(url)

      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 1099554087438,
                displayJobId: '50610',
                name: 'Software Engineer L3',
                locations: ['Remote - India'],
                department: 'Engineering',
              },
              {
                id: 1099553530264,
                displayJobId: '50533',
                name: 'Technical Support Engineer 2',
                locations: ['Remote - India'],
                department: 'Customer Support',
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=1099554087438')) {
        return {
          data: {
            publicUrl: 'https://jobs.twilio.com/careers/job/1099554087438',
            efcustomTextPostDate: ['2026-06-22'],
            jobDescription: '<p>This role is a critical engineering role within Twilio SendGrid.</p>',
          },
        }
      }

      if (url.includes('position_id=1099553530264')) {
        return {
          data: {
            publicUrl: 'https://jobs.twilio.com/careers/job/1099553530264',
            efcustomTextPostDate: ['2026-06-03'],
            jobDescription: '<p>Join our Email Infra support team for EMEA customers.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(sendgrid.SOURCE, 'sendgrid')
  assert.equal(sendgrid.COMPANY, 'SendGrid')
  assert.equal(sendgrid.VERIFIED_ON, '2026-07-25')
  assert.equal(sendgrid.isExplicitSendGridRole('<p>Twilio SendGrid platform</p>'), true)
  assert.equal(sendgrid.isExplicitSendGridRole('<p>Email Infra only</p>'), false)
  assert.equal(new URL(requests[0]).searchParams.get('query'), 'SendGrid')
  assert.equal(new URL(requests[0]).searchParams.get('location'), 'India')
  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer L3',
      company: 'SendGrid',
      location: 'Remote - India',
      city: 'Remote',
      country: 'India',
      link: 'https://jobs.twilio.com/careers/job/1099554087438',
      applyUrl: 'https://jobs.twilio.com/careers/job/1099554087438',
      sourceUrl: 'https://jobs.twilio.com/careers/job/1099554087438',
      source: 'sendgrid',
      jobId: 1099554087438,
      requisitionId: '50610',
      department: 'Engineering',
      employmentType: null,
      experienceRequired: null,
      postingDate: '2026-06-22',
      jobDescription: '<p>This role is a critical engineering role within Twilio SendGrid.</p>',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'Remote',
      scrapedAt: '2026-07-25T00:00:00.000Z',
    },
  ])
})

test('SendGrid fails closed when the Twilio jobs API contract drifts', async () => {
  const sendgrid = await loadSendGridModule()

  await assert.rejects(
    sendgrid.createSendGridScraper().run({
      fetchJson: async () => ({ data: { count: 1 } }),
    }),
    /data\.positions|contract/i,
  )
})
