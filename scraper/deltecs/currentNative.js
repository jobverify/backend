import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {qualifiedFirstPartyHTML,clean,descendants,retained,nativeText,nativeLines,authoredNativeLines,comparable,exactlyOne,requireNative} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const HOMEPAGE_URL='https://www.dronahq.com/'
export const CAREERS_URL='https://www.dronahq.com/careers/'
const failure=message=>firstPartyFailure('deltecs',message)
const need=(value,message)=>requireNative(value,message,failure)
const one=(rows,label)=>exactlyOne(rows,label,failure)
export const isCurrentRoleURL=value=>{try{const url=new URL(value);return url.href===value&&url.origin==='https://www.dronahq.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/career\/[a-z0-9-]+\/$/.test(url.pathname)}catch{return false}}
const owned=page=>{
 const policies=retained(page.root,node=>page.raw.hasClass(node,'right-policy'))
 one(policies,'retained employer legal copyright block')
 const policy=one(page.visible.nodes(node=>page.visible.hasClass(node,'right-policy')),'active employer legal copyright block')
 need(/^Copyright © Deltecs Infotech Pvt Ltd\. All Rights Reserved$/.test(clean(nativeText(policy))),'Native Deltecs employer ownership changed')
}
export function parseCurrentHomepage(html){
 const page=qualifiedFirstPartyHTML(html,HOMEPAGE_URL,failure)
 need(page.title==='DronaHQ: Enterprise Platform for AI Apps & Agents'||page.title==='DronaHQ | Enterprise platform to build apps and agents faster','Current employer homepage title changed')
 owned(page)
 need(page.visible.nodes(node=>node.tag==='a'&&['https://www.dronahq.com/careers/','/careers/'].includes(node.attrs.href)&&/careers/i.test(nativeText(node))).length>0,'Native careers navigation unavailable')
 return {title:page.title,careersUrl:CAREERS_URL,employer:'Deltecs Infotech Pvt Ltd'}
}
export const hasCurrentHomepageSignal=html=>{try{parseCurrentHomepage(html);return true}catch{return false}}
export function extractCurrentListings(html){
 const page=qualifiedFirstPartyHTML(html,CAREERS_URL,failure),doc=page.visible
 need(page.title==='Careers at DronaHQ','Current careers title changed');owned(page)
 const scope=one(doc.nodes(node=>doc.hasClass(node,'job-listing')),'native current vacancy scope')
 need(/Open Positions at DronaHQ/.test(clean(nativeText(scope))),'Native vacancy heading changed')
 const cards=descendants(scope,node=>doc.hasClass(node,'job-card'))
 need(cards.length>0&&cards.length<=64&&cards.length===doc.nodes(node=>doc.hasClass(node,'job-card')).length,'Missing, excessive or outside-scope native vacancy cards')
 const urls=new Set()
 return cards.map(card=>{
  const heading=one(descendants(card,node=>node.tag==='h3'),'native vacancy heading')
  const link=one(descendants(heading,node=>node.tag==='a'),'native vacancy link')
  const sourceUrl=link.attrs.href,title=clean(nativeText(link))
  need(title&&isCurrentRoleURL(sourceUrl)&&!urls.has(sourceUrl),'Invalid or duplicate native vacancy identity');urls.add(sourceUrl)
  const apply=one(descendants(card,node=>node.tag==='a'&&doc.hasClass(node,'apply-btn')),'native vacancy application entry')
  need(apply.attrs.href===sourceUrl,'Native vacancy application URL differs from role')
  const info=one(descendants(card,node=>doc.hasClass(node,'job-other-info')),'native vacancy metadata')
  const values=info.children.filter(node=>typeof node!=='string'&&node.tag==='span').map(node=>clean(nativeText(node)))
  need(values.length===3&&values.every(Boolean),'Native vacancy metadata changed')
  return {title,sourceUrl,location:values[0],country:nativeLocationCountryName(values[0]),workplaceType:values[1],experienceRequired:values[2]}
 })
}
export function extractCurrentDetail(html,listing){
 need(isCurrentRoleURL(listing.sourceUrl),'Unbound native role identity')
 const page=qualifiedFirstPartyHTML(html,listing.sourceUrl,failure),doc=page.visible;owned(page)
 need(page.title===listing.title+' - DronaHQ','Native role page title changed')
 const post=one(doc.nodes(node=>/^post-[1-9]\d*$/.test(node.attrs.id??'')&&doc.hasClass(node,'career')&&doc.hasClass(node,'type-career')&&doc.hasClass(node,'status-publish')),'published native career post')
 const postId=post.attrs.id.slice(5)
 need(page.raw.hasClass(page.body,'post-'+postId),'Native post body identity changed')
 need(retained(page.root,node=>node.attrs.id===post.attrs.id).length===1,'Retained native post ID is ambiguous')
 const scope=one(descendants(post,node=>doc.hasClass(node,'job-listing')),'native role detail scope')
 const heading=one(descendants(scope,node=>node.tag==='h1'&&doc.hasClass(node,'job-title')),'native role title')
 need(clean(nativeText(heading))===listing.title,'Native visible role title differs from listing')
 const copy=one(descendants(scope,node=>doc.hasClass(node,'job-url-wrapper')),'native role URL')
 need(clean(nativeText(copy))===listing.sourceUrl,'Native visible role URL identity changed')
 const locationScope=one(descendants(scope,node=>doc.hasClass(node,'job-location-wrapper')),'native workplace field')
 const workplace=descendants(locationScope,node=>node.tag==='span'&&!doc.hasClass(node,'location')&&!doc.hasClass(node,'wokr-type')
  &&!node.children.some(child=>typeof child!=='string'&&child.tag==='span')&&clean(nativeText(node)))
 const location=clean(nativeText(one(workplace,'native workplace value')))
 need(location===listing.location,'Native listing/detail workplace conflict')
 const workMode=clean(nativeText(one(descendants(scope,node=>node.tag==='span'&&doc.hasClass(node,'wokr-type')),'native work mode')))
 need(workMode===listing.workplaceType,'Native listing/detail work-mode conflict')
 const field=(name,label)=>{
  const block=one(descendants(scope,node=>doc.hasClass(node,name)),'native '+label+' field')
  const values=block.children.filter(node=>typeof node!=='string'&&node.tag==='span').map(node=>clean(nativeText(node)))
  need(values.length===2&&values[0].toLowerCase()===label.toLowerCase()&&values[1],'Native '+label+' value unavailable')
  return values[1]
 }
 const employmentType=field('job-type-wrapper','Job type'),experience=field('job-experience','Experience')
 need(experience===listing.experienceRequired,'Native listing/detail experience conflict')
 const sections=descendants(scope,node=>doc.hasClass(node,'job-summary-wrapper')||doc.hasClass(node,'job-responsibilities-wrapper'))
 need(sections.length>=4&&sections.length<=12,'Native criteria section count changed')
 const labels=sections.map(section=>clean(nativeText(one(descendants(section,node=>/^h[23]$/.test(node.tag)),'native criteria section heading'))))
 need(['Role Overview','Key Responsibilities','Must-Have Skills','Why join us?'].every(name=>labels.includes(name))&&new Set(labels).size===labels.length,'Native criteria sections incomplete or ambiguous')
 const rawPost=one(retained(page.root,node=>node.attrs.id===post.attrs.id),'retained original native post')
 const rawScope=one(retained(rawPost,node=>page.raw.hasClass(node,'job-listing')),'retained original detail scope')
 const authoredSections=retained(rawScope,node=>page.raw.hasClass(node,'job-summary-wrapper')||page.raw.hasClass(node,'job-responsibilities-wrapper'))
 need(authoredSections.length===sections.length,'Native criteria section content is hidden or incomplete')
 const descriptionLines=sections.flatMap((section,index)=>{
  const lines=nativeLines(section),authored=authoredNativeLines(authoredSections[index])
  need(lines.some(line=>clean(line)!==labels[index]),'Native criteria section has no non-heading content')
  need(comparable(lines.join(' '))===comparable(authored.join(' ')),'Native criteria section content is hidden or incomplete')
  return lines
 }),description=descriptionLines.join('\n')
 need(description.length>=100,'Native full criteria unavailable')
 const button=one(descendants(scope,node=>doc.hasClass(node,'apply-btn')),'native role application button')
 need(button.tag==='a'||button.tag==='button','Native application control kind changed')
 need(button.attrs['data-job-title']===listing.title&&!button.attrs.href,'Native application role-title binding changed')
 const country=nativeLocationCountryName(location)
 return {jobId:postId,requisitionId:null,title:listing.title,company:'Deltecs',department:null,
  location,city:location.split(',')[0].trim(),country,sourceCountryScopeUnresolved:country===null,
  sourceUrl:listing.sourceUrl,applyUrl:listing.sourceUrl,employmentType,workplaceType:workMode,experienceRequired:experience,
  minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,
  sourceClosingStatusVerified:false,firstEverPostedAt:null,nativeLegalEmployer:null,
  jobDescription:description,sourceDescription:description,sourceDescriptionLines:descriptionLines,
  sourceNativeRoleEvidence:{nativePostId:postId,canonicalURL:listing.sourceUrl,visibleTitle:listing.title,visibleLocation:location,
   nativeApplicationTitle:button.attrs['data-job-title'],nativeCriteriaSectionLabels:labels},
  sourceApplicationHandoff:{kind:'native-title-bound-application-button-on-role-page',url:listing.sourceUrl,nativePostId:postId,activationVerified:false},
  applicationVisited:false,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
export const listingSnapshot=rows=>JSON.stringify(rows)
