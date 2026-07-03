import { useState } from 'react';
import { Shield, Truck, Sparkles, MapPin, Bell } from 'lucide-react';

interface HeaderProps {
  currentRole: 'admin' | 'driver';
  onRoleChange: (role: 'admin' | 'driver') => void;
  driverName: string;
}

export default function Header({ currentRole, onRoleChange, driverName }: HeaderProps) {
  return (
    <header id="app_header" className="h-16 bg-white border-b border-slate-200 sticky top-0 z-[100] px-6 shadow-sm rtl">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
        
        {/* Brand Section */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md shadow-orange-200">
            KM
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-base md:text-lg text-slate-800 tracking-tight">کارتن محمد دزفول</h1>
              <span className="bg-orange-100 text-orange-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-orange-200">
                <Sparkles className="w-2.5 h-2.5" />
                هولدر لیوان
              </span>
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-orange-600" />
              پنل مدیریت و بازاریابی توزیع
            </p>
          </div>
        </div>

        {/* Navigation & Role Selection */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            id="role_btn_driver"
            onClick={() => onRoleChange('driver')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              currentRole === 'driver'
                ? 'bg-white text-orange-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>راننده ({driverName})</span>
          </button>
          
          <button
            id="role_btn_admin"
            onClick={() => onRoleChange('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              currentRole === 'admin'
                ? 'bg-white text-orange-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>مدیریت پنل</span>
          </button>
        </div>

      </div>
    </header>
  );
}
