import assert from 'node:assert/strict'
import test from 'node:test'

const loadDhanalaxmiBankModule = async () => {
  try {
    return await import('../../scraper/dhanalaxmibank/script.js')
  } catch {
    assert.fail('Expected Dhanalaxmi Bank scraper module at ../../scraper/scraper/dhanalaxmibank/script.js')
  }
}

const careersPayload = {
  success: true,
  careers: [
    {
      id: 1061,
      title: 'Information Security Group',
      pdfFile: '/pdf/Advertisement-for-recruitment-to-ISG-20.06.2026.pdf',
      description: '&lt;p>Recruitment for Information Security Group&lt;/p>',
      status: 1,
      applyForm: 1,
      lastDate: null,
      createdAt: '2026-02-13T12:26:19.224Z',
      updatedAt: '2026-06-20T12:43:25.798Z',
    },
  ],
}

test('run converts Dhanalaxmi Bank official careers API records into normalized jobs', async () => {
  const { createDhanalaxmiBankScraper } = await loadDhanalaxmiBankModule()
  const requestedUrls = []
  const scraper = createDhanalaxmiBankScraper()

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return careersPayload
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.dhan.bank.in/api/careers/'])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Information Security Group',
    company: 'Dhanalaxmi Bank',
    department: 'Information Security Group',
    location: 'India',
    city: null,
    country: 'India',
    jobId: '1061',
    requisitionId: '1061',
    sourceUrl: 'https://www.dhan.bank.in/careers/',
    applyUrl: 'https://www.dhan.bank.in/cv?post=1061',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-02-13T12:26:19.224Z',
    closingDate: null,
    jobDescription: 'Recruitment for Information Security Group',
    attachmentUrl: 'https://www.dhan.bank.in/pdf/Advertisement-for-recruitment-to-ISG-20.06.2026.pdf',
    source: 'dhanalaxmibank',
    link: 'https://www.dhan.bank.in/cv?post=1061',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
