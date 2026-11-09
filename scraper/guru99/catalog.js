import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GURU99_CATALOG = {
  source: 'guru99',
  companyName: 'Guru99',
  officialBrandName: 'Guru99',
  adapter: 'script',
  homepageUrl: 'https://www.guru99.com/',
  companyCareerPage: 'https://www.guru99.com/about-us',
  contactPageUrl: 'https://www.guru99.com/contact-us',
  termsUrl: 'https://www.guru99.com/terms-of-service',
  careerContentSiteUrl: 'https://career.guru99.com/',
  companyDomain: 'guru99.com',
  atsPlatform: 'official-content-site-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-about-contact-terms-plus-career-content-microsite',
  extractionStrategy:
    'verified-company-identity-pages+verified-career-content-microsite-without-employer-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.guru99.com/about-us is the live first-party Guru99 company page describing the site as an educational content platform and inviting contributors through a Contribute a Tutorial section, that https://www.guru99.com/contact-us is the live first-party contact page for Guru99 headquarters in Ahmedabad, Gujarat, India, that https://www.guru99.com/terms-of-service identifies the operator as Guru99 Tech Pvt Ltd, and that https://career.guru99.com/ is a first-party interview-content microsite headed Career Guru99 helps you get your Dream Job with an Interview Question Library rather than a public employer jobs board. No trustworthy public Guru99 recruiting board or public role-detail surface was verified.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default GURU99_CATALOG
