import { useState } from 'react';
import { Shield, Truck, Sparkles, MapPin, Moon, Sun, Database, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';

interface HeaderProps {
  currentRole: 'admin' | 'driver';
  onRoleChange: (role: 'admin' | 'driver') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Header({ currentRole, onRoleChange, darkMode, toggleDarkMode }: HeaderProps) {
  const isProd = !window.location.hostname.includes('run.app') && 
                 !window.location.hostname.includes('localhost') && 
                 !window.location.hostname.includes('127.0.0.1');

  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    isCloudflareMode: boolean;
    isConnected: boolean;
    hasBinding: boolean;
    hasTables: boolean;
    errorMessage?: string;
  } | null>(null);

  const runDiagnostics = async () => {
    setChecking(true);
    try {
      const status = await api.checkDbStatus();
      setDbStatus(status);
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  const handleOpenDiagnostics = () => {
    setShowModal(true);
    runDiagnostics();
  };

  return (
    <>
      <header id="app_header" className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-[100] px-6 shadow-sm rtl">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
          
          {/* Brand Section */}
          <div className="flex items-center gap-1.5 md:gap-3 flex-shrink min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-base md:text-xl shadow-md shadow-orange-200 flex-shrink-0">
              KM
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
                <h1 className="font-bold text-xs sm:text-base md:text-lg text-slate-800 dark:text-slate-100 tracking-tight truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">کارتن محمد دزفول</h1>
                <span className="hidden md:inline-flex bg-orange-100 text-orange-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full items-center gap-0.5 border border-orange-200 flex-shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  کارتن
                </span>
                
                {isProd ? (
                  <button 
                    onClick={handleOpenDiagnostics}
                    className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer flex-shrink-0"
                    title="بررسی اتصال دیتابیس آنلاین"
                  >
                    <Database className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline">دیتابیس متصل (D1)</span>
                    <span className="sm:hidden">D1</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleOpenDiagnostics}
                    className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 font-semibold shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer flex-shrink-0"
                    title="بررسی وضعیت دیتابیس محلی"
                  >
                    <Database className="w-2.5 h-2.5 text-amber-500" />
                    <span className="hidden sm:inline">آفلاین (Local)</span>
                    <span className="sm:hidden">آفلاین</span>
                  </button>
                )}
              </div>
              <p className="hidden md:flex text-[10px] text-slate-500 dark:text-slate-400 items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-orange-600" />
                پنل مدیریت و بازاریابی توزیع
              </p>
            </div>
          </div>

          {/* Navigation & Role Selection & Dark Mode */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button 
                  onClick={toggleDarkMode}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                  {darkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 h-4" />}
              </button>
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl md:rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                  id="role_btn_driver"
                  onClick={() => onRoleChange('driver')}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                  currentRole === 'driver'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm border border-slate-200/50 dark:border-slate-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                  }`}
              >
                  <Truck className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  <span>راننده</span>
              </button>
              
              <button
                  id="role_btn_admin"
                  onClick={() => onRoleChange('admin')}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                  currentRole === 'admin'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm border border-slate-200/50 dark:border-slate-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                  }`}
              >
                  <Shield className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  <span>مدیریت پنل</span>
              </button>
              </div>
          </div>

        </div>
      </header>

      {/* Diagnostics Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 text-right">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-600" />
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">بررسی وضعیت اتصال دیتابیس (D1)</h2>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                این بخش به شما کمک می‌کند متوجه شوید آیا برنامه با موفقیت به دیتابیس آنلاین کلادفلر (Cloudflare D1) متصل شده است و داده‌ها را ذخیره می‌کند یا خیر.
              </p>

              {/* Steps Checklist */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950/25 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                {/* Step 1: Mode */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700 dark:text-slate-300">محیط استقرار (Cloudflare Mode):</span>
                  {checking ? (
                    <span className="text-slate-400">در حال بررسی...</span>
                  ) : dbStatus?.isCloudflareMode ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      محیط Cloudflare Pages
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3.5 h-3.5" />
                      محیط محلی / پیش‌نمایش (Local)
                    </span>
                  )}
                </div>

                {/* Step 2: Connection / Ping */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700 dark:text-slate-300">ارتباط با سرور (API Connection):</span>
                  {checking ? (
                    <span className="text-slate-400">در حال بررسی...</span>
                  ) : !dbStatus ? (
                    <span className="text-slate-400">-</span>
                  ) : dbStatus.isConnected ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      موفقیت‌آمیز
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-full">
                      <X className="w-3.5 h-3.5" />
                      عدم ارتباط
                    </span>
                  )}
                </div>

                {/* Step 3: Binding */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700 dark:text-slate-300">بایندینگ دیتابیس (D1 Binding):</span>
                  {checking ? (
                    <span className="text-slate-400">در حال بررسی...</span>
                  ) : !dbStatus ? (
                    <span className="text-slate-400">-</span>
                  ) : !dbStatus.isCloudflareMode ? (
                    <span className="text-slate-400 dark:text-slate-500">غیرفعال در حالت آفلاین</span>
                  ) : dbStatus.hasBinding ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      متصل شده (DB)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-full">
                      <X className="w-3.5 h-3.5" />
                      عدم بایندینگ
                    </span>
                  )}
                </div>

                {/* Step 4: Tables */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700 dark:text-slate-300">ساخت جدول‌ها (Tables Schema):</span>
                  {checking ? (
                    <span className="text-slate-400">در حال بررسی...</span>
                  ) : !dbStatus ? (
                    <span className="text-slate-400">-</span>
                  ) : !dbStatus.isCloudflareMode ? (
                    <span className="text-slate-400 dark:text-slate-500">غیرفعال در حالت آفلاین</span>
                  ) : dbStatus.hasTables ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      جدول‌ها ایجاد شده‌اند
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-full">
                      <X className="w-3.5 h-3.5" />
                      یافت نشد
                    </span>
                  )}
                </div>
              </div>

              {/* Error & Resolution Panel */}
              {!checking && dbStatus && dbStatus.errorMessage && (
                <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">جزئیات خطا و راهنمای حل مشکل:</h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400/90 leading-relaxed mt-1">
                        {dbStatus.errorMessage}
                      </p>
                    </div>
                  </div>
                  
                  {/* Detailed actionable commands */}
                  {!dbStatus.hasTables && dbStatus.hasBinding && (
                    <div className="bg-white dark:bg-slate-950/40 p-3 rounded-lg border border-amber-100 dark:border-amber-900/20 space-y-2 mt-2">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">دستور گام‌به‌گام برای ساخت جدول‌ها:</span>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        وارد محیط ترمینال پروژه خود شوید و دستور زیر را برای اعمال ساختار دیتابیس به سرور کلادفلر اجرا کنید:
                      </p>
                      <code className="block bg-slate-100 dark:bg-slate-900 p-2 rounded text-[11px] font-mono text-left ltr overflow-x-auto text-orange-600 dark:text-orange-400">
                        npx wrangler d1 execute holderdb --remote --file=schema.sql
                      </code>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        * یا می‌توانید کل محتویات فایل <span className="font-mono text-xs text-orange-600">schema.sql</span> در ریشه پروژه را کپی کرده و در داشبورد کلادفلر بخش دیتابیس D1 دکمه Console وارد کرده و Run کنید.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Summary */}
              {!checking && dbStatus && !dbStatus.errorMessage && (
                <div className="bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">سیستم آنلاین و متصل است!</h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400/90 leading-relaxed mt-1">
                      دیتابیس Cloudflare D1 با موفقیت بایند شده و جدول‌ها آماده استفاده هستند. تمام داده‌ها (کافه‌ها، محصولات، گزارشات رانندگان و...) مستقیماً روی سرورهای آنلاین کلادفلر و دیتابیس متمرکز شما ذخیره و همگام‌سازی می‌شوند.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3">
              <button
                onClick={runDiagnostics}
                disabled={checking}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>بررسی مجدد</span>
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
