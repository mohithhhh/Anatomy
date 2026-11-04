# Anatomy: Product Plan and Brainstorm

*Draft, Nov 4, 2026. Builds on "Human Atlas: Gaps and Build Opportunities".*

## The one-line bet

Human Atlas is a good 3D **viewer**. We build the **study tool**: the same free, no-login viewer, plus a way to learn, test yourself and remember what you learned, with every fact sourced.

Our edge is content and teaching method, not the 3D model. We fork the viewer and spend our effort on what it lacks.

---

## 1. What I found in the reference code (ashemag/human-atlas)

These facts come from reading the repository and `public/models/atlas.json` directly. They change some of the effort estimates in the gaps PDF.

| Finding | Why it matters |
|---|---|
| **All 2,234 meshes carry an FMA concept ID** (`conceptId: "FMA59763"`). | The info panel is a data-join problem, not a research problem. FMA IDs link to FMA definitions and synonyms, Wikidata (P1402), Uberon and MeSH. |
| **3,432 concepts, 1,925 of which group several meshes** (e.g. "vascular tree"). | We already have a part-of hierarchy, so we get "zoom out" quiz questions ("which larger structure is this part of?") and region grouping for free. |
| **1,229 parts are named Left/Right.** | A laterality quiz mode costs almost nothing to build. |
| **Each part has bounding boxes in metres, Y-up.** | We can generate thousands of spatial questions automatically ("Is the ulna medial or lateral to the radius?"). See idea A1. |
| **Descriptions are 15 hard-coded paragraphs, one per system** (`app/anatomy.ts`). | Confirms the PDF: no structure has its own text. |
| **No URL state.** The only `location` use is a reload button. | Deep links and shareable views are greenfield. |
| **System coverage is lopsided:** arterial 639, venous 404, muscular 402, skeletal 296, nervous 139 … lymphatic 3, endocrine 4, urinary 6, reproductive 12. | Quizzes should start where the data is dense: musculoskeletal, vascular and nervous. We shouldn't promise deep endocrine or lymphatic coverage. |
| **A female reference set was shipped before and later removed**: HuBMAP *3D Reference Organ Set for Female v1.5*, CC BY 4.0 (see `public/ATTRIBUTION.md`, "Historical assets"). | **This corrects the PDF**, which found only paid female assets. A free, open female body exists. Its skeleton and muscle coverage is partial, but organs and reproductive anatomy are there. That moves "female body" from *hard* to *medium*. |
| **BodyParts3D 4.0 is officially CC BY 4.0.** The attribution file says the current database license supersedes the old CC BY-SA 2.1 Japan text in the OBJ comments. | That settles the geometry license. **Wikipedia text (CC BY-SA) is still the share-alike risk**, so we avoid it as a primary source. |
| **WebMCP tools already exist** (`find_anatomy`, `inspect_anatomical_structure`). | AI agents can already drive the viewer. We can extend these tools instead of building a chatbot from scratch (idea D2). |
| **The code is dense:** about 80 KB of source, with lines thousands of characters long (`page.tsx` is 14.5 KB in 52 lines). The build pulls in `vinext`, `@openai/sites-vite-plugin` and Cloudflare plugins. The repo is **155 MB** because the models are committed as both `.bin` and `.bin.gz`. | Phase 0 has to reformat the code, trim dependencies and move the models out of git. Otherwise every later change costs more. |

---

## 2. Who it's for (recommendation)

The PDF leaves this open. **I recommend medical, dental, physiotherapy and nursing students first**, for three reasons:

1. **The pain is sharp and recurring.** They sit practical exams where they must identify a tagged structure in about 60 seconds. Spaced repetition and identification practice map straight onto that, and the PDF's best evidence (the neuroanatomy spaced-repetition study) is about this group.
2. **They study every day**, so they come back on their own. A school class might use us once.
3. **They pay for Complete Anatomy (USD 74.99) or Visible Body.** "As good for exams, and free" is an easy pitch, and word of mouth spreads quickly within a cohort.

Teachers are the second audience. They multiply our reach (one teacher brings a class of students), so the classroom features in Phase 3 target them. The general public benefits from everything we build but won't drive decisions.

**Decision needed:** confirm this audience. If it holds, quizzes come before the info panel, and Phase 1 below assumes that order.

---

## 3. Feature ideas

The PDF's eight gaps are included. New ideas are marked **NEW**.

### A. Learn by doing: self-testing (the core)

- **A1. Spatial questions generated from geometry. NEW.** Bounding boxes plus the part-of tree give unlimited questions with no human authoring:
  - "Which is more superior: X or Y?"
  - "Is X medial or lateral to Y?"
  - "Click the structure directly anterior to X."
  - "Which of these four is part of the brachial plexus?"

  This is our cheapest moat: competitors write their question banks by hand. Directional terms (anterior, posterior, superior, medial and so on) are exactly what first-year students get wrong.
- **A2. Core quiz modes:** find-it (we name it, you click it), name-it (we highlight it, you type or choose the name), labels hidden, laterality (left or right), which system, and part-of.
- **A3. Spaced repetition with FSRS** (the modern successor to the SM-2 algorithm that Anki uses). Each card is one FMA concept plus one question type. Progress stays on the device with no login (IndexedDB). Sync is opt-in later.
- **A4. Practical-exam simulator ("steeplechase" or "bell-ringer" stations). NEW.** A pin marks a structure, a 60-second timer runs, you type the name and the next station loads. At the end you get a score and a "review your misses" deck. This mirrors the real exam format, and I found no free competitor that offers it.
- **A5. Region decks. NEW.** Medical courses teach by **region** (upper limb, thorax, head and neck), not by system. We derive region tags from the FMA part-of tree and body position. Students choose "my exam: upper limb, week 6" and get a deck built for it.
- **A6. Anki export. NEW.** Export any deck as an `.apkg` file with a screenshot for each card. Many medical students already live in Anki, so we meet them there instead of fighting it. Every exported card links back to the 3D view, which brings them back to us.

### B. Understand: content per structure

- **B1. Real info panel (PDF #2):** FMA definition, synonyms, Latin name (Terminologia Anatomica), part-of breadcrumb, sibling structures and source links, all joined on the FMA ID we already have.
- **B2. Muscle cards (PDF #3):** origin, insertion, action, innervation and blood supply. Start with the upper and lower limbs, which are the most-tested regions.
- **B3. "What if" lesion mode. NEW.** Click a nerve, choose "lesion", and the muscles it supplies turn red while the panel lists the expected deficits ("wrist drop"). Click an artery and its supply territory lights up. This turns the static atlas into the relational, clinical reasoning that students in the PDF's survey said 3D apps don't teach (only 21% said the apps helped much with function, 41% with clinical application). It needs the innervation and supply graph from B2, so it's the payoff of building that data well.
- **B4. Cross-section slicer. NEW.** Drag a clipping plane through the body to see axial, sagittal and coronal slices. This prepares students for CT and MRI, a big curriculum area that free 3D apps mostly ignore. Three.js clipping planes make a basic version cheap. Filling in the cut faces with solid caps is harder and can come later.
- **B5. Pronunciation and Latin toggle. NEW.** An audio clip per term, plus a switch between English and Latin labels. This matters for European and Latin American courses that examine in Latin.
- **B6. Community mnemonics, reviewed. NEW.** Users submit mnemonics, a moderator approves them, and each one is attached to a concept. It's low cost, students love it, and it gives people a reason to contribute.

### C. Share and teach

- **C1. Deep links (PDF #7):** the URL encodes the camera, visible systems, selection and exploded state, so `…/#s=FMA9628&sys=muscular,skeletal` opens exactly that view. This is cheap and every other sharing feature depends on it.
- **C2. Notes and pins:** private notes on any structure, kept locally.
- **C3. Guided tours as JSON (PDF):** a lesson is a list of steps (camera, highlighted structures, narration text). Teachers write them, and anyone can play them through a link.
- **C4. Classroom live quiz. NEW.** A Kahoot-style session in which the teacher's screen drives a 3D question and students answer on their phones. This brings in the multiplier audience. It needs a small realtime backend, so it goes in Phase 3.
- **C5. Embeddable viewer and LMS support. NEW.** An `<iframe>` embed for slides and Moodle or Canvas pages, with LTI later. Each embed acts as a free distribution channel.

### D. AI, grounded and only in Phase 2 or later

- **D1. Grounded tutor (PDF #4):** it answers only from our curated panel text, cites the concept, and says "not in our sources" otherwise. Good uses: "explain my mistake" after a wrong quiz answer, and oral-exam (viva) practice where it asks you about the structure on screen.
- **D2. Agent-ready atlas. NEW.** Extend the existing WebMCP tools with `start_quiz`, `show_region`, `slice_at`, `lesion` and `get_definition`. Any AI assistant could then say "let me show you" and drive our viewer. It's cheap, because the upstream code already does this, and it will matter more over time.

### E. Reach

- **E1. Load by system and work offline.** Load the skeleton first, stream the other systems as needed, and install as a progressive web app (PWA) for offline use. Today's single ~33 MB download hurts students on mobile data.
- **E2. Multilingual labels (PDF #6):** FMA and TA2 multilingual labels plus Wikidata labels. Start with Spanish, Portuguese and Hindi, where large student populations meet weak free options.
- **E3. Accessibility:** keyboard navigation through the structure tree, screen-reader labels and a high-contrast mode. Few competitors offer this, and some universities require it.
- **E4. Female reference body:** reintroduce the HuBMAP CC BY 4.0 set (see section 1) as a second body, labelled honestly as *organ reference, partial musculoskeletal*.

---

## 4. Phased roadmap

Effort assumes 1 to 2 developers.

### Phase 0: foundation (about 1 week)
- Fork human-atlas into this repo. Reformat the code with `oxfmt`. Remove unused dependencies (`vinext`, OpenAI and Cloudflare plugins if they turn out to be unneeded).
- Move the models out of git (Git LFS, or a release or CDN download step).
- Add the URL-state layer (C1). A quiz and a share link both need the same "describe this view" object.
- **Decide licenses:** our code under MIT. Our content under **CC BY 4.0**, which only works if Wikipedia text stays out of the core content; keep it behind a clearly labelled CC BY-SA "Read more" link instead.
- Add region tags (A5) to the manifest through a build script.

### Phase 1: MVP, "the free anatomy study app" (about 4 weeks)
- Quiz modes A2, including laterality, plus spatial questions A1.
- FSRS spaced repetition with local progress (A3).
- Info panel v1 (B1): FMA definition, synonyms, part-of tree, sources and an educational-use disclaimer.
- Region decks (A5) for the upper limb, lower limb and thorax.
- **Ship criterion:** a student can study "upper limb bones and muscles" for two weeks and see their retention improve.

### Phase 2: exam-ready (about 6 weeks)
- Practical-exam simulator (A4), the headline feature for launch marketing.
- Muscle cards (B2) for the limbs, followed by lesion mode (B3) built on that data.
- Anki export (A6) and a basic cross-section slicer (B4).
- Load by system and offline PWA (E1).
- Grounded tutor (D1) behind a flag, and only after we've retested accuracy against our own content.

### Phase 3: teach and spread
- Guided tours (C3), embeds (C5), classroom live quiz (C4).
- Multilingual labels (E2), a Latin toggle and audio (B5).
- Female reference body (E4) and community mnemonics (B6).

---

## 5. Architecture sketch

```
geometry (BodyParts3D, CC BY 4.0) ── unchanged from upstream ──┐
                                                               ▼
content pipeline (build-time, scripts/)              static site (Vite + React + three.js)
  FMA OWL  ─┐                                        ├─ viewer (forked)
  Uberon   ─┼─► join on FMA ID ─► content/*.json ──► ├─ info panel
  Wikidata ─┘   + curated muscle/nerve data          ├─ quiz engine + FSRS (local IndexedDB)
                + region tags                        ├─ URL state / deep links
                + generated spatial questions        └─ WebMCP tools
                                                         │ (Phase 2-3, optional)
                                                         ▼
                                                     small backend: sync, classroom realtime,
                                                     tutor retrieval over content/*.json
```

- **Static first:** no accounts, no server and hosting that costs close to nothing until Phase 3.
- **Content keyed by FMA ID:** one JSON record per concept, and every field records its source and license. Reviewers can then audit medical accuracy field by field.
- **Questions are data:** generated questions and hand-written ones share the same schema, so the spaced-repetition engine doesn't care where a question came from.

---

## 6. How we know it's working

- **Activation:** share of new visitors who finish one quiz session.
- **Retention:** day-7 and day-30 return rate. This is the real test of a study tool; a viewer never gets one.
- **Learning:** recall accuracy on cards that come back due for review over time.
- **Content coverage:** share of the most-quizzed concepts that have their own sourced definition (target: 100% of the top 500).
- **Spread:** number of shared links and embeds created.

---

## 7. Risks (adds to the PDF's list)

| Risk | Mitigation |
|---|---|
| Share-alike text contaminates our content license | Keep Wikipedia text out of the core content and show the source on every field. |
| Medical errors in curated data (muscle attachments, nerve supply) | Cite a source for every claim, provide a "report an error" button and have a clinician or anatomy-teacher reviewer approve each region before release. |
| Upstream adds quizzes | Unlikely to match generated spatial questions, the exam simulator, lesion mode and the content pipeline. Keep in touch with the upstream author; contributing viewer fixes back builds goodwill. |
| Mobile performance with quiz UI on top of a ~33 MB model | Load by system (E1) and test on real low-end Android phones, which upstream says it never did. |
| Model uses older terminology | Map labels to Terminologia Anatomica 2 where possible and show synonyms. |

---

## 8. Open decisions

1. **Primary user:** I recommend health-science students (section 2). Confirm?
2. **Content license:** CC BY 4.0 with Wikipedia text excluded from the core, or CC BY-SA throughout?
3. **Name and domain** for the product.
4. **Clinical reviewer:** who signs off on the muscle and nerve data?
