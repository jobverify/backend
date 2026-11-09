import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {qualifiedFirstPartyHTML,clean,descendants,retained,nativeText,nativeLines,authoredNativeLines,exactlyOne,requireNative} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const CURRENT_CAREERS_URL='https://codewave.com/careers'
export const LEGACY_CAREERS_URL='https://codewave.com/careers/'
export const APPLICATION_ENTRY_URL='https://codewave.com/apply'
const failure=message=>firstPartyFailure('codewavetechnologies',message)
const need=(value,message)=>requireNative(value,message,failure)
const one=(rows,label)=>exactlyOne(rows,label,failure)
const titleKey=value=>clean(value).replace(/\.$/,'').toLowerCase()
const locationParts=value=>clean(value).split(/\s*[,/]\s*/).filter(Boolean)
export function extractCurrentOpenings(html,{check=()=>{}}={}){
 check()
 const page=qualifiedFirstPartyHTML(html,CURRENT_CAREERS_URL,failure),doc=page.visible
 need(page.title==='Careers at Codewave | Bring your whole self | Codewave','Current employer careers title changed')
 const retainedMain=one(retained(page.root,node=>node.tag==='main'),'retained careers main')
 need(retainedMain.attrs.id==='main','Current careers main identity changed')
 const main=one(doc.nodes(node=>node.tag==='main'&&node.attrs.id==='main'),'active careers main')
 const career=one(descendants(main,node=>doc.hasClass(node,'careers-page')),'native careers article')
 const scope=one(descendants(career,node=>node.tag==='section'&&node.attrs.id==='openings'&&doc.hasClass(node,'careers-openings')),'native openings section')
 const nodes=descendants(scope,node=>node.tag==='details'&&doc.hasClass(node,'job-row'))
 need(nodes.length>0&&nodes.length<=1000,'Missing or excessive native expandable role records')
 need(nodes.length===doc.nodes(node=>node.tag==='details'&&doc.hasClass(node,'job-row')).length,'Native records exist outside the qualified careers scope')
 const ids=new Set()
 const rows=nodes.map(node=>{
  check()
  const id=node.attrs['data-job-id'];need(typeof id==='string'&&/^[1-9]\d{0,19}$/.test(id)&&!ids.has(id),'Invalid or repeated native post ID');ids.add(id)
  const summary=one(node.children.filter(child=>typeof child!=='string'&&child.tag==='summary'),'native role summary')
  const heading=one(descendants(summary,child=>child.tag==='h3'),'native role title')
  const title=clean(nativeText(heading));need(title.length>0,'Empty native role title')
  const label=clean(nativeText(one(descendants(summary,child=>doc.hasClass(child,'job-location')),'native role workplace label')))
  const nativeLocation=locationParts(label)
  need(nativeLocation.length>=1&&nativeLocation.length<=3,'Unqualified native workplace label')
  const country=nativeLocation.length===2?nativeCountryName(nativeLocation[1]):null
  const description=one(descendants(node,child=>doc.hasClass(child,'job-description')),'native expandable role criteria')
  const rawRow=one(page.raw.nodes(child=>child.tag==='details'&&child.attrs['data-job-id']===id),'original native role record')
  const rawDescription=one(descendants(rawRow,child=>page.raw.hasClass(child,'job-description')),'original native role criteria')
  const descriptionLines=authoredNativeLines(rawDescription),content=descriptionLines.join('\n')
  need(content.length>=100,'Native role criteria unavailable')
  const apply=one(descendants(description,child=>child.tag==='a'&&doc.hasClass(child,'job-apply')),'native role application entry')
  need(apply.attrs.href==='/apply'&&apply.attrs['data-apply-job']===id,'Native application post binding changed')
  need(titleKey(apply.attrs['data-apply-title'])===titleKey(title),'Native application title binding changed')
  const applicationLocation=locationParts(apply.attrs['data-apply-location'])
  need(JSON.stringify(applicationLocation.map(value=>value.toLowerCase()))===JSON.stringify(nativeLocation.map(value=>value.toLowerCase())),'Native application workplace binding changed')
  const firstParagraph=descendants(description,child=>child.tag==='p')[0]
  const employment=firstParagraph?clean(nativeText(firstParagraph)):null
  return {jobId:id,requisitionId:null,title,company:'Codewave Technologies',department:null,
   location:clean(apply.attrs['data-apply-location']),city:nativeLocation.length===2?nativeLocation[0]:null,country,
   sourceCountryScopeUnresolved:country===null,sourceUrl:CURRENT_CAREERS_URL,applyUrl:APPLICATION_ENTRY_URL,applicationUrlIsGeneric:true,
   employmentType:/^(?:full[- ]?time|part[- ]?time|contract|internship)$/i.test(employment??'')?employment:null,
   experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   postingDate:null,closingDate:null,sourceClosingStatusVerified:false,firstEverPostedAt:null,nativeLegalEmployer:null,
   jobDescription:content,sourceDescription:content,sourceDescriptionLines:descriptionLines,
   sourceVisibleDescription:nativeLines(description).join('\n'),
   sourceNativeRoleEvidence:{nativePostId:id,summaryTitle:title,summaryLocation:label,
    applicationData:{href:apply.attrs.href,jobId:apply.attrs['data-apply-job'],title:apply.attrs['data-apply-title'],location:apply.attrs['data-apply-location']}},
   sourceApplicationHandoff:{kind:'native-role-data-and-first-party-application-entry',url:APPLICATION_ENTRY_URL,nativePostId:id,activationVerified:false},
   applicationVisited:false,sourceCriteriaPresentation:'authored-expandable-details-including-native-tooltip-definitions-and-hidden-offer-metadata;not-claimed-all-initially-visible',
   sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 })
 check();return rows
}
export const hasCurrentCareersSignal=html=>{try{return extractCurrentOpenings(html).length>0}catch{return false}}
export const currentSnapshot=rows=>JSON.stringify(rows.map(row=>({id:row.jobId,title:row.title,location:row.location,country:row.country,
 description:row.jobDescription,employmentType:row.employmentType,application:row.sourceNativeRoleEvidence.applicationData})))
