import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY = 'Verified on Wednesday, August 5, 2026 that the official STL Tech life and careers page at https://stl.tech/life/ still presented the first-party Join us section and now linked candidates to the public RippleHire handoff URL https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#list. Verified that the public RippleHire board shell stayed live at https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE and that the RippleHire jobs API at https://stltech.ripplehire.com/candidate/candidatejobsearch returned 104 live listings on August 5, 2026. Sampled live locations from the public board were Indian locations including Ahmedabad, Bangalore, Bhubaneswar, Gurgaon, Mumbai, Rakholi, Silvassa, Tuticorin, Udaipur, and Waluj.'

export const STERLITE_TECHNOLOGIES_CATALOG = {
  source: 'sterlitetechnologies',
  companyName: 'Sterlite Technologies',
  officialBrandName: 'STL Tech',
  adapter: 'script',
  companyCareerPage: 'https://stl.tech/life/',
  officialCareersPageUrl: 'https://stl.tech/life/',
  linkedJobsPortalUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#list',
  linkedJobsPortalHost: 'stltech.ripplehire.com',
  portalOrigin: 'https://stltech.ripplehire.com',
  officialCareersHandoffUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE#list',
  jobBoardUrl: 'https://stltech.ripplehire.com/candidate/?token=v0cOTxD3fgZqIF393gqj&source=CAREERSITE',
  jobsApiUrl: 'https://stltech.ripplehire.com/candidate/candidatejobsearch',
  companyDomain: 'stl.tech',
  atsPlatform: 'ripplehire',
  countryFilter: 'India',
  paginationStrategy: 'page-param-on-public-ripplehire-board',
  extractionStrategy: 'official-careers-handoff+ripplehire-list-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'sterlitetechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default STERLITE_TECHNOLOGIES_CATALOG
