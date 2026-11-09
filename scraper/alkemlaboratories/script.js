import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runCurrentAlkem} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.alkemlabs.com/career'
export const CAREERS_HANDOFF_URL = 'https://alkem.turbohire.co/'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    normalized.includes('alkem')
    && normalized.includes('career')
    && (
      normalized.includes('search jobs')
      || normalized.includes('build your career')
    )
  )
}

export const hasOfficialHandoffSignal = (html) =>
  String(html ?? '').includes(CAREERS_HANDOFF_URL)

export const hasUnreachableCareersSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    status >= 400
    || normalized.includes('not found')
    || normalized.includes('access denied')
    || normalized.includes('forbidden')
  )
}

export const createAlkemLaboratoriesScraper = (defaults = {}) => ({run:(options={})=>runCurrentAlkem({...defaults,...options})})

export const run = async (options={}) => createAlkemLaboratoriesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'alkemlaboratories')
  }
}
