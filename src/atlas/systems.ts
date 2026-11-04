import type { SystemId } from "./types";

export interface SystemInfo {
  id: SystemId;
  name: string;
  color: string;
  description: string;
}

// Names, colours and overview text adapted from human-atlas (MIT), tuned for this model.
export const SYSTEMS: readonly SystemInfo[] = [
  {
    id: "skeletal",
    name: "Skeleton",
    color: "#e2d9ba",
    description:
      "Bones form the supporting framework of the body, protect organs and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.",
  },
  {
    id: "muscular",
    name: "Muscles",
    color: "#a85b50",
    description:
      "Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilise posture and produce heat.",
  },
  {
    id: "cardiac",
    name: "Heart",
    color: "#b96760",
    description:
      "The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.",
  },
  {
    id: "sensory",
    name: "Sensory organs",
    color: "#b0c8ce",
    description:
      "These structures serve the special senses, including sight, hearing and balance. Their specialised tissues detect stimuli and pass signals to the nervous system.",
  },
  {
    id: "arterial",
    name: "Arteries",
    color: "#c05245",
    description:
      "Arteries carry blood away from the heart, to the tissues in the systemic circuit or to the lungs in the pulmonary circuit.",
  },
  {
    id: "venous",
    name: "Veins",
    color: "#527c9f",
    description:
      "Veins return blood toward the heart. Superficial and deep networks drain the tissues, and the pulmonary veins bring oxygenated blood back from the lungs.",
  },
  {
    id: "nervous",
    name: "Nervous system",
    color: "#d8b565",
    description:
      "The brain, spinal cord and peripheral nerves carry and process signals for sensation, movement, coordination and automatic regulation of the body.",
  },
  {
    id: "respiratory",
    name: "Respiratory",
    color: "#b98991",
    description:
      "The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood.",
  },
  {
    id: "digestive",
    name: "Digestive",
    color: "#b8916b",
    description:
      "The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs supply bile and digestive enzymes.",
  },
  {
    id: "urinary",
    name: "Urinary",
    color: "#b47961",
    description:
      "The kidneys filter blood and regulate fluid, electrolyte and acid–base balance. Urine passes through the ureters to the bladder and leaves through the urethra.",
  },
  {
    id: "lymphatic",
    name: "Lymphatic",
    color: "#879f7c",
    description:
      "Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune responses.",
  },
  {
    id: "endocrine",
    name: "Endocrine",
    color: "#c5a09a",
    description:
      "Endocrine organs release hormones into the blood to coordinate metabolism, growth, stress responses and reproduction.",
  },
  {
    id: "reproductive",
    name: "Reproductive",
    color: "#bda098",
    description:
      "The male reproductive structures shown here produce, mature and transport sperm, and produce sex hormones.",
  },
  {
    id: "integumentary",
    name: "Body surface",
    color: "#ba9b7d",
    description:
      "The body surface gives an outer anatomical reference. The skin forms a protective barrier and contributes to sensation and temperature regulation.",
  },
  {
    id: "connective",
    name: "Connective tissue",
    color: "#aec3bb",
    description:
      "Cartilage, ligaments and other connective tissues support, connect and separate structures, stabilising joints and spreading mechanical loads.",
  },
  {
    id: "pregnancy",
    name: "Pregnancy reference",
    color: "#c9a2a8",
    description:
      "Placental structures from the female reference set, hidden by default. They show the placenta and its vessels, not a full pregnancy.",
  },
];

export const SYSTEM_BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));
export const SYSTEM_IDS = SYSTEMS.map((s) => s.id);

/** Everything except the translucent body surface and the pregnancy reference. */
export const DEFAULT_VISIBLE: readonly SystemId[] = SYSTEM_IDS.filter(
  (id) => id !== "integumentary" && id !== "pregnancy",
);

export const PRESETS: readonly { id: string; label: string; systems: readonly SystemId[] }[] = [
  { id: "all", label: "All", systems: DEFAULT_VISIBLE },
  { id: "skeleton", label: "Skeleton", systems: ["skeletal"] },
  { id: "muscles", label: "Muscles", systems: ["skeletal", "muscular"] },
  {
    id: "organs",
    label: "Organs",
    systems: ["cardiac", "respiratory", "digestive", "urinary", "endocrine", "reproductive"],
  },
  { id: "vessels", label: "Vessels", systems: ["cardiac", "arterial", "venous"] },
];

export function isSystemId(value: string): value is SystemId {
  return SYSTEM_BY_ID.has(value as SystemId);
}
