import { useState, useEffect, useCallback } from 'react';
import { Cafe, VisitReport, DriverStatus, Product } from './types';
import { api } from './api';
import Header from './components/Header';
import AdminPanel from './components/AdminPanel';
import DriverPanel from './components/DriverPanel';
import MapComponent from './components/MapComponent';
import AdminLogin from './components/AdminLogin';
import ShamsiDatePicker from './components/ShamsiDatePicker';
import { g_to_j, JALALI_MONTH_NAMES } from './lib/shamsi';
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, Info, MessageSquareCode, Sparkles, Bell } from 'lucide-react';

const SEED_CAFES: Omit<Cafe, 'id' | 'createdAt' | 'visitStatus' | 'lastVisitDate' | 'assignedDate'>[] = [
  {
    name: "کافه تار دزفول",
    managerName: "آقای امین پور",
    phone: "09163412589",
    address: "خیابان شریعتی، بعد از چهارراه سی‌متری، روبروی بانک ملی",
    lat: 32.3888,
    lng: 48.4022,
  },
  {
    name: "کافه روبینا دزفول",
    managerName: "خانم موسوی",
    phone: "09165523478",
    address: "بلوار دانشگاه، نبش خیابان پیام، روبروی دانشگاه آزاد دزفول",
    lat: 32.3752,
    lng: 48.4195,
  },
  {
    name: "کافه لند",
    managerName: "آقای سلیمانی",
    phone: "09168854712",
    address: "خیابان منتظری، بین خیابان طالقانی و شریعتی",
    lat: 32.3842,
    lng: 48.4050,
  },
  {
    name: "کافه دنج دزفول",
    managerName: "آقای رادان",
    phone: "09307745214",
    address: "کوی کارمندان، نبش خیابان وصال شرقی، پلاک ۱۲",
    lat: 32.3921,
    lng: 48.3985,
  },
  {
    name: "کافه قهوه تلخ",
    managerName: "آقای محمودی",
    phone: "09169956321",
    address: "بلوار قدس، بین میدان فتح‌المبین و خیابان صابرین",
    lat: 32.3812,
    lng: 48.4120,
  },
  {
    name: "کافه ژوان",
    managerName: "خانم علوی",
    phone: "09024458963",
    address: "خیابان آفرینش، تقاطع طباطبایی، مجتمع ساحل طبقه همکف",
    lat: 32.3895,
    lng: 48.4111,
  }
];

const SEED_PRODUCTS: Omit<Product, 'id' | 'createdAt'>[] = [
  {
    name: "کارتن لیوان ۲ تایی",
    price: 1500,
    description: "نگهدارنده دوتایی لیوان کاغذی بیرون‌بر"
  },
  {
    name: "کارتن لیوان ۴ تایی",
    price: 2500,
    description: "نگهدارنده چهارتایی لیوان کاغذی بیرون‌بر"
  },
  {
    name: "کارتن بیرون‌بر قهوه",
    price: 3500,
    description: "جعبه حمل قهوه بیرون‌بر مخصوص کافه‌ها"
  },
  {
    name: "کارتن همبرگر دابل",
    price: 1800,
    description: "جعبه بسته‌بندی همبرگر با کیفیت بالا"
  }
];

const toPersianDigits = (str: string | number) => {
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

export default function App() {
  const [currentRole, setCurrentRole] = useState<'admin' | 'driver'>('admin');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isAdminAuthenticated') === 'true';
  });
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [reports, setReports] = useState<VisitReport[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const [products, setProducts] = useState<Product[]>([]);
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [isAddingCafeMode, setIsAddingCafeMode] = useState<boolean>(false);
  const [newCafeCoords, setNewCafeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [loading, setLoading] = useState(true);

  // Helper to get today's date formatted as YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();
  const [activeDate, setActiveDate] = useState<string>(todayStr);

  const getPersianDateString = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const gy = parseInt(parts[0], 10);
      const gm = parseInt(parts[1], 10);
      const gd = parseInt(parts[2], 10);
      if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return dateStr;
      const [jy, jm, jd] = g_to_j(gy, gm, gd);
      const monthName = JALALI_MONTH_NAMES[jm - 1] || '';
      return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
    } catch (e) {
      return dateStr;
    }
  };

  // 1. Fetch from Cloudflare D1 Database with automatic polling
  const loadData = async () => {
    try {
      let fetchedCafes = await api.getCafes();
      // Auto-seed if database has no cafes
      if (fetchedCafes.length === 0) {
        console.log('Seeding initial cafes to D1/LocalStorage...');
        for (const seed of SEED_CAFES) {
          await api.addCafe(seed);
        }
        fetchedCafes = await api.getCafes();
      }

      let fetchedProducts = await api.getProducts();
      // Auto-seed if database has no products
      if (fetchedProducts.length === 0) {
        console.log('Seeding initial products to D1/LocalStorage...');
        for (const seed of SEED_PRODUCTS) {
          await api.addProduct(seed);
        }
        fetchedProducts = await api.getProducts();
      }

      const fetchedReports = await api.getReports();
      const fetchedDriver = await api.getDriverStatus();
      const fetchedNotifs = await api.getNotifications();

      setCafes(fetchedCafes);
      setReports(fetchedReports);
      setProducts(fetchedProducts);
      setDriverStatus(fetchedDriver);
      setNotifications(fetchedNotifs);
    } catch (e) {
      console.error("Error fetching database tables:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 10 second polling interval for cross-device state sync
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Admin operations
  const handleAddCafe = async (cafeData: Omit<Cafe, 'id' | 'createdAt' | 'visitStatus' | 'lastVisitDate' | 'assignedDate'>) => {
    try {
      const newCafe = await api.addCafe(cafeData);
      setCafes(prev => [newCafe, ...prev]);
      setSelectedCafeId(newCafe.id);
    } catch (error) {
      console.error("Error adding cafe:", error);
    }
  };

  const handleDeleteCafe = async (cafeId: string) => {
    try {
      await api.deleteCafe(cafeId);
      setCafes(prev => prev.filter((c) => c.id !== cafeId));
      
      // Proactively clean up any notifications that refer to non-existent cafes
      const remainingCafes = cafes.filter((c) => c.id !== cafeId);
      const currentNotifs = await api.getNotifications();
      for (const notif of currentNotifs) {
        // If a notification doesn't match ANY of the remaining cafes, it's an orphan
        const isOrphan = !remainingCafes.some((c) => notif.message?.includes(c.name));
        if (isOrphan) {
          await api.deleteNotification(notif.id);
        }
      }
      const updatedNotifs = await api.getNotifications();
      setNotifications(updatedNotifs);
    } catch (error) {
      console.error("Error deleting cafe:", error);
    }
    if (selectedCafeId === cafeId) {
      setSelectedCafeId(null);
    }
  };

  const handleAssignDate = async (cafeId: string, date: string | null) => {
    const cafe = cafes.find((c) => c.id === cafeId);
    if (!cafe) return;

    try {
      await api.updateCafe(cafeId, {
        assignedDate: date,
        visitStatus: 'pending',
      });
      
      setCafes(prev => prev.map(c => c.id === cafeId ? { ...c, assignedDate: date, visitStatus: 'pending' } : c));

      // Add Notification if assigned to any date
      if (date) {
         const dateLabel = getPersianDateString(date);
         const msg = `بازدید جدید برای کافه "${cafe.name}" در تاریخ ${dateLabel} به برنامه شما اضافه شد.`;
         
         const currentNotifs = await api.getNotifications();
         const exists = currentNotifs.some(n => n.message === msg && !n.read);
         if (!exists) {
            const newNotif = await api.addNotification('driver_mohammad', msg);
            setNotifications(prev => [...prev, newNotif]);
         }
      }
    } catch (error) {
      console.error("Error assigning cafe date:", error);
    }
  };

  // 2B. Admin Product operations
  const handleAddProduct = async (productData: Omit<Product, 'id' | 'createdAt'>) => {
    try {
      const newProduct = await api.addProduct(productData);
      setProducts(prev => [...prev, newProduct]);
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleUpdateProduct = async (productId: string, productData: Partial<Omit<Product, 'id' | 'createdAt'>>) => {
    try {
      await api.updateProduct(productId, productData);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...productData } : p));
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await api.deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  // 3. Driver operations
  const handleUpdateDriverLocation = async (lat: number, lng: number, isSharing: boolean) => {
    try {
      await api.updateDriverStatus({
        lat,
        lng,
        isSharingLocation: isSharing,
        lastActive: Date.now(),
      });
      setDriverStatus(prev => prev ? { ...prev, lat, lng, isSharingLocation: isSharing, lastActive: Date.now() } : null);
    } catch (error) {
      console.error("Error updating driver status:", error);
    }
  };

  const handleSubmitReport = async (reportData: Omit<VisitReport, 'id' | 'timestamp'>) => {
    try {
      // A. Add new report
      const newReport = await api.addReport(reportData);
      setReports(prev => [newReport, ...prev]);

      // B. Update Cafe record with visit status & date
      await api.updateCafe(reportData.cafeId, {
        visitStatus: reportData.status,
        lastVisitDate: activeDate,
        lastVisitReportId: newReport.id,
      });

      setCafes(prev => prev.map(c => c.id === reportData.cafeId ? {
        ...c,
        visitStatus: reportData.status,
        lastVisitDate: activeDate,
        lastVisitReportId: newReport.id
      } : c));
    } catch (error) {
      console.error("Error submitting visit report:", error);
    }
  };

  // Switch Cafe Selector Helper
  const handleCafeSelect = useCallback((cafeId: string) => {
    setSelectedCafeId(cafeId);
  }, []);

  // Handle click on map to fetch coords (for Admin form mode)
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setIsAddingCafeMode((prevMode) => {
      if (prevMode) {
        setNewCafeCoords({ lat, lng });
      }
      return prevMode;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 selection:bg-orange-100 selection:text-orange-950" id="app_root">
      
      {/* Branding and Switcer Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={(role) => {
          setCurrentRole(role);
          setSelectedCafeId(null); // Clear selected cafe when changing context
          setIsAddingCafeMode(false);
          setNewCafeCoords(null);
        }}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

      {currentRole === 'driver' && notifications.length > 0 && (
         <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" id="driver_notification_popup_modal">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 text-right rtl">
                <h3 className="font-black text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-orange-600 animate-bounce" />
                    <span>برنامه‌ریزی بازدید جدید</span>
                </h3>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                    <p>{notifications[0].message}</p>
                </div>
                <button 
                  onClick={async () => {
                      const notifId = notifications[0].id;
                      try {
                        await api.updateNotification(notifId, { read: true });
                        setNotifications(prev => prev.filter(n => n.id !== notifId));
                      } catch (error) {
                        console.error("Error updating notification status:", error);
                      }
                  }} 
                  className="mt-6 w-full bg-orange-600 text-white font-bold py-3 rounded-2xl hover:bg-orange-700 transition-all cursor-pointer text-xs"
                >
                  بستن و تایید خوانده شد
                </button>
             </div>
         </div>
      )}

      {/* Main App Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* Loading overlay */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 bg-white rounded-2xl border border-slate-200/80 shadow-sm" id="loading_screen">
            <div className="w-10 h-10 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"></div>
            <p className="text-xs font-black text-slate-500 text-center rtl">در حال راه‌اندازی و اتصال زنده به سیستم کارتن محمد دزفول...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* Quick alert banner about app workflow - Bento grid style */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-right rtl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100 shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">راهنمای هوشمند سیستم کارتن محمد دزفول</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    {currentRole === 'admin' 
                      ? 'مدیر گرامی: کافه‌ها را روی نقشه مشخص کنید و با دکمه «برنامه امروز»، راننده را راهنمایی کنید.'
                      : 'راننده گرامی: وضعیت فروش خود را مشخص کنید تا آمار برای پنل مدیریت به صورت آنی ارسال گردد.'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-orange-50/50 border border-orange-100/80 px-3 py-1.5 rounded-2xl shrink-0" id="global_date_selector">
                <span className="text-xs font-black text-orange-800 rtl">تاریخ برنامه کاری:</span>
                <ShamsiDatePicker
                  value={activeDate}
                  onChange={(val) => {
                    if (val) {
                      setActiveDate(val);
                    }
                  }}
                  clearable={false}
                />
              </div>
            </div>

            {/* Grid layout containing MAP (left) and CONTEXT CONTROL (right) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Left Side: Leaflet Interactive Map View (7 of 12 columns on large displays) */}
              <div className="xl:col-span-7 h-[450px] md:h-[550px] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-2 flex flex-col justify-between" id="map_visualizer_card">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 mb-2">
                  <span className="text-xs font-extrabold text-slate-700 rtl text-right">نقشه زنده کافه‌های دزفول</span>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Coffee className="w-3.5 h-3.5 text-orange-600" />
                    کل نشانه‌ها: {toPersianDigits(cafes.length)} کافه
                  </span>
                </div>

                <div className="flex-1 overflow-hidden rounded-xl border border-slate-100">
                  <MapComponent
                    cafes={cafes}
                    driverLocation={driverStatus}
                    selectedCafeId={selectedCafeId}
                    onCafeSelect={handleCafeSelect}
                    onMapClick={handleMapClick}
                    isAdmin={currentRole === 'admin'}
                    isAddingCafeMode={isAddingCafeMode}
                    userLocation={userLocation}
                    activeDate={activeDate}
                  />
                </div>
              </div>

              {/* Right Side: Active Context Dashboard (5 of 12 columns) */}
              <div className="xl:col-span-5 flex flex-col gap-6" id="dashboard_context_container">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentRole}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="w-full"
                  >
                    {currentRole === 'admin' ? (
                      !isAdminAuthenticated ? (
                        <AdminLogin
                          onSuccess={() => setIsAdminAuthenticated(true)}
                          onBackToDriver={() => setCurrentRole('driver')}
                        />
                      ) : (
                        <AdminPanel
                          cafes={cafes}
                          reports={reports}
                          driverStatus={driverStatus}
                          products={products}
                          onAddProduct={handleAddProduct}
                          onUpdateProduct={handleUpdateProduct}
                          onDeleteProduct={handleDeleteProduct}
                          selectedCafeId={selectedCafeId}
                          onCafeSelect={handleCafeSelect}
                          onAddCafe={handleAddCafe}
                          onDeleteCafe={handleDeleteCafe}
                          onAssignDate={handleAssignDate}
                          isAddingCafeMode={isAddingCafeMode}
                          setIsAddingCafeMode={setIsAddingCafeMode}
                          newCafeCoords={newCafeCoords}
                          setNewCafeCoords={setNewCafeCoords}
                          onLockAdmin={() => {
                            setIsAdminAuthenticated(false);
                            localStorage.removeItem('isAdminAuthenticated');
                          }}
                          activeDate={activeDate}
                          darkMode={darkMode}
                          toggleDarkMode={toggleDarkMode}
                        />
                      )
                    ) : (
                      <DriverPanel
                        cafes={cafes}
                        reports={reports}
                        driverStatus={driverStatus}
                        products={products}
                        onUpdateDriverLocation={handleUpdateDriverLocation}
                        onSubmitReport={handleSubmitReport}
                        selectedCafeId={selectedCafeId}
                        onCafeSelect={handleCafeSelect}
                        setUserLocation={setUserLocation}
                        activeDate={activeDate}
                        darkMode={darkMode}
                        toggleDarkMode={toggleDarkMode}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Elegant Footer block */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium" id="app_footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p className="rtl text-right">طراحی شده برای بازاریابی و توزیع کارتن - شرکت کارتن‌سازی محمد دزفول © ۲۰۲۶</p>
        </div>
      </footer>

    </div>
  );
}
