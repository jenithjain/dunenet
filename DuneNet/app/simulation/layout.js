'use client';

import { useState, useEffect } from 'react';
import StaggeredMenu from '@/components/StaggeredMenu';

export default function SimulationLayout({ children }) {
  const [menuBtnColor, setMenuBtnColor] = useState('#ffffff');

  useEffect(() => {
    const updateColor = () => {
      // Always use white on simulation page (dark background)
      setMenuBtnColor('#ffffff');
    };

    updateColor();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <StaggeredMenu
            position="right"
            isFixed={true}
            logoUrl="/chain-forecast.svg"
            showLogo={false}
            showThemeToggle={false}
            accentColor="#22c55e"
            colors={['#0f172a', '#111827', '#1f2937']}
            menuButtonColor={menuBtnColor}
            openMenuButtonColor="#22c55e"
            items={[
              { label: 'Home', link: '/', ariaLabel: 'Go to Home' },
              { label: 'Simulation', link: '/simulation', ariaLabel: 'Desert Simulation' },
              { label: 'Dashboard', link: '/dashboard', ariaLabel: 'View Dashboard' },
            ]}
            displaySocials={false}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
