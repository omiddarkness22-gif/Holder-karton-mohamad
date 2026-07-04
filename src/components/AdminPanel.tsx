import React, { useState, useMemo, useEffect } from 'react';
import ShamsiDatePicker from './ShamsiDatePicker';
import SalesReport from './SalesReport';
import MapComponent from './MapComponent';
import { g_to_j, JALALI_MONTH_NAMES, toPersianDigits as toPersianDigitsShamsi } from '../lib/shamsi';
import {
  Cafe,
  VisitReport,
  DriverStatus,
  Product
} from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MapPin,
  Phone,
  User,
  Search,
  ChevronLeft,
  Truck,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Clock3,
  Coffee,
  Lock,
  Edit3,
  Save,
  Package,
  PlusCircle,
  Tag,
  Menu,
  X,
  LayoutDashboard,
  MessageSquareCode
} from 'lucide-react';

interface AdminPanelProps {
  cafes: Cafe[];
  reports: VisitReport[];
  driverStatus: DriverStatus | null;
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateProduct: (productId: string, product: Partial<Omit<Product, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  selectedCafeId: string | null;
  onCafeSelect: (cafeId: string) => void;
  onAddCafe: (cafe: Omit<Cafe, 'id' | 'createdAt' | 'visitStatus' | 'lastVisitDate' | 'assignedDate'>) => Promise<void>;
  onDeleteCafe: (cafeId: string) => Promise<void>;
  onAssignDate: (cafeId: string, date: string | null) => Promise<void>;
  isAddingCafeMode: boolean;
  setIsAddingCafeMode: (mode: boolean) => void;
  newCafeCoords: { lat: number; lng: number } | null;
  setNewCafeCoords: (coords: { lat: number; lng: number } | null) => void;
  onLockAdmin?: () => void;
  activeDate: string;
  userLocation?: { lat: number; lng: number } | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

// Dezful Coordinates as Default for form inputs
const DEZFUL_LAT = 32.3855;
const DEZFUL_LNG = 48.4065;

const getPersianDateString = (dateStr: string) => {
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

export default function AdminPanel({
  cafes,
  reports,
  driverStatus,
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  selectedCafeId,
  onCafeSelect,
  onAddCafe,
  onDeleteCafe,
  onAssignDate,
  isAddingCafeMode,
  setIsAddingCafeMode,
  newCafeCoords,
  setNewCafeCoords,
  onLockAdmin,
  activeDate,
  userLocation,
  darkMode,
  toggleDarkMode,
}: AdminPanelProps) {
  // Tabs & Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cafes' | 'sales' | 'products' | 'reports' | 'settings'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'داشبورد و نقشه زنده', icon: LayoutDashboard },
    { id: 'cafes', label: 'بانک کافه‌ها', icon: Coffee },
    { id: 'sales', label: 'تحلیل جامع فروش دزفول', icon: TrendingUp },
    { id: 'products', label: 'مدیریت محصولات و قیمت‌ها', icon: Package },
    { id: 'reports', label: 'گزارش‌های امروز راننده', icon: Clock3 },
    { id: 'settings', label: 'تنظیمات امنیتی', icon: Lock },
  ] as const;

  // Form state
  const [name, setName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [customLat, setCustomLat] = useState<string>(DEZFUL_LAT.toString());
  const [customLng, setCustomLng] = useState<string>(DEZFUL_LNG.toString());
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterToday, setFilterToday] = useState<boolean>(false);

  // Status message state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // New report popup state
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [latestReport, setLatestReport] = useState<VisitReport | null>(null);
  
  // Track component mount time and report IDs that have already been shown
  const mountTimeRef = React.useRef(Date.now() - 5000); // 5 second buffer in case of slight clock drift
  const shownReportIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (reports.length === 0) return;

    // Find any report created after the page was mounted
    // and that hasn't been shown yet in this session
    const newReports = reports.filter(r => 
      r.timestamp > mountTimeRef.current && 
      !shownReportIdsRef.current.has(r.id)
    );

    if (newReports.length > 0) {
      const newestReport = newReports[0];
      const isDismissed = localStorage.getItem(`dismissed_report_${newestReport.id}`) === 'true';
      
      if (!isDismissed) {
        shownReportIdsRef.current.add(newestReport.id);
        setLatestReport(newestReport);
        setShowReportPopup(true);
      }
    }
  }, [reports]);

  // Password management
  const [newPassword, setNewPassword] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateErr, setUpdateErr] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'auth'), { passcode: newPassword });
      setUpdateMsg('رمز عبور با موفقیت تغییر کرد');
      setNewPassword('');
    } catch (err) {
      setUpdateErr('خطا در تغییر رمز عبور');
    }
  };
  // Product management state
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [prodError, setProdError] = useState('');
  const [prodSuccess, setProdSuccess] = useState('');

  // Handle adding product
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) {
      setProdError('لطفا نام و قیمت محصول را وارد کنید.');
      return;
    }
    const parsedPrice = parseFloat(newProdPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setProdError('قیمت باید یک عدد معتبر و بزرگتر از صفر باشد.');
      return;
    }

    setLoading(true);
    setProdError('');
    setProdSuccess('');
    try {
      await onAddProduct({
        name: newProdName,
        price: parsedPrice,
        description: newProdDesc,
      });
      setProdSuccess(`محصول "${newProdName}" با موفقیت ثبت شد.`);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdDesc('');
    } catch (err: any) {
      setProdError('خطا در ثبت محصول: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle saving edited price
  const handleSavePrice = async (productId: string) => {
    const parsedPrice = parseFloat(editingPriceValue);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setProdError('قیمت باید عدد معتبر باشد.');
      return;
    }

    setLoading(true);
    setProdError('');
    setProdSuccess('');
    try {
      await onUpdateProduct(productId, { price: parsedPrice });
      setProdSuccess('قیمت محصول با موفقیت بروزرسانی شد.');
      setEditingProductId(null);
    } catch (err: any) {
      setProdError('خطا در بروزرسانی قیمت: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedCafeId]);

  // Update form coords if admin clicks the map
  useMemo(() => {
    if (newCafeCoords) {
      setCustomLat(newCafeCoords.lat.toFixed(6));
      setCustomLng(newCafeCoords.lng.toFixed(6));
    }
  }, [newCafeCoords]);

  // Today's Date String Helper
  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();

  // Selected Cafe info
  const selectedCafe = useMemo(() => {
    return cafes.find((c) => c.id === selectedCafeId) || null;
  }, [selectedCafeId, cafes]);

  // Custom Date Planning State
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCafe) {
      setSelectedCustomDate(selectedCafe.assignedDate || null);
    } else {
      setSelectedCustomDate(null);
    }
  }, [selectedCafeId, selectedCafe?.assignedDate]);

  // Handle adding Cafe
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      setError('لطفا نام کافه و آدرس را حتما وارد کنید.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await onAddCafe({
        name,
        managerName,
        phone,
        address,
        lat: parseFloat(customLat),
        lng: parseFloat(customLng),
      });
      setSuccess(`کافه "${name}" با موفقیت ثبت شد.`);
      setName('');
      setManagerName('');
      setPhone('');
      setAddress('');
      setNewCafeCoords(null);
      setIsAddingCafeMode(false);
    } catch (err: any) {
      setError('خطا در ثبت کافه: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format prices beautifully in Toman
  const formatPrice = (amount: number) => {
    if (!amount) return '۰';
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  // Helper to convert English numbers to Persian
  const toPersianDigits = (str: string | number) => {
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.toString().replace(/[0-9]/g, (w) => id[+w]);
  };

  // Calculate statistics for activeDate
  const stats = useMemo(() => {
    const todayAssigned = cafes.filter((c) => c.assignedDate === activeDate);
    const totalAssignedCount = todayAssigned.length;
    
    const visitedSold = todayAssigned.filter((c) => c.visitStatus === 'sold').length;
    const visitedNoSale = todayAssigned.filter((c) => c.visitStatus === 'no_sale').length;
    const visitedCallback = todayAssigned.filter((c) => c.visitStatus === 'callback').length;
    const visitedClosed = todayAssigned.filter((c) => c.visitStatus === 'closed').length;
    const pendingCount = todayAssigned.filter((c) => c.visitStatus === 'pending').length;

    const totalVisited = visitedSold + visitedNoSale + visitedCallback + visitedClosed;
    const visitSuccessPercent = totalVisited > 0 ? Math.round((visitedSold / totalVisited) * 100) : 0;

    // Financial calculations
    const todayReports = reports.filter((r) => {
      const reportDate = new Date(r.timestamp);
      const repStr = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(reportDate.getDate()).padStart(2, '0')}`;
      return repStr === activeDate;
    });

    const totalHoldersSold = todayReports.reduce((sum, r) => sum + r.quantitySold, 0);
    const totalRevenue = todayReports.reduce((sum, r) => sum + r.totalPrice, 0);

    return {
      totalAssignedCount,
      totalVisited,
      visitedSold,
      visitedNoSale,
      visitedCallback,
      visitedClosed,
      pendingCount,
      visitSuccessPercent,
      totalHoldersSold,
      totalRevenue,
    };
  }, [cafes, reports, activeDate]);

  // Filtered cafes for the sidebar list
  const filteredCafes = useMemo(() => {
    return cafes.filter((cafe) => {
      const matchesSearch =
        cafe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cafe.managerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cafe.address.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesToday = !filterToday || cafe.assignedDate === activeDate;

      return matchesSearch && matchesToday;
    });
  }, [cafes, searchQuery, filterToday, activeDate]);

  // Driver active timing indicator
  const driverActiveTimeAgo = useMemo(() => {
    if (!driverStatus || !driverStatus.lastActive) return 'موقعیت ثبت نشده';
    const seconds = Math.floor((Date.now() - driverStatus.lastActive) / 1000);
    if (seconds < 60) return 'هم‌اکنون';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
    const hours = Math.floor(minutes / 60);
    return `${toPersianDigits(hours)} ساعت پیش`;
  }, [driverStatus]);

  const handleMapClick = (lat: number, lng: number) => {
    if (isAddingCafeMode) {
      setNewCafeCoords({ lat, lng });
    }
  };

  return (
    <div className="w-full rtl text-right flex flex-col gap-4" id="admin_panel_root">
      
      {/* Report Popup Modal */}
      {showReportPopup && latestReport && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" id="report_popup_modal">
          <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200">
            <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
              <MessageSquareCode className="w-6 h-6 text-orange-600" />
              گزارش جدید از راننده
            </h3>
            <div className="space-y-3 text-sm text-slate-600">
              <p>کافه: <span className="font-bold text-slate-800">{latestReport.cafeName}</span></p>
              <p>وضعیت: <span className="font-bold text-slate-800">{latestReport.status === 'sold' ? 'فروش موفق' : 'بدون فروش'}</span></p>
              <p>توضیحات: <span className="font-medium text-slate-700">{latestReport.notes || 'بدون توضیحات'}</span></p>
            </div>
            <button 
              onClick={() => {
                if (latestReport) {
                  localStorage.setItem(`dismissed_report_${latestReport.id}`, 'true');
                }
                setShowReportPopup(false);
              }} 
              className="mt-6 w-full bg-orange-600 text-white font-bold py-3 rounded-2xl hover:bg-orange-700 transition-all cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )}

      {/* Admin Panel Tabs & Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-2 flex flex-col md:flex-row items-center justify-between gap-4" id="admin_tabs_header">
        {/* ... existing header content ... */}
        
        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 mt-4">
            <h2 className="text-lg font-bold mb-4">تنظیمات</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-bold mb-2">تغییر رمز عبور مدیریت</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="رمز عبور جدید"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    required
                  />
                  <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded-xl">تغییر رمز</button>
                </form>
                {updateMsg && <p className="text-green-600 mt-2">{updateMsg}</p>}
                {updateErr && <p className="text-red-600 mt-2">{updateErr}</p>}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 justify-between w-full md:w-auto">
          <div className="flex items-center gap-2">
            <div className="bg-orange-50 p-2 rounded-xl text-orange-600 border border-orange-100">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800">پنل مدیریت هوشمند دزفول</h1>
              <p className="text-[10px] text-slate-400 font-medium">کارتن محمد - ردیابی زنده و مدیریت یکپارچه</p>
            </div>
          </div>

          {/* Hamburger button for mobile */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-all cursor-pointer border border-slate-200"
            id="admin_hamburger_btn"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Desktop Tabs list */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 text-orange-600" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons: Lock Panel */}
        <div className="hidden md:flex items-center gap-3">
          {onLockAdmin && (
            <button
              type="button"
              onClick={onLockAdmin}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer border border-slate-200/60"
              id="header_lock_admin"
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span>خروج و قفل پنل</span>
            </button>
          )}
        </div>

        {/* Mobile dropdown menu */}
        {isMenuOpen && (
          <div className="md:hidden w-full flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-2 mt-2 space-y-1 animate-fadeIn">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full text-right px-4 py-2.5 text-xs font-black rounded-lg transition-all flex items-center gap-2.5 cursor-pointer ${
                    isActive
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-orange-600'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            
            {onLockAdmin && (
              <button
                type="button"
                onClick={() => {
                  onLockAdmin();
                  setIsMenuOpen(false);
                }}
                className="w-full text-right px-4 py-2.5 text-xs font-black rounded-lg transition-all flex items-center gap-2.5 text-red-600 hover:bg-red-50 cursor-pointer border-t border-slate-200/60 mt-1"
              >
                <Lock className="w-4 h-4 text-red-500" />
                <span>خروج و قفل پنل</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="w-full" id="admin_tab_contents">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="dashboard_tab_root">
            {/* Stats Dashboard on top - full width inside tab */}
            <div className="lg:col-span-12">
              {/* Statistics Widgets Banner - Beautiful Bento Cells */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2" id="stats_dashboard">
                {/* Total Target today */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300">
                  <span className="text-xs font-bold text-slate-400">مجموع اهداف امروز</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black text-orange-600 font-sans">{toPersianDigits(stats.totalAssignedCount)}</span>
                    <span className="text-xs text-slate-400 font-bold">کافه</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-300 block"></span>
                    <span>منتظر بازدید: {toPersianDigits(stats.pendingCount)}</span>
                  </div>
                </div>

                {/* Visits completed */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300">
                  <span className="text-xs font-bold text-slate-400">بازدیدهای انجام شده</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black text-slate-800 font-sans">{toPersianDigits(stats.totalVisited)}</span>
                    <span className="text-xs text-slate-400 font-bold">کافه</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 font-bold">
                    موفقیت:{' '}
                    <span className="text-emerald-600 font-extrabold">
                      ٪{toPersianDigits(stats.visitSuccessPercent)}
                    </span>
                  </div>
                </div>

                {/* Total Cup Holders sold */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300">
                  <span className="text-xs font-bold text-slate-400">تعداد کارتن فروخته شده</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black text-orange-700 font-sans">{toPersianDigits(stats.totalHoldersSold)}</span>
                    <span className="text-xs text-slate-400 font-bold">عدد</span>
                  </div>
                  <div className="text-[10px] text-orange-600 mt-2 flex items-center gap-0.5 font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>فروش موفق امروز</span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300">
                  <span className="text-xs font-bold text-slate-400">فروش کل (تومان)</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-black text-emerald-600 font-sans">
                      {toPersianDigits(formatPrice(stats.totalRevenue))}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-0.5 font-bold">
                    <DollarSign className="w-3 h-3 text-emerald-500" />
                    <span>تسویه نقدی و فاکتوری</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Column (8 of 12 columns): Selected Cafe details */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Selected Cafe Operations details */}
              {selectedCafe ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm" id="selected_cafe_details">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] text-orange-600 font-extrabold tracking-widest uppercase">مشخصات کافه انتخابی</span>
                      <h2 className="text-base font-black text-slate-800 flex items-center gap-1.5 mt-1">
                        <Coffee className="w-5 h-5 text-orange-600" />
                        {selectedCafe.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {selectedCafe.address}
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                      {/* Advanced Date Assigner Box */}
                      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl w-full" id="date_assigner_container">
                        {/* Today Quick Option */}
                        <div className="flex items-center gap-2 border-l-0 lg:border-l border-slate-200/80 pl-0 lg:pl-3">
                          <button
                            type="button"
                            onClick={async () => {
                              setLoading(true);
                              try {
                                if (selectedCafe.assignedDate === activeDate) {
                                  await onAssignDate(selectedCafe.id, null);
                                  setSuccess('برنامه کافه برای امروز لغو شد.');
                                } else {
                                  await onAssignDate(selectedCafe.id, activeDate);
                                  setSuccess('کافه به برنامه امروز اضافه شد.');
                                }
                              } catch (err) {
                                setError('خطا در بروزرسانی برنامه.');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className={`w-full lg:w-auto px-3.5 py-2 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                              selectedCafe.assignedDate === activeDate
                                ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Calendar className="w-4 h-4" />
                            <span>{selectedCafe.assignedDate === activeDate ? 'حذف از برنامه امروز' : 'برنامه‌ریزی برای امروز'}</span>
                          </button>
                        </div>

                        {/* Custom Date option with submit */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-extrabold text-slate-600">تاریخ مشخص:</span>
                          <ShamsiDatePicker
                            value={selectedCustomDate}
                            onChange={(val) => {
                              setSelectedCustomDate(val);
                            }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (selectedCustomDate) {
                                setLoading(true);
                                await onAssignDate(selectedCafe.id, selectedCustomDate);
                                setLoading(false);
                              }
                            }}
                            disabled={!selectedCustomDate}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                          >
                            ثبت تاریخ
                          </button>
                        </div>

                        {/* Active scheduled info */}
                        {selectedCafe.assignedDate && (
                          <div className="flex items-center justify-between gap-2 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-xl text-[10px] font-extrabold text-orange-800">
                            <span>برنامه: {toPersianDigits(getPersianDateString(selectedCafe.assignedDate))}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setLoading(true);
                                await onAssignDate(selectedCafe.id, null);
                                setLoading(false);
                              }}
                              className="text-red-500 hover:text-red-700 transition-colors mr-1 font-black cursor-pointer"
                              title="لغو برنامه‌ریزی"
                            >
                              [لغو]
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Delete button block */}
                      <div className="flex items-center shrink-0">
                        {!showDeleteConfirm ? (
                          <button
                            id="btn_delete_cafe"
                            onClick={() => {
                              setShowDeleteConfirm(true);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2.5 text-red-600 hover:text-white hover:bg-red-600 rounded-xl border border-red-200 hover:border-red-600 transition-all text-xs font-extrabold cursor-pointer"
                            title="حذف کافه از بانک اطلاعاتی"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>حذف کافه</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 p-1.5 rounded-xl animate-pulse" id="delete_confirm_actions">
                            <span className="text-[10px] text-red-700 font-extrabold px-1.5">حذف شود؟</span>
                            <button
                              id="btn_delete_confirm_yes"
                              onClick={async () => {
                                setLoading(true);
                                await onDeleteCafe(selectedCafe.id);
                                setLoading(false);
                                setShowDeleteConfirm(false);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-extrabold px-2 py-1.5 rounded-lg cursor-pointer"
                            >
                              بله، حذف
                            </button>
                            <button
                              id="btn_delete_confirm_no"
                              type="button"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-extrabold px-2 py-1.5 rounded-lg cursor-pointer"
                            >
                              خیر
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sub-panels: Stats, Contact details & History */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs text-slate-600">
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="font-extrabold text-slate-700 flex items-center gap-1 border-b border-slate-200/50 pb-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>اطلاعات تماس</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">مدیر کافه:</span>
                          <span className="font-bold text-slate-700">{selectedCafe.managerName || 'ثبت نشده'}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">شماره تلفن:</span>
                          <span className="font-bold text-slate-700 font-sans">{selectedCafe.phone || 'ثبت نشده'}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">مختصات ثبت‌شده:</span>
                          <span className="font-mono text-[10px] text-slate-500 ltr">
                            {selectedCafe.lat.toFixed(5)}, {selectedCafe.lng.toFixed(5)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="font-extrabold text-slate-700 flex items-center gap-1 border-b border-slate-200/50 pb-1.5">
                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                        <span>آخرین وضعیت و گزارش بازاریابی</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">آخرین بازدید:</span>
                          <span className="font-bold text-slate-700">
                            {selectedCafe.lastVisitDate ? toPersianDigits(selectedCafe.lastVisitDate) : 'هنوز بازدیدی انجام نشده'}
                          </span>
                        </div>
                        
                        {selectedCafe.lastVisitDate ? (
                          <div className="mt-2 text-[11px] bg-white p-2.5 rounded border border-slate-100 leading-relaxed text-slate-500 italic font-medium">
                            {reports.find((r) => r.cafeId === selectedCafe.id)?.notes || 'توضیحاتی برای این بازدید ثبت نشده است.'}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic font-medium">سفارش یا توضیحی در سیستم ثبت نشده است.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200/80 rounded-2xl p-4 text-center text-xs text-slate-400 font-bold">
                  💡 برای تعیین مسیر, حذف کافه, یا مشاهده جزئیات بیشتر, یکی از نشانگرهای نقشه یا لیست کافه‌ها را انتخاب کنید.
                </div>
              )}
            </div>

            {/* Right Column (4 of 12 columns): Tracking card */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Real-time Driver Tracker Summary */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-600"></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">موقعیت و ردیابی راننده</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        راننده:{' '}
                        <span className="font-extrabold text-slate-700">
                          {driverStatus?.name || 'محمد دزفولی'}
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      driverStatus?.isSharingLocation 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${driverStatus?.isSharingLocation ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`}></span>
                      {driverStatus?.isSharingLocation ? 'فعال (GPS آنلاین)' : 'غیرفعال'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5 font-sans">
                      <Clock className="w-3 h-3 text-slate-300" />
                      {driverActiveTimeAgo}
                    </span>
                  </div>
                </div>

                {driverStatus?.isSharingLocation && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-400">مختصات فعلی راننده:</span>
                    <span className="font-mono bg-slate-50 px-2 py-0.5 rounded text-slate-600 text-[10px] ltr">
                      {driverStatus.lat.toFixed(5)}, {driverStatus.lng.toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Also place a brief version or instructions here */}
              <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl">
                <h4 className="text-xs font-black text-orange-950 flex items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-orange-600" />
                  <span>راهنمای نقشه زنده</span>
                </h4>
                <p className="text-[11px] text-orange-800 leading-relaxed mt-2 font-medium">
                  می‌توانید آخرین موقعیت راننده را به صورت زنده روی نقشه با آیکون ون نارنجی رنگ ردیابی کنید. جهت تخصیص کافه‌ها به برنامه کاری راننده, روی کافه کلیک کرده و دکمه برنامه‌ریزی را انتخاب کنید.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cafes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="cafes_tab_root">
            {/* Cafe list on left (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[600px]" id="cafe_bank_container">
              {/* Header & Controls */}
              <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-orange-600" />
                    <span>بانک کافه‌ها ({toPersianDigits(cafes.length)})</span>
                  </h2>
                  
                  <button
                    id="btn_add_cafe_mode"
                    onClick={() => {
                      setIsAddingCafeMode(!isAddingCafeMode);
                      setNewCafeCoords(null);
                      setError('');
                      setSuccess('');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                      isAddingCafeMode
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm'
                    }`}
                  >
                    {isAddingCafeMode ? (
                      <span>انصراف از ثبت کافه</span>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>افزودن کافه جدید</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Simple Search */}
                <div className="relative">
                  <input
                    id="cafe_search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجو در نام, مدیر یا آدرس کافه..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-600 focus:bg-white text-slate-700 transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                </div>

                {/* Today Filters */}
                <div className="flex items-center gap-2">
                  <button
                    id="filter_all"
                    onClick={() => setFilterToday(false)}
                    className={`flex-1 py-1.5 px-3 text-center text-xs font-bold rounded-xl border transition-all ${
                      !filterToday
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    همه کافه‌ها
                  </button>
                  <button
                    id="filter_today"
                    onClick={() => setFilterToday(true)}
                    className={`flex-1 py-1.5 px-3 text-center text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1 ${
                      filterToday
                        ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>برنامه بازدید امروز ({toPersianDigits(cafes.filter(c => c.assignedDate === activeDate).length)})</span>
                  </button>
                </div>
              </div>

              {/* Cafe list view */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100" id="cafe_list_container">
                {filteredCafes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    کافه‌ای با این فیلتر یافت نشد.
                  </div>
                ) : (
                  filteredCafes.map((cafe) => {
                    const isAssignedToday = cafe.assignedDate === activeDate;
                    const isSelected = cafe.id === selectedCafeId;
                    
                    let statusLabel = '';
                    let statusClass = '';
                    if (isAssignedToday) {
                      if (cafe.visitStatus === 'pending') {
                        statusLabel = 'منتظر بازدید';
                        statusClass = 'bg-blue-50 text-blue-700 border-blue-200';
                      } else if (cafe.visitStatus === 'sold') {
                        statusLabel = 'فروش موفق';
                        statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (cafe.visitStatus === 'no_sale') {
                        statusLabel = 'بدون خرید';
                        statusClass = 'bg-red-50 text-red-700 border-red-200';
                      } else if (cafe.visitStatus === 'callback') {
                        statusLabel = 'تماس مجدد';
                        statusClass = 'bg-orange-50 text-orange-700 border-orange-200';
                      } else if (cafe.visitStatus === 'closed') {
                        statusLabel = 'بسته بود';
                        statusClass = 'bg-slate-50 text-slate-600 border-slate-200';
                      }
                    }

                    return (
                      <div
                        key={cafe.id}
                        onClick={() => {
                          onCafeSelect(cafe.id);
                        }}
                        className={`p-3.5 cursor-pointer hover:bg-slate-50/80 transition-all flex flex-col gap-1.5 ${
                          isSelected ? 'bg-orange-50/30 border-r-4 border-orange-600' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-extrabold text-slate-800 text-sm">{cafe.name}</h4>
                          <div className="flex items-center gap-1.5">
                            {cafe.assignedDate && (
                              <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                برنامه کاری: {toPersianDigits(getPersianDateString(cafe.assignedDate))}
                              </span>
                            )}
                            {isAssignedToday && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${statusClass}`}>
                                {statusLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{cafe.address}</span>
                        </div>

                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1 font-sans">
                            <Phone className="w-3 h-3" />
                            {cafe.phone || 'بدون تلفن'}
                          </span>

                          <span className="text-slate-400">
                            مدیر:{' '}
                            <span className="text-slate-600 font-extrabold">
                              {cafe.managerName || 'نامشخص'}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Add/Edit/View panel on right (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {isAddingCafeMode ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                  <div className="border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                      <PlusCircle className="w-5 h-5 text-orange-600" />
                      <span>ثبت کافه جدید در دزفول</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">با تعیین آدرس, نام مدیر و مختصات موقعیت کافه جدید را به سیستم اضافه کنید.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-[11px] text-orange-800 leading-relaxed font-bold">
                      📍 برای ثبت مختصات جغرافیایی دقیق, می‌توانید به تب «داشبورد و نقشه» رفته, گزینه «کافه جدید» را بزنید و روی هر نقطه از نقشه کلیک کنید تا عرض و طول جغرافیایی به صورت خودکار در این فیلدها پر شوند.
                    </div>
                    
                    {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg font-bold">{error}</div>}
                    {success && <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg font-bold">{success}</div>}

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">نام کافه *</label>
                      <input
                        id="form_cafe_name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="مثال: کافه تار یا کافه فنجان"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-600 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">نام مدیر کافه</label>
                        <input
                          id="form_cafe_manager"
                          type="text"
                          value={managerName}
                          onChange={(e) => setManagerName(e.target.value)}
                          placeholder="مثال: آقای محمدی"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-600 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">تلفن تماس</label>
                        <input
                          id="form_cafe_phone"
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="۰۹۱۶xxxxxxx"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans focus:outline-none focus:border-orange-600 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">آدرس دقیق در دزفول *</label>
                      <textarea
                        id="form_cafe_address"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="خیابان شریعتی, نبش کوچه مانی..."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-600 focus:bg-white resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">عرض جغرافیایی (Lat)</label>
                        <input
                          id="form_cafe_lat"
                          type="text"
                          readOnly
                          value={customLat}
                          className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl text-xs font-mono ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">طول جغرافیایی (Lng)</label>
                        <input
                          id="form_cafe_lng"
                          type="text"
                          readOnly
                          value={customLng}
                          className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl text-xs font-mono ltr"
                        />
                      </div>
                    </div>

                    <button
                      id="btn_submit_cafe"
                      type="submit"
                      disabled={loading}
                      className="mt-2 w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'در حال ثبت اطلاعات...' : 'ثبت قطعی کافه در سیستم'}
                    </button>
                  </form>
                </div>
              ) : selectedCafe ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                  <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-orange-600 font-extrabold tracking-widest uppercase">عملیات برنامه‌ریزی کافه</span>
                      <h3 className="font-black text-slate-800 text-sm mt-0.5">{selectedCafe.name}</h3>
                    </div>
                    <button
                      onClick={() => {
                        setIsAddingCafeMode(true);
                        setNewCafeCoords(null);
                      }}
                      className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-bold transition-all text-slate-600 cursor-pointer"
                    >
                      ثبت کافه جدید
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Date Planning Box */}
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-3">
                      <h4 className="text-xs font-black text-slate-700 flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-orange-600" />
                        <span>برنامه‌ریزی بازدید راننده</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">برای اختصاص دادن این کافه به برنامه امروز یا تاریخ مشخص:</p>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setLoading(true);
                            if (selectedCafe.assignedDate === activeDate) {
                              await onAssignDate(selectedCafe.id, null);
                            } else {
                              await onAssignDate(selectedCafe.id, activeDate);
                            }
                            setLoading(false);
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedCafe.assignedDate === activeDate
                              ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{selectedCafe.assignedDate === activeDate ? 'حذف از برنامه امروز راننده' : 'برنامه‌ریزی برای بازدید امروز'}</span>
                        </button>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 flex-wrap">
                          <span className="text-[11px] font-extrabold text-slate-600">تاریخ دلخواه:</span>
                          <ShamsiDatePicker
                            value={selectedCustomDate}
                            onChange={(val) => {
                              setSelectedCustomDate(val);
                            }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (selectedCustomDate) {
                                setLoading(true);
                                await onAssignDate(selectedCafe.id, selectedCustomDate);
                                setLoading(false);
                              }
                            }}
                            disabled={!selectedCustomDate}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                          >
                            ثبت تاریخ
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Delete Option */}
                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-red-950">حذف همیشگی کافه</h4>
                        <p className="text-[10px] text-red-700 font-medium mt-0.5">حذف کامل این کافه از بانک اطلاعاتی دزفول.</p>
                      </div>

                      {!showDeleteConfirm ? (
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(true);
                          }}
                          className="px-3 py-2 text-red-600 hover:text-white hover:bg-red-600 rounded-xl border border-red-200 hover:border-red-600 transition-all text-xs font-extrabold cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 bg-white border border-red-200 p-1 rounded-lg">
                          <button
                            onClick={async () => {
                              setLoading(true);
                              await onDeleteCafe(selectedCafe.id);
                              setLoading(false);
                              setShowDeleteConfirm(false);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-extrabold px-2 py-1.5 rounded-md cursor-pointer"
                          >
                            بله, حذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-extrabold px-2 py-1.5 rounded-md cursor-pointer"
                          >
                            خیر
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 font-bold">
                  💡 لطفا از لیست سمت راست یک کافه را انتخاب کنید تا عملیات برنامه‌ریزی کاری, حذف یا مشاهده جزئیات آن ظاهر شود.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="w-full animate-fadeIn" id="sales_tab_root">
            <SalesReport reports={reports} cafes={cafes} products={products} />
          </div>
        )}

        {activeTab === 'products' && (
          <div className="w-full animate-fadeIn" id="products_tab_root">
            {/* Products & Pricing Management Panel */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col gap-5" id="products_pricing_management">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-orange-600 font-extrabold tracking-widest uppercase">پنل مدیریت قیمت‌ها</span>
                  <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Package className="w-4 h-4 text-orange-600" />
                    <span>محصولات قابل فروش و قیمت‌گذاری واحد</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    در این بخش قیمت محصولات را تعیین کنید. رانندگان فقط قادر به مشاهده این قیمت‌ها هستند و سفارشات طبق مبالغ زیر ثبت می‌شوند.
                  </p>
                </div>
              </div>

              {/* Success / Error notification */}
              {prodSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl font-bold">
                  {prodSuccess}
                </div>
              )}
              {prodError && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl font-bold">
                  {prodError}
                </div>
              )}

              {/* Grid content for product list and addition form */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left side: Products List (7 cols) */}
                <div className="md:col-span-7 space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-orange-600" />
                    <span>فهرست محصولات فعال در سیستم ({toPersianDigits(products.length)})</span>
                  </h3>

                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/20 px-3">
                    {products.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs font-bold">
                        هیچ محصولی در سیستم وجود ندارد.
                      </div>
                    ) : (
                      products.map((product) => {
                        const isEditing = editingProductId === product.id;

                        return (
                          <div key={product.id} className="py-3 flex items-center justify-between gap-3 font-medium">
                            <div className="flex flex-col gap-1 flex-1">
                              <span className="text-xs font-black text-slate-800">{product.name}</span>
                              {product.description && (
                                <span className="text-[10px] text-slate-400">{product.description}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Price display / Editor */}
                              {isEditing ? (
                                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-0.5" id={`editor_box_${product.id}`}>
                                  <input
                                    type="number"
                                    value={editingPriceValue}
                                    onChange={(e) => setEditingPriceValue(e.target.value)}
                                    className="w-20 text-xs font-sans text-center text-slate-800 font-extrabold focus:outline-none"
                                  />
                                  <span className="text-[9px] text-slate-400">تومان</span>
                                </div>
                              ) : (
                                <span className="text-xs font-black text-emerald-600 font-sans">
                                  {toPersianDigits(formatPrice(product.price))} <span className="text-[9px] text-slate-400 font-medium">تومان</span>
                                </span>
                              )}

                              {/* Action buttons */}
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSavePrice(product.id)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                                      title="ذخیره قیمت"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingProductId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5 rounded-lg transition-all cursor-pointer"
                                      title="انصراف"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingProductId(product.id);
                                        setEditingPriceValue(product.price.toString());
                                      }}
                                      className="bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded-lg transition-all border border-slate-200 shadow-sm cursor-pointer"
                                      title="ویرایش قیمت"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (window.confirm(`آیا از حذف محصول "${product.name}" اطمینان دارید؟`)) {
                                          setLoading(true);
                                          await onDeleteProduct(product.id);
                                          setLoading(false);
                                        }
                                      }}
                                      className="bg-white hover:bg-red-50 text-red-600 p-1.5 rounded-lg transition-all border border-slate-200 shadow-sm cursor-pointer"
                                      title="حذف محصول"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right side: Add Product Form (5 cols) */}
                <div className="md:col-span-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-1 mb-3">
                    <PlusCircle className="w-3.5 h-3.5 text-orange-600" />
                    <span>افزودن محصول جدید</span>
                  </h3>

                  <form onSubmit={handleProductSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1">نام محصول *</label>
                      <input
                        type="text"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        placeholder="مثال: کارتن ۳ تایی"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 transition-all text-slate-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1">قیمت واحد فروش (تومان) *</label>
                      <input
                        type="number"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value)}
                        placeholder="مثال: ۳۰۰۰"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-sans focus:outline-none focus:border-orange-500 transition-all text-slate-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1">توضیحات (اختیاری)</label>
                      <textarea
                        value={newProdDesc}
                        onChange={(e) => setNewProdDesc(e.target.value)}
                        placeholder="مثال: مخصوص قهوه‌های بیرون‌بر"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 transition-all text-slate-700 h-16 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl transition-all shadow-sm shadow-orange-100 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ثبت محصول در لیست</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="w-full animate-fadeIn" id="reports_tab_root">
            {/* Dynamic Activity Log / Reports table today */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" id="today_activity_logs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <Clock3 className="w-4 h-4 text-orange-600" />
                  <span>گزارشات و بازخوردهای امروز راننده ({toPersianDigits(reports.filter(r => {
                    const rDate = new Date(r.timestamp);
                    return `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}` === activeDate;
                  }).length)})</span>
                </h3>
                <span className="bg-orange-50 text-orange-700 text-[10px] font-extrabold px-2.5 py-1 rounded-md border border-orange-100">
                  کارتن محمد دزفول
                </span>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto font-medium">
                {reports.filter(r => {
                  const rDate = new Date(r.timestamp);
                  return `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}` === activeDate;
                }).length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-bold">
                    هنوز هیچ گزارش فروشی از طرف راننده در امروز ثبت نشده است.
                  </div>
                ) : (
                  reports
                    .filter(r => {
                      const rDate = new Date(r.timestamp);
                      return `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}` === activeDate;
                    })
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((report) => {
                      let statusBadge = null;
                      if (report.status === 'sold') {
                        statusBadge = (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span>فروش {report.productName ? `(${report.productName})` : ''}:</span>
                            <span>{toPersianDigits(report.quantitySold)} عدد</span>
                          </span>
                        );
                      } else if (report.status === 'no_sale') {
                        statusBadge = <span className="bg-red-100 text-red-800 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">عدم خرید</span>;
                      } else if (report.status === 'callback') {
                        statusBadge = <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full">پیگیری مجدد</span>;
                      } else if (report.status === 'closed') {
                        statusBadge = <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">بسته بود</span>;
                      }

                      const rTime = new Date(report.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={report.id} className="p-4 hover:bg-slate-50/50 transition-all flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 text-xs">{report.cafeName}</span>
                              <span className="text-[10px] text-slate-400 font-sans font-medium">({rTime})</span>
                            </div>
                            {statusBadge}
                          </div>
                          
                          {report.notes && (
                            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-100/50 font-medium">
                              {report.notes}
                            </p>
                          )}

                          {report.status === 'sold' && (
                            <div className="text-[10px] font-sans text-emerald-600 font-extrabold flex items-center gap-1 mt-0.5">
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>مبلغ دریافتی: {toPersianDigits(formatPrice(report.totalPrice))} تومان</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
