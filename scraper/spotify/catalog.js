export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that Spotify\'s first-party careers surface remains https://www.lifeatspotify.com/jobs, that the same first-party hub currently shows "0 jobs in all locations in all categories in all job types", that https://www.lifeatspotify.com/find-your-team/locations still presents Mumbai under Asia Pacific, that https://www.lifeatspotify.com/find-your-team/locations/mumbai currently says "0 jobs in all categories in all job types", and that https://www.lifeatspotify.com/start-your-journey states legitimate Spotify career links begin with https://lifeatspotify.com/jobs or https://jobs.lever.co/spotify. Restricting this provider to first-party public careers surfaces only, Jobverify trusts lifeatspotify.com and records no current India openings for Spotify.'

export const SPOTIFY_PROVIDER = {
  source: 'spotify',
  companyName: 'Spotify',
  officialBrandName: 'Spotify',
  adapter: 'script',
  modulePath: '../../scraper/spotify/script.js',
  companyCareerPage: 'https://www.lifeatspotify.com/jobs',
  companyDomain: 'lifeatspotify.com',
  atsPlatform: 'official-first-party-careers-pages',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-pages-with-global-and-mumbai-zero-openings-checks',
  extractionStrategy:
    'verified-lifeatspotify-jobs-zero-openings+verified-india-locations-page+verified-mumbai-zero-jobs+verified-faq-legitimacy-copy+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SPOTIFY_PROVIDER

