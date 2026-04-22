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

function getMobileNavigationMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia('(max-width: 1023px)') ?? null;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentRoute, onNavigate }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(() => {
    return !!getMobileNavigationMediaQuery()?.matches;
  });

  React.useEffect(() => {
    const mediaQuery = getMobileNavigationMediaQuery();

    if (!mediaQuery) {
      return undefined;
    }

    const syncMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncMobileViewport();
    mediaQuery.addEventListener('change', syncMobileViewport);

    return () => mediaQuery.removeEventListener('change', syncMobileViewport);
  }, []);

  const handleNavigate = (route: AppRoute) => {
    onNavigate(route);
    setIsMobileOpen(false);
  };

  const isClosedMobileNavigation = isMobileViewport && !isMobileOpen;

  return (
    <>
      <button
        type="button"
        className="app-sidebar__mobile-toggle"
        aria-label="Open navigation menu"
        aria-controls="primary-dashboard-navigation"
        aria-expanded={isMobileOpen}
        onClick={() => setIsMobileOpen(true)}
        data-testid="app-sidebar-mobile-toggle"
      >
        Menu
      </button>

      <nav
        id="primary-dashboard-navigation"
        className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${isMobileOpen ? 'is-mobile-open' : ''}`.trim()}
        aria-label="Primary dashboard"
        aria-hidden={isClosedMobileNavigation ? true : undefined}
        data-testid="app-sidebar"
        {...(isClosedMobileNavigation ? { inert: '' as unknown as string } : {})}
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
              {isCollapsed ? '->' : '<-'}
            </button>
            <button
              type="button"
              className="app-sidebar__icon-button app-sidebar__mobile-close"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close navigation menu"
              data-testid="app-sidebar-mobile-close"
            >
              x
            </button>
          </div>
        </div>

        <div className="app-sidebar__nav-groups">
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
        </div>
      </nav>
    </>
  );
};

export default AppSidebar;
