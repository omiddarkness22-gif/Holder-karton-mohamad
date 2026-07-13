import React, { useState, useEffect, useRef, useMemo } from 'react';
import { g_to_j, JALALI_MONTH_NAMES, toPersianDigits as toPersianDigitsShamsi } from '../lib/shamsi';
import { Cafe, VisitReport, DriverStatus, Product, DeletionRequest } from '../types';
import { api } from '../api';
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
  DollarSign,
  Trash2,
  AlertTriangle,
  Bell,
  Plus,
  ShoppingBag,
} from 'lucide-react';

interface DriverPanelProps {
  cafes: Cafe[];
  reports: VisitReport[];
  driverStatus: DriverStatus | null;
  products: Product[];
  deletionRequests: DeletionRequest[];
  notifications: any[];
  onMarkNotificationAsRead: (id: string) => Promise<void>;
  onMarkAllNotificationsAsRead: () => Promise<void>;
  onCreateDeletionRequest: (reportId: string, cafeId: string, reason: string) => Promise<void>;
  onUpdateDriverLocation: (lat: number, lng: number, isSharing: boolean) => Promise<void>;
  onSubmitReport: (report: Omit<VisitReport, 'id' | 'timestamp'>) => Promise<void>;
  onDeleteReport: (reportId: string, cafeId: string) => Promise<void>;
  selectedCafeId: string | null;
  onCafeSelect: (cafeId: string) => void;
  setUserLocation: (coords: { lat: number; lng: number } | null) => void;
  activeDate: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function DriverPanel({
  cafes,
  reports,
  driverStatus,
  products,
  deletionRequests,
  notifications,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onCreateDeletionRequest,
  onUpdateDriverLocation,
  onSubmitReport,
  onDeleteReport,
  selectedCafeId,
  onCafeSelect,
  setUserLocation,
  activeDate,
  darkMode,
  toggleDarkMode,
}: DriverPanelProps) {
  // Basket Item Interface for selling multiple products
  interface BasketItem {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }

  // Form states
  const [status, setStatus] = useState<Cafe['visitStatus']>('sold');
  const [quantity, setQuantity] = useState<number | ''>(100);
  const [totalPrice, setTotalPrice] = useState<number>(150000); // 150,000 Tomans
  const [notes, setNotes] = useState('');

  // Product state for driver panel
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Multiple Products Basket State
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [addQuantity, setAddQuantity] = useState<number | ''>(50);
  const [addProductId, setAddProductId] = useState<string>('');

  // Find currently selected product
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || products[0] || null;
  }, [selectedProductId, products]);

  // Set initial product ID when products are loaded
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
    if (products.length > 0 && !addProductId) {
      setAddProductId(products[0].id);
    }
  }, [products]);

  // Automatically calculate total price based on unit price (driver cannot edit price)
  useEffect(() => {
    if (selectedProduct) {
      const qty = typeof quantity === 'number' ? quantity : 0;
      setTotalPrice(qty * selectedProduct.price);
    }
  }, [quantity, selectedProduct]);

  // Basket item quantity modification helpers
  const handleUpdateBasketItemQty = (prodId: string, newQty: number) => {
    const qty = Math.max(1, newQty);
    setBasketItems(prev => prev.map(item => {
      if (item.productId === prodId) {
        return {
          ...item,
          quantity: qty,
          totalPrice: qty * item.unitPrice
        };
      }
      return item;
    }));
  };

  // Safe wrapper for string key conversion
  const toEnglishDigits = (str: string): string => {
    return str.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
              .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  };

  const handleRemoveBasketItem = (prodId: string) => {
    setBasketItems(prev => prev.filter(item => item.productId !== prodId));
  };

  const handleAddProductToBasket = () => {
    if (!addProductId) return;
    const prod = products.find(p => p.id === addProductId);
    if (!prod) return;

    const qty = typeof addQuantity === 'number' ? addQuantity : 50;

    setBasketItems(prev => {
      const existing = prev.find(item => item.productId === addProductId);
      if (existing) {
        return prev.map(item => {
          if (item.productId === addProductId) {
            const nextQty = item.quantity + qty;
            return {
              ...item,
              quantity: nextQty,
              totalPrice: nextQty * item.unitPrice
            };
          }
          return item;
        });
      } else {
        return [
          ...prev,
          {
            productId: prod.id,
            productName: prod.name,
            unitPrice: prod.price,
            quantity: qty,
            totalPrice: qty * prod.price
          }
        ];
      }
    });
    setAddQuantity(50);
  };

  // Sync basket changes to total quantity and price states
  useEffect(() => {
    if (status === 'sold' && basketItems.length > 0) {
      const totalQty = basketItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPriceSum = basketItems.reduce((sum, item) => sum + item.totalPrice, 0);
      setQuantity(totalQty);
      setTotalPrice(totalPriceSum);
    }
  }, [basketItems, status]);
  
  const [loading, setLoading] = useState(false);
  const [driverTab, setDriverTab] = useState<'today' | 'tomorrow' | 'allFuture'>('today');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Deletion request states
  const [showDeletionRequestForm, setShowDeletionRequestForm] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionError, setDeletionError] = useState('');

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

  // Ref to track selected cafe id to prevent form reset during live polling updates
  const lastCafeIdRef = useRef<string | null>(null);

  // Update report default values if target changes
  useEffect(() => {
    if (!selectedCafe) {
      lastCafeIdRef.current = null;
      return;
    }

    if (selectedCafe.id !== lastCafeIdRef.current) {
      lastCafeIdRef.current = selectedCafe.id;
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
          setBasketItems([]);
        }
      } else {
        setStatus('sold');
        setNotes('');
        
        // Initialize basket with the first product as a default (100 qty) for convenience
        if (products.length > 0) {
          const defaultProd = products[0];
          setSelectedProductId(defaultProd.id);
          setQuantity(100);
          setTotalPrice(100 * defaultProd.price);
          setBasketItems([
            {
              productId: defaultProd.id,
              productName: defaultProd.name,
              unitPrice: defaultProd.price,
              quantity: 100,
              totalPrice: 100 * defaultProd.price
            }
          ]);
        } else {
          setQuantity(100);
          setTotalPrice(150000);
          setBasketItems([]);
        }
      }
    } else {
      // Same cafe being active - if products have been loaded and nothing is selected, do a lazy init
      if (products.length > 0 && !selectedProductId) {
        setSelectedProductId(products[0].id);
      }
    }
  }, [selectedCafeId, selectedCafe, reports, products, selectedProductId]);

  // Submit report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCafe) return;

    if (status === 'sold' && basketItems.length === 0) {
      setError('سبد سفارشات خالی است. لطفا ابتدا یک محصول به فاکتور اضافه کنید.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const qtyNum = typeof quantity === 'number' ? quantity : 0;
    const reportData: Omit<VisitReport, 'id' | 'timestamp'> = {
        cafeId: selectedCafe.id,
        cafeName: selectedCafe.name,
        driverName: driverStatus?.name || 'محمد دزفولی',
        status: status as VisitReport['status'],
        quantitySold: status === 'sold' ? qtyNum : 0,
        totalPrice: status === 'sold' ? totalPrice : 0,
        notes: notes.trim(),
    };

    if (status === 'sold' && basketItems.length > 0) {
        reportData.productId = basketItems.map(item => item.productId).join(",");
        reportData.productName = basketItems.map(item => `${item.productName} (${item.quantity} عدد)`).join(" + ");
    } else if (status === 'sold' && selectedProduct) {
        reportData.productId = selectedProduct.id;
        reportData.productName = selectedProduct.name;
    }

    try {
      await onSubmitReport(reportData);
      setSuccess('گزارش بازاریابی شما با موفقیت به مدیریت ارسال شد.');
      setNotes('');
      // Keep lastCafeIdRef updated so that it doesn't immediately reset if we render read-only state
      lastCafeIdRef.current = null;
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
    <div className="flex flex-col gap-6 rtl text-right dark:text-white" id="driver_panel_root">
      
      {/* 1. Today's Target List */}
      <div className="flex flex-col gap-5">

        {/* Compact inline notification panel */}
        {notifications.length > 0 && (
          <div className="bg-orange-50/40 dark:bg-orange-950/10 border border-orange-200/60 dark:border-orange-900/30 rounded-2xl p-4 shadow-sm space-y-3 animate-fadeIn" id="driver_in_panel_notifications">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-400">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-950/50 rounded-lg text-orange-600 dark:text-orange-400">
                  <Bell className="w-4 h-4 animate-swing" />
                </div>
                <h4 className="font-extrabold text-xs text-orange-900 dark:text-orange-300">اعلان‌های دریافتی جدید ({toPersianDigits(notifications.length)})</h4>
              </div>
              <button
                type="button"
                onClick={onMarkAllNotificationsAsRead}
                className="text-[10px] text-orange-700 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 font-black cursor-pointer bg-orange-100/60 hover:bg-orange-100 dark:bg-orange-950/45 dark:hover:bg-orange-950/80 px-2.5 py-1 rounded-lg transition-all"
              >
                تایید همه به عنوان خوانده شده
              </button>
            </div>

            <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
              {notifications.map((notif) => (
                <div key={notif.id} className="bg-white dark:bg-slate-800 border border-orange-100/60 dark:border-orange-900/20 rounded-xl p-2.5 flex items-start gap-2.5 shadow-sm text-right text-xs">
                  <div className="flex-1 text-slate-600 dark:text-slate-300 font-bold leading-relaxed text-[11px]">
                    {notif.message}
                  </div>
                  <button
                    type="button"
                    onClick={() => onMarkNotificationAsRead(notif.id)}
                    className="p-1 bg-slate-50 dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-slate-400 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 rounded-md transition-all cursor-pointer"
                    title="علامت‌گذاری به عنوان خوانده شده"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
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

      {/* 2. Operations & Submit Report Form */}
      <div className="flex flex-col gap-6">
        
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

            {selectedCafe.visitStatus !== 'pending' && (
              <div className="bg-orange-50/80 border border-orange-200/60 p-4 rounded-xl text-xs space-y-3 mt-4" id="report_already_submitted_warning">
                {(() => {
                  const existingReport = reports.find(r => r.cafeId === selectedCafe.id);
                  if (!existingReport) return null;
                  
                  const pendingReq = deletionRequests.find(req => req.reportId === existingReport.id && req.status === 'pending');
                  
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-orange-800 font-extrabold">
                          <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                          <span>گزارش بازدید این کافه قبلاً ثبت شده است.</span>
                        </div>

                        {!pendingReq && (() => {
                          const reportDateStr = new Date(existingReport.timestamp).toDateString();
                          const todayDateStr = new Date().toDateString();
                          const isToday = reportDateStr === todayDateStr;
                          
                          if (!isToday) {
                            return (
                              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded">
                                فقط گزارش روز جاری قابل حذف است.
                              </span>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDeletionRequestForm(true);
                                setDeletionReason('');
                                setDeletionError('');
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              id="btn_delete_report_prompt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>درخواست حذف گزارش</span>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Compact Details of the submitted report */}
                      <div className="bg-white/90 dark:bg-slate-900/50 p-3.5 rounded-xl border border-orange-100/60 dark:border-slate-800 space-y-2.5 text-right shadow-sm">
                        <div className="grid grid-cols-2 gap-3 text-[11px]">
                          <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                            <span className="text-slate-400 font-bold">وضعیت ثبت شده: </span>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">
                              {existingReport.status === 'sold' && 'فروش موفق'}
                              {existingReport.status === 'no_sale' && 'بدون خرید'}
                              {existingReport.status === 'callback' && 'پیگیری مجدد'}
                              {existingReport.status === 'closed' && 'کافه بسته بود'}
                            </span>
                          </div>
                          {existingReport.status === 'sold' && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                              <span className="text-slate-400 font-bold">محصول فروخته شده: </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{existingReport.productName || 'کارتن لیوان'}</span>
                            </div>
                          )}
                          {existingReport.status === 'sold' && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                              <span className="text-slate-400 font-bold">تعداد کل سفارش: </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{toPersianDigits(existingReport.quantitySold)} عدد</span>
                            </div>
                          )}
                          {existingReport.status === 'sold' && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                              <span className="text-slate-400 font-bold">مبلغ کل فاکتور: </span>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{toPersianDigits(formatPrice(existingReport.totalPrice))} تومان</span>
                            </div>
                          )}
                        </div>
                        {existingReport.notes && (
                          <div className="text-[11px] border-t border-slate-100/80 dark:border-slate-800/60 pt-2 mt-2">
                            <span className="text-slate-400 font-bold">توضیحات و یادداشت راننده: </span>
                            <p className="text-slate-600 dark:text-slate-300 font-bold leading-relaxed mt-1">{existingReport.notes}</p>
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400 text-left border-t border-slate-100/50 dark:border-slate-800/40 pt-1.5 mt-1.5 font-bold">
                          ثبت شده در: {toPersianDigits(new Date(existingReport.timestamp).toLocaleTimeString('fa-IR'))}
                        </div>
                      </div>

                      {pendingReq && (
                        <div className="bg-orange-100/50 border border-orange-200 p-3.5 rounded-xl space-y-2 text-right">
                          <p className="font-extrabold text-orange-800 text-xs flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-orange-600" />
                            <span>درخواست حذف گزارش ثبت شده و در انتظار تأیید مدیریت است.</span>
                          </p>
                          <p className="text-slate-600 font-medium text-[11px]">
                            دلیل ثبت شده برای حذف: <span className="font-bold text-slate-800">{pendingReq.reason}</span>
                          </p>
                        </div>
                      )}

                      {showDeletionRequestForm && !pendingReq && (
                        <div className="bg-white border border-red-100 p-3.5 rounded-xl space-y-3 animate-fadeIn" id="deletion_request_form_container">
                          <p className="font-extrabold text-slate-700 text-[11px] text-right">
                            لطفاً علت درخواست برای حذف گزارش را بنویسید تا برای تایید به مدیر ارسال شود:
                          </p>
                          <textarea
                            placeholder="مثال: اشتباه در ثبت تعداد کارتن‌ها، ثبت گزارش برای کافه اشتباهی و..."
                            value={deletionReason}
                            onChange={(e) => setDeletionReason(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-red-500 dark:focus:border-red-500 text-slate-800 dark:text-slate-100 font-medium text-right focus:bg-white dark:focus:bg-slate-850"
                            rows={2}
                            id="deletion_reason_input"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowDeletionRequestForm(false)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!deletionReason.trim()) {
                                  setDeletionError('وارد کردن دلیل حذف الزامی است.');
                                  return;
                                }
                                setDeletionError('');
                                try {
                                  await onCreateDeletionRequest(existingReport.id, selectedCafe.id, deletionReason.trim());
                                  setShowDeletionRequestForm(false);
                                  setSuccess('درخواست حذف گزارش با موفقیت ثبت شد و برای مدیریت ارسال گردید.');
                                } catch (e) {
                                  setDeletionError('خطا در ثبت درخواست.');
                                }
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] px-4 py-2 rounded-xl transition-all cursor-pointer"
                            >
                              ارسال درخواست به مدیریت
                            </button>
                          </div>
                          {deletionError && (
                            <p className="text-[10px] font-bold text-red-600 text-right">
                              {deletionError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}



            {/* Visit submission form */}
            {selectedCafe.visitStatus === 'pending' && (
              <form onSubmit={handleReportSubmit} className="mt-5 space-y-4">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-600" />
                  <span>ثبت گزارش و نتایج بازاریابی کارتن</span>
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
                <div className="grid grid-cols-1 gap-4 p-4 rounded-2xl bg-emerald-50/40 dark:bg-slate-800/20 border border-emerald-100 dark:border-emerald-950/40 animate-fadeIn">
                  
                  <div className="space-y-3">
                    <label className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 border-b border-emerald-100 dark:border-emerald-950 pb-1.5">
                      <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>اقلام و کالاهای فروخته شده (فاکتور فروش)</span>
                    </label>

                    {/* Basket Items List */}
                    {basketItems.length === 0 ? (
                      <div className="text-center py-4 text-xs font-bold text-slate-400 bg-white/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        هیچ محصولی در فاکتور اضافه نشده است. لطفاً از بخش زیر محصول اضافه کنید.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {basketItems.map((item) => (
                          <div 
                            key={item.productId} 
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-xs"
                          >
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.productName}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                قیمت واحد: {toPersianDigits(formatPrice(item.unitPrice))} تومان
                              </span>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3.5">
                              {/* Quantity Editor */}
                              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-850 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/50">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBasketItemQty(item.productId, item.quantity - 1)}
                                  className="w-5 h-5 rounded bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold flex items-center justify-center transition-colors text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const cleanVal = toEnglishDigits(e.target.value).replace(/\D/g, '');
                                    if (cleanVal !== '') {
                                      handleUpdateBasketItemQty(item.productId, parseInt(cleanVal, 10));
                                    } else {
                                      handleUpdateBasketItemQty(item.productId, 1);
                                    }
                                  }}
                                  className="w-12 text-center bg-transparent border-0 font-sans font-black text-xs text-black dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBasketItemQty(item.productId, item.quantity + 1)}
                                  className="w-5 h-5 rounded bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold flex items-center justify-center transition-colors text-sm"
                                >
                                  +
                                </button>
                              </div>

                              {/* Price Display */}
                              <div className="text-left min-w-[90px]">
                                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                                  {toPersianDigits(formatPrice(item.totalPrice))} تومان
                                </span>
                              </div>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveBasketItem(item.productId)}
                                className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Product Section */}
                  <div className="bg-slate-100/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-800/40 space-y-3 mt-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 block">
                      ➕ افزودن کالا/محصول جدید به این فاکتور:
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Product select */}
                      <div className="sm:col-span-6 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">انتخاب محصول:</label>
                        <select
                          id="add_product_select"
                          value={addProductId}
                          onChange={(e) => setAddProductId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-black dark:text-white focus:outline-none focus:border-emerald-500"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id} className="text-black bg-white">
                              {p.name} - ({toPersianDigits(formatPrice(p.price))} ت)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity input */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">تعداد:</label>
                        <input
                          id="add_product_qty"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={addQuantity}
                          onChange={(e) => {
                            const cleanVal = toEnglishDigits(e.target.value).replace(/\D/g, '');
                            if (cleanVal === '') {
                              setAddQuantity('');
                            } else {
                              setAddQuantity(Math.max(1, parseInt(cleanVal, 10)));
                            }
                          }}
                          placeholder="مثال: ۵۰"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-black dark:text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Add button */}
                      <div className="sm:col-span-3">
                        <button
                          type="button"
                          onClick={handleAddProductToBasket}
                          className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن به لیست</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  {basketItems.length > 0 && (
                    <div className="mt-2 pt-3 border-t border-dashed border-emerald-100 dark:border-emerald-950 flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-emerald-100/30 dark:bg-emerald-950/10 p-3 rounded-xl border border-emerald-100/50 dark:border-emerald-950/30">
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">جمع کل اقلام سفارش:</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {toPersianDigits(quantity || 0)} عدد کالا
                          </span>
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">جمع کل مبلغ فاکتور:</span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {toPersianDigits(formatPrice(totalPrice))} تومان
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold flex items-center gap-1">
                        <span>⚠️ تعیین قیمت فروش منحصراً بر اساس نرخ مصوب مدیریت می‌باشد.</span>
                      </p>
                    </div>
                  )}

                </div>
              )}

              {/* General description box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">توضیحات و بازخورد مدیر کافه:</label>
                <textarea
                  id="form_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: مایل به سفارش با لوگوی اختصاصی کافه خودشان هستند / فردا دوباره تماس گرفته شود..."
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-orange-600 dark:focus:border-orange-500 focus:bg-white dark:focus:bg-slate-850 resize-none text-black dark:text-white leading-relaxed font-black text-right"
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
            )}

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
