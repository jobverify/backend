import { readFileSync } from 'node:fs'
import { createNativeGreenhouseScraper, nativeSourceMetadata } from '../declaredGreenhouse/nativeCareers.js'
import { requireNative } from '../declaredGreenhouse/nativeData.js'
import { mergeDefinedNativeOptions } from '../declaredGreenhouse/runtimeControls.js'
export const NATIVE_ROUTE_PROFILES = JSON.parse(readFileSync(new URL('./profiles.json', import.meta.url)))
export const nativeRouteMetadata = (profile, previous = {}) => ({ ...nativeSourceMetadata(profile, previous),
  countryFilter: profile.countryFilter, verifiedInventoryStatus: 'unverified', zeroResultPolicy: 'coverage-gap', backfillMode: 'discovery-only',
  boardIdentityVerified: false, officialBindingVerifiedAt: null, bindingEvidence: null, runtimeInventoryVerification: false,
  nativeRouteProfile: profile.source, scraperTimeoutMs: 900000, companyDomain: new URL(profile.primaryURL).hostname.replace(/^www\./, ''),
  paginationStrategy: 'paired-current-native-and-published-own-route-original-GETs',
  extractionStrategy: 'full-native-and-published-route-models-before-country-selection' })
export const createNativeRouteScraper = (profile, defaults = {}) => ({ name: profile.source, async run(passed = {}) {
  const options = mergeDefinedNativeOptions(defaults, passed), { onAudit = () => {}, onRecords = () => {}, now = () => new Date().toISOString() } = options
  options.signal?.throwIfAborted()
  return createNativeGreenhouseScraper(profile, defaults).run({ ...options, now: () => {
    const observedAt = now();requireNative(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'invalid observation clock')
    return observedAt
  },
    onAudit: async (audit, control, check) => {
      check()
      const detachedAudit = structuredClone(audit);check()
      await onAudit(detachedAudit)
      check()
      const detachedRecords = structuredClone(audit.observations);check()
      await onRecords(detachedRecords)
      check()
    } })
} })
