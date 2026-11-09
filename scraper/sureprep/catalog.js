import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const SUREPREP_CATALOG = {
  source: 'sureprep',
  companyName: 'SurePrep',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://sureprep.com/',
  companyDomain: 'sureprep.com',
  homepageUrl: 'https://tax.thomsonreuters.com/en/sureprep',
  evidenceUrl: 'https://tax.thomsonreuters.com/en/sureprep',
  loginUrl: 'https://production.sureprep.com/',
  parentCareersUrl: 'https://www.thomsonreuters.com/en/careers',
  officialBrandName: 'SurePrep',
  officialProductTitle: 'SurePrep 1040 tax workflow automation solutions | Thomson Reuters',
  officialLoginTitle: 'SurePrep FileRoom Login',
  officialLoginProvider: 'Thomson Reuters Account',
  atsPlatform: 'no-public-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy:
    'verified-sureprep-root-redirect-to-thomson-reuters-product-page+verified-production-login+generic-parent-careers-link-without-sureprep-jobs',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://sureprep.com/ redirected to the Thomson Reuters SurePrep product page at https://tax.thomsonreuters.com/en/sureprep, that the only job-related public handoff on that verified page was the generic Thomson Reuters careers link at https://www.thomsonreuters.com/en/careers, and that the public SurePrep login surface now lives at https://production.sureprep.com/ with the "SurePrep FileRoom Login" and "Sign in with Thomson Reuters Account" markers. No trustworthy exact-brand public SurePrep jobs inventory or role detail surface was verified, so this provider stays fail-closed and returns an empty set until that state changes.',
}

export default SUREPREP_CATALOG
