import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261114.json',import.meta.url)))
const employerDescriptions=new Set(profile.employerDescriptionSHA256)
const sha=value=>createHash('sha256').update(value).digest('hex')

// Directly reviewed original current criteria use static p/strong/br/span/ul/li
// formatting. No criterion class, client trigger, event, link or hidden subtree
// is qualified by this finite render review. Hold new activation for review.
const tags=new Set(['root','p','strong','br','span','ul','li'])
const styles={p:new Set(['text-align: justify']),span:new Set([
 'font-family: sans-serif','font-size: 11pt','font-size: 16pt',
 'color: rgba(0, 0, 0, 1)','color: rgba(17, 85, 204, 1)',
])}
export const qualifiesCurrentNaviCriteria=value=>{
 if(value==null||value==='')return true
 if(typeof value!=='string'||/<[!?]/.test(value))return false
 try{
  const root=readNativeDocument(value).nodes(node=>node.tag==='root')[0],pending=[root]
  while(pending.length){const node=pending.pop()
   if(!node||node.inert||node.nativeTagUnqualified||!tags.has(node.tag))return false
   for(const [key,attribute]of Object.entries(node.attrs))if(key!=='style'||!styles[node.tag]?.has(attribute))return false
   pending.push(...node.children.filter(child=>typeof child!=='string'))
  }
  return true
 }catch{return false}
}

export const qualifiesCurrentNaviSupplementaryCriteria=detail=>{
 if(detail.ShowClientName!==false||typeof detail.ClientDesc!=='string'||!employerDescriptions.has(sha(detail.ClientDesc)))return false
 if(detail.Skills!=null&&(!Array.isArray(detail.Skills)||!detail.Skills.every(skill=>typeof skill==='string'&&skill.trim())))return false
 const experience=detail.Experience
 if(experience!=null){
  if(typeof experience!=='object'||Array.isArray(experience)||Object.keys(experience).some(key=>!['MinExp','MaxExp'].includes(key)))return false
  for(const value of [experience.MinExp,experience.MaxExp])if(value!=null&&(!Number.isFinite(value)||value<0))return false
  if(experience.MinExp!=null&&experience.MaxExp!=null&&experience.MinExp>experience.MaxExp)return false
 }
 if(detail.JobTypeV2!=null&&typeof detail.JobTypeV2!=='string')return false
 if(detail.NumberOfVacancy!=null&&(!Number.isSafeInteger(detail.NumberOfVacancy)||detail.NumberOfVacancy<1))return false
 const compensation=detail.CTCInfo
 if(compensation!=null){
  if(typeof compensation!=='object'||Array.isArray(compensation)
   ||Object.keys(compensation).some(key=>!['CurrencyCode','Type','Min','Max','Negotiable','IsHidden','HiddenFrom'].includes(key)))return false
  for(const key of ['IsHidden','Negotiable'])if(compensation[key]!=null&&typeof compensation[key]!=='boolean')return false
  if(compensation.HiddenFrom!=null&&(!Array.isArray(compensation.HiddenFrom)||!compensation.HiddenFrom.every(value=>typeof value==='string')))return false
  for(const key of ['Min','Max'])if(compensation[key]!=null&&(!['string','number'].includes(typeof compensation[key])||!/^[0-9]+(?:\.[0-9]+)?$/.test(String(compensation[key]))))return false
  if(compensation.CurrencyCode!=null&&(typeof compensation.CurrencyCode!=='string'||!/^[A-Z]{3}$/.test(compensation.CurrencyCode)))return false
  if(compensation.Type!=null&&!['UNSPECIFIED','ANNUAL'].includes(compensation.Type))return false
  if(compensation.IsHidden===true&&!compensation.HiddenFrom?.includes('JobSeekers')&&(compensation.Min||compensation.Max||compensation.Negotiable))return false
 }
 return true
}

export const currentNaviPublicCriteria=detail=>{
 const withheld=detail.CTCInfo?.IsHidden===true||detail.CTCInfo?.HiddenFrom?.includes('JobSeekers')===true
 return{ClientDesc:detail.ClientDesc,Experience:detail.Experience??null,Skills:detail.Skills??null,
  JobTypeV2:detail.JobTypeV2??null,NumberOfVacancy:detail.NumberOfVacancy??null,
  CTCInfo:withheld?null:detail.CTCInfo??null,compensationWithheldByNativeVisibility:withheld}
}
