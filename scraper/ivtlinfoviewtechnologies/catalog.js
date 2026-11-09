import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IVTL_INFOVIEW_TECHNOLOGIES_CATALOG = {
  source: 'ivtlinfoviewtechnologies',
  companyName: 'IVTL Infoview Technologies',
  officialBrandName: 'Works Applications (India)',
  adapter: 'script',
  homepageUrl: 'https://india.worksap.co.jp/',
  companyCareerPage: 'https://india.worksap.co.jp/',
  atsPlatform: 'official-homepage-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-homepage-contact-validation-return-empty',
  extractionStrategy: 'verified-first-party-homepage+legacy-infoview-branding+contact-only-handoff+no-public-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'india.worksap.co.jp',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://india.worksap.co.jp/ was the live first-party Works Applications (India) homepage carrying the legacy Infoview branding handoff, and that the visible public contact path exposed wai-hr@worksap.co.jp alongside the legacy hr-office@ivtlinfoview.co.jp address without any trustworthy public careers or openings surface on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ivtlinfoviewtechnologies/jobs.json',
}

export default IVTL_INFOVIEW_TECHNOLOGIES_CATALOG
