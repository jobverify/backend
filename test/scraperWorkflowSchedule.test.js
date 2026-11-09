import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readScraperWorkflow = () => readFileSync(
  path.join(repoRoot, '.github/workflows/scraper.yml'),
  'utf8',
).replace(/\r\n/g, '\n')

test('scraper workflow uses backend dispatch instead of GitHub cron', () => {
  assert.doesNotMatch(readScraperWorkflow(), /^  schedule:/m)
  assert.match(readScraperWorkflow(), /^  workflow_dispatch:/m)
})

test('scheduled no-op checks skip scraping, checkpoints, artifacts and reporting', () => {
  const workflow = readScraperWorkflow()
  for (const name of ['Restore source checkpoint on rerun', 'Run Scraper', 'Upload scraper diagnostics', 'Record stage outcome']) {
    const step = workflow.split(`- name: ${name}`)[1]?.split(/\r?\n      - /)[0]
    assert.match(step || '', /if: .*steps\.register\.outputs\.should_run == 'true'/)
  }
  for (const name of ['Save resumable source checkpoint', 'Report publishing coverage']) {
    const step = workflow.split(`- name: ${name}`)[1]?.split(/\r?\n      - /)[0]
    assert.match(step || '', /steps\.scraper_run\.outcome != 'skipped'/)
  }
})

test('scraper workflow leaves failure-abort handling disabled', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/scraper.yml'),
    'utf8',
  )

  assert.doesNotMatch(workflow, /SCRAPER_FAILURE_ABORT_THRESHOLD:/)
})

test('scraper workflow runs the scraper with system CA support enabled', () => {
  const workflow = readScraperWorkflow()

  assert.match(workflow, /NODE_OPTIONS:\s*['"]--use-system-ca['"]/)
})

test('scraper workflow bounds the job and per-source public enrichment budgets', () => {
  const workflow = readScraperWorkflow()

  assert.match(workflow, /\n\s+scrape:\s*\n(?:.*\n)*?\s+timeout-minutes:\s*360/)
  assert.match(workflow, /SCRAPER_SOURCE_LIFECYCLE_TIMEOUT_MS:\s*['"]1800000['"]/)
  assert.match(workflow, /PUBLIC_EXPERIENCE_FETCH_TIMEOUT_MS:\s*['"]15000['"]/)
  assert.match(workflow, /PDF_TEXT_EXTRACTION_TIMEOUT_MS:\s*['"]30000['"]/)
})
