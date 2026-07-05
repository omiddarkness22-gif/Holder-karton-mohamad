import React, { useState, useEffect } from 'react';
import { ShieldAlert, Key, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

interface AdminLoginProps {
  onSuccess: () => void;
  onBackToDriver: () => void;
}

export default function AdminLogin({ onSuccess, onBackToDriver }: AdminLoginProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [dbPassword, setDbPassword] = useState<string | null>(null);

  useEffect(() => {
    const fetchPassword = async () => {
      try {
        const code = await api.getPasscode();
        setDbPassword(code);
      } catch (e) {
        console.error("Failed to fetch passcode:", e);
        setDbPassword('123456');
      }
    };
    fetchPassword();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dbPassword && passcode === dbPassword) {
      localStorage.setItem('isAdminAuthenticated', 'true');
      onSuccess();
    } else {
      setError('رمز عبور وارد شده نادرست است. لطفا دوباره تلاش کنید.');
      setPasscode('');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-md flex flex-col items-center justify-center min-h-[450px] text-right rtl" id="admin_login_container">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-4 animate-pulse">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h3 className="font-extrabold text-slate-800 text-lg text-center">ورود امن به پنل مدیریت</h3>
      <p className="text-xs text-slate-500 text-center mt-2 max-w-sm leading-relaxed font-medium">
        این بخش مخصوص مدیران شرکت کارتن‌سازی محمد دزفول است. جهت دسترسی، لطفا رمز عبور مدیریت را وارد نمایید.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs mt-6 space-y-4">
        <div className="space-y-1.5 relative">
          <label className="text-[11px] font-extrabold text-slate-500 block">رمز عبور مدیریت</label>
          <div className="relative">
            <input
              id="admin_passcode_input"
              type={showPasscode ? 'text' : 'password'}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError('');
              }}
              placeholder="••••"
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-sans text-base tracking-widest focus:outline-none focus:border-orange-600 focus:bg-white text-slate-800 transition-all font-bold"
              required
              autoFocus
            />
            <div className="absolute right-3 top-3 text-slate-400">
              <Key className="w-4 h-4" />
            </div>
            <button
              type="button"
              onClick={() => setShowPasscode(!showPasscode)}
              className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
            >
              {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg font-bold text-center">
            {error}
          </div>
        )}

        <button
          id="btn_admin_login_submit"
          type="submit"
          className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>تایید و ورود</span>
        </button>
      </form>

      <button
        id="btn_admin_login_back"
        onClick={onBackToDriver}
        className="mt-6 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold transition-all bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>بازگشت به پنل راننده</span>
      </button>
    </div>
  );
}
