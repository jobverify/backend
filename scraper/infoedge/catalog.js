export const VERIFIED_SURFACE_SUMMARY = "Verified on October 9, 2026 (India time) that the official InfoEdge homepage publishes careers.infoedge.com, whose current client pins https://public.zwayam.com/jobs/search, base64 companyId MTU1Nzg=, domain careers.infoedge.com, and decoded detail companyId 15578 at https://public.zwayam.com/jobs-service/v1/jobs/careersite. Strict native listing capture reconciled 294 distinct public-status rows across 25 pages, including 288 explicit India rows and 6 known foreign rows. Current native detail and later listing requests intermittently return HTTP 403. Full active job counts remain unknown; only substantive publisher full descriptions may be retained with coverage-gap evidence and sourceListingComplete=false. Full counted listings with unavailable individual details may retain a nonempty substantive India subset when only the final snapshot transport is unavailable; the result remains incomplete, the India facet count is unknown, and actual snapshot or country drift still fails."

export const INFOEDGE_CATALOG = {
  "source": "infoedge",
  "companyName": "InfoEdge",
  "officialBrandName": "Info Edge India Ltd",
  "adapter": "script",
  "modulePath": "../../scraper/infoedge/script.js",
  "dryRunFile": "infoedge/jobs.json",
  "homepageUrl": "https://www.infoedgeindia.com/",
  "careersLandingUrl": "https://careers.infoedge.com/infoedge/",
  "companyCareerPage": "https://careers.infoedge.com/infoedge/jobslist",
  "companyDomain": "careers.infoedge.com",
  "zwayamTenantGroupId": "G1",
  "zwayamCompanyId": "MTU1Nzg=",
  "zwayamDetailCompanyId": "15578",
  "verifiedPublicJobCount": null,
  "verifiedSampleJobUrl": "https://careers.infoedge.com/infoedge/jobview/deputy-manager-training-and-quality-noida-2026091014201322",
  "atsPlatform": "zwayam",
  "countryFilter": "India",
  "paginationStrategy": "public-zwayam-total-count-plus-page-size",
  "extractionStrategy": "verified-first-party-careers-page+counted-zwayam-search+native-detail-api+incomplete-full-description-fallback",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-09",
  "verifiedSurfaceSummary": VERIFIED_SURFACE_SUMMARY,
  "verifiedIndiaJobCount": null,
  "verifiedPublicListingRowCount": 294,
  "verifiedIndiaListingRowCount": 288,
  "verifiedInventoryStatus": "coverage-gap"
}

export default INFOEDGE_CATALOG
