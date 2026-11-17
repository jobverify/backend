import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{currentIgtTransport}from'./currentTransport20261117.js'
import{currentIgtPage,currentIgtForm,check}from'./currentModels20261117.js'
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentIgt(options={}){
 options.signal?.throwIfAborted();const io=currentIgtTransport(options)
 try{
  const acquire=async()=>{
   const pages=[],documents=[];for(const expected of profile.pages){const p=currentIgtPage(await io.read(expected.url),expected);io.checkpoint();pages.push(p.model);documents.push(p.doc)}
   const [home,careers,join]=documents
   check(home.nodes(n=>n.tag==='p'&&home.text(n)==='IGT Solutions is now Atain.').length>0,'active first-party rebrand statement')
   const link=(doc,url,text)=>doc.nodes(n=>n.tag==='a'&&n.attrs.href===url&&text.includes(doc.text(n)))
   check(link(home,profile.pages[1].url,['Careers']).length>0,'active own current Careers handoff')
   check(link(careers,profile.pages[2].url,['Join the Squad','Get Started','Join Our Squad']).length>0,'active own current intake handoff')
   const nativeApplicationForm=currentIgtForm(join,profile);io.checkpoint();return{pages,nativeApplicationForm}
  }
  const opening=await acquire(),closing=await acquire();check(equal(opening,closing),'complete current HTML, program and generic intake models changed at closing');io.checkpoint()
  throw Object.assign(Error('IGT Solutions declared Atain recruitment currently publishes a general candidate intake; no reviewed role inventory or per-role employer/country/criteria authority is available'),{
   name:'IgtSolutionsCurrentIntakeUnavailableError',abortRetries:true,softFailure:true,failureKind:'source_inventory_unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   nativeCollectionEvidence:{source:'igtsolutions',observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    nativeOpeningModel:opening,nativeClosingModel:closing,closingCurrentIntakeModelMatches:true,closingVacancyInventoryMatches:false,listingPaginationComplete:false,roleEmployerBindingsProven:false,
    applicationSubmitted:false,applicationValidationComplete:false,browserEquivalenceComplete:false,verifiedEmpty:false,retainedResponses:io.receipts,
    failures:[{stage:'current-native-inventory',reason:'general-candidate-intake-is-not-vacancy-inventory;unreviewed-external-browser-dependencies;per-role-employer-country-criteria-unknown'}]}
  })
 }finally{io.close()}
}
