import {CAREERS,IMTF_ACCOUNT,parseListing,parseRoleHTML,parseNativeMarkdown,corporateAlignment,roleCode,sha} from './parser.js'
import {BOARD_INDEX,advertisedIndex,declaredCount,inventory,signature,detailCountry,ownCountries} from './currentBoard.js'

const requireShape=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{code:'IMTF_NATIVE_OBSERVATION_SHAPE'})}
const ownURL=code=>'https://apply.workable.com/api/v2/accounts/imtf/jobs/'+code
const identityKey=identity=>JSON.stringify([identity.canonicalURL,identity.markdownURL,identity.nativePublicURLShortcode,identity.nativeNumericJobId,identity.nativeAccountId,identity.nativeRoleTitle])
const corporateKey=rows=>JSON.stringify(rows.map(({shortcode,url,title,workplaceRaw,locationRaw,departmentRaw,employmentRaw})=>({shortcode,url,title,workplaceRaw,locationRaw,departmentRaw,employmentRaw})))

// This contract retains independently corroborated native observations. It does
// not complete the corporate inventory or qualify records for publication.
// All IO shares the primary collector's admission, timeout and cancellation.
export async function collectNativeObservations({read,openingRead,check,r,anchor,listing,home,isRoleUnavailable}){
 requireShape(anchor.nativeAccountId===IMTF_ACCOUNT,'Native observation anchor account mismatch')
 const llms=advertisedIndex(anchor),total=declaredCount(await read(llms,'markdown'))
 const opening=inventory(await read(BOARD_INDEX,'markdown'),total)
 r.nativeObservationInventory={surface:BOARD_INDEX,nativeAccountId:anchor.nativeAccountId,opening,closingConsistent:false,companyScopeComplete:false}
 const corporate=new Map(listing.candidates.map(c=>[c.shortcode,c]))
 const nativeCodes=new Set(opening.map(row=>row.shortcode))
 r.advertisedIdentityUnion=[...new Set([...corporate.keys(),...nativeCodes])]
 const checked=[]
 for(const row of opening){
  // Validate the published native row and full detail before deriving a public
  // HTML parent from its explicit Apply declaration. The Apply URL is not read.
  const markdown=await openingRead(row.markdownURL,'markdown'),detail=detailCountry(markdown,row)
  const candidate=corporate.get(row.shortcode)??null
  const roleURL=candidate?.url??'https://apply.workable.com/imtf/j/'+row.shortcode
  requireShape(roleCode(roleURL)===row.shortcode,'Native observation role URL mismatch')
  const identity=parseRoleHTML(await openingRead(roleURL,'html'),{shortcode:row.shortcode})
  requireShape(identity.nativeAccountId===anchor.nativeAccountId&&identity.nativeRoleTitle===row.title,'Native per-role HTML account or title mismatch')
  const fact=parseNativeMarkdown(markdown,identity)
  const rawOwn=await read(ownURL(row.shortcode),'json'),own=ownCountries(rawOwn,row,identity,detail)
  const gaps=candidate?corporateAlignment(fact,candidate,identity):[]
  const observation={...fact,listing:candidate,listingDepartmentRaw:candidate?.departmentRaw??null,membership:candidate?'corporate-and-native':'native-only',qualification:!candidate?'unqualified-native-only':gaps.some(g=>g.field==='title'||g.field==='employment')?'quarantined-corporate-alignment':'unqualified-native-observation',corporateAlignmentGaps:gaps,nativeCountryCode:row.countryCode,nativeAllLocations:own.places,rawNativeBoardLine:row.rawLine,rawNativeOwnJSON:rawOwn,nativeOwnJSONSHA256:sha(rawOwn),nativeOwnSignature:own.signature,nativeCriteriaSHA256:detail.criteriaSHA256,roleHTMLProvenance:candidate?'corporate-advertised-same-code':'native-detail-explicit-apply-parent',eligibleForPublication:false,publicEligibility:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,openingValidated:true,closingConsistent:false}
  r.nativeObservations.push(observation)
  for(const gap of gaps)if(!r.alignmentGaps.some(g=>g.nativePublicURLShortcode===row.shortcode&&g.field===gap.field&&g.listingRaw===gap.listingRaw&&g.nativeRaw===gap.nativeRaw))r.alignmentGaps.push({stage:'corporate-native-alignment',code:'IMTF_CORPORATE_ALIGNMENT_GAP',...gap,nativePublicURLShortcode:row.shortcode,nativeNumericJobId:identity.nativeNumericJobId,nativeAccountId:identity.nativeAccountId,canonicalURL:identity.canonicalURL,markdownURL:identity.markdownURL,nativeFullMarkdownSHA256:fact.nativeFullMarkdownSHA256})
  checked.push({row,identity,detail,own,observation,roleURL})
  check()
 }
 // An absent native-board member does not close a primary reference. Only an
 // actually observed same-canonical not-found redirect has the known shape.
 for(const candidate of listing.candidates.filter(c=>!nativeCodes.has(c.shortcode))){
  let unavailable=isRoleUnavailable(null,candidate)
  if(!unavailable){
   try{await read(candidate.url,'html')}
   catch(error){if(!isRoleUnavailable(error,candidate))throw error;unavailable=true}
  }
  requireShape(unavailable,'Native board omitted an available corporate role; unresolved inventory identity')
  r.unavailableCorporateReferences.push({shortcode:candidate.shortcode,url:candidate.url,listing:candidate,status:'unavailable',reason:'canonical-role-not-found-redirect',closureVerified:false,sourceScopeComplete:false,eligibleForPublication:false,publicEligibility:null})
 }
 for(const {row,identity,detail,own,observation,roleURL}of checked){
  const closingHTML=await read(roleURL,'html',{fresh:true}),closingIdentity=parseRoleHTML(closingHTML,{shortcode:row.shortcode})
  requireShape(identityKey(closingIdentity)===identityKey(identity),'Native per-role HTML identity changed during collection')
  const closingMarkdown=await read(row.markdownURL,'markdown',{fresh:true}),closingDetail=detailCountry(closingMarkdown,row)
  parseNativeMarkdown(closingMarkdown,closingIdentity)
  const closingRawOwn=await read(ownURL(row.shortcode),'json',{fresh:true}),closingOwn=ownCountries(closingRawOwn,row,closingIdentity,closingDetail)
  requireShape(closingOwn.signature===own.signature&&closingDetail.markdownSHA256===detail.markdownSHA256,'Native own/Markdown full criteria changed during collection')
  Object.assign(observation,{closingConsistent:true,closingRoleHTMLSHA256:sha(closingHTML),closingNativeFullMarkdownSHA256:sha(closingMarkdown),closingNativeOwnJSONSHA256:sha(closingRawOwn)})
  check()
 }
 const closingCount=declaredCount(await read(llms,'markdown',{fresh:true}))
 const closing=inventory(await read(BOARD_INDEX,'markdown',{fresh:true}),closingCount)
 requireShape(signature(opening)===signature(closing),'Native inventory changed during collection')
 const closingListing=parseListing(home,await read(CAREERS,'html',{fresh:true}))
 requireShape(closingListing.provenance&&!closingListing.failures.length&&corporateKey(listing.candidates)===corporateKey(closingListing.candidates),'Corporate inventory changed during observation collection')
 check()
 Object.assign(r.nativeObservationInventory,{closing,closingConsistent:true,closingCorporateConsistent:true})
 Object.assign(r,{source:'imtf',recordKind:'vacancy-rows',observedRecordCount:r.nativeObservations.length,observedVacancyCount:r.nativeObservations.length,companyGlobalTotal:null,companyIndiaTotal:null})
}
