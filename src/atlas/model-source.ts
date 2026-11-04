import lock from "../../data/models.lock.json";

/** Versioned folder, so model files can be cached forever. */
export const MODEL_VERSION: string = lock.version;
export const MODEL_BASE = `/models/${MODEL_VERSION}/`;
export const ATLAS_URL = `${MODEL_BASE}atlas.json`;
