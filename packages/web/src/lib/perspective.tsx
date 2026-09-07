import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Perspective = { mode: 'parent' } | { mode: 'child'; childId: string };

const STORAGE_KEY = 'bloommate-perspective';

interface PerspectiveContextValue {
  perspective: Perspective;
  setPerspective: (perspective: Perspective) => void;
  isParent: boolean;
  /** Child id locked in child-perspective mode, undefined in parent mode. */
  perspectiveChildId: string | undefined;
  /** Author role attached to records created under the current perspective. */
  authorRole: 'parent' | 'child';
}

const PerspectiveContext = createContext<PerspectiveContextValue>({
  perspective: { mode: 'parent' },
  setPerspective: () => undefined,
  isParent: true,
  perspectiveChildId: undefined,
  authorRole: 'parent',
});

function readStoredPerspective(): Perspective {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: 'parent' };
    const parsed = JSON.parse(raw) as Perspective;
    if (parsed && parsed.mode === 'child' && typeof parsed.childId === 'string') return parsed;
    return { mode: 'parent' };
  } catch {
    return { mode: 'parent' };
  }
}

export function PerspectiveProvider({ children }: { children: ReactNode }) {
  const [perspective, setPerspective] = useState<Perspective>(readStoredPerspective);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(perspective));
    } catch {
      // localStorage unavailable (private mode) — keep in-memory only
    }
  }, [perspective]);

  const isParent = perspective.mode === 'parent';

  return (
    <PerspectiveContext.Provider
      value={{
        perspective,
        setPerspective,
        isParent,
        perspectiveChildId: isParent ? undefined : perspective.childId,
        authorRole: isParent ? 'parent' : 'child',
      }}
    >
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective() {
  return useContext(PerspectiveContext);
}
