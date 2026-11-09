import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KRG_TECHNOLOGIES_CATALOG = {
  source: 'krgtechnologies',
  companyName: 'KRG Technologies',
  officialBrandName: 'KRG Technologies',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://krgtech.com/',
  companyCareerPage: 'https://krgtech.com/career.aspx',
  currentOpeningsUrl: 'https://krgtech.com/Jobs.aspx',
  externalBoardUrl: 'https://talenthire.ceipal.com/Jobs/listing/ODI0MA==',
  atsPlatform: 'official-current-openings-page-plus-ceipal-iframe',
  countryFilter: 'India',
  paginationStrategy: 'verified-current-openings-page-plus-public-iframe-validation-return-empty',
  extractionStrategy: 'verified-careers-page+verified-current-openings-iframe-handoff+ceipal-redirect-dns-failure-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'krgtech.com',
  dryRunFile: 'krgtechnologies/jobs.json',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that the live first-party KRG Technologies careers surface now resolves on the apex host https://krgtech.com rather than https://www.krgtech.com, whose certificate no longer covers the www hostname. Verified that https://krgtech.com/career.aspx remains the official careers page and that https://krgtech.com/Jobs.aspx still exposes the Current Openings handoff with the public CEIPAL listing iframe at https://talenthire.ceipal.com/Jobs/listing/ODI0MA==. That iframe currently 302-redirects to https://careerportal.ceipal.com/jobs/listing/ODI0MA==//, which did not resolve during live verification, so this provider remains a fail-closed sentinel that returns no jobs.',
}

export default KRG_TECHNOLOGIES_CATALOG
