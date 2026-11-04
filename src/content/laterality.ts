export type Side = "left" | "right";

const SIDE = /\b(left|right)\b/i;

/** The body side named in a structure's name, if any. */
export function sideOf(name: string): Side | null {
  const match = SIDE.exec(name);
  return match ? (match[1]!.toLowerCase() as Side) : null;
}

/** The same name for the other side of the body ("Left femur" → "Right femur"). */
export function mirrorName(name: string): string | null {
  if (!SIDE.test(name)) return null;
  return name.replace(SIDE, (word) => {
    const swapped = word.toLowerCase() === "left" ? "right" : "left";
    return word[0] === word[0]!.toUpperCase()
      ? swapped[0]!.toUpperCase() + swapped.slice(1)
      : swapped;
  });
}
