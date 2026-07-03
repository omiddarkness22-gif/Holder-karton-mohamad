import React, { useState, useEffect, useRef, useMemo } from 'react';
import { g_to_j, JALALI_MONTH_NAMES, toPersianDigits as toPersianDigitsShamsi } from '../lib/shamsi';
import { Cafe, VisitReport, DriverStatus, Product } from '../types';
import {
  MapPin,
  Coffee,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Navigation,
  Phone,
  User,
  Check,
  AlertCircle,
  Package,
  FileText,
  DollarSign
} from 'lucide-react';

interface DriverPanelProps {
  cafes: Cafe[];
  reports: VisitReport[];
  driverStatus: DriverStatus | null;
  products: Product[];
  onUpdateDriverLocation: (lat: number, lng: number, isSharing: boolean) => Promise<void>;
  onSubmitReport: (report: Omit<VisitReport, 'id' | 'timestamp'>) => Promise<void>;
  selectedCafeId: string | null;
  onCafeSelect: (cafeId: string) => void;
  setUserLocation: (coords: { lat: number; lng: number } | null) => void;
  activeDate: string;
}

export default function DriverPanel({
  cafes,
  reports,
  driverStatus,
  products,
  onUpdateDriverLocation,
  onSubmitReport,
  selectedCafeId,
  onCafeSelect,
  setUserLocation,
  activeDate,
}: DriverPanelProps) {
  // Form states
  const [status, setStatus] = useState<Cafe['visitStatus']>('sold');
  const [quantity, setQuantity] = useState<number>(100);
  const [totalPrice, setTotalPrice] = useState<number>(150000); // 150,000 Tomans
  const [notes, setNotes] = useState('');

  // Product state for driver panel
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || products[0] || null;
  }, [selectedProductId, products]);

  // Set initial product ID when products are loaded
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products]);

  // Automatically calculate total price based on unit price (driver cannot edit price)
  useEffect(() => {
    if (selectedProduct) {
      setTotalPrice(quantity * selectedProduct.price);
    }
  }, [quantity, selectedProduct]);
  
  const [loading, setLoading] = useState(false);
  const [driverTab, setDriverTab] = useState<'today' | 'tomorrow' | 'allFuture'>('today');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // Today's Date String Helper
  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();

  // Tomorrow's Date String Helper
  const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const tomorrowStr = getTomorrowString();

  const getPersianDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      const gy = parseInt(parts[0], 10);
      const gm = parseInt(parts[1], 10);
      const gd = parseInt(parts[2], 10);
      if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return dateStr;
      const [jy, jm, jd] = g_to_j(gy, gm, gd);
      const monthName = JALALI_MONTH_NAMES[jm - 1] || '';
      return `${toPersianDigitsShamsi(jd)} ${monthName} ${toPersianDigitsShamsi(jy)}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Selected Cafe
  const selectedCafe = useMemo(() => {
    return cafes.find((c) => c.id === selectedCafeId) || null;
  }, [selectedCafeId, cafes]);

  // Today's assigned cafes list
  const todayCafes = useMemo(() => {
    return cafes.filter((c) => c.assignedDate === activeDate);
  }, [cafes, activeDate]);

  // Tomorrow's assigned cafes list
  const tomorrowCafes = useMemo(() => {
    return cafes.filter((c) => c.assignedDate === tomorrowStr);
  }, [cafes, tomorrowStr]);

  // All scheduled cafes (excluding non-scheduled)
  const allScheduledCafes = useMemo(() => {
    return cafes.filter((c) => !!c.assignedDate).sort((a, b) => {
      return (a.assignedDate || '').localeCompare(b.assignedDate || '');
    });
  }, [cafes]);

  // Pending vs Visited
  const pendingCafes = useMemo(() => {
    return todayCafes.filter((c) => c.visitStatus === 'pending');
  }, [todayCafes]);

  const visitedCafes = useMemo(() => {
    return todayCafes.filter((c) => c.visitStatus !== 'pending');
  }, [todayCafes]);

  // Handle live location toggle
  const toggleLocationSharing = () => {
    if (driverStatus?.isSharingLocation) {
      // Turn off
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      onUpdateDriverLocation(32.3855, 48.4065, false);
      setUserLocation(null);
      setGpsError(null);
    } else {
      setGpsError(null);
      // Turn on GPS
      if (!navigator.geolocation) {
        setGpsError('مرورگر یا موبایل شما از اشتراک‌گذاری موقعیت جغرافیایی پشتیبانی نمی‌کند. از موقعیت شبیه‌سازی شده دزفول استفاده شد.');
        onUpdateDriverLocation(32.3855, 48.4065, true);
        setUserLocation({ lat: 32.3855, lng: 48.4065 });
        return;
      }

      setGpsLoading(true);
      
      const successHandler = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        onUpdateDriverLocation(latitude, longitude, true);
        setUserLocation({ lat: latitude, lng: longitude });
        setGpsLoading(false);
        setGpsError(null);
      };

      const errorHandler = (err: GeolocationPositionError) => {
        console.error('GPS tracking error:', err);
        setGpsError('دسترسی به GPS مسدود یا غیرفعال است. از موقعیت شبیه‌سازی شده دزفول استفاده شد.');
        setGpsLoading(false);
        onUpdateDriverLocation(32.3855, 48.4065, true);
        setUserLocation({ lat: 32.3855, lng: 48.4065 });
      };

      // Watch position triggers updates in real-time
      watchIdRef.current = navigator.geolocation.watchPosition(successHandler, errorHandler, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      });
    }
  };

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Update report default values if target changes
  useEffect(() => {
    if (selectedCafe) {
      setNotes('');
      setError('');
      setSuccess('');
      if (selectedCafe.visitStatus !== 'pending') {
        setStatus(selectedCafe.visitStatus);
        const existingReport = reports.find(r => r.cafeId === selectedCafe.id);
        if (existingReport) {
          setQuantity(existingReport.quantitySold || 100);
          setTotalPrice(existingReport.totalPrice || 150000);
          setNotes(existingReport.notes || '');
          if (existingReport.productId) {
            setSelectedProductId(existingReport.productId);
          }
        }
      } else {
        setStatus('sold');
        setQuantity(100);
        if (products.length > 0) {
          setSelectedProductId(products[0].id);
          setTotalPrice(100 * products[0].price);
        } else {
          setTotalPrice(150000);
        }
      }
    }
  }, [selectedCafeId, reports, products]);

  // Submit report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCafe) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const reportData: Omit<VisitReport, 'id' | 'timestamp'> = {
        cafeId: selectedCafe.id,
        cafeName: selectedCafe.name,
        driverName: driverStatus?.name || 'محمد دزفولی',
        status: status as VisitReport['status'],
        quantitySold: status === 'sold' ? quantity : 0,
        totalPrice: status === 'sold' ? totalPrice : 0,
        notes: notes.trim(),
    };
    if (status === 'sold' && selectedProduct) {
        reportData.productId = selectedProduct.id;
        reportData.productName = selectedProduct.name;
    }

    try {
      await onSubmitReport(reportData);
      setSuccess('گزارش بازاریابی شما با موفقیت به مدیریت ارسال شد.');
      setNotes('');
    } catch (err: any) {
      setError('خطا در ارسال گزارش: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toPersianDigits = (str: string | number) => {
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.toString().replace(/[0-9]/g, (w) => id[+w]);
  };

  const formatPrice = (amount: number) => {
    if (!amount) return '۰';
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 rtl text-right" id="driver_panel_root">
      
      {/* 1. Today's Target List (4 Cols) */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        
        {/* GPS Live Sharing Switcher Card */}
        <div className="bg-gradient-to-br from-orange-50/70 to-amber-50/30 border border-orange-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-600"></div>
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
            <Navigation className="w-5 h-5 text-orange-600 animate-pulse" />
            <span>ردیابی جغرافیایی (راننده)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
            با روشن کردن این گزینه، مدیر می‌تواند موقعیت زنده شما را روی نقشه دزفول ببیند تا هماهنگی‌های لازم راحت‌تر انجام شود.
          </p>

          {gpsError && (
            <div className="mt-2.5 text-[10px] text-orange-700 bg-orange-50 border border-orange-100 p-2 rounded-xl font-bold leading-relaxed">
              {gpsError}
            </div>
          )}

          <button
            id="btn_toggle_location"
            onClick={toggleLocationSharing}
            disabled={gpsLoading}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all shadow-md ${
              driverStatus?.isSharingLocation
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {gpsLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                در حال راه‌اندازی GPS...
              </span>
            ) : driverStatus?.isSharingLocation ? (
              <>
                <Check className="w-4 h-4 animate-bounce" />
                <span>اشتراک‌گذاری آنلاین روشن است (خاموش کردن)</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>روشن کردن اشتراک‌گذاری موقعیت زنده</span>
              </>
            )}
          </button>
        </div>

        {/* Cafe Visits Summary & Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[520px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <Coffee className="w-4.5 h-4.5 text-orange-600" />
                  <span>برنامه زمان‌بندی بازدیدها</span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                  امروز: {toPersianDigits(getPersianDateString(todayStr))}
                </p>
              </div>
            </div>

            {/* Beautiful Tab buttons */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1" id="driver_tabs">
              <button
                type="button"
                onClick={() => setDriverTab('today')}
                className={`flex-1 py-1.5 text-center text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                  driverTab === 'today'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                امروز ({toPersianDigits(todayCafes.length)})
              </button>
              <button
                type="button"
                onClick={() => setDriverTab('tomorrow')}
                className={`flex-1 py-1.5 text-center text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                  driverTab === 'tomorrow'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                فردا ({toPersianDigits(tomorrowCafes.length)})
              </button>
              <button
                type="button"
                onClick={() => setDriverTab('allFuture')}
                className={`flex-1 py-1.5 text-center text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                  driverTab === 'allFuture'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                همه برنامه‌ها ({toPersianDigits(allScheduledCafes.length)})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {driverTab === 'today' && (
              todayCafes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2 font-bold">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                  <span>مدیریت امروز هیچ کافه‌ای برای شما تعیین نکرده است.</span>
                </div>
              ) : (
                <>
                  {/* Pending Visits Section */}
                  {pendingCafes.length > 0 && (
                    <div className="bg-orange-50/5">
                      <div className="px-3 py-1 bg-slate-100/80 text-[10px] font-extrabold text-slate-500 border-y border-slate-200/40">
                        کافه‌های باقی‌مانده (منتظر بازدید)
                      </div>
                      {pendingCafes.map((cafe) => (
                        <div
                          key={cafe.id}
                          onClick={() => onCafeSelect(cafe.id)}
                          className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-all flex flex-col gap-1.5 ${
                            cafe.id === selectedCafeId ? 'bg-orange-50/30 border-r-4 border-orange-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-slate-800 text-xs">{cafe.name}</h4>
                            <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                              ثبت گزارش فروش
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{cafe.address}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Visited Section */}
                  {visitedCafes.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-slate-100/80 text-[10px] font-extrabold text-slate-500 border-y border-slate-200/40">
                        بازدیدهای ثبت‌شده امروز شما
                      </div>
                      {visitedCafes.map((cafe) => {
                        let statusBadge = null;
                        if (cafe.visitStatus === 'sold') {
                          statusBadge = <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded">فروخته شد</span>;
                        } else if (cafe.visitStatus === 'no_sale') {
                          statusBadge = <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-extrabold px-2 py-0.5 rounded">بدون خرید</span>;
                        } else if (cafe.visitStatus === 'callback') {
                          statusBadge = <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-extrabold px-2 py-0.5 rounded">پیگیری مجدد</span>;
                        } else if (cafe.visitStatus === 'closed') {
                          statusBadge = <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-extrabold px-2 py-0.5 rounded">بسته بود</span>;
                        }

                        return (
                          <div
                            key={cafe.id}
                            onClick={() => onCafeSelect(cafe.id)}
                            className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-all flex flex-col gap-1.5 ${
                              cafe.id === selectedCafeId ? 'bg-orange-50/30 border-r-4 border-orange-600' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-700 text-xs line-through opacity-85">{cafe.name}</h4>
                              {statusBadge}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-300" />
                              <span className="truncate">{cafe.address}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )
            )}

            {driverTab === 'tomorrow' && (
              tomorrowCafes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2 font-bold">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                  <span>برنامه‌ای برای فردا تعیین نشده است.</span>
                </div>
              ) : (
                <div>
                  <div className="px-3 py-1 bg-slate-100/80 text-[10px] font-extrabold text-slate-500 border-y border-slate-200/40">
                    کافه‌های برنامه‌ریزی شده برای فردا ({toPersianDigits(getPersianDateString(tomorrowStr))})
                  </div>
                  {tomorrowCafes.map((cafe) => (
                    <div
                      key={cafe.id}
                      onClick={() => onCafeSelect(cafe.id)}
                      className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-all flex flex-col gap-1.5 ${
                        cafe.id === selectedCafeId ? 'bg-orange-50/30 border-r-4 border-orange-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-800 text-xs">{cafe.name}</h4>
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold px-2 py-0.5 rounded">
                          فردا
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{cafe.address}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {driverTab === 'allFuture' && (
              allScheduledCafes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2 font-bold">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                  <span>هیچ برنامه‌ریزی در سیستم وجود ندارد.</span>
                </div>
              ) : (
                <div>
                  <div className="px-3 py-1 bg-slate-100/80 text-[10px] font-extrabold text-slate-500 border-y border-slate-200/40">
                    لیست کلیه برنامه‌های کاری ثبت شده
                  </div>
                  {allScheduledCafes.map((cafe) => {
                    const isToday = cafe.assignedDate === todayStr;
                    const isTomorrow = cafe.assignedDate === tomorrowStr;
                    
                    let dateLabel = getPersianDateString(cafe.assignedDate);
                    if (isToday) dateLabel = 'امروز';
                    else if (isTomorrow) dateLabel = 'فردا';

                    let statusBadge = null;
                    if (cafe.visitStatus === 'sold') {
                      statusBadge = <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">فروش</span>;
                    } else if (cafe.visitStatus === 'no_sale') {
                      statusBadge = <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">عدم خرید</span>;
                    } else if (cafe.visitStatus === 'callback') {
                      statusBadge = <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">پیگیری</span>;
                    } else if (cafe.visitStatus === 'closed') {
                      statusBadge = <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">بسته</span>;
                    } else {
                      statusBadge = <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">منتظر</span>;
                    }

                    return (
                      <div
                        key={cafe.id}
                        onClick={() => onCafeSelect(cafe.id)}
                        className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-all flex flex-col gap-1.5 border-b border-slate-100 ${
                          cafe.id === selectedCafeId ? 'bg-orange-50/30 border-r-4 border-orange-600' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-slate-800 text-xs">{cafe.name}</h4>
                          <div className="flex items-center gap-1">
                            {statusBadge}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isToday ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                              {toPersianDigits(dateLabel)}
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{cafe.address}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

      </div>

      {/* 2. Operations & Submit Report Form (8 Cols) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {selectedCafe ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm" id="driver_cafe_report_card">
            
            {/* Header info of selected cafe */}
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-orange-600 font-extrabold tracking-wide">کافه در حال بازدید</span>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Coffee className="w-5 h-5 text-orange-600" />
                  {selectedCafe.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {selectedCafe.address}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 text-xs">
                <a
                  href={typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(window.navigator.userAgent) ? `maps://?q=${selectedCafe.lat},${selectedCafe.lng}` : `geo:${selectedCafe.lat},${selectedCafe.lng}?q=${selectedCafe.lat},${selectedCafe.lng}(${encodeURIComponent(selectedCafe.name)})`}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2.5 rounded-xl font-extrabold shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
                  title="مسیریابی هوشمند با اپلیکیشن‌های گوشی (نشان، بلد، گوگل مپس)"
                >
                  <Navigation className="w-3.5 h-3.5 rotate-45" />
                  <span>مسیریابی</span>
                </a>
                {selectedCafe.phone && (
                  <a
                    href={`tel:${selectedCafe.phone}`}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl font-sans hover:bg-slate-100 transition-all font-extrabold"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{toPersianDigits(selectedCafe.phone)}</span>
                  </a>
                )}
                <span className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-orange-50 text-orange-800 border border-orange-100 px-3 py-2.5 rounded-xl font-extrabold">
                  <User className="w-3.5 h-3.5 text-orange-500" />
                  <span>مدیر: {selectedCafe.managerName || 'نامشخص'}</span>
                </span>
              </div>
            </div>



            {/* Visit submission form */}
            <form onSubmit={handleReportSubmit} className="mt-5 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span>ثبت گزارش و نتایج بازاریابی هولدر لیوان</span>
              </h4>

              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg font-bold">{error}</div>}
              {success && <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg font-bold">{success}</div>}

              {/* Status Radio Choice */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">وضعیت بازدید و سفارش کافه:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  
                  {/* Visited & Sold */}
                  <label className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${
                    status === 'sold'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/50 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="visitStatus"
                      value="sold"
                      checked={status === 'sold'}
                      onChange={() => setStatus('sold')}
                      className="hidden"
                    />
                    <CheckCircle2 className="w-4.5 h-4.5" />
                    <span>فروش موفق</span>
                  </label>

                  {/* Callback */}
                  <label className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${
                    status === 'callback'
                      ? 'bg-orange-50 text-orange-700 border-orange-300 ring-2 ring-orange-500/20'
                      : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/50 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="visitStatus"
                      value="callback"
                      checked={status === 'callback'}
                      onChange={() => setStatus('callback')}
                      className="hidden"
                    />
                    <Clock className="w-4.5 h-4.5" />
                    <span>پیگیری مجدد</span>
                  </label>

                  {/* Visited & No Sale */}
                  <label className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${
                    status === 'no_sale'
                      ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-500/20'
                      : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/50 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="visitStatus"
                      value="no_sale"
                      checked={status === 'no_sale'}
                      onChange={() => setStatus('no_sale')}
                      className="hidden"
                    />
                    <XCircle className="w-4.5 h-4.5" />
                    <span>عدم خرید</span>
                  </label>

                  {/* Closed */}
                  <label className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${
                    status === 'closed'
                      ? 'bg-slate-100 text-slate-700 border-slate-300 ring-2 ring-slate-400/20'
                      : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/50 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="visitStatus"
                      value="closed"
                      checked={status === 'closed'}
                      onChange={() => setStatus('closed')}
                      className="hidden"
                    />
                    <AlertCircle className="w-4.5 h-4.5" />
                    <span>کافه بسته بود</span>
                  </label>

                </div>
              </div>

              {/* Show only if SOLD */}
              {status === 'sold' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 animate-fadeIn">
                  
                  {/* Select Product */}
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Package className="w-4 h-4 text-emerald-600" />
                      <span>نوع کالا / محصول فروخته شده:</span>
                    </label>
                    <select
                      id="form_product_select"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 text-slate-700 font-semibold"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ({toPersianDigits(formatPrice(p.price))} تومان)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Quantity Sold */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <span>تعداد سفارش داده شده:</span>
                      </label>
                      <div className="relative">
                        <input
                          id="form_qty"
                          type="number"
                          min="1"
                          required
                          value={quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 0);
                            setQuantity(val);
                          }}
                          className="w-full pl-12 pr-4 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-sans focus:outline-none focus:border-emerald-500 font-bold"
                        />
                        <span className="absolute left-3 top-2 text-[10px] font-extrabold text-slate-400">عدد</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">تعداد نهایی بر اساس فاکتور تحویلی</p>
                    </div>

                    {/* Total Price */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>مبلغ کل سفارش (تومان):</span>
                      </label>
                      <div className="relative">
                        <input
                          id="form_price"
                          type="text"
                          readOnly
                          disabled
                          value={`${toPersianDigits(formatPrice(totalPrice))} تومان`}
                          className="w-full px-4 py-2 bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-500 select-none cursor-not-allowed text-center"
                        />
                      </div>
                      <p className="text-[10px] text-orange-600 font-black">
                        ⚠️ تعیین قیمت فروش منحصراً در اختیار مدیریت می‌باشد.
                      </p>
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="text-[10px] bg-emerald-100/30 text-emerald-800 border border-emerald-100/50 p-2.5 rounded-xl leading-relaxed font-bold">
                      محاسبه قیمت: {toPersianDigits(quantity)} عدد × {toPersianDigits(formatPrice(selectedProduct.price))} تومان (قیمت واحد مصوب مدیریت) = {toPersianDigits(formatPrice(totalPrice))} تومان
                    </div>
                  )}

                </div>
              )}

              {/* General description box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">توضیحات و بازخورد مدیر کافه:</label>
                <textarea
                  id="form_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: مایل به سفارش با لوگوی اختصاصی کافه خودشان هستند / فردا دوباره تماس گرفته شود..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none focus:border-orange-600 focus:bg-white resize-none text-slate-700 leading-relaxed font-medium"
                />
              </div>

              {/* Submit btn */}
              <button
                id="btn_submit_report"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                    در حال ارسال گزارش...
                  </span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ثبت نهایی و ارسال گزارش به کارتن محمد</span>
                  </>
                )}
              </button>

            </form>

          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200/80 rounded-2xl p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2 font-bold">
            <Coffee className="w-10 h-10 text-slate-300" />
            <span>مدیر کافه گرامی، لطفا برای شروع ثبت گزارش بازدید، یکی از کافه‌های برنامه امروز خود را از لیست سمت راست انتخاب کنید.</span>
          </div>
        )}

      </div>

    </div>
  );
}
