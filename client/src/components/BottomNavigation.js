import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Sun, Moon, Camera, Map } from 'lucide-react';

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/' || path === '/home') return 'home';
    if (path === '/amPage') return 'am';
    if (path === '/pmPage') return 'pm';
    if (path === '/transformation') return 'photos';
    if (path === '/journey') return 'journey';
    if (path === '/checkin-success') return 'home'; // Treat success page as home
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'am', label: 'AM', icon: Sun, path: '/amPage' },
    { id: 'pm', label: 'PM', icon: Moon, path: '/pmPage' },
    { id: 'photos', label: 'Photos', icon: Camera, path: '/transformation' },
    { id: 'journey', label: 'Journey', icon: Map, path: '/journey' },
  ];

  const handleNavClick = (path) => {
    navigate(path);
  };

  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-around px-2 py-2 bg-[rgba(255,255,255,0.95)] backdrop-blur-[12px] border-t border-[#ede9e5]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.path)}
            className="bg-0 border-0 cursor-pointer px-3.5 py-1 flex flex-col items-center gap-0.5 transition-all duration-200 hover:scale-105"
          >
            <Icon 
              className={`w-5 h-5 transition-colors duration-200 ${
                isActive ? 'text-[#c44033]' : 'text-[#a39e95]'
              }`}
              strokeWidth={item.id === 'home' ? 1.5 : item.id === 'photos' ? 1.2 : 1.4}
            />
            <span 
              className={`text-xs transition-colors duration-200 font-outfit tracking-[0.3px] ${
                isActive ? 'font-semibold text-[#c44033]' : 'font-normal text-[#a39e95]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
