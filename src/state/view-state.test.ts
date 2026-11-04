import { describe, expect, it } from "vitest";
import { DEFAULT_VISIBLE } from "@/atlas/systems";
import { DEFAULT_VIEW_STATE, decodeViewState, encodeViewState, type ViewState } from "./view-state";

describe("view state URL encoding", () => {
  it("encodes the default view as an empty hash", () => {
    expect(encodeViewState(DEFAULT_VIEW_STATE)).toBe("");
    expect(decodeViewState("")).toEqual(DEFAULT_VIEW_STATE);
  });

  it("round-trips a full view", () => {
    const state: ViewState = {
      body: "male",
      visible: ["skeletal", "muscular"],
      selection: { kind: "concept", id: "FMA9611" },
      isolate: false,
      explode: 0,
      view: "front",
      camera: { position: [0.3, 1.2, 1.5], target: [0, 1.1, 0] },
    };
    const hash = encodeViewState(state);
    expect(hash).toBe("c=FMA9611&sys=skeletal,muscular&v=front&cam=0.3,1.2,1.5,0,1.1,0");
    expect(decodeViewState(`#${hash}`)).toEqual(state);
  });

  it("round-trips an isolated part and an exploded view", () => {
    const isolated: ViewState = {
      ...DEFAULT_VIEW_STATE,
      selection: { kind: "part", id: "FJ1252" },
      isolate: true,
    };
    expect(decodeViewState(encodeViewState(isolated))).toEqual(isolated);
    expect(decodeViewState("p=FJ1452M").selection).toEqual({ kind: "part", id: "FJ1452M" });

    const exploded: ViewState = { ...DEFAULT_VIEW_STATE, visible: ["skeletal"], explode: 0.4 };
    expect(encodeViewState(exploded)).toBe("sys=skeletal&x=40");
    expect(decodeViewState(encodeViewState(exploded))).toEqual(exploded);
  });

  it("keeps an empty system list distinct from the default", () => {
    const none: ViewState = { ...DEFAULT_VIEW_STATE, visible: [] };
    expect(encodeViewState(none)).toBe("sys=none");
    expect(decodeViewState("sys=none").visible).toEqual([]);
  });

  it("encodes equal system sets identically regardless of order", () => {
    const a = encodeViewState({ ...DEFAULT_VIEW_STATE, visible: ["muscular", "skeletal"] });
    const b = encodeViewState({ ...DEFAULT_VIEW_STATE, visible: ["skeletal", "muscular"] });
    expect(a).toBe(b);
    expect(encodeViewState({ ...DEFAULT_VIEW_STATE, visible: DEFAULT_VISIBLE.toReversed() })).toBe(
      "",
    );
  });

  it("ignores malformed or hostile input", () => {
    const state = decodeViewState(
      "#c=<script>&sys=skeletal,bogus&x=900&v=upside&iso=1&cam=1,2,NaN,4,5,6",
    );
    expect(state.selection).toBeNull();
    expect(state.visible).toEqual(["skeletal"]);
    expect(state.explode).toBe(1);
    expect(state.view).toBe("three-quarter");
    expect(state.isolate).toBe(false);
    expect(state.camera).toBeNull();
  });

  it("encodes the female body and accepts its mesh IDs", () => {
    const state: ViewState = {
      ...DEFAULT_VIEW_STATE,
      body: "female",
      selection: { kind: "part", id: "VH_F_kidney_capsule_L" },
    };
    expect(encodeViewState(state)).toContain("b=f");
    expect(decodeViewState(encodeViewState(state))).toEqual(state);
  });

  it("drops the camera when the view is exploded or isolated", () => {
    expect(decodeViewState("x=50&cam=1,1,1,0,1,0").camera).toBeNull();
    expect(decodeViewState("c=FMA7088&iso=1&cam=1,1,1,0,1,0").camera).toBeNull();
    expect(decodeViewState("cam=1,1,1,0,1,0").camera).not.toBeNull();
  });
});
