import {attachInventoryEvidence} from '../../utils/inventoryEvidence.js'

// Synthetic no-network provider for the registration integration tests. Keep
// the supplied observation raw: the catalog must reject invalid metadata.
// This module is test scaffolding, not a historical public response capture.
export const run=async({rows=[],observation}={})=>{
 const jobs=rows.map(row=>({...row}))
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:observation,configurable:true})
 return attachInventoryEvidence(jobs,{
  status:'coverage-gap',surface:'https://example.invalid/careers',firstParty:true,
  listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,
  indiaFacetCount:null,verifiedAt:null,pagesFetched:0,
  reason:'controlled-no-network-observation-fixture;company-inventory-unverified',
 })
}
