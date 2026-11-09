import {readPublishedPdf,pdfBoxText} from './pdfDocument.js'
import {need,makeListingObservation} from './nativeModels.js'
import {bindNativeDeploymentCountry} from './nativeCountry.js'
const normalize=value=>String(value??'').replace(/\s+/g,' ').trim()
const titleKey=value=>normalize(value).toLowerCase().replace(/professionals?/g,'professional').replace(/[^a-z0-9]/g,'')
const listedPostTitle=listing=>{
 const title=normalize(listing.title),extension=/^(.*?)\.\s*\(Last date for submission extended to (\d{2})\/(\d{2})\/(\d{4})\)$/.exec(title)
 if(!extension)return title
 const [,post,day,month,year]=extension
 need(`${year}-${month}-${day}`===listing.closingDate,'deadline extension annotation and closing date conflict')
 return post
}
export async function readCdotAdvertisement(bytes,listing,{signal,page,clock}={}){
 const {rendererFontAliases,...pdf}=await readPublishedPdf(bytes,{signal}),first=pdf.pages[0]
 need(first.width===792&&first.height===612&&pdf.totalPages>=3,'native role-table layout changed')
 const employer=normalize(first.text).match(/C-DOT \(Cent(?:er|re) for Development of Telematics\)/)?.[0]
 need(employer&&/Government of India/.test(first.text),'native advertisement publisher changed')
 const bounds=p=>({bottom:p.number===3?475:75,top:p.number===1?195:530})
 const cell=(left,right)=>pdf.pages.slice(0,3).map(p=>pdfBoxText(p,{left,right,...bounds(p)})).filter(Boolean).join(' ')
 const title=pdfBoxText(first,{left:78,right:178,...bounds(first)}),responsibilities=cell(362,511),criteria=cell(511,674)
 const mode=cell(178,249),ctc=cell(249,305),maximumAge=cell(305,362),count=cell(674,717),workplace=cell(717,766)
 need(titleKey(title)===titleKey(listedPostTitle(listing)),'listed role and native PDF post identity conflict')
 need(responsibilities.length>500&&/Key Responsibilities/.test(responsibilities)&&criteria.length>500&&/Qualification:/.test(criteria),'complete current native role columns unavailable')
 need(workplace&&mode&&/^\d+$/.test(count)&&Number(count)>0&&Number(count)<=10000,'native role metadata unavailable')
 const boundary=pdf.pages.findIndex(p=>/[\u0900-\u097f]/.test(p.text)),english=boundary===-1?pdf.pages:pdf.pages.slice(0,boundary)
 need(english.length>=3&&/English version will prevail/.test(normalize(pdf.text)),'complete primary-language version unavailable')
 need(boundary===-1||pdf.pages.slice(boundary).every(p=>/[\u0900-\u097f]/.test(p.text)),'unreviewed primary-language appendix after translated version')
 const primaryEnglishText=english.map(p=>p.text).join('\n\n')
 const role={title,mode,ctc,maximumAge,responsibilities,criteria,numberOfPosts:Number(count),workplace}
 const country=bindNativeDeploymentCountry({pages:english,role,sha256:pdf.sha256})
 const observation=makeListingObservation(listing,page,clock)
 return {...observation,title,jobDescription:primaryEnglishText,sourceDescription:primaryEnglishText,nativeWorkplace:workplace,
  country:country.country,location:country.country?workplace:null,sourceCountryScopeUnresolved:!country.country,
  sourceWorksiteCountryProof:country.proof,sourceDetailFailureKind:country.country?'native-closing-unreconciled':'native-country-unproven',
  nativeHiringOrganization:{name:employer,url:'https://cdot.in/'},sourceEmploymentType:mode,employmentType:/^Contractual\b/.test(mode)?'Contract':null,
  numberOfOpenings:Number(count),experienceRequired:criteria.match(/Experience\s*-\s*(Fresher to \d+ Years)/)?.[1]??null,
  minimumQualification:criteria.match(/Qualification:\s*([\s\S]+?)\s*Desired Skills:/)?.[1]??null,
  nativeSourceRecord:{listing:structuredClone(listing),index:{identity:structuredClone(page.identity),schemas:structuredClone(page.schemas)},role,pdf,primaryEnglishPages:english.map(p=>p.number)},
  sourceNativePDFSHA256:pdf.sha256,sourceNativePDFPages:pdf.totalPages,sourceNativePDFText:pdf.text,sourceDescriptionPages:english.map(p=>p.number),
  sourceNativePDFRendererFontAliases:rendererFontAliases,
  sourceNativeCriteriaContainerRetained:true,sourceStructuredRoleCriteria:structuredClone(role),
  sourceNativeCountryContext:{nativeWorkplace:workplace,documentEmployerJurisdiction:'Government of India',
   domesticPostingClause:normalize(pdf.text).match(/If selected, the candidates can be posted to any Project \/ location throughout the country\./)?.[0]??null,
   country:country.country,contextualBinding:Boolean(country.proof),literalRoleCountry:false,
   reason:country.reason??country.proof.interpretation}}
}
