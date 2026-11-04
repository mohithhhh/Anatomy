import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Atlas } from "@/atlas/types";
import {
  AnatomyViewer,
  ViewerError,
  type CameraPose,
  type Insets,
  type SceneState,
} from "./AnatomyViewer";

interface Props {
  atlas: Atlas;
  modelBase: string;
  state: SceneState;
  insets: Insets;
  initialCamera: CameraPose | null;
  /** Receives the live viewer instance (null while none exists). */
  viewerRef: RefObject<AnatomyViewer | null>;
  onPick: (partId: string) => void;
  onProgress: (percent: number) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onCameraChange: (pose: CameraPose) => void;
}

/** Mounts one AnatomyViewer per atlas and keeps it in sync with React state. */
export function ViewerCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const { atlas, modelBase, state, insets, viewerRef } = props;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let viewer: AnatomyViewer;
    try {
      viewer = new AnatomyViewer(el, atlas, {
        modelBase,
        initialState: latest.current.state,
        initialCamera: latest.current.initialCamera,
        onPick: (id) => latest.current.onPick(id),
        onProgress: (n) => latest.current.onProgress(n),
        onReady: () => latest.current.onReady(),
        onError: (message) => latest.current.onError(message),
        onCameraChange: (pose) => latest.current.onCameraChange(pose),
      });
    } catch (error) {
      latest.current.onError(
        error instanceof ViewerError ? error.message : "The 3D viewer could not start.",
      );
      return;
    }
    viewer.setInsets(latest.current.insets);
    viewerRef.current = viewer;
    return () => {
      viewerRef.current = null;
      viewer.dispose();
    };
  }, [atlas, modelBase, viewerRef]);

  useEffect(() => {
    viewerRef.current?.setState(state);
  }, [state, viewerRef]);

  useEffect(() => {
    viewerRef.current?.setInsets(insets);
  }, [insets, viewerRef]);

  return <div ref={host} className="viewer-host absolute inset-0 overflow-hidden" />;
}
