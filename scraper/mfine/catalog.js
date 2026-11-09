import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MFINE_CATALOG = {
  source: 'mfine',
  companyName: 'Mfine',
  officialBrandName: 'mfine',
  adapter: 'script',
  homepageUrl: 'https://www.mfine.co/',
  companyCareerPage: 'https://www.mfine.co/contact-us/',
  officialCareersHandoffUrl: 'https://www.mfine.co/join-us/',
  darwinboxCareersUrl: 'https://mfine.darwinbox.in/ms/candidate/careers',
  darwinboxShellRouteUrls: [
    'https://mfine.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://mfine.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ],
  darwinboxListingApiUrl: 'https://mfine.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  companyDomain: 'mfine.co',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-contact-page-plus-broken-darwinbox-blank-shell-validation',
  extractionStrategy:
    'verified-contact-page+join-us-darwinbox-handoff+blank-darwinbox-shells+tenant-info-api-error-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.mfine.co/contact-us/ is the live first-party page exposing the "Careers at mfine" message and a handoff link to https://www.mfine.co/join-us/. Verified that https://www.mfine.co/join-us/ resolves to the public Darwinbox tenant at https://mfine.darwinbox.in/ms/candidate/careers, while https://mfine.darwinbox.in/ms/candidate/careers, https://mfine.darwinbox.in/ms/candidatev2/main/careers/home, and https://mfine.darwinbox.in/ms/candidatev2/main/careers/allJobs all returned only minimal blank shells. Verified that the public candidate API at https://mfine.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returned "Internal Server Error - Error while getting tenant info". There is no trustworthy public jobs surface for Mfine on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MFINE_CATALOG
