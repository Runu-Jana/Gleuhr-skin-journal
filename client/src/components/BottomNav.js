import React from 'react';
import { Home, Map, User } from 'lucide-react';

export default function BottomNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'journey', label: 'Journey', icon: Map },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
          >
            <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
