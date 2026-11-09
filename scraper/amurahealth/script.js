import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runCurrentAmura,jobsBlogIdentity,publicPosts} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'amurahealth'
export const COMPANY = 'Amura Health'
export const JOBS_PAGE_URL = 'https://amura.ai/jobs/'
export const VERIFIED_PAGE_TITLE = 'Jobs at Amura - Adventure of your Lifetime'
export const REQUIRED_PAGE_SIGNALS = [
  'Working at Amura',
  'Jobs at Amura',
]

export const hasVerifiedJobsBlogSurface = jobsBlogIdentity

export const extractPublicPostTitles = html=>publicPosts(html).map(row=>row.title).filter(Boolean)

// A post title alone never proves a non-vacancy or complete zero inventory.
export const hasKnownNonRolePostsOnly = () => false

export const createAmuraHealthScraper = () => ({run:runCurrentAmura})

export const run = async (options = {}) => createAmuraHealthScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
