import type { ContentIndex, StudyItem } from "../content/content.ts";
import { nerveName, type CuratedData } from "../content/curated.ts";
import type { Definitions } from "../content/definitions.ts";
import { deckItems, type Deck } from "./decks.ts";
import { cardsFor, spatialRelation } from "./questions.ts";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clean = (s: string) => s.replace(/[\t\n\r]+/g, " ");

/**
 * Text cards for Anki (tab-separated, Anki 2.1.55+ header lines). Each answer links back to the
 * structure in the 3D view. Image cards are not exported yet.
 */
export function deckToAnki(
  deck: Deck,
  content: ContentIndex,
  curated: CuratedData,
  definitions: Definitions | null,
  origin: string,
): string {
  const items = deckItems(content, deck);
  const link = (item: StudyItem) =>
    `<br><a href="${origin}/#p=${item.partIds[0]}&iso=1">Open in 3D</a>`;
  const rows: string[][] = [];
  const tag = deck.name.replace(/[^A-Za-z0-9]+/g, "_");

  for (const item of items) {
    const def = definitions?.concepts[item.conceptId]?.definition;
    if (def) rows.push([`Which structure is this? ${def}`, item.name + link(item), tag]);
    if (item.parentName) {
      rows.push([`${item.name} is part of which structure?`, item.parentName + link(item), tag]);
    }
    if (
      item.muscle &&
      item.muscleName &&
      !rows.some((r) => r[0]?.startsWith(`${item.muscleName}:`))
    ) {
      const m = item.muscle;
      rows.push([`${item.muscleName}: origin?`, m.o + link(item), tag]);
      rows.push([`${item.muscleName}: insertion?`, m.i + link(item), tag]);
      rows.push([`${item.muscleName}: action?`, m.a + link(item), tag]);
      rows.push([
        `${item.muscleName}: nerve supply?`,
        `${nerveName(curated, m.n)} (${m.r})${link(item)}`,
        tag,
      ]);
    }
  }
  for (const card of cardsFor(items, ["spatial"])) {
    const a = content.byConcept.get(card.conceptId)!;
    const b = content.byConcept.get(card.otherId!)!;
    const relation = spatialRelation(a, b, card.axis!);
    if (relation === null) continue;
    const pair = {
      vertical: ["superior", "inferior"],
      depth: ["anterior", "posterior"],
      medial: ["medial", "lateral"],
    }[card.axis!];
    rows.push([
      `Is the ${lower(a.name)} ${pair[0]} or ${pair[1]} to the ${lower(b.name)}?`,
      `${pair[relation]}${link(a)}`,
      tag,
    ]);
  }
  const header = ["#separator:tab", "#html:true", "#tags column:3", `#deck:${clean(deck.name)}`];
  return [...header, ...rows.map((r) => r.map(clean).join("\t"))].join("\n") + "\n";
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/tab-separated-values" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
