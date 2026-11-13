import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

// Literal formatting observed in the retained current native descriptions.
// A familiar CSS property does not authorize arbitrary values or layout rules.
const colors=new Set(['black','rgb(192,0,0)','rgb(0,0,0)','rgb(15,17,19)','rgb(197,0,68)','rgb(26,26,26)','rgb(192,24,45)','rgb(10,10,10)','rgba(0,0,0,0.9)','rgb(200,16,46)'])
const backgrounds=new Set(['transparent','rgb(255,255,255)','rgba(0,0,0,0)'])
const typography=new Set(['ql-font-sansserif','ql-font-serif','ql-align-justify','ql-indent-1','ql-size-small','ql-font-arial','ql-align-center','ql-cursor'])
const tags=new Set(['root','a','p','div','span','br','strong','em','b','i','u','s','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','pre','code','table','thead','tbody','tfoot','tr','th','td','dl','dt','dd'])
const rawText=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(rawText).join(' ')
const reviewedStyle=value=>value.split(';').filter(part=>part.trim()).every(part=>{
 const colon=part.indexOf(':');if(colon<0)return false
 const name=part.slice(0,colon).trim().toLowerCase(),literal=part.slice(colon+1).replace(/\s+/g,'').toLowerCase()
 return name==='color'?colors.has(literal):name==='background-color'?backgrounds.has(literal):false
})
export function hasReviewedCriterionRendering(node){
 if(typeof node==='string')return true
 if(!tags.has(node.tag)||node.nativeTagUnqualified)return false
 for(const [name,value]of Object.entries(node.attrs)){
  if(name==='style'){if(!reviewedStyle(value))return false}
  else if(name==='class'){
   const classes=value.split(/\s+/).filter(Boolean)
   if(classes.some(value=>!typography.has(value)))return false
   if(classes.includes('ql-cursor')&&rawText(node).replace(/[\u200b\ufeff]/g,'').trim())return false
  }else if(node.tag!=='a'||!['href','rel','target'].includes(name))return false
 }
 return node.children.every(hasReviewedCriterionRendering)
}
