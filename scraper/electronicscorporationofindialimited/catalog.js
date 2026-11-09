import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.ecil.co.in/ is the live first-party Electronics Corporation of India Limited (ECIL) homepage and links directly to the first-party current job openings grid at https://www.ecil.co.in/jobopenings. Verified that the live current job openings page exposes a Yii GridView table with the summary "Showing 1-10 of 12 items." plus a next-page link to https://www.ecil.co.in/jobopenings?page=2, and that page 2 shows the summary "Showing 11-12 of 12 items." The verified public jobs surface is a two-page first-party ECIL listings grid whose rows are anchored by first-party PDF documents such as advertisements, application forms, corrigenda, and related notices.'

export const ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG = {
  source: 'electronicscorporationofindialimited',
  companyName: 'Electronics Corporation of India Limited',
  officialBrandName: 'ECIL',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'electronicscorporationofindialimited/jobs.json',
  homepageUrl: 'https://www.ecil.co.in/',
  companyCareerPage: 'https://www.ecil.co.in/jobopenings',
  currentOpeningsPage2Url: 'https://www.ecil.co.in/jobopenings?page=2',
  companyDomain: 'ecil.co.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-yiigrid-page-parameter-pagination-plus-pdf-documents',
  extractionStrategy:
    'verified-homepage-current-job-openings-link+verified-two-page-yiigrid+first-party-document-links+application-form-preference',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG
