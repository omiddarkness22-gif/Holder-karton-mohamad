import { Cafe, VisitReport, Product, DriverStatus } from './types';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Check if we should use Cloudflare API or LocalStorage fallback
const isCloudflare = () => {
  const host = window.location.hostname;
  // Local development in container or AI Studio runs on .run.app or localhost
  return !host.includes('run.app') && !host.includes('localhost') && !host.includes('127.0.0.1');
};

// Seed Data for LocalStorage Fallback (so development looks rich from day one)
const LOCAL_SEED_CAFES: Cafe[] = [
  {
    id: "cafe-1",
    name: "کافه دزفول (شعبه مرکزی)",
    managerName: "آقای رضایی",
    phone: "09161234567",
    address: "خیابان امام خمینی، نبش صفا",
    lat: 32.3855,
    lng: 48.4065,
    assignedDate: null,
    visitStatus: "pending",
    lastVisitDate: null,
    lastVisitReportId: null,
    createdAt: Date.now() - 50000
  },
  {
    id: "cafe-2",
    name: "کافه آرامش",
    managerName: "خانم عباسی",
    phone: "09169876543",
    address: "بلوار ساحلی، روبروی شهربازی",
    lat: 32.3920,
    lng: 48.4110,
    assignedDate: null,
    visitStatus: "pending",
    lastVisitDate: null,
    lastVisitReportId: null,
    createdAt: Date.now() - 40000
  }
];

const LOCAL_SEED_PRODUCTS = [
  {
    id: "prod-1",
    name: "کارتن میوه ۵ لایه",
    price: 15000,
    description: "کارتن با کیفیت بالا مناسب صادرات میوه",
    createdAt: Date.now() - 100000
  },
  {
    id: "prod-2",
    name: "کارتن تخم مرغ",
    price: 8500,
    description: "کارتن شانه‌ای با ضخامت بالا و ضربه‌گیری عالی",
    createdAt: Date.now() - 90000
  }
];

// LocalStorage Persistence Helpers
const getLocal = <T>(key: string, defaultVal: T): T => {
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(defaultVal));
    return defaultVal;
  }
  return JSON.parse(val);
};

const setLocal = <T>(key: string, val: T) => {
  localStorage.setItem(key, JSON.stringify(val));
};

export const api = {
  // --- CAFES ---
  getCafes: async (): Promise<Cafe[]> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/cafes');
        if (res.ok) return await res.json();
      } catch (e) {
        console.error("Cloudflare API error, falling back to LocalStorage:", e);
      }
    }
    return getLocal<Cafe[]>('cf_cafes', LOCAL_SEED_CAFES);
  },

  addCafe: async (cafe: Omit<Cafe, 'id' | 'createdAt' | 'visitStatus' | 'lastVisitDate' | 'assignedDate'>): Promise<Cafe> => {
    const newCafe: Cafe = {
      ...cafe,
      id: generateId(),
      assignedDate: null,
      visitStatus: 'pending',
      lastVisitDate: null,
      lastVisitReportId: null,
      createdAt: Date.now()
    };

    if (isCloudflare()) {
      try {
        const res = await fetch('/api/cafes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCafe)
        });
        if (res.ok) return newCafe;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<Cafe[]>('cf_cafes', LOCAL_SEED_CAFES);
    current.unshift(newCafe);
    setLocal('cf_cafes', current);
    return newCafe;
  },

  updateCafe: async (id: string, updates: Partial<Omit<Cafe, 'id' | 'createdAt'>>): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch(`/api/cafes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<Cafe[]>('cf_cafes', LOCAL_SEED_CAFES);
    const updated = current.map(c => c.id === id ? { ...c, ...updates } : c);
    setLocal('cf_cafes', updated);
    return true;
  },

  deleteCafe: async (id: string): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch(`/api/cafes/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<Cafe[]>('cf_cafes', LOCAL_SEED_CAFES);
    const filtered = current.filter(c => c.id !== id);
    setLocal('cf_cafes', filtered);
    return true;
  },

  // --- VISIT REPORTS ---
  getReports: async (): Promise<VisitReport[]> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/reports');
        if (res.ok) return await res.json();
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }
    return getLocal<VisitReport[]>('cf_reports', []);
  },

  addReport: async (report: Omit<VisitReport, 'id' | 'timestamp'>): Promise<VisitReport> => {
    const newReport: VisitReport = {
      ...report,
      id: generateId(),
      timestamp: Date.now()
    };

    if (isCloudflare()) {
      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport)
        });
        if (res.ok) return newReport;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<VisitReport[]>('cf_reports', []);
    current.unshift(newReport);
    setLocal('cf_reports', current);
    return newReport;
  },

  // --- PRODUCTS ---
  getProducts: async (): Promise<Product[]> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/products');
        if (res.ok) return await res.json();
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }
    return getLocal<Product[]>('cf_products', LOCAL_SEED_PRODUCTS);
  },

  addProduct: async (product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
      createdAt: Date.now()
    };

    if (isCloudflare()) {
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        });
        if (res.ok) return newProduct;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<Product[]>('cf_products', LOCAL_SEED_PRODUCTS);
    current.push(newProduct);
    setLocal('cf_products', current);
    return newProduct;
  },

  updateProduct: async (id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch(`/api/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<Product[]>('cf_products', LOCAL_SEED_PRODUCTS);
    const updated = current.map(p => p.id === id ? { ...p, ...updates } : p);
    setLocal('cf_products', updated);
    return true;
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<Product[]>('cf_products', LOCAL_SEED_PRODUCTS);
    const filtered = current.filter(p => p.id !== id);
    setLocal('cf_products', filtered);
    return true;
  },

  // --- DRIVER STATUS ---
  getDriverStatus: async (): Promise<DriverStatus> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/driverStatus');
        if (res.ok) return await res.json();
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }
    return getLocal<DriverStatus>('cf_driver_status', {
      id: 'driver_mohammad',
      name: 'محمد دزفولی',
      lat: 32.3855,
      lng: 48.4065,
      lastActive: Date.now(),
      isSharingLocation: false
    });
  },

  updateDriverStatus: async (updates: Partial<Omit<DriverStatus, 'id'>>): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/driverStatus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<DriverStatus>('cf_driver_status', {
      id: 'driver_mohammad',
      name: 'محمد دزفولی',
      lat: 32.3855,
      lng: 48.4065,
      lastActive: Date.now(),
      isSharingLocation: false
    });
    const updated = { ...current, ...updates };
    setLocal('cf_driver_status', updated);
    return true;
  },

  // --- NOTIFICATIONS ---
  getNotifications: async (): Promise<any[]> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) return await res.json();
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }
    return getLocal<any[]>('cf_notifications', []);
  },

  addNotification: async (driverId: string, message: string): Promise<any> => {
    const newNotif = {
      id: generateId(),
      driverId,
      message,
      createdAt: Date.now(),
      read: false
    };

    if (isCloudflare()) {
      try {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNotif)
        });
        if (res.ok) return newNotif;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<any[]>('cf_notifications', []);
    current.push(newNotif);
    setLocal('cf_notifications', current);
    return newNotif;
  },

  updateNotification: async (id: string, updates: { read: boolean }): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<any[]>('cf_notifications', []);
    const updated = current.map(n => n.id === id ? { ...n, ...updates } : n);
    setLocal('cf_notifications', updated);
    return true;
  },

  deleteNotification: async (id: string): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }

    const current = getLocal<any[]>('cf_notifications', []);
    const filtered = current.filter(n => n.id !== id);
    setLocal('cf_notifications', filtered);
    return true;
  },

  // --- SETTINGS (ADMIN PASSCODE) ---
  getPasscode: async (): Promise<string> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/settings/auth');
        if (res.ok) {
          const data = await res.json() as any;
          return data.passcode;
        }
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }
    return localStorage.getItem('cf_passcode') || '123456';
  },

  setPasscode: async (passcode: string): Promise<boolean> => {
    if (isCloudflare()) {
      try {
        const res = await fetch('/api/settings/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode })
        });
        if (res.ok) return true;
      } catch (e) {
        console.error("Cloudflare API error:", e);
      }
    }
    localStorage.setItem('cf_passcode', passcode);
    return true;
  },

  checkDbStatus: async (): Promise<{
    isCloudflareMode: boolean;
    isConnected: boolean;
    hasBinding: boolean;
    hasTables: boolean;
    errorMessage?: string;
  }> => {
    const isCf = isCloudflare();
    if (!isCf) {
      return {
        isCloudflareMode: false,
        isConnected: false,
        hasBinding: false,
        hasTables: false,
        errorMessage: "شما در محیط محلی (Local) یا پیش‌نمایش قرار دارید. ذخیره‌سازی روی مرورگر شما انجام می‌شود."
      };
    }

    try {
      const res = await fetch('/api/cafes');
      if (res.ok) {
        return {
          isCloudflareMode: true,
          isConnected: true,
          hasBinding: true,
          hasTables: true
        };
      } else {
        const text = await res.text().catch(() => '');
        let errorMsg = '';
        try {
          const parsed = JSON.parse(text);
          errorMsg = parsed.error || '';
        } catch(e) {
          errorMsg = text;
        }
        
        if (errorMsg.includes('binding') || errorMsg.includes('undefined') || errorMsg.includes('is missing')) {
          return {
            isCloudflareMode: true,
            isConnected: true,
            hasBinding: false,
            hasTables: false,
            errorMessage: "اتصال برقرار است اما بایندینگ دیتابیس (D1 Database Binding) در تنظیمات Cloudflare Pages انجام نشده است. لطفا در پنل کلادفلر خود وارد مسیر Settings > Functions شده و بخش D1 database bindings را با متغیر DB به دیتابیس متصل کنید."
          };
        }
        
        if (errorMsg.includes('no such table')) {
          return {
            isCloudflareMode: true,
            isConnected: true,
            hasBinding: true,
            hasTables: false,
            errorMessage: "دیتابیس متصل است اما جدول‌ها هنوز ساخته نشده‌اند. لطفا فایل schema.sql را با ابزار wrangler d1 یا کنسول کلادفلر روی دیتابیس خود اجرا کنید تا جدول‌ها ساخته شوند."
          };
        }

        return {
          isCloudflareMode: true,
          isConnected: true,
          hasBinding: true,
          hasTables: false,
          errorMessage: errorMsg || `خطای سرور با کد ${res.status}`
        };
      }
    } catch (e: any) {
      return {
        isCloudflareMode: true,
        isConnected: false,
        hasBinding: false,
        hasTables: false,
        errorMessage: "ارتباط با سرور برقرار نشد. وضعیت اینترنت یا آدرس سایت را بررسی کنید."
      };
    }
  }
};
