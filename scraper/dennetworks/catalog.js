export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 1, 2026 that https://dennetworks.com/ is the live official Den Networks homepage and links the first-party careers hub at https://dennetworks.com/careers. The homepage still uses the DEN Networks - Top Cable Service Provider in India title and footer, while the careers page exposes 14 first-party category detail routes under https://dennetworks.com/home/career_detail/. Thirteen of the 14 checked detail pages render only the no-openings message "There are currently no opening." The remaining live opening route https://dennetworks.com/home/career_detail/3 currently lists the Corporate Communication role in Gurgaon with 3-6 Years Experience and an on-page first-party application form that posts to https://dennetworks.com/home/upload_resume.'

export const DEN_NETWORKS_CATALOG = {
  source: 'dennetworks',
  companyName: 'Den Networks',
  adapter: 'script',
  modulePath: '../../scraper/dennetworks/script.js',
  companyCareerPage: 'https://dennetworks.com/careers',
  homepageUrl: 'https://dennetworks.com/',
  careerDetailBaseUrl: 'https://dennetworks.com/home/career_detail/',
  sampleOpeningUrl: 'https://dennetworks.com/home/career_detail/3',
  applyFormActionUrl: 'https://dennetworks.com/home/upload_resume',
  companyDomain: 'dennetworks.com',
  atsPlatform: 'first-party-careers-pages-plus-upload-resume-form',
  countryFilter: 'India',
  paginationStrategy: 'careers-root-plus-linked-career-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-root+linked-first-party-career-detail-pages+resume-upload-form-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DEN_NETWORKS_CATALOG

