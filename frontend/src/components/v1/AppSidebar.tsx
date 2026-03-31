import React from 'react';
import './AppSidebar.css';

export type AppRoute = 'lobby' | 'games' | 'profile';

interface SidebarItem {
  route: AppRoute;
  label: string;
}

interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
}

export interface AppSidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const sections: SidebarSection[] = [
  {
    id: 'play',
    title: 'Play',
    items: [
      { route: 'lobby', label: 'Lobby' },
      { route: 'games', label: 'Games' },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [{ route: 'profile', label: 'Profile' }],
  },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentRoute, onNavigate }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const handleNavigate = (route: AppRoute) => {
    onNavigate(route);
    setIsMobileOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="app-sidebar__mobile-toggle"
        aria-label="Open navigation menu"
        onClick={() => setIsMobileOpen(true)}
        data-testid="app-sidebar-mobile-toggle"
      >
        ☰ Menu
      </button>

      <aside
        className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${isMobileOpen ? 'is-mobile-open' : ''}`.trim()}
        data-testid="app-sidebar"
      >
        <div className="app-sidebar__header">
          <h2 className="app-sidebar__title">Navigation</h2>
          <div className="app-sidebar__controls">
            <button
              type="button"
              className="app-sidebar__icon-button app-sidebar__desktop-collapse"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              data-testid="app-sidebar-collapse-toggle"
            >
              {isCollapsed ? '→' : '←'}
            </button>
            <button
              type="button"
              className="app-sidebar__icon-button app-sidebar__mobile-close"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close navigation menu"
              data-testid="app-sidebar-mobile-close"
            >
              ✕
            </button>
          </div>
        </div>

        <nav aria-label="Sidebar navigation">
          {sections.map((section) => (
            <div key={section.id} className="app-sidebar__section">
              <h3 className="app-sidebar__section-title">{section.title}</h3>
              <ul className="app-sidebar__list">
                {section.items.map((item) => {
                  const isActive = item.route === currentRoute;
                  return (
                    <li key={item.route}>
                      <button
                        type="button"
                        className={`app-sidebar__link ${isActive ? 'is-active' : ''}`.trim()}
                        onClick={() => handleNavigate(item.route)}
                        aria-current={isActive ? 'page' : undefined}
                        data-testid={`app-sidebar-link-${item.route}`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default AppSidebar;
