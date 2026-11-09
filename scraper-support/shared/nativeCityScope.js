import {CANONICAL_CITIES} from '../utils/cities.js'
import {isJobInPublicLocationScope} from '../../src/utils/publicJobLocationScope.js'

// Unknown source countries remain unknown. Only whole city labels qualify;
// substring normalization must not turn a composite into an India city.
// Extra labels are reviewed source literals, never values from an API response.
export const isNativeBareCityInPublicScope=(label,{extraLabels=[]}={})=>{
 if(typeof label!=='string')return false
 const key=label.trim().replace(/\s+/g,' ').toLowerCase()
 if(!Object.hasOwn(CANONICAL_CITIES,key)&&!extraLabels.includes(key))return false
 return isJobInPublicLocationScope({country:null,location:label})
}
