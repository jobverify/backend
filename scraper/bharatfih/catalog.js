import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BHARAT_FIH_CATALOG = {
  source: 'bharatfih',
  companyName: 'Bharat FIH',
  adapter: 'script',
  companyCareerPage: 'https://bharatfih.com/',
  homepageUrl: 'https://bharatfih.com/',
  wwwHomepageUrl: 'https://www.bharatfih.com/',
  firstPartyCareerRouteUrls: [
    'https://bharatfih.com/careers',
    'https://www.bharatfih.com/careers',
  ],
  darwinboxJobsUrl: 'https://bharatfih.darwinbox.in/jobs',
  darwinboxShellRouteUrls: [
    'https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/allJobs',
    'https://bharatfih.darwinbox.in/ms/candidate/careers',
  ],
  darwinboxListingApiUrl: 'https://bharatfih.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  companyDomain: 'bharatfih.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'first-party-homepage-and-careers-tls-failure-plus-darwinbox-login-and-angular-shell-validation',
  extractionStrategy:
    'verified-first-party-tls-hostname-mismatch+darwinbox-jobs-login-redirect+non-public-darwinbox-candidate-shells+invalid-subdomain-api-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that https://bharatfih.com/ and https://www.bharatfih.com/ both failed public HTTPS hostname validation with a certificate mismatch, and https://bharatfih.com/careers plus https://www.bharatfih.com/careers failed the same way. On the likely ATS host, https://bharatfih.darwinbox.in/jobs redirected through /user/login to https://darwinbox.com/, https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/home, https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/allJobs, and https://bharatfih.darwinbox.in/ms/candidate/careers returned non-public candidate app shells with no job links, and the candidate jobs API at https://bharatfih.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returned "Invalid subdomain: bharatfih". There is no trustworthy public jobs surface for Bharat FIH on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BHARAT_FIH_CATALOG
