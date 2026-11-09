import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { saveToFile } from '../utils/saveToDB.js'

test('saveToFile preserves mailto apply routes for dry-run snapshots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-to-file-mailto-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  saveToFile([
    {
      title: 'Embedded Engineer',
      company: 'Example Co',
      location: 'Bengaluru, India',
      country: 'India',
      source: 'exampleco',
      applyUrl: 'mailto:careers@example.com',
      link: 'mailto:careers@example.com',
      sourceUrl: 'https://example.com/careers',
    },
  ], outputPath)

  const jobs = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, 'mailto:careers@example.com')
  assert.equal(jobs[0].link, 'mailto:careers@example.com')
  assert.equal(jobs[0].sourceUrl, 'https://example.com/careers')
})

test('saveToFile keeps normalized http apply routes unchanged', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-to-file-http-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  saveToFile([
    {
      title: 'Embedded Engineer',
      company: 'Example Co',
      location: 'Bengaluru, India',
      country: 'India',
      source: 'exampleco',
      applyUrl: 'https://example.com/jobs/123',
      link: 'https://example.com/jobs/123',
      sourceUrl: 'https://example.com/jobs/123',
    },
  ], outputPath)

  const jobs = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, 'https://example.com/jobs/123')
  assert.equal(jobs[0].link, 'https://example.com/jobs/123')
})
