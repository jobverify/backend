import path from 'path'
import { fileURLToPath } from 'url'

import {runCurrentEnerparc} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://enerparc.in/apply-now/'

export const SOURCE = 'enerparcenergy'
export const VERIFIED_ON = '2026-11-14'
export const VERIFIED_SURFACE_SUMMARY =
  'Current own Zoho internal Enerparc legal employer and official-site metadata bind the independently observed public native account. One complete original India criteria pair and the whole25-row closing inventory are qualified under the original stricter budgets. Corporate handoff remains historical and the observed corporate403 is retained;24unhydrated roles, full-company/CSS/dependency/activation/application/cleanup scopes remain held.'

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Enerparc Energy Pvt\.? Ltd\.?/i.test(page)
    && /Careers/i.test(page)
    && /enerparc\.zohorecruit\.in\/jobs\/Careers/i.test(page)
}

export const hasNoPublicListingsSignal = (html) => {
  const page = String(html ?? '')

  return hasOfficialCareersSignal(page)
    && !/\b(current openings|open positions|job openings|vacancies)\b/i.test(page)
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = String(html ?? '').replace(/\s+/g, ' ').trim()

  return Number(page.status) === 403
    && /<title>\s*(?:Just a moment\.\.\.|Attention Required!\s*\|\s*Cloudflare)\s*<\/title>/i.test(html)
    && (
      /challenges\.cloudflare\.com/i.test(html)
      || (
        text.includes('Sorry, you have been blocked')
        && text.includes('Please enable cookies')
      )
      || text.includes('Enable JavaScript and cookies to continue')
    )
}

export const createEnerparcEnergyScraper = () => ({run:runCurrentEnerparc})

export const run = runCurrentEnerparc

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Enerparc Energy scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
