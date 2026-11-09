import {createReviewedPublicSurface,publicDocument,publicText,publicTitles} from '../balajitelefilms/currentPublic.js'
const C='https://avglogistics.com/careers'
export const createCurrentAvg=()=>createReviewedPublicSurface({source:'avglogistics',url:C,inspect:(html,fail)=>{
 const doc=publicDocument(html),text=publicText(doc),rows=doc.nodes(node=>node.tag==='div'&&(node.attrs.class||'').trim()==='row g-4')
 if(publicTitles(doc).length!==1||!/Avg Logistics \|\| Green Logistics/.test(publicTitles(doc)[0])||!text.includes('Explore your Future at AVG')||!text.includes('Easily apply to multiple jobs with one click !')||!text.includes('AVG Logistics Limited')||rows.length!==1)throw fail('current employer/advertised jobs panel binding changed')
 const advertisedJobRow={observedElementCount:rows[0].children.filter(node=>typeof node==='object'&&node.tag!=='comment').length,nativeVacancyCount:null,qualification:'rendered-advertised-row-only;empty-markup-and-comments-do-not-declare-native-vacancy-total'},observation={kind:'unqualified-empty-advertised-jobs-panel',url:C,vacancy:false,country:null,postingDate:null,descriptionComplete:false,applicationActionPerformed:false}
 return{model:{advertisedJobRow},observations:[observation],advertisedJobRow,activeNativeHandoffs:[]}
}})
