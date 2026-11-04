import { sideOf } from "../content/laterality.ts";

export type TypedGrade = "correct" | "close" | "wrong";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bthe\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length]!;
}

/**
 * Grade a typed name. Small spelling slips count ("close"), but the side must match exactly,
 * because left versus right is part of what is being tested.
 */
export function gradeTyped(input: string, answer: string): TypedGrade {
  const given = normalize(input);
  const expected = normalize(answer);
  if (!given) return "wrong";
  if (given === expected) return "correct";
  if (sideOf(given) !== sideOf(expected)) return "wrong";
  const allowed = Math.max(1, Math.floor(expected.length * 0.15));
  return levenshtein(given, expected) <= allowed ? "close" : "wrong";
}
