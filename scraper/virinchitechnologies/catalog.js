import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VIRINCHI_TECHNOLOGIES_CATALOG = {
  source: 'virinchitechnologies',
  companyName: 'Virinchi Technologies',
  officialBrandName: 'Virinchi',
  adapter: 'script',
  homepageUrl: 'https://www.virinchi.com/',
  companyCareerPage: 'https://www.virinchi.com/careers.php',
  profileSignupUrl: 'http://www.virinchigroup.com/ksoft/profSignup.php',
  resumeEmail: 'virinchi2015@gmail.com',
  atsPlatform: 'first-party-careers-page-profile-signup-only',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy: 'verified-careers-page+profile-signup-link+resume-email-no-public-role-list',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'virinchi.com',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that https://www.virinchi.com/careers.php is still the live first-party Virinchi careers page, now under the title ".:: Welcome to Virinchi ::.", and that it still exposes only the Profile Sign Up handoff at http://www.virinchigroup.com/ksoft/profSignup.php plus the resume email virinchi2015@gmail.com instead of a trustworthy public list of open roles. This provider therefore remains fail-closed and returns no jobs until a real first-party openings surface appears.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default VIRINCHI_TECHNOLOGIES_CATALOG
