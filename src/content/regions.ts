import type { Part } from "../atlas/types.ts";

export type RegionId =
  "head_neck" | "thorax" | "abdomen" | "pelvis" | "back" | "upper_limb" | "lower_limb";

export interface RegionInfo {
  id: RegionId;
  name: string;
}

/** The regions most anatomy courses are taught in. */
export const REGIONS: readonly RegionInfo[] = [
  { id: "head_neck", name: "Head and neck" },
  { id: "thorax", name: "Thorax" },
  { id: "abdomen", name: "Abdomen" },
  { id: "pelvis", name: "Pelvis and perineum" },
  { id: "back", name: "Back" },
  { id: "upper_limb", name: "Upper limb" },
  { id: "lower_limb", name: "Lower limb" },
];

export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
export const REGION_IDS = REGIONS.map((r) => r.id);

export function isRegionId(value: string): value is RegionId {
  return REGION_BY_ID.has(value as RegionId);
}

// Exceptions that would otherwise hit a broader rule below.
const OVERRIDES: [RegExp, RegionId][] = [
  [/brachiocephalic/, "thorax"],
  [/\b(lateral|third|fourth) ventricle\b/, "head_neck"],
  [/\bvertebral (artery|vein)\b/, "head_neck"],
  [/\bsubclavian\b/, "thorax"],
  [/colliculus|geniculate|eyelid|tarsal plate/, "head_neck"],
  [/\b(transverse|deep|superficial) cervical\b|\blongus (colli|capitis)\b/, "head_neck"],
  [/\b(lumbar|thoracic|cervical) rotator\b/, "back"],
  [/\b(subscapular|suprascapular|circumflex scapular|subclavius)\b/, "upper_limb"],
];

// Checked in this order; the first match wins. Limbs come first because their muscle names are
// the most specific ("extensor digitorum longus" is in the leg, "extensor digitorum" the forearm).
const RULES: [RegionId, RegExp][] = [
  [
    "lower_limb",
    /\b(lower limb|thigh|leg|knee|ankle|foot|toes?|hallu\w*|femur|femoral|tibi\w*|fibul\w*|patell\w*|tars\w*|metatars\w*|calcane\w*|talus|navicular|cuboid|cuneiform|plantar|popliteal|glute\w*|sartorius|quadriceps|rectus femoris|vast\w*|gracilis|adductor (longus|brevis|magnus|minimus|hallucis)|pectineus|biceps femoris|semitendinosus|semimembranosus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|extensor (hallucis|digitorum longus|digitorum brevis)|flexor (hallucis|digitorum longus|digitorum brevis)|saphenous|sciatic|obturator nerve|piriformis|gemellus|quadratus femoris|tensor fasciae latae|iliotibial)\b/,
  ],
  [
    "upper_limb",
    /\b(upper limb|arm|forearm|hand|fingers?|thumb|wrist|elbow|shoulder|axill\w*|brachi\w*|humer\w*|radius|radial|ulna\w*|carp\w*|metacarp\w*|scaphoid|lunate|triquetr\w*|pisiform|trapezium|trapezoid bone|capitate|hamate|palm\w*|thenar|hypothenar|clavic\w*|scapul\w*|deltoid|supraspinatus|infraspinatus|teres|subscapularis|biceps brachii|triceps|coracobrachialis|pronator|supinator|flexor (carpi|digitorum|pollicis)|extensor (carpi|digitorum|pollicis|indicis)|abductor pollicis|adductor pollicis|opponens|anconeus|cephalic|basilic|median nerve|musculocutaneous|pectoralis|serratus anterior)\b/,
  ],
  [
    "head_neck",
    /\b(head(?! of)|neck(?! of)|cran\w*|skull|brain|cerebr\w*|cerebell\w*|pons|medulla oblongata|midbrain|thalam\w*|hypothal\w*|hippocamp\w*|fornix|amygdala|eyes?|eyeball|ocul\w*|orbit\w*|optic|retina|lens|cornea|ears?|auricular|cochle\w*|tympan\w*|nasal|nose|tooth|teeth|incisor|canine|premolar|molar|gingiva|tongue|lingual|palat\w*|mandib\w*|maxill\w*|zygomat\w*|frontal|parietal|occipital|temporal|sphenoid\w*|ethmoid\w*|vomer|lacrimal|hyoid|larynx|laryng\w*|pharyn\w*|thyroid|parathyroid|parotid|submandibular|sublingual|tonsil\w*|facial|masseter|buccinator|pterygoid|sternocleidomastoid|scalene|platysma|carotid|jugular|epiglott\w*|arytenoid|cricoid|vocal)\b/,
  ],
  [
    "back",
    /\b(vertebra\w*|atlas|axis|spinal|spine|spinous|intervertebral|sacrum|sacral|coccyx|erector spinae|iliocostalis|longissimus|spinalis|semispinalis|multifid\w*|rotatores|splenius|trapezius|latissimus|rhomboid\w*|levator scapulae|serratus posterior|quadratus lumborum|interspinal\w*|intertransvers\w*|cauda equina)\b/,
  ],
  [
    "pelvis",
    /\b(pelv\w*|bladder|prostat\w*|rectum|rectal|anal|anus|ureth\w*|testis|testic\w*|epididym\w*|spermatic|seminal|ductus deferens|vas deferens|penis|penile|scrot\w*|perine\w*|hip bone|ilium|iliac|ischi\w*|pubis|pubic|obturator|levator ani|coccygeus|ejaculatory|bulbourethral|corpus cavernosum|corpus spongiosum)\b/,
  ],
  [
    "abdomen",
    /\b(abdom\w*|stomach|gastr\w*|duoden\w*|jejun\w*|ileum|ileal|ileo\w*|cecum|caecum|appendix|colon|colic|sigmoid|liver|hepat\w*|bile|biliary|gallbladder|cystic duct|pancrea\w*|spleen|splen\w*|kidney|renal|suprarenal|adrenal|ureter|mesenter\w*|omentum|omental|perito\w*|celiac|coeliac|portal vein|inferior vena cava|rectus abdominis|external oblique|internal oblique|transversus abdominis|psoas|iliacus|lumbar)\b/,
  ],
  [
    "thorax",
    /\b(thora\w*|heart|cardiac|atrium|atrial|ventricles?|valve|mitral|tricuspid|pulmonary|lungs?|bronch\w*|trachea\w*|pleura\w*|mediastin\w*|pericard\w*|esophag\w*|oesophag\w*|ribs?|costal|intercostal|stern\w*|xiphoid|azygos|hemiazygos|thymus|coronary|aorta|aortic|superior vena cava|papillary muscle|chordae|myocard\w*|auricle|diaphragm)\b/,
  ],
];

export function regionByName(name: string): RegionId | null {
  const text = name.toLowerCase();
  for (const [pattern, region] of OVERRIDES) if (pattern.test(text)) return region;
  for (const [region, pattern] of RULES) if (pattern.test(text)) return region;
  return null;
}

/**
 * Fallback from the mesh's position. Model space: metres, +y superior, +x the body's left,
 * +z anterior. Landmarks: top of femur ≈ 0.91 m, clavicle ≈ 1.41 m, humerus |x| ≥ 0.14 m.
 */
export function regionByPosition(part: Pick<Part, "bounds">): RegionId {
  const [min, max] = part.bounds;
  const x = Math.abs(((min[0] ?? 0) + (max[0] ?? 0)) / 2);
  const y = ((min[1] ?? 0) + (max[1] ?? 0)) / 2;
  const z = ((min[2] ?? 0) + (max[2] ?? 0)) / 2;
  if (x > 0.18 && y > 0.6) return "upper_limb";
  if (y < 0.83) return "lower_limb";
  if (y > 1.3 && x > 0.15) return "upper_limb";
  if (y > 1.45) return "head_neck";
  if (z < -0.055) return "back";
  if (y < 1.0) return "pelvis";
  if (y < 1.2) return "abdomen";
  return "thorax";
}

/**
 * Region of one mesh: its own name first, then the names of the small groups it belongs to
 * (nearest first), then its position.
 */
export function regionOfPart(
  part: Pick<Part, "name" | "bounds">,
  groupNames: readonly string[] = [],
): { region: RegionId; source: "name" | "group" | "position" } {
  const own = regionByName(part.name);
  if (own) return { region: own, source: "name" };
  for (const name of groupNames) {
    const region = regionByName(name);
    if (region) return { region, source: "group" };
  }
  return { region: regionByPosition(part), source: "position" };
}
