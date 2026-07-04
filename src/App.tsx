import { useState, useEffect, useCallback } from 'react';
import { db, OperationType, handleFirestoreError } from './firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  getDocs,
  where
} from 'firebase/firestore';
import { Cafe, VisitReport, DriverStatus, Product } from './types';
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

  // 1. Subscribe to Firestore Collections in Real-time
  useEffect(() => {
    // A. Subscribe to Cafes
    const cafesQuery = query(collection(db, 'cafes'), orderBy('createdAt', 'desc'));
    const unsubscribeCafes = onSnapshot(cafesQuery, async (snapshot) => {
      const fetchedCafes: Cafe[] = [];
      snapshot.forEach((doc) => {
        fetchedCafes.push({ id: doc.id, ...doc.data() } as Cafe);
      });

      // Seeding database on first run if empty
      if (fetchedCafes.length === 0) {
        console.log('Seeding initial cafes to Firestore...');
        const batch = writeBatch(db);
        SEED_CAFES.forEach((seed) => {
          const newDocRef = doc(collection(db, 'cafes'));
          batch.set(newDocRef, {
            ...seed,
            assignedDate: null,
            visitStatus: 'pending',
            lastVisitDate: null,
            createdAt: Date.now(),
          });
        });
        try {
          await batch.commit();
          console.log('Seeding completed successfully!');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'cafes');
        }
      } else {
        setCafes(fetchedCafes);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cafes');
    });

    // B. Subscribe to Reports
    const reportsQuery = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const fetchedReports: VisitReport[] = [];
      snapshot.forEach((doc) => {
        fetchedReports.push({ id: doc.id, ...doc.data() } as VisitReport);
      });
      setReports(fetchedReports);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reports');
    });

    // C. Subscribe to Driver Live Status
    const driverDocRef = doc(db, 'driverStatus', 'driver_mohammad');
    const unsubscribeDriver = onSnapshot(driverDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        setDriverStatus(docSnap.data() as DriverStatus);
      } else {
        // Seed initial driver status document
        console.log('Seeding driver status document to Firestore...');
        const initialDriver: DriverStatus = {
          id: 'driver_mohammad',
          name: 'محمد دزفولی',
          lat: 32.3855,
          lng: 48.4065,
          lastActive: Date.now(),
          isSharingLocation: false,
        };
        try {
          await setDoc(docRef, initialDriver);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'driverStatus/driver_mohammad');
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'driverStatus/driver_mohammad');
    });

    // D. Subscribe to Products in Real-time
    const productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'asc'));
    const unsubscribeProducts = onSnapshot(productsQuery, async (snapshot) => {
      const fetchedProducts: Product[] = [];
      snapshot.forEach((doc) => {
        fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
      });

      // Seeding initial products if database has none
      if (fetchedProducts.length === 0) {
        console.log('Seeding initial products to Firestore...');
        const batch = writeBatch(db);
        SEED_PRODUCTS.forEach((seed) => {
          const newDocRef = doc(collection(db, 'products'));
          batch.set(newDocRef, {
            ...seed,
            createdAt: Date.now(),
          });
        });
        try {
          await batch.commit();
          console.log('Product seeding completed successfully!');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'products');
        }
      } else {
        setProducts(fetchedProducts);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // E. Subscribe to Notifications in Real-time for driver
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('driverId', '==', 'driver_mohammad'),
      where('read', '==', false)
    );
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const fetchedNotifications: any[] = [];
      snapshot.forEach((doc) => {
        fetchedNotifications.push({ id: doc.id, ...doc.data() });
      });
      setNotifications(fetchedNotifications);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => {
      unsubscribeCafes();
      unsubscribeReports();
      unsubscribeDriver();
      unsubscribeProducts();
      unsubscribeNotifications();
    };
  }, []);

  const docRef = doc(db, 'driverStatus', 'driver_mohammad');

  // 2. Admin operations
  const handleAddCafe = async (cafeData: Omit<Cafe, 'id' | 'createdAt' | 'visitStatus' | 'lastVisitDate' | 'assignedDate'>) => {
    const newDocRef = doc(collection(db, 'cafes'));
    const newCafe: Cafe = {
      ...cafeData,
      id: newDocRef.id,
      assignedDate: null,
      visitStatus: 'pending',
      lastVisitDate: null,
      createdAt: Date.now(),
    };
    try {
      await setDoc(newDocRef, newCafe);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cafes/${newCafe.id}`);
    }
    setSelectedCafeId(newCafe.id);
  };

  const handleDeleteCafe = async (cafeId: string) => {
    try {
      await deleteDoc(doc(db, 'cafes', cafeId));
      
      // Proactively clean up any notifications that refer to non-existent cafes
      const remainingCafes = cafes.filter((c) => c.id !== cafeId);
      const q = query(collection(db, 'notifications'), where('driverId', '==', 'driver_mohammad'), where('read', '==', false));
      const snapshot = await getDocs(q);
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        // If a notification doesn't match ANY of the remaining cafes, it's an orphan
        const isOrphan = !remainingCafes.some((c) => data.message?.includes(c.name));
        
        if (isOrphan) {
          await deleteDoc(doc(db, 'notifications', docSnapshot.id));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `cafes/${cafeId}`);
    }
    if (selectedCafeId === cafeId) {
      setSelectedCafeId(null);
    }
  };

  const handleAssignDate = async (cafeId: string, date: string | null) => {
    const cafe = cafes.find((c) => c.id === cafeId);
    if (!cafe) return;

    const visitStatus = 'pending'; // Reset status back to pending when assigned

    try {
      await updateDoc(doc(db, 'cafes', cafeId), {
        assignedDate: date,
        visitStatus,
      });

      // Add Notification if assigned to any date
      if (date) {
         const dateLabel = getPersianDateString(date);
         const msg = `بازدید جدید برای کافه "${cafe.name}" در تاریخ ${dateLabel} به برنامه شما اضافه شد.`;
         
         const q = query(
           collection(db, 'notifications'),
           where('driverId', '==', 'driver_mohammad'),
           where('message', '==', msg),
           where('read', '==', false)
         );
         const existingNotifs = await getDocs(q);
         if (existingNotifs.empty) {
            await addDoc(collection(db, 'notifications'), {
                driverId: 'driver_mohammad',
                message: msg,
                createdAt: Date.now(),
                read: false
            });
         }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cafes/${cafeId}`);
    }
  };

  // 2B. Admin Product operations
  const handleAddProduct = async (productData: Omit<Product, 'id' | 'createdAt'>) => {
    const newDocRef = doc(collection(db, 'products'));
    const newProduct: Product = {
      ...productData,
      id: newDocRef.id,
      createdAt: Date.now(),
    };
    try {
      await setDoc(newDocRef, newProduct);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `products/${newProduct.id}`);
    }
  };

  const handleUpdateProduct = async (productId: string, productData: Partial<Omit<Product, 'id' | 'createdAt'>>) => {
    try {
      await updateDoc(doc(db, 'products', productId), productData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  };

  // 3. Driver operations
  const handleUpdateDriverLocation = async (lat: number, lng: number, isSharing: boolean) => {
    try {
      await updateDoc(doc(db, 'driverStatus', 'driver_mohammad'), {
        lat,
        lng,
        isSharingLocation: isSharing,
        lastActive: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'driverStatus/driver_mohammad');
    }
  };

  const handleSubmitReport = async (reportData: Omit<VisitReport, 'id' | 'timestamp'>) => {
    // A. Add new report doc
    const reportsColl = collection(db, 'reports');
    const newReportRef = doc(reportsColl);
    const reportTimestamp = Date.now();
    const newReport: any = {
      ...reportData,
      id: newReportRef.id,
      timestamp: reportTimestamp,
    };

    // Clean up optional fields that might be undefined to avoid Firestore errors
    Object.keys(newReport).forEach(key => {
        if (newReport[key] === undefined) {
            delete newReport[key];
        }
    });

    console.log("Saving report:", newReport);
    try {
      await setDoc(newReportRef, newReport);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `reports/${newReport.id}`);
    }

    // B. Update Cafe record with visit status & date
    const cafeDocRef = doc(db, 'cafes', reportData.cafeId);
    try {
      await updateDoc(cafeDocRef, {
        visitStatus: reportData.status,
        lastVisitDate: activeDate,
        lastVisitReportId: newReportRef.id,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cafes/${reportData.cafeId}`);
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
                        await updateDoc(doc(db, 'notifications', notifId), { read: true });
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
