import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'

export const TENANT_URL = 'https://sharechat.mynexthire.com/employer/jobboard/details_by_shortname/get/sharechat/'
export const DETAIL_URL = 'https://sharechat.prod.us1.mynexthire.io/d17/careers/requisition/object'
export const PUBLICATION_DATES_URL = 'https://sharechat.mynexthire.com/ats/public-apis/v1/careers/job-posting-dates/list'
const JOB_BASE = 'https://sharechat.mynexthire.com/employer/jobs'
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const requireNative = (ok, message) => { if (!ok) throw new Error(`ShareChat native ${message}`) }

export const validateNativeTenant = value => {
  const routes = value?.tenantPreferencesMap?.career_page_url?.url
  requireNative(value?.clientId === 1109 && value.clientName === 'ShareChat' && value.companyWebsite === 'https://sharechat.com/'
    && Array.isArray(routes) && routes.length > 0 && routes.every(route => route.url === JOB_BASE)
    && ['jd', 'application', 'list'].every(type => routes.some(route => route.pageType === type)),
  'employer, official website or configured public board conflicts with ShareChat')
  return value
}

export const nativePublicationDates = (payload, ids, checkedAt) => {
  const rows = payload?.data?.careersJobPostingDatesList
  const now = new Date(checkedAt).getTime()
  requireNative(Number.isFinite(now), 'publication verification clock is invalid')
  requireNative(payload?.code === 200 && payload.message === 'OK' && Array.isArray(rows) && rows.length === ids.length,
    'publication inventory is missing or incomplete')
  const dates = new Map()
  for (const row of rows) {
    requireNative(ids.includes(row?.requisitionId) && !dates.has(row.requisitionId)
      && Number.isSafeInteger(row.publishedOn) && row.publishedOn > 0
      && !Number.isNaN(new Date(row.publishedOn).getTime()) && row.publishedOn <= now,
    'publication identity repeats, changes, lacks publishedOn or is in the future')
    dates.set(row.requisitionId, row.publishedOn)
  }
  return dates
}

const assignedOffice = (office, expectedNames) => {
  requireNative(office && typeof office === 'object' && norm(office.office) && norm(office.address)
    && expectedNames.includes(office.office), 'role assigned office conflicts with the first-party listing')
  for (const country of [office.country, office.countryCode]) {
    requireNative(country == null || ['India', 'IN', 'IND'].includes(country), 'role assigned native country conflicts with India')
  }
  const name = norm(office.office), address = norm(office.address)
  let method, city = null
  if (name === 'India' && address === 'India') method = 'role-assigned-explicit-india-label'
  else {
    // These are role-assigned offices, not the employer's headquarters. Keep the
    // missing raw country null and record the existing city policy inference.
    city = getValidIndiaCityForJob({ city: name, location: name })
    requireNative(city && city !== 'Remote' && (
      (name === 'Bangalore' && city === 'Bangalore'
        && address === '1st Floor, Sona Towers, Hosur Rd, next to Nexa Showroom, Chikku Lakshmaiah Layout, S.G. Palya, Bengaluru, Karnataka 560029')
      || (name === 'Mumbai' && city === 'Mumbai' && address === 'Mumbai')
    ), 'role assigned office address has unresolved India scope')
    method = 'role-assigned-office-trusted-india-city'
  }
  return { raw: { ...office, country: office.country ?? null }, city, method }
}

export const extractNativeShareChatJob = (listing, rawListing, tenant, payload, publishedOn) => {
  validateNativeTenant(tenant)
  const details = payload?.data?.reqDetailsBO
  requireNative(payload?.status === 200 && details?.reqId === rawListing.requisitionId
    && String(details.reqId) === listing.requisitionId && norm(details.reqTitle) === listing.title
    && details.statusId === 3 && details.requisitionPublished === true,
  'role identity, title or published open status conflicts with the first-party listing')
  requireNative(Array.isArray(rawListing.officeLocationNames) && rawListing.officeLocationNames.length > 0
    && new Set(rawListing.officeLocationNames).size === rawListing.officeLocationNames.length
    && Array.isArray(details.locationList) && details.locationList.length === rawListing.officeLocationNames.length,
  'role assigned office inventory is missing or incomplete')
  const offices = details.locationList.map(office => assignedOffice(office, rawListing.officeLocationNames))
  requireNative(new Set(offices.map(place => place.raw.office)).size === offices.length,
    'role assigned office inventory repeats a location')
  requireNative(typeof details.jdDisplay === 'string' && extractActiveDescription(details.jdDisplay), 'published role description is missing')
  requireNative(Number.isSafeInteger(publishedOn) && publishedOn > 0 && !Number.isNaN(new Date(publishedOn).getTime()), 'publishedOn is missing')
  const uniqueCities = [...new Set(offices.map(place => place.city))], city = uniqueCities.length === 1 ? uniqueCities[0] : null
  return { ...listing, country: 'India', city, location: city ? `${city}, India` : 'India',
    locations: offices.map(place => place.city ? `${place.city}, India` : 'India'),
    postingDate: new Date(publishedOn).toISOString(), jobDescription: details.jdDisplay, sourceDescription: details.jdDisplay,
    jobDescriptionHtml: details.jdDisplay, sourceDetailComplete: true, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    sourceNativeLocations: offices.map(place => place.raw),
    sourceNativeCountryEvidence: { method: offices.every(place => place.method === offices[0].method) ? offices[0].method : 'role-assigned-mixed-india-evidence',
      policy: 'src/utils/publicJobLocationScope.js', source: 'reqDetailsBO.locationList', rawCountry: null },
    sourceNativeDates: { publishedOn, createdDate: rawListing.createdDate ?? null, approvedDate: rawListing.approvedDate ?? null },
    sourceNativeStatusEvidence: { statusId: details.statusId, requisitionPublished: details.requisitionPublished },
    sourceNativeEmployerEvidence: { clientId: tenant.clientId, clientName: tenant.clientName, companyWebsite: tenant.companyWebsite,
      configuredTenant: 'sharechat', configuredDetailUrl: DETAIL_URL },
  }
}
