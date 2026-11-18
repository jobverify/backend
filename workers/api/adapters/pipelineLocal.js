import { unavailable } from './unavailable.js';
export const localEnabled = () => false;
export function launchLocal() { throw unavailable('Local pipeline execution'); }
export async function readLocalLog() { throw unavailable('Local pipeline logs'); }
// A cloud API cannot determine whether an external local runner has died.
// Preserve its status rather than falsely interrupting a running pipeline.
export async function reconcileLocal(run) { return run; }
