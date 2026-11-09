import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  CAREERS_API_URL,
  createNetworkIntelligenceScraper,
} from '../../scraper/networkintelligence/script.js'

const careersPageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <h1>Join Our Elite Cyber security Community!</h1>
    <h2>Current Opening</h2>

    <div class="opening">
      <h3>CyberArk Engineer Full-Time</h3>
      <p>Job Code: CYA001</p>
      <p>Location: Gurugram</p>
      <p>Experience: 2+ years</p>
    </div>

    <div class="opening">
      <h3>OT Security Full-Time</h3>
      <p>Job Code: OT001</p>
      <p>Location: Pune</p>
      <p>Experience: 3+ years</p>
    </div>

    <div class="opening">
      <h3>US Security Consultant Full-Time</h3>
      <p>Job Code: US001</p>
      <p>Location: Austin, Texas, United States</p>
      <p>Experience: 5+ years</p>
    </div>
  </body>
</html>
`

const careersApiPayload = [
  {
    id: 101,
    date: '2026-06-10T00:00:00',
    slug: 'cyberark-engineer',
    link: 'https://www.networkintelligence.ai/careers/cyberark-engineer/',
    title: { rendered: 'CyberArk Engineer' },
    content: {
      rendered:
        '<p>Deploy and manage CyberArk solutions to secure privileged access.</p>',
    },
  },
  {
    id: 102,
    date: '2026-06-11T00:00:00',
    slug: 'ot-security',
    link: 'https://www.networkintelligence.ai/careers/ot-security/',
    title: { rendered: 'OT Security' },
    content: {
      rendered:
        '<p>Hiring for an in-office OT Security role in Pune.</p>',
    },
  },
  {
    id: 103,
    date: '2026-06-12T00:00:00',
    slug: 'us-security-consultant',
    link: 'https://www.networkintelligence.ai/careers/us-security-consultant/',
    title: { rendered: 'US Security Consultant' },
    content: {
      rendered:
        '<p>Support North America delivery programs.</p>',
    },
  },
]

const otSecurityDetailHtml = `
<!DOCTYPE html>
<html>
  <body>
    <h1>OT Security</h1>
    <ul>
      <li>Hiring for an in-office OT Security role in Pune with 3-8 years' experience.</li>
      <li>LinkedIn Easy Apply - https://www.linkedin.com/jobs/view/4297744093</li>
    </ul>
  </body>
</html>
`

const cyberArkDetailHtml = `
<!DOCTYPE html>
<html>
  <body>
    <h1>CyberArk Engineer</h1>
    <p>Deploy and manage CyberArk solutions to secure privileged access.</p>
  </body>
</html>
`

test('run merges the Network Intelligence careers page with WP jobs, keeps India roles, and preserves explicit apply links', async () => {
  const requestedTexts = []
  const requestedJson = []

  const jobs = await createNetworkIntelligenceScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === CAREERS_PAGE_URL) return careersPageHtml
      if (url === 'https://www.networkintelligence.ai/careers/cyberark-engineer/') {
        return cyberArkDetailHtml
      }
      if (url === 'https://www.networkintelligence.ai/careers/ot-security/') {
        return otSecurityDetailHtml
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === CAREERS_API_URL) return careersApiPayload

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [
    CAREERS_PAGE_URL,
    'https://www.networkintelligence.ai/careers/cyberark-engineer/',
    'https://www.networkintelligence.ai/careers/ot-security/',
  ])
  assert.deepEqual(requestedJson, [CAREERS_API_URL])

  assert.deepEqual(jobs, [
    {
      title: 'CyberArk Engineer',
      company: 'Network Intelligence',
      department: null,
      location: 'Gurugram, India',
      city: 'Gurugram',
      state: null,
      country: 'India',
      jobId: '101',
      requisitionId: 'CYA001',
      sourceUrl: 'https://www.networkintelligence.ai/careers/cyberark-engineer/',
      applyUrl: 'https://www.networkintelligence.ai/careers/cyberark-engineer/',
      employmentType: 'Full-time',
      experienceRequired: '2+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-10',
      closingDate: null,
      jobDescription: 'Deploy and manage CyberArk solutions to secure privileged access.',
      remoteStatus: 'On-site',
      source: 'networkintelligence',
      link: 'https://www.networkintelligence.ai/careers/cyberark-engineer/',
      scrapedAt: '2026-07-09T00:00:00.000Z',
    },
    {
      title: 'OT Security',
      company: 'Network Intelligence',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      state: null,
      country: 'India',
      jobId: '102',
      requisitionId: 'OT001',
      sourceUrl: 'https://www.networkintelligence.ai/careers/ot-security/',
      applyUrl: 'https://www.linkedin.com/jobs/view/4297744093',
      employmentType: 'Full-time',
      experienceRequired: '3+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-11',
      closingDate: null,
      jobDescription: "Hiring for an in-office OT Security role in Pune with 3-8 years' experience. LinkedIn Easy Apply - https://www.linkedin.com/jobs/view/4297744093",
      remoteStatus: 'On-site',
      source: 'networkintelligence',
      link: 'https://www.linkedin.com/jobs/view/4297744093',
      scrapedAt: '2026-07-09T00:00:00.000Z',
    },
  ])
})
