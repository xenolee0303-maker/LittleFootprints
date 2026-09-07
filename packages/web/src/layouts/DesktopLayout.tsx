import { useEffect, useState } from 'react';
import { GrowthPage } from '../pages/GrowthPage';
import { SettingsPage } from '../pages/SettingsPage';
import { usePerspective } from '../lib/perspective';
import { PerspectiveSwitcher } from '../components/shared/PerspectiveSwitcher';

const navItems = [
  { key: 'growth', label: '成长', component: GrowthPage, parentOnly: false },
  { key: 'settings', label: '设置', component: SettingsPage, parentOnly: true },
];

export function DesktopLayout() {
  const { isParent } = usePerspective();
  const [active, setActive] = useState('growth');
  const visibleItems = navItems.filter((item) => isParent || !item.parentOnly);

  useEffect(() => {
    if (!visibleItems.some((item) => item.key === active)) {
      setActive('growth');
    }
  }, [visibleItems, active]);

  const ActiveComponent = visibleItems.find(n => n.key === active)?.component ?? GrowthPage;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-white border-r p-4 flex flex-col gap-2">
        <h1 className="text-lg font-bold mb-4 text-primary">LittleFootprints</h1>
        {visibleItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === item.key
                ? 'bg-indigo-50 text-primary'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="mt-auto pt-4 border-t">
          <PerspectiveSwitcher />
        </div>
      </aside>
      <main className="flex-1 p-6">
        <ActiveComponent />
      </main>
    </div>
  );
}
