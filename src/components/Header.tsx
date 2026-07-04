import { useState } from 'react';
import { Shield, Truck, Sparkles, MapPin, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  currentRole: 'admin' | 'driver';
  onRoleChange: (role: 'admin' | 'driver') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Header({ currentRole, onRoleChange, darkMode, toggleDarkMode }: HeaderProps) {
  return (
    <header id="app_header" className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-[100] px-6 shadow-sm rtl">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
        
        {/* Brand Section */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md shadow-orange-200">
            KM
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm md:text-lg text-slate-800 dark:text-slate-100 tracking-tight">کارتن محمد دزفول</h1>
              <span className="bg-orange-100 text-orange-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-orange-200">
                <Sparkles className="w-2.5 h-2.5" />
                کارتن
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-orange-600" />
              پنل مدیریت و بازاریابی توزیع
            </p>
          </div>
        </div>

        {/* Navigation & Role Selection & Dark Mode */}
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleDarkMode}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 md:p-1 rounded-xl md:rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
                id="role_btn_driver"
                onClick={() => onRoleChange('driver')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                currentRole === 'driver'
                    ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm border border-slate-200/50 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                }`}
            >
                <Truck className="w-3.5 h-3.5" />
                <span>راننده</span>
            </button>
            
            <button
                id="role_btn_admin"
                onClick={() => onRoleChange('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                currentRole === 'admin'
                    ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm border border-slate-200/50 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                }`}
            >
                <Shield className="w-3.5 h-3.5" />
                <span>مدیریت پنل</span>
            </button>
            </div>
        </div>

      </div>
    </header>
  );
}
