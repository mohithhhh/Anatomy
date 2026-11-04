# Anatomy: Product Plan and Brainstorm

_Draft, Nov 4, 2026. Builds on "Human Atlas: Gaps and Build Opportunities"._

## The one-line bet

Human Atlas is a good 3D **viewer**. We build the **study tool**: the same free, no-login viewer, plus a way to learn, test yourself and remember what you learned, with every fact sourced.

Our edge is content and teaching method, not the 3D model. We start a fresh codebase, reuse upstream's model data and port its renderer, and spend our effort on what it lacks.

---

## 1. What I found in the reference code (ashemag/human-atlas)

These facts come from reading the repository and `public/models/atlas.json` directly. They change some of the effort estimates in the gaps PDF.

| Finding                                                                                                                                                                                                                                                                                           | Why it matters                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All 2,234 meshes carry an FMA concept ID** (`conceptId: "FMA59763"`).                                                                                                                                                                                                                           | The info panel is a data-join problem, not a research problem. FMA IDs link to FMA definitions and synonyms, Wikidata (P1402), Uberon and MeSH.                                                                                                |
| **3,432 concepts, 1,925 of which group several meshes** (e.g. "vascular tree").                                                                                                                                                                                                                   | We already have a part-of hierarchy, so we get "zoom out" quiz questions ("which larger structure is this part of?") and region grouping for free.                                                                                             |
| **1,229 parts are named Left/Right.**                                                                                                                                                                                                                                                             | A laterality quiz mode costs almost nothing to build.                                                                                                                                                                                          |
| **Each part has bounding boxes in metres, Y-up.**                                                                                                                                                                                                                                                 | We can generate thousands of spatial questions automatically ("Is the ulna medial or lateral to the radius?"). See idea A1.                                                                                                                    |
| **Descriptions are 15 hard-coded paragraphs, one per system** (`app/anatomy.ts`).                                                                                                                                                                                                                 | Confirms the PDF: no structure has its own text.                                                                                                                                                                                               |
| **No URL state.** The only `location` use is a reload button.                                                                                                                                                                                                                                     | Deep links and shareable views are greenfield.                                                                                                                                                                                                 |
| **System coverage is lopsided:** arterial 639, venous 404, muscular 402, skeletal 296, nervous 139 … lymphatic 3, endocrine 4, urinary 6, reproductive 12.                                                                                                                                        | Quizzes should start where the data is dense: musculoskeletal, vascular and nervous. We shouldn't promise deep endocrine or lymphatic coverage.                                                                                                |
| **A female reference set was shipped before and later removed**: HuBMAP _3D Reference Organ Set for Female v1.5_, CC BY 4.0 (see `public/ATTRIBUTION.md`, "Historical assets").                                                                                                                   | **This corrects the PDF**, which found only paid female assets. A free, open female body exists. Its skeleton and muscle coverage is partial, but organs and reproductive anatomy are there. That moves "female body" from _hard_ to _medium_. |
| **BodyParts3D 4.0 is officially CC BY 4.0.** The attribution file says the current database license supersedes the old CC BY-SA 2.1 Japan text in the OBJ comments.                                                                                                                               | That settles the geometry license. **Wikipedia text (CC BY-SA) is still the share-alike risk**, so we avoid it as a primary source.                                                                                                            |
| **WebMCP tools already exist** (`find_anatomy`, `inspect_anatomical_structure`).                                                                                                                                                                                                                  | AI agents can already drive the viewer. We can extend these tools instead of building a chatbot from scratch (idea D2).                                                                                                                        |
| **The code is dense:** about 80 KB of source, with lines thousands of characters long (`page.tsx` is 14.5 KB in 52 lines). The build pulls in `vinext`, `@openai/sites-vite-plugin` and Cloudflare plugins. The repo is **155 MB** because the models are committed as both `.bin` and `.bin.gz`. | This is why we start fresh rather than fork: we port the renderer into a clean module and keep the models out of git (Phase 1).                                                                                                                |

---

## 2. Who it's for (recommendation)

The PDF leaves this open. **I recommend medical, dental, physiotherapy and nursing students first**, for three reasons:

1. **The pain is sharp and recurring.** They sit practical exams where they must identify a tagged structure in about 60 seconds. Spaced repetition and identification practice map straight onto that, and the PDF's best evidence (the neuroanatomy spaced-repetition study) is about this group.
2. **They study every day**, so they come back on their own. A school class might use us once.
3. **They pay for Complete Anatomy (USD 74.99) or Visible Body.** "As good for exams, and free" is an easy pitch, and word of mouth spreads quickly within a cohort.

Teachers are the second audience. They multiply our reach (one teacher brings a class of students), so the classroom features in Phase 3 target them. The general public benefits from everything we build but won't drive decisions.

**Decision needed:** confirm this audience. If it holds, quizzes come before the info panel, and Phase 2 below assumes that order.

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
- **C4. Classroom live quiz. NEW.** A Kahoot-style session in which the teacher's screen drives a 3D question and students answer on their phones. This brings in the multiplier audience. It needs a small realtime backend, so it goes in Phase 5.
- **C5. Embeddable viewer and LMS support. NEW.** An `<iframe>` embed for slides and Moodle or Canvas pages, with LTI later. Each embed acts as a free distribution channel.

### D. AI, grounded and only in Phase 5

- **D1. Grounded tutor (PDF #4):** it answers only from our curated panel text, cites the concept, and says "not in our sources" otherwise. Good uses: "explain my mistake" after a wrong quiz answer, and oral-exam (viva) practice where it asks you about the structure on screen.
- **D2. Agent-ready atlas. NEW.** Extend the existing WebMCP tools with `start_quiz`, `show_region`, `slice_at`, `lesion` and `get_definition`. Any AI assistant could then say "let me show you" and drive our viewer. It's cheap, because the upstream code already does this, and it will matter more over time.

### E. Reach

- **E1. Load by system and work offline.** Load the skeleton first, stream the other systems as needed, and install as a progressive web app (PWA) for offline use. Today's single ~33 MB download hurts students on mobile data.
- **E2. Multilingual labels (PDF #6):** FMA and TA2 multilingual labels plus Wikidata labels. Start with Spanish, Portuguese and Hindi, where large student populations meet weak free options.
- **E3. Accessibility:** keyboard navigation through the structure tree, screen-reader labels and a high-contrast mode. Few competitors offer this, and some universities require it.
- **E4. Female reference body:** reintroduce the HuBMAP CC BY 4.0 set (see section 1) as a second body, labelled honestly as _organ reference, partial musculoskeletal_.

---

## 4. How we build it: five phases

**Build approach (decided):** a fresh codebase, not a fork.

- Reuse upstream's processed model data (geometry chunks and `atlas.json`, CC BY 4.0, with attribution).
- Port upstream's renderer (MIT, keeping the copyright notice) and its validation scripts.
- Write everything else new.

**Stack:** Vite, React and TypeScript. Plain three.js for the 3D scene. Tailwind and shadcn for UI. `ts-fsrs` for spaced repetition. Dexie (IndexedDB) for local progress. Static hosting.

**Durations** assume 1 to 2 developers, about 5 months to the end of Phase 4.

### Phase 1: Foundation (about 2 weeks)

**Goal:** our own app shows the full body and works as well as Human Atlas does today.

1. **Scaffold the repo.** Vite, React, TypeScript, Tailwind and shadcn, with lint, format and type checks in CI. Start with a clean git history.
2. **Ship the model data.** Download the 15 geometry chunks and `atlas.json` from a release or CDN at build time instead of committing them. Write `ATTRIBUTION.md` (BodyParts3D CC BY 4.0, plus the upstream MIT notice).
3. **Port the renderer.** Move `scene.tsx` into a standalone `viewer/` module: batched draw calls, GPU textures for per-structure state, picking, the exploded layout and tap-versus-drag handling. Reformat it, add types and upgrade three.js.
4. **Give the viewer a clean API.** For example `select(id)`, `setVisible(systems)`, `isolate(id)`, `flyTo(id)`, `highlight(ids, color)` and `onPick(cb)`. Every later feature talks to the viewer only through this API.
5. **Build URL state.** One serialisable `ViewState` object (camera, visible systems, selection, exploded mode) kept in sync with the URL. Deep links work from day one.
6. **Rebuild the basic UI.** System toggles, search over 3,432 concepts, and a selection panel showing name, FMA ID and system, laid out for desktop and mobile.
7. **Port the validation scripts.** Atlas integrity, layout overlap, tap versus drag, and Playwright checks at the 390×844, 320×568 and 844×390 sizes.
8. **Decide the content license.** CC BY 4.0, with Wikipedia text kept out of the core content.

**Exit criteria:** feature parity with Human Atlas on desktop and a mid-range Android phone, every check passing in CI, and a deep link that reopens the exact same view.

**Status (Nov 4, 2026): built, two items open.**

- Done: steps 1–7. Also built: search ranked by word order, ID and prefix; fly-to on search; copy link; WebMCP tools; quiz-ready `setHighlights` in the viewer API.
- Done: unit tests (layout, tap detection, URL state, search, WebMCP) and 10 Playwright browser tests, run in CI on every push.
- Open: step 8, the content license decision.
- Open: testing on a real mid-range Android phone. Layouts are only checked in headless Chromium at phone sizes.

### Phase 2: Study MVP (about 4 weeks) → public launch

**Goal:** a student can study a region for two weeks and measurably remember more.

1. **Content pipeline v0** (`scripts/build-content`). From `atlas.json` alone, produce one record per concept, keyed by FMA ID, with name, system, part-of parents and children, laterality, and centre and bounds.
2. **Region tags.** Assign upper limb, lower limb, thorax, abdomen, pelvis, head and neck, and back, using the FMA part-of tree with body position as a fallback. A human then spot-checks the result.
3. **Question engine.** One schema shared by all question types: `{conceptId, type, prompt, answer, distractors}`. Types:
   - find-it (click the named structure)
   - name-it (choose from multiple options or type the name, with fuzzy matching)
   - left or right
   - which system
   - part-of
4. **Generated spatial questions.** "Is X superior or inferior to Y?", "medial or lateral?", "click the structure anterior to X", all computed from bounds within the same region. Filter out pairs that are ambiguous or overlapping.
5. **Spaced repetition.** `ts-fsrs` scheduling, with progress, streaks and the daily review queue stored in IndexedDB. No login.
6. **Deck builder.** Pick a region and systems (for example "Upper limb: bones and muscles") to get a deck, with a link to share it.
7. **Info panel lite.** Name, part-of breadcrumb, sibling structures, a "quiz me on this" button, and an educational-use disclaimer.
8. **Privacy-friendly analytics** (Plausible or similar, no cookies): track sessions started, reviews done, and day-7 return.

**Exit criteria:** launch to 2 or 3 student cohorts (one real course is enough). Target 25% or more of users returning on day 7, and recall accuracy on due cards rising over two weeks.

**Status (Nov 4, 2026): built; the exit criteria need real students.**

- **Done, steps 1–8:**
  - 1,654 study items with regions, sides and part-of.
  - All six question types, including directions generated from the model.
  - FSRS scheduling with progress saved in IndexedDB.
  - The deck builder, shareable deck links and five starter decks.
  - The info panel with "Quiz me on this".
  - Optional cookie-free analytics.
- **Changes from the plan:**
  - Content is derived in the browser at load time (about 70 ms), not in a build step. `scripts/content-report.ts` writes the region report for review instead.
  - Part-of comes from FMA names ("X of Y"), because the model's concept groups are mostly "is a kind of" categories.
  - "Click the structure anterior to X" was not built. It needs a clear definition of "directly" anterior. The other direction questions (binary choices) are built.
- **Data fixes:**
  - The levator scapulae muscles were tagged as skeletal upstream; they are now muscles.
  - The first region review fixed brain, eyelid, pelvic-floor and back-muscle tags.
- **Open:**
  - A clinician or anatomy teacher should read `docs/content/regions-report.md`.
  - Pilot with 2 or 3 student groups.
  - Set `VITE_PLAUSIBLE_DOMAIN` to measure day-7 return.

### Phase 3: Content depth (about 4 weeks)

**Goal:** clicking any commonly studied structure tells you what it is and what it does, with sources.

1. **Content pipeline v1.** Join FMA (definitions, synonyms) and Uberon and Wikidata cross-references (labels in other languages, Latin terms) on FMA ID. Every field records its source and license.
2. **Info panel v1.** Definition, synonyms, a Latin and English toggle, the part-of tree, "related structures", and visible sources.
3. **Muscle cards for the upper and lower limbs.** Origin, insertion, action, innervation and blood supply, hand-curated and cited, stored as a graph (muscle → nerve → spinal level, muscle → artery).
4. **New question types from that data.** "What nerve supplies X?" and "Which muscle does action Y?"
5. **Review workflow.** Content lives as JSON in the repo, changes go through pull requests, an anatomy teacher or clinician approves each region, and the app gets a "report an error" button.
6. **Coverage dashboard.** The share of the top 500 most-quizzed concepts that have their own definition (target 100%).

**Exit criteria:** all limb muscles fully carded and reviewed, and the top 500 concepts defined.

### Phase 4: Exam-ready and clinical (about 5 weeks)

**Goal:** the best free tool for anatomy practical exams. This is the headline for the next marketing push.

1. **Practical-exam simulator.** Pinned stations, a 60-second timer per station, typed answers, a final score, and an auto-built "your misses" deck. Teachers can share a station set by link.
2. **Lesion mode.** Lesion a nerve to highlight the muscles it supplies and list the expected deficits; select an artery to highlight its supply territory. Built on the Phase 3 graph.
3. **Cross-section slicer.** A draggable clipping plane in axial, sagittal or coronal orientation (no solid caps on the cut faces yet), with a "name the structures in this slice" quiz.
4. **Anki export.** An `.apkg` file with a screenshot per card and a deep link back to the 3D view.
5. **Performance and offline.** Load the skeleton first and stream other systems on demand. Install as a progressive web app (PWA) with a service-worker cache for offline study. Test on real low-end Android phones.
6. **Accessibility.** Keyboard navigation through the structure tree, screen-reader labels, high-contrast mode, and quizzes playable without the 3D view.

**Exit criteria:** the exam simulator is used by at least one cohort before a real practical exam, and first load on a low-end phone is under 5 seconds for the skeleton.

### Phase 5: AI, teaching and reach (about 6 weeks, then ongoing)

**Goal:** spread through teachers and languages, and add AI help we trust.

1. **Grounded AI tutor.**
   - It answers only from our curated content, cites the concept, and says "not in our sources" otherwise.
   - Features: "explain my mistake" after a wrong answer, and oral-exam (viva) practice about the structure on screen.
   - A small serverless function does the retrieval over the content JSON.
   - Ship only after accuracy testing against our own content.
2. **AI-ready atlas.** WebMCP tools (`find`, `inspect`, `start_quiz`, `show_region`, `slice_at`, `lesion`) so any AI assistant can drive the viewer.
3. **Teaching tools.**
   - Guided tours written as JSON (camera steps, highlights, narration), with a simple editor.
   - An `<iframe>` embed for slides and course pages.
   - A classroom live quiz: the teacher's screen drives the question, students answer on their phones. This needs a small realtime backend.
4. **Languages.** Spanish, Portuguese and Hindi labels first, a Latin label mode, and pronunciation audio.
5. **Second body.** Reintroduce the HuBMAP female reference set (CC BY 4.0) as a separate body, labelled honestly as partial musculoskeletal coverage.
6. **Community mnemonics.** Users submit, a moderator approves, and each one is attached to a concept.
7. **Optional accounts.** Sync progress across devices. Studying stays free and works without logging in.

**Exit criteria:** at least 10 teachers using tours or the live quiz, one non-English locale shipped, and the tutor passing our accuracy benchmark.

### Runs through every phase

- **Medical accuracy:** every claim has a source, a reviewer approves each region, and the disclaimer is always visible.
- **Testing:** the ported validation scripts plus Playwright quiz flows run in CI. Every feature ships with a check.
- **Feedback loop:** talk to students every 2 weeks, and treat the day-7 return rate as the main metric.

---

## 5. Architecture sketch

```
geometry (BodyParts3D, CC BY 4.0) ── reused from upstream ─────┐
                                                               ▼
content pipeline (build-time, scripts/)              static site (Vite + React + three.js)
  FMA OWL  ─┐                                        ├─ viewer (ported)
  Uberon   ─┼─► join on FMA ID ─► content/*.json ──► ├─ info panel
  Wikidata ─┘   + curated muscle/nerve data          ├─ quiz engine + FSRS (local IndexedDB)
                + region tags                        ├─ URL state / deep links
                + generated spatial questions        └─ WebMCP tools
                                                         │ (Phase 5, optional)
                                                         ▼
                                                     small backend: sync, classroom realtime,
                                                     tutor retrieval over content/*.json
```

- **Static first:** no accounts, no server and hosting that costs close to nothing until Phase 5.
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

| Risk                                                              | Mitigation                                                                                                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share-alike text contaminates our content license                 | Keep Wikipedia text out of the core content and show the source on every field.                                                                                                                    |
| Medical errors in curated data (muscle attachments, nerve supply) | Cite a source for every claim, provide a "report an error" button and have a clinician or anatomy-teacher reviewer approve each region before release.                                             |
| Upstream adds quizzes                                             | Unlikely to match generated spatial questions, the exam simulator, lesion mode and the content pipeline. Keep in touch with the upstream author; contributing renderer fixes back builds goodwill. |
| Mobile performance with quiz UI on top of a ~33 MB model          | Load by system (E1) and test on real low-end Android phones, which upstream says it never did.                                                                                                     |
| Model uses older terminology                                      | Map labels to Terminologia Anatomica 2 where possible and show synonyms.                                                                                                                           |

---

## 8. Open decisions

1. **Primary user:** I recommend health-science students (section 2). Confirm?
2. **Content license:** CC BY 4.0 with Wikipedia text excluded from the core, or CC BY-SA throughout?
3. **Name and domain** for the product.
4. **Clinical reviewer:** who signs off on the muscle and nerve data?
