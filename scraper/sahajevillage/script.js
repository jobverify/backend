import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SAHAJ_E_VILLAGE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SAHAJ_E_VILLAGE_CATALOG
export const SOURCE = SAHAJ_E_VILLAGE_CATALOG.source
export const COMPANY = SAHAJ_E_VILLAGE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SAHAJ_E_VILLAGE_CATALOG.officialBrandName
export const VERIFIED_ON = SAHAJ_E_VILLAGE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SAHAJ_E_VILLAGE_CATALOG.verifiedSurfaceSummary
export const COMPANY_INFO_URL = SAHAJ_E_VILLAGE_CATALOG.companyInfoUrl
export const LEARNING_HOME_URL = SAHAJ_E_VILLAGE_CATALOG.learningHomeUrl
export const LEARNING_JOIN_US_URL = SAHAJ_E_VILLAGE_CATALOG.companyCareerPage

const buildPageResponse = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const isVerifiedGatewayTimeoutPage = ({ status, url, html }) => {
  const page = String(html ?? '')

  try {
    const hostname = new URL(String(url ?? '')).hostname
    return status === 504
      && /(^|\.)sahajcorporate\.com$/i.test(hostname)
      && /504 Gateway Time-out/i.test(page)
      && !hasPublicCompanyJobsSignal(page)
  } catch {
    return false
  }
}

export const hasOfficialCompanyInfoSignal = (html = '') => {
  const page = String(html ?? '')

  return /AAJEEVIKA\s*\/\s*SGSY Special Project/i.test(page)
    && /Implemented by:\s*Sahaj e Village Ltd/i.test(page)
    && /About THE PIA/i.test(page)
    && /Sahaj e-Village Ltd,\s*an ISO 27001 company/i.test(page)
    && /registration Number 95455/i.test(page)
    && /Copyright 2012-2013 SeVL/i.test(page)
}

export const hasOfficialLearningJoinUsSignal = (html = '') => {
  const page = String(html ?? '')

  return /Why Join Sahaj eLearning Courses/i.test(page)
    && /Benefits of e Shiksha/i.test(page)
    && /Sahaj Certificate/i.test(page)
    && /NSDC Certificate/i.test(page)
    && /Sahaj e Shiksha Course Fees/i.test(page)
    && /©\s*Sahaj e-Village Limited/i.test(page)
}

export const hasPublicCompanyJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /"@type"\s*:\s*"JobPosting"/i.test(page)
    || /\b(Current Openings|Open Positions|Career Opportunities)\b/i.test(page)
    || /href=["'][^"']*\/careers\/[^"']+["'][^>]*>\s*Apply Now/i.test(page)
}

export const createSahajEVillageScraper = () => ({
  async run({
    fetchPage = buildPageResponse,
  } = {}) {
    const companyInfo = await fetchPage(COMPANY_INFO_URL)
    if (isVerifiedGatewayTimeoutPage(companyInfo)) {
      const learningJoinUs = await fetchPage(LEARNING_JOIN_US_URL)
      const learningHome = await fetchPage(LEARNING_HOME_URL)

      if (
        isVerifiedGatewayTimeoutPage(learningJoinUs)
        && isVerifiedGatewayTimeoutPage(learningHome)
      ) {
        return []
      }

      throw new Error('Sahaj e-Village timeout surfaces changed materially across the verified first-party domains')
    }

    if (companyInfo.status !== 200 || !hasOfficialCompanyInfoSignal(companyInfo.html)) {
      throw new Error('Sahaj e-Village verified company info page no longer matches the official first-party surface')
    }

    const learningJoinUs = await fetchPage(LEARNING_JOIN_US_URL)
    if (learningJoinUs.status !== 200 || !hasOfficialLearningJoinUsSignal(learningJoinUs.html)) {
      throw new Error('Sahaj e-Village verified learning join us page no longer matches the official first-party surface')
    }

    if (
      hasPublicCompanyJobsSignal(companyInfo.html)
      || hasPublicCompanyJobsSignal(learningJoinUs.html)
    ) {
      throw new Error('Sahaj e-Village verified first-party surfaces now appear to expose public company jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createSahajEVillageScraper().run(options)

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
