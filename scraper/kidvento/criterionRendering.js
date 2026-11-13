// Complete literal declarations reviewed in the current native descriptions.
// Negative margins, invisible colors, positioning and unknown classes remain held.
const styles=new Map([
 ['margin-top',new Set(['0px'])],['margin-bottom',new Set(['0px'])],
 ['padding-left',new Set(['1.5em'])],['margin-left',new Set(['1.5em'])],
 ['list-style-type',new Set(['disc'])],['text-align',new Set(['justify'])],
 ['color',new Set(['rgb(0,0,0)'])],['background-color',new Set(['rgb(255,255,255)','transparent'])],
])
const tags=new Set(['root','a','p','div','span','br','strong','em','b','i','u','s','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','pre','code','table','thead','tbody','tfoot','tr','th','td','dl','dt','dd'])
const reviewedStyle=value=>value.split(';').filter(part=>part.trim()).every(part=>{
 const colon=part.indexOf(':');if(colon<0)return false
 const name=part.slice(0,colon).trim().toLowerCase(),literal=part.slice(colon+1).replace(/\s+/g,'').toLowerCase()
 return styles.get(name)?.has(literal)===true
})
export function hasReviewedCriterionRendering(node){
 if(typeof node==='string')return true
 if(!tags.has(node.tag)||node.nativeTagUnqualified)return false
 for(const [name,value]of Object.entries(node.attrs)){
  if(name==='style'){if(!reviewedStyle(value))return false}
  else if(node.tag!=='a'||!['href','rel','target'].includes(name))return false
 }
 return node.children.every(hasReviewedCriterionRendering)
}
