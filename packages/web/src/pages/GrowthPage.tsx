import { useEffect, useState } from 'react';
import { useChildren } from '../hooks/useChildren';
import { usePerspective } from '../lib/perspective';
import { GrowthTimeline } from '../components/growth/GrowthTimeline';
import { GrowthInterests } from '../components/growth/GrowthInterests';
import { GrowthProfile } from '../components/growth/GrowthProfile';
import { ChildWeeklySummaryCard } from '../components/growth/ChildWeeklySummary';
import { AiQuestionPanel } from '../components/ai/AiQuestionPanel';
import { createAiPageContext } from '../components/ai/createAiPageContext';
import type { AiContextModule } from '@bloommate/shared';

type Section = 'timeline' | 'interests' | 'profile';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'timeline', label: '时间线' },
  { key: 'interests', label: '兴趣' },
  { key: 'profile', label: '档案' },
];

export function GrowthPage() {
  const { isParent, perspectiveChildId } = usePerspective();
  const { data: children } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(undefined);
  const [section, setSection] = useState<Section>('timeline');

  const childId = isParent ? selectedChildId : perspectiveChildId;

  useEffect(() => {
    if (isParent && !selectedChildId && children && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [isParent, selectedChildId, children]);

  const currentChild = children?.find((child) => child.id === childId);

  if (!childId || !currentChild) {
    return <div className="py-8 text-center text-sm text-gray-400">加载中...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">
          {isParent ? '成长' : `${currentChild.name}的成长`}
        </h1>
        <span className="text-sm text-gray-400">{currentChild.name}</span>
      </div>

      {isParent && children && children.length > 1 && (
        <div className="flex gap-2">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedChildId(child.id)}
              className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
                childId === child.id
                  ? 'bg-indigo-50 border-primary text-primary font-medium'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      <ChildWeeklySummaryCard childId={childId} />

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`flex-1 rounded-lg py-1.5 text-sm transition-colors ${
              section === item.key ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'timeline' && <GrowthTimeline children={children ?? []} childId={childId} />}
      {section === 'interests' && <GrowthInterests childId={childId} />}
      {section === 'profile' && <GrowthProfile childId={childId} />}

      {isParent && (
        <AiQuestionPanel
          compact
          context={createAiPageContext({
            page: 'growth',
            module: (section === 'timeline' ? 'growth-timeline' : section) as AiContextModule,
            childId,
            childLabel: currentChild.name,
          })}
        />
      )}
    </div>
  );
}
