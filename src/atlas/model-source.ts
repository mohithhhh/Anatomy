import male from "../../data/models.lock.json";
import female from "../../data/models-female.lock.json";

export type BodyId = "male" | "female";

export interface BodyInfo {
  label: string;
  base: string;
  atlasUrl: string;
  source: string;
  note: string;
}

/** Each body lives in a versioned folder, so its files can be cached forever. */
export const BODIES: Record<BodyId, BodyInfo> = {
  male: {
    label: "Male",
    base: `/models/${male.version}/`,
    atlasUrl: `/models/${male.version}/atlas.json`,
    source: "BodyParts3D",
    note: "Adult male reference anatomy",
  },
  female: {
    label: "Female",
    base: `/models/${female.version}/`,
    atlasUrl: `/models/${female.version}/${female.atlas}`,
    source: "HuBMAP HRA",
    note: "Female reference organ set; partial skeleton and muscle coverage",
  },
};

export const MODEL_VERSION: string = male.version;
export const MODEL_BASE = BODIES.male.base;
export const ATLAS_URL = BODIES.male.atlasUrl;
