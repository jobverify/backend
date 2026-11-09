import {createHash} from 'node:crypto'

const sha=value=>createHash('sha256').update(value).digest('hex')
const reviewedBodySha256='ea890474613f743b38e2dcdb8bc342ea28e42ab869b9ecfe1a1f28fad4e4ab58'
const comparison=name=>'<a href="/comparisons/snowplow-vs-'+name+'" class="footer1_link">vs. '+({ 'google-analytics':'Google Analytics',adobe:'Adobe',segment:'Segment' })[name]+'</a>'
const substitutions=[
 {before:'<div class="pm-label pm-next">Real-time</div>',after:'<div class="pm-label pm-next">Real-time &amp; agentic</div>'},
 {before:'<div class="footer1_link heading">Real-Time</div>',after:'<div class="footer1_link heading">Real-Time &amp; Agentic</div>'},
 {before:comparison('google-analytics')+comparison('segment'),after:comparison('google-analytics')+comparison('adobe')+comparison('segment')},
]

// Three original current marketing edits, at their exact reviewed locations,
// must reconstruct every byte of the earlier reviewed corporate document.
// Do not strip navigation/footer trees or substitute the response given to the
// native reader. All hiring cards, programs, styles, controls and hidden/raw
// content remain bound by the complete prior document hash.
export function reviewSnowplowCorporateChrome(body){
 if(typeof body!=='string')return null
 let reconstructed=body
 for(const{before,after}of substitutions){
  if(reconstructed.split(after).length!==2)return null
  reconstructed=reconstructed.replace(after,before)
 }
 if(sha(reconstructed)!==reviewedBodySha256)return null
 return{
  policy:'snowplow-three-exact-marketing-chrome-edits-20261109',
  originalBodySha256:sha(body),reviewedBodySha256,substitutionCount:substitutions.length,
  evidence:{snapshot:'scraper/snowplow/test-data/corporate-chrome-20261109.json.gz',snapshotSha256:'71594c7e2c8fab83fbd7efff5a54386bf3799cf5768466f09f1ab8f98af64db9'},
  originalResponseRetained:true,completeReviewedDocumentReconstructed:true,
 }
}
