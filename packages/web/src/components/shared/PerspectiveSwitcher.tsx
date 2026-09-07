import { useEffect, useState } from 'react';
import { useChildren } from '../../hooks/useChildren';
import { usePerspective } from '../../lib/perspective';
import { Modal } from '../ui/Modal';

export function PerspectiveSwitcher() {
  const { perspective, setPerspective, isParent } = usePerspective();
  const { data: children } = useChildren();
  const [chooserOpen, setChooserOpen] = useState(false);
  const lockedChildId = perspective.mode === 'child' ? perspective.childId : undefined;

  // A stored child id may no longer exist (child removed) — fall back to parent mode.
  useEffect(() => {
    if (!isParent && children && lockedChildId && !children.some((child) => child.id === lockedChildId)) {
      setPerspective({ mode: 'parent' });
    }
  }, [children, isParent, lockedChildId, setPerspective]);

  if (isParent) {
    return (
      <button
        type="button"
        onClick={() => setChooserOpen(true)}
        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        👀 孩子视角
      </button>
    );
  }

  const currentChild = children?.find((child) => child.id === lockedChildId);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-indigo-600">
          👀 {currentChild?.name ?? '孩子'}的视角
        </span>
        <button
          type="button"
          onClick={() => setPerspective({ mode: 'parent' })}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          回家长
        </button>
      </div>
      <Modal open={chooserOpen} onClose={() => setChooserOpen(false)} title="选择视角">
        <div className="space-y-2">
          {(children ?? []).map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => {
                setPerspective({ mode: 'child', childId: child.id });
                setChooserOpen(false);
              }}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-indigo-50 transition-colors"
            >
              👀 {child.name}的视角
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
