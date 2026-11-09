import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAVE_TECHNOLOGIES_CATALOG = {
  source: 'ravetechnologies',
  companyName: 'Rave Technologies',
  officialBrandName: 'Rave Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.rave-tech.com/',
  companyCareerPage: 'https://www.necsws.com/careers/',
  successorHomepageUrl: 'https://www.necsws.com/india/',
  transitionEvidenceUrl: 'https://www.nec.com/en/press/202107/global_20210701_03.html',
  companyDomain: 'necsws.com',
  atsPlatform: 'smartrecruiters-public-board',
  countryFilter: 'India',
  paginationStrategy: 'smartrecruiters-api-pages',
  extractionStrategy:
    'verified-nec-brand-transition+first-party-careers-handoff+smartrecruiters-public-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  smartRecruitersBoardUrl: 'https://jobs.smartrecruiters.com/NECSWS',
  smartRecruitersCompanyIdentifier: 'NECSWS',
  smartRecruitersListingApiUrl: 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings',
  smartRecruitersDetailApiUrlTemplate:
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/{{jobId}}',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that NEC\'s first-party rename announcement at https://www.nec.com/en/press/202107/global_20210701_03.html still states that "Rave Technologies (India) Pvt Limited" was re-named "NEC Software Solutions India Private Limited", that https://www.necsws.com/india is again serving the live NEC India homepage with careers links, that https://www.necsws.com/careers/ is the live first-party careers page and links out to public https://jobs.smartrecruiters.com/NECSWS postings, and that the public jobs API at https://api.smartrecruiters.com/v1/companies/NECSWS/postings returns India roles.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ravetechnologies/jobs.json',
}

export default RAVE_TECHNOLOGIES_CATALOG
