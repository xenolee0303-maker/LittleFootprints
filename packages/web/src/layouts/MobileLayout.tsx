import { useEffect, useState } from 'react';
import { GrowthPage } from '../pages/GrowthPage';
import { SettingsPage } from '../pages/SettingsPage';
import { usePerspective } from '../lib/perspective';
import { PerspectiveSwitcher } from '../components/shared/PerspectiveSwitcher';

const tabs = [
  { key: 'growth', label: '成长', icon: '🌱', component: GrowthPage, parentOnly: false },
  { key: 'settings', label: '设置', icon: '⚙️', component: SettingsPage, parentOnly: true },
];

export function MobileLayout() {
  const { isParent } = usePerspective();
  const [activeTab, setActiveTab] = useState('growth');
  const visibleTabs = tabs.filter((tab) => isParent || !tab.parentOnly);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab('growth');
    }
  }, [visibleTabs, activeTab]);

  const ActiveComponent = visibleTabs.find((t) => t.key === activeTab)?.component ?? GrowthPage;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <span className="font-bold text-primary">BloomMate</span>
        <PerspectiveSwitcher />
      </header>
      <main className="flex-1 pb-16">
        <ActiveComponent />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t flex items-center justify-around safe-area-bottom">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-col items-center text-xs gap-0.5 min-w-0 ${
              activeTab === tab.key ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
