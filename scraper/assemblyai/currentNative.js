import {runCurrentGreenhouseSource} from '../dataiku/currentNative.js'
import config from './currentConfig.json' with {type:'json'}
export const run=options=>runCurrentGreenhouseSource(config,options)
