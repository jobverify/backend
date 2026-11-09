import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { extractJobs } from '../../scraper/ihubrobotics/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'ihubrobotics',
)

test('extractJobs marks verified iHUB Robotics API jobs as public experience checked', () => {
  const payload = JSON.parse(readFileSync(path.join(fixturesDir, 'job-positions.json'), 'utf8'))
  const jobs = extractJobs(payload)

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Digital Marketer')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].experienceRequired, null)
  assert.deepEqual(jobs[0].requiredSkills, [
    'Experience in digital marketing',
    'Knowledge of SEO, SEM, and social media marketing',
  ])
})
