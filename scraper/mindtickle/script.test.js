import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  LEVER_API_URL,
  createMindTickleScraper,
  hasVerifiedAboutPageSignal,
} from './script.js'

const currentAboutHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>About Us: Empowering Revenue Teams Globally | Mindtickle</title>
    </head>
    <body>
      <main>
        <section>
          <img alt="We thrive on creating impact for our customers. Our people matter most." />
          <p>See what opportunities are open at Mindtickle</p>
          <a href="https://jobs.lever.co/mindtickle">Join the team</a>
          <a href="https://jobs.lever.co/mindtickle">View open opportunities</a>
        </section>
      </main>
    </body>
  </html>
`

const leverPayload = [
  {
    id: 'india-role-1',
    text: 'Senior Solutions Engineer',
    hostedUrl: 'https://jobs.lever.co/mindtickle/india-role-1',
    applyUrl: 'https://jobs.lever.co/mindtickle/india-role-1/apply',
    createdAt: 1761955200000,
    workplaceType: 'HYBRID',
    descriptionPlain: 'Help enterprise customers deploy revenue enablement workflows.',
    openingPlain: 'Own pre-sales discovery and solution design.',
    additionalPlain: 'Experience with SaaS is preferred.',
    categories: {
      location: 'Pune, India',
      department: 'Solutions Engineering',
      commitment: 'Full-time',
      allLocations: ['Pune, India'],
    },
  },
  {
    id: 'us-role-1',
    text: 'Account Executive',
    hostedUrl: 'https://jobs.lever.co/mindtickle/us-role-1',
    applyUrl: 'https://jobs.lever.co/mindtickle/us-role-1/apply',
    createdAt: 1761955200000,
    workplaceType: 'REMOTE',
    categories: {
      location: 'San Francisco, United States',
      department: 'Sales',
      commitment: 'Full-time',
      allLocations: ['San Francisco, United States'],
    },
  },
]

test('MindTickle accepts the current about page careers handoff', () => {
  assert.equal(hasVerifiedAboutPageSignal(currentAboutHtml), true)
})

test('MindTickle validates the current about page before normalizing India Lever jobs', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createMindTickleScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return currentAboutHtml
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return leverPayload
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [ABOUT_URL])
  assert.deepEqual(requestedJsonUrls, [LEVER_API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Solutions Engineer',
      company: 'MindTickle',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      link: 'https://jobs.lever.co/mindtickle/india-role-1',
      applyUrl: 'https://jobs.lever.co/mindtickle/india-role-1/apply',
      sourceUrl: 'https://jobs.lever.co/mindtickle/india-role-1',
      source: 'mindtickle',
      jobId: 'india-role-1',
      requisitionId: 'india-role-1',
      department: 'Solutions Engineering',
      employmentType: 'Full-time',
      experienceRequired: null,
      jobDescription: [
        'Help enterprise customers deploy revenue enablement workflows.',
        'Own pre-sales discovery and solution design.',
        'Experience with SaaS is preferred.',
      ].join('\n\n'),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-11-01T00:00:00.000Z',
      remoteStatus: 'Hybrid',
      scrapedAt: '2026-08-01T00:00:00.000Z',
    },
  ])
})
