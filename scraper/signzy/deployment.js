import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import previous from './currentConfig.json' with {type:'json'}
import reviewed from './deployment20261114.json' with {type:'json'}
const current={...previous,routeUrl:reviewed.routeUrl,routeSha256:reviewed.routeSha256,
 bridgeUrl:reviewed.bridgeUrl,bridgeSha256:reviewed.bridgeSha256,assets:reviewed.assets,
 baselines:{...previous.baselines,[previous.officialUrl]:reviewed.corporateScope,
  $renderers:{...previous.baselines.$renderers,...reviewed.rendererSHA256}}}
// A reviewed deployment must be declared by the fetched corporate page. Keep
// the original deployment for reproducible observations; never request its
// retired assets as a fallback for a different current page.
export function selectCurrentSignzyDeployment(html){
 const urls=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.src)
  .map(node=>new URL(node.attrs.src,previous.officialUrl).href)
 const matches=[previous,current].filter(value=>urls.filter(url=>url===value.routeUrl).length===1
  &&urls.filter(url=>url===value.bridgeUrl).length===1)
 if(matches.length!==1)throw Error('Signzy native inventory: unreviewed declared corporate deployment')
 return matches[0]
}
