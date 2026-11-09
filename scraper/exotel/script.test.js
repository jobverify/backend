import test from 'node:test'
import assert from 'node:assert/strict'

import { extractSearchResults } from './script.js'

test('uses the hosted Recruiterbox application form for an opening', () => {
  const [job] = extractSearchResults([{
    id: 700106,
    hash_id: 'fk0z7wh',
    title: 'Software Engineer - 2',
    company_name: 'Exotel Techcom Pvt Ltd',
    team: 'Other',
    position_type: 'Full-time',
    location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
    description: 'Build reliable systems.',
  }])

  assert.equal(job.sourceUrl, 'https://app.recruiterbox.com/widget/2176/opening/700106/')
  assert.equal(job.applyUrl, 'https://exotel.hire.trakstar.com/jobs/fk0z7wh/?apply=true')
})
