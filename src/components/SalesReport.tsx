import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  Filter,
  Download,
  Calendar,
  Search,
  ChevronDown,
  BarChart3,
  Coffee,
  Package,
  CalendarDays,
  Percent,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  AlertTriangle,
  Check,
  MapPin,
  User,
  Layers
} from 'lucide-react';
import { VisitReport, Cafe, Product } from '../types';
import { g_to_j, JALALI_MONTH_NAMES, toPersianDigits as toPersianDigitsShamsi } from '../lib/shamsi';

interface SalesReportProps {
  reports: VisitReport[];
  cafes: Cafe[];
  products: Product[];
  onUpdateReport?: (reportId: string, updatedFields: Partial<VisitReport>) => Promise<void>;
}

type TimePeriod = 'today' | '7days' | '30days' | 'all';
type SalesSection = 'charts' | 'dues' | 'monthly' | 'invoices' | 'all';

export default function SalesReport({ reports, cafes, products, onUpdateReport }: SalesReportProps) {
  const [period, setPeriod] = useState<TimePeriod>('30days');
  const [activeSection, setActiveSection] = useState<SalesSection>('charts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [creditDueFilter, setCreditDueFilter] = useState<'3days' | 'overdue_and_3days' | 'all_unpaid'>('3days');
  const [settlingReportId, setSettlingReportId] = useState<string | null>(null);
  const [settledSuccessToast, setSettledSuccessToast] = useState<string | null>(null);

  // Helper: format prices beautifully in Toman
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  // Helper: convert English numbers to Persian digits
  const toPersianDigits = (str: string | number) => {
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.toString().replace(/[0-9]/g, (w) => id[+w]);
  };

  // Helper: Get Persian short date string (e.g. 12 Tir)
  const getPersianShortDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      const [jy, jm, jd] = g_to_j(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const monthName = JALALI_MONTH_NAMES[jm - 1] || '';
      return `${jd} ${monthName}`;
    } catch {
      return '';
    }
  };

  // Helper: Get full Persian date (e.g. 1405/04/12)
  const getPersianDateFull = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      const [jy, jm, jd] = g_to_j(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  // Filter reports by timeframe
  const filteredReportsByTime = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Start of today in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfTodayMs = today.getTime();

    return reports.filter((r) => {
      if (period === 'today') {
        return r.timestamp >= startOfTodayMs;
      } else if (period === '7days') {
        return r.timestamp >= now - 7 * oneDayMs;
      } else if (period === '30days') {
        return r.timestamp >= now - 30 * oneDayMs;
      }
      return true; // all
    });
  }, [reports, period]);

  // Filter only sold (successful) reports for sales analytics
  const salesReports = useMemo(() => {
    return filteredReportsByTime.filter((r) => r.status === 'sold');
  }, [filteredReportsByTime]);

  // General visit metrics (sold vs other statuses)
  const visitMetrics = useMemo(() => {
    const totalVisits = filteredReportsByTime.length;
    const soldCount = filteredReportsByTime.filter(r => r.status === 'sold').length;
    const noSaleCount = filteredReportsByTime.filter(r => r.status === 'no_sale').length;
    const callbackCount = filteredReportsByTime.filter(r => r.status === 'callback').length;
    const closedCount = filteredReportsByTime.filter(r => r.status === 'closed').length;
    
    const conversionRate = totalVisits > 0 ? Math.round((soldCount / totalVisits) * 100) : 0;

    return {
      totalVisits,
      soldCount,
      noSaleCount,
      callbackCount,
      closedCount,
      conversionRate
    };
  }, [filteredReportsByTime]);

  // Financial and Quantity aggregates
  const aggregates = useMemo(() => {
    const totalRevenue = salesReports.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const totalQty = salesReports.reduce((sum, r) => sum + (r.quantitySold || 0), 0);
    const successfulInvoices = salesReports.length;
    const avgInvoiceValue = successfulInvoices > 0 ? Math.round(totalRevenue / successfulInvoices) : 0;

    return {
      totalRevenue,
      totalQty,
      successfulInvoices,
      avgInvoiceValue,
    };
  }, [salesReports]);

  // Daily Trend Data for Recharts AreaChart
  const dailyTrendData = useMemo(() => {
    const dailyMap: Record<string, { date: string; displayDate: string; timestamp: number; revenue: number; quantity: number }> = {};
    
    salesReports.forEach((r) => {
      const fullDate = getPersianDateFull(r.timestamp);
      const shortDate = getPersianShortDate(r.timestamp);
      
      // We also need start of day timestamp to sort correctly
      const d = new Date(r.timestamp);
      d.setHours(0, 0, 0, 0);
      const dayTimestamp = d.getTime();

      if (!dailyMap[fullDate]) {
        dailyMap[fullDate] = {
          date: fullDate,
          displayDate: shortDate,
          timestamp: dayTimestamp,
          revenue: 0,
          quantity: 0
        };
      }
      
      dailyMap[fullDate].revenue += r.totalPrice || 0;
      dailyMap[fullDate].quantity += r.quantitySold || 0;
    });

    // Return sorted chronologically
    return Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp);
  }, [salesReports]);

  // Product Share Breakdown Data
  const productBreakdown = useMemo(() => {
    const prodMap: Record<string, { id: string; name: string; quantity: number; revenue: number; sharePercent: number }> = {};
    
    salesReports.forEach((r) => {
      const pId = r.productId || 'unknown';
      const pName = r.productName || 'کارتن عمومی';

      if (!prodMap[pId]) {
        prodMap[pId] = {
          id: pId,
          name: pName,
          quantity: 0,
          revenue: 0,
          sharePercent: 0
        };
      }
      prodMap[pId].quantity += r.quantitySold || 0;
      prodMap[pId].revenue += r.totalPrice || 0;
    });

    const list = Object.values(prodMap);
    const totalRev = list.reduce((sum, p) => sum + p.revenue, 0);
    
    return list.map(item => ({
      ...item,
      sharePercent: totalRev > 0 ? Math.round((item.revenue / totalRev) * 100) : 0
    })).sort((a, b) => b.revenue - a.revenue);
  }, [salesReports]);

  // Top Buying Cafes
  const topCafes = useMemo(() => {
    const cafeMap: Record<string, { id: string; name: string; totalRevenue: number; totalQty: number; visitsCount: number; lastPurchaseDate: number }> = {};

    salesReports.forEach((r) => {
      if (!cafeMap[r.cafeId]) {
        cafeMap[r.cafeId] = {
          id: r.cafeId,
          name: r.cafeName,
          totalRevenue: 0,
          totalQty: 0,
          visitsCount: 0,
          lastPurchaseDate: r.timestamp
        };
      }

      const entry = cafeMap[r.cafeId];
      entry.totalRevenue += r.totalPrice || 0;
      entry.totalQty += r.quantitySold || 0;
      entry.visitsCount += 1;
      if (r.timestamp > entry.lastPurchaseDate) {
        entry.lastPurchaseDate = r.timestamp;
      }
    });

    return Object.values(cafeMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5); // top 5
  }, [salesReports]);

  // Detailed successful sales reports after search and product filter
  const processedSalesReports = useMemo(() => {
    return salesReports.filter((r) => {
      const matchesSearch =
        r.cafeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesProduct =
        selectedProductFilter === 'all' || r.productId === selectedProductFilter;

      return matchesSearch && matchesProduct;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [salesReports, searchQuery, selectedProductFilter]);

  // Aggregate reports by Persian month for the Monthly Reports List
  const monthlyReportsSummary = useMemo(() => {
    const map: Record<string, {
      key: string;
      year: number;
      month: number;
      monthName: string;
      label: string;
      totalVisits: number;
      soldCount: number;
      noSaleCount: number;
      closedCount: number;
      callbackCount: number;
      totalRevenue: number;
      totalQuantity: number;
      averageInvoice: number;
      conversionRate: number;
      uniqueCafesCount: number;
      topProductName: string;
      cashRevenue: number;
      creditRevenue: number;
      reports: VisitReport[];
      soldReports: VisitReport[];
    }> = {};

    reports.forEach((r) => {
      const d = new Date(r.timestamp);
      const [jy, jm, jd] = g_to_j(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const key = `${jy}-${String(jm).padStart(2, '0')}`;
      const monthName = JALALI_MONTH_NAMES[jm - 1] || `ماه ${jm}`;
      const label = `${monthName} ${toPersianDigits(jy)}`;

      if (!map[key]) {
        map[key] = {
          key,
          year: jy,
          month: jm,
          monthName,
          label,
          totalVisits: 0,
          soldCount: 0,
          noSaleCount: 0,
          closedCount: 0,
          callbackCount: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          averageInvoice: 0,
          conversionRate: 0,
          uniqueCafesCount: 0,
          topProductName: '—',
          cashRevenue: 0,
          creditRevenue: 0,
          reports: [],
          soldReports: []
        };
      }

      const item = map[key];
      item.totalVisits += 1;
      item.reports.push(r);

      if (r.status === 'sold') {
        item.soldCount += 1;
        item.totalRevenue += (r.totalPrice || 0);
        item.totalQuantity += (r.quantitySold || 0);
        item.soldReports.push(r);
        if (r.paymentType === 'cash') {
          item.cashRevenue += (r.totalPrice || 0);
        } else if (r.paymentType === 'credit') {
          item.creditRevenue += (r.totalPrice || 0);
        }
      } else if (r.status === 'no_sale') {
        item.noSaleCount += 1;
      } else if (r.status === 'closed') {
        item.closedCount += 1;
      } else if (r.status === 'callback') {
        item.callbackCount += 1;
      }
    });

    const list = Object.values(map).map((item) => {
      const uniqueCafes = new Set(item.soldReports.map(r => r.cafeId));
      item.uniqueCafesCount = uniqueCafes.size;
      item.averageInvoice = item.soldCount > 0 ? Math.round(item.totalRevenue / item.soldCount) : 0;
      item.conversionRate = item.totalVisits > 0 ? Math.round((item.soldCount / item.totalVisits) * 100) : 0;

      const productQtyMap: Record<string, number> = {};
      item.soldReports.forEach(r => {
        const pName = r.productName || 'کارتن عمومی';
        productQtyMap[pName] = (productQtyMap[pName] || 0) + (r.quantitySold || 0);
      });
      let topPName = '—';
      let maxQ = 0;
      Object.entries(productQtyMap).forEach(([pName, qty]) => {
        if (qty > maxQ) {
          maxQ = qty;
          topPName = pName;
        }
      });
      item.topProductName = topPName;

      return item;
    });

    return list.sort((a, b) => b.key.localeCompare(a.key));
  }, [reports]);

  // Export the full monthly reports list as CSV for Excel
  const handleExportMonthlySummaryCSV = () => {
    if (monthlyReportsSummary.length === 0) return;

    const headers = [
      'ردیف',
      'ماه و سال شمسی',
      'تعداد فاکتورهای فروش موفق',
      'تعداد کل کارتن‌های فروخته شده',
      'مجموع مبلغ فروش (تومان)',
      'میانگین مبلغ هر فاکتور (تومان)',
      'تعداد کافه‌های خریدار',
      'پرفروش‌ترین محصول ماه',
      'تعداد کل ویزیت‌ها',
      'نرخ موفقیت ویزیت‌ها (درصد)',
      'فروش نقدی (تومان)',
      'فروش نسیه و چک (تومان)'
    ];

    let totalVisitsSum = 0;
    let totalSoldSum = 0;
    let totalQtySum = 0;
    let totalRevenueSum = 0;
    let totalCashSum = 0;
    let totalCreditSum = 0;

    const rows = monthlyReportsSummary.map((m, idx) => {
      totalVisitsSum += m.totalVisits;
      totalSoldSum += m.soldCount;
      totalQtySum += m.totalQuantity;
      totalRevenueSum += m.totalRevenue;
      totalCashSum += m.cashRevenue;
      totalCreditSum += m.creditRevenue;

      return [
        idx + 1,
        `"${m.monthName} ${m.year}"`,
        m.soldCount,
        m.totalQuantity,
        m.totalRevenue,
        m.averageInvoice,
        m.uniqueCafesCount,
        `"${m.topProductName.replace(/"/g, '""')}"`,
        m.totalVisits,
        `"${m.conversionRate}%"`,
        m.cashRevenue,
        m.creditRevenue
      ];
    });

    // Summary row at the bottom
    const avgInvoiceTotal = totalSoldSum > 0 ? Math.round(totalRevenueSum / totalSoldSum) : 0;
    const avgConversionTotal = totalVisitsSum > 0 ? Math.round((totalSoldSum / totalVisitsSum) * 100) : 0;
    const summaryRow = [
      'مجموع کل',
      `"کل دوره‌ها (${monthlyReportsSummary.length} ماه)"`,
      totalSoldSum,
      totalQtySum,
      totalRevenueSum,
      avgInvoiceTotal,
      '—',
      '—',
      totalVisitsSum,
      `"${avgConversionTotal}%"`,
      totalCashSum,
      totalCreditSum
    ];

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      summaryRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `لیست_گزارش‌های_ماهانه_فروش_دزفول_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export single month detailed sales invoices as CSV for Excel
  const handleExportSingleMonthCSV = (m: (typeof monthlyReportsSummary)[0]) => {
    if (m.soldReports.length === 0) return;

    const headers = [
      'ردیف',
      'تاریخ شمسی',
      'ساعت',
      'نام کافه',
      'محصول فروخته شده',
      'تعداد کارتن',
      'مبلغ کل (تومان)',
      'نوع پرداخت',
      'وضعیت فاکتور',
      'توضیحات'
    ];

    const rows = m.soldReports.map((r, idx) => {
      const dateObj = new Date(r.timestamp);
      const jalaliDate = getPersianDateFull(r.timestamp);
      const timeStr = dateObj.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const paymentLabel = r.paymentType === 'credit' ? `نسیه (${r.creditDays || 0} روزه)` : 'نقدی';
      return [
        idx + 1,
        jalaliDate,
        timeStr,
        `"${r.cafeName.replace(/"/g, '""')}"`,
        `"${(r.productName || 'کارتن عمومی').replace(/"/g, '""')}"`,
        r.quantitySold,
        r.totalPrice,
        `"${paymentLabel}"`,
        `"موفق"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const summaryRow = [
      'مجموع',
      `"${m.monthName} ${m.year}"`,
      '—',
      `"${m.uniqueCafesCount} کافه خریدار"`,
      '—',
      m.totalQuantity,
      m.totalRevenue,
      '—',
      '—',
      '—'
    ];

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      summaryRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `فاکتورهای_فروش_${m.monthName}_${m.year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle simple CSV export of the sales data
  const handleExportCSV = () => {
    if (processedSalesReports.length === 0) return;

    // Headers
    const headers = ['ردیف', 'تاریخ شمسی', 'ساعت', 'نام کافه', 'محصول', 'تعداد فروخته شده', 'مبلغ کل (تومان)', 'توضیحات'];
    
    // Rows
    const rows = processedSalesReports.map((r, idx) => {
      const dateObj = new Date(r.timestamp);
      const jalaliDate = getPersianDateFull(r.timestamp);
      const timeStr = dateObj.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      return [
        idx + 1,
        jalaliDate,
        timeStr,
        `"${r.cafeName.replace(/"/g, '""')}"`,
        `"${(r.productName || 'کارتن عمومی').replace(/"/g, '""')}"`,
        r.quantitySold,
        r.totalPrice,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ];
    });

    // Combine headers and rows with UTF-8 BOM
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const periodLabel = period === 'today' ? 'emroz' : period === '7days' ? '7rooze' : period === '30days' ? '30rooze' : 'hame-doreha';
    link.setAttribute('download', `gozaresh_foroosh_${periodLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lookup map for cafes by ID for contact and location info
  const cafeLookup = useMemo(() => {
    const map = new Map<string, Cafe>();
    cafes.forEach(c => map.set(c.id, c));
    return map;
  }, [cafes]);

  // Compute all unpaid credit reports with due date details
  const allUnpaidCreditReports = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return reports
      .filter((r) => r.status === 'sold' && r.paymentType === 'credit' && !r.isPaid)
      .map((r) => {
        const dueTimestamp = r.creditDueDate || (r.timestamp + (r.creditDays || 7) * oneDayMs);
        const diffMs = dueTimestamp - now;
        const daysRemaining = Math.ceil(diffMs / oneDayMs);
        const cafeInfo = cafeLookup.get(r.cafeId);

        return {
          report: r,
          dueTimestamp,
          daysRemaining,
          isOverdue: dueTimestamp < now,
          dueJalali: getPersianDateFull(dueTimestamp),
          saleJalali: getPersianDateFull(r.timestamp),
          cafe: cafeInfo,
          cafeName: r.cafeName || cafeInfo?.name || 'کافه',
          phone: cafeInfo?.phone || '',
          managerName: cafeInfo?.managerName || '',
          address: cafeInfo?.address || ''
        };
      })
      .sort((a, b) => a.dueTimestamp - b.dueTimestamp);
  }, [reports, cafeLookup]);

  // Filter for upcoming credit reports
  const upcomingCreditReports = useMemo(() => {
    if (creditDueFilter === '3days') {
      return allUnpaidCreditReports.filter(item => item.daysRemaining >= 0 && item.daysRemaining <= 3);
    } else if (creditDueFilter === 'overdue_and_3days') {
      return allUnpaidCreditReports.filter(item => item.daysRemaining <= 3);
    } else {
      return allUnpaidCreditReports;
    }
  }, [allUnpaidCreditReports, creditDueFilter]);

  // Count strictly in next 3 days
  const strict3DaysCount = useMemo(() => {
    return allUnpaidCreditReports.filter(item => item.daysRemaining >= 0 && item.daysRemaining <= 3).length;
  }, [allUnpaidCreditReports]);

  // Overdue count
  const overdueCount = useMemo(() => {
    return allUnpaidCreditReports.filter(item => item.daysRemaining < 0).length;
  }, [allUnpaidCreditReports]);

  // Total amount of dues in next 3 days
  const upcoming3DaysTotalAmount = useMemo(() => {
    return allUnpaidCreditReports
      .filter(item => item.daysRemaining >= 0 && item.daysRemaining <= 3)
      .reduce((sum, item) => sum + (item.report.totalPrice || 0), 0);
  }, [allUnpaidCreditReports]);

  // Handle settling a credit report payment directly
  const handleSettlePayment = async (reportId: string, cafeName: string) => {
    if (!onUpdateReport) return;
    try {
      setSettlingReportId(reportId);
      await onUpdateReport(reportId, { isPaid: true });
      setSettledSuccessToast(`فاکتور اعتباری «${cafeName}» با موفقیت تسویه شد.`);
      setTimeout(() => setSettledSuccessToast(null), 4000);
    } catch (err) {
      console.error("Error settling report:", err);
    } finally {
      setSettlingReportId(null);
    }
  };

  // Export upcoming credit dues as CSV for Excel
  const handleExportUpcomingDuesCSV = () => {
    if (upcomingCreditReports.length === 0) return;

    const headers = [
      'ردیف',
      'نام کافه',
      'مدیر کافه',
      'شماره تماس',
      'مبلغ فاکتور (تومان)',
      'تعداد کارتن',
      'نام محصول',
      'تاریخ فروش شمسی',
      'تاریخ سررسید شمسی',
      'وضعیت موعد پرداخت',
      'آدرس کافه',
      'یادداشت'
    ];

    const rows = upcomingCreditReports.map((item, idx) => {
      let statusStr = '';
      if (item.daysRemaining < 0) {
        statusStr = `سررسید گذشته (${Math.abs(item.daysRemaining)} روز تأخیر)`;
      } else if (item.daysRemaining === 0) {
        statusStr = 'سررسید امروز';
      } else {
        statusStr = `${item.daysRemaining} روز مانده`;
      }

      return [
        idx + 1,
        `"${item.cafeName.replace(/"/g, '""')}"`,
        `"${(item.managerName || 'نامشخص').replace(/"/g, '""')}"`,
        `"${item.phone || '—'}"`,
        item.report.totalPrice,
        item.report.quantitySold,
        `"${(item.report.productName || 'کارتن عمومی').replace(/"/g, '""')}"`,
        item.saleJalali,
        item.dueJalali,
        `"${statusStr}"`,
        `"${(item.address || '').replace(/"/g, '""')}"`,
        `"${(item.report.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const totalSum = upcomingCreditReports.reduce((sum, i) => sum + i.report.totalPrice, 0);
    const totalQty = upcomingCreditReports.reduce((sum, i) => sum + i.report.quantitySold, 0);
    const summaryRow = [
      'مجموع',
      `"${upcomingCreditReports.length} کافه"`,
      '—',
      '—',
      totalSum,
      totalQty,
      '—',
      '—',
      '—',
      '—',
      '—',
      '—'
    ];

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      summaryRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `موعد_پرداخت‌های_نزدیک_کافه‌ها.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to dynamically size font based on character length to prevent horizontal overflow/leakage
  const getResponsiveFontClass = (valStr: string) => {
    const len = valStr.length;
    if (len > 12) return 'text-sm sm:text-base md:text-lg lg:text-xs xl:text-base';
    if (len > 9) return 'text-base sm:text-lg md:text-xl lg:text-sm xl:text-lg';
    return 'text-lg sm:text-xl md:text-2xl';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-6 overflow-hidden" id="sales_comprehensive_report">
      
      {/* Header with Title and Time Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <span className="text-[10px] text-orange-600 font-extrabold tracking-widest uppercase">داشبورد هوشمند فروش دزفول</span>
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2 mt-1">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <span>گزارش جامع و تحلیل پیشرفته فروش</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            تحلیل فروش، نمودارها، میزان علاقه خریداران، عملکرد راننده و تفکیک فروش محصولات بر اساس داده‌های ثبت‌شده.
          </p>
        </div>

        {/* Header Actions: Period Tabs & Monthly CSV Button */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          {/* Main Monthly Reports CSV Download Button */}
          <button
            type="button"
            onClick={handleExportMonthlySummaryCSV}
            disabled={monthlyReportsSummary.length === 0}
            className={`px-3 py-1.5 text-xs font-black rounded-xl flex items-center gap-2 transition-all shadow-sm ${
              monthlyReportsSummary.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-md shadow-emerald-600/20 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
            title="دریافت فایل اکسل لیست گزارش‌های ماهانه (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>دریافت گزارش‌های ماهانه (CSV)</span>
          </button>

          {/* Period Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'today', label: 'امروز' },
              { id: '7days', label: '۷ روز اخیر' },
              { id: '30days', label: '۳۰ روز اخیر' },
              { id: 'all', label: 'همه گزارش‌ها' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id as TimePeriod)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  period === tab.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-Section Navigation Tabs (Eliminates excessive scrolling on Mobile) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto no-scrollbar border border-slate-200/80 shrink-0" id="sales_section_segmented_tabs">
        {[
          {
            id: 'charts',
            label: 'شاخص‌ها و نمودارها',
            icon: BarChart3,
            iconColor: 'text-orange-600',
            badge: null
          },
          {
            id: 'dues',
            label: 'موعد پرداخت‌ها',
            icon: Clock,
            iconColor: 'text-amber-600',
            badge: strict3DaysCount > 0 ? toPersianDigits(strict3DaysCount) : null,
            badgeClass: 'bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse'
          },
          {
            id: 'monthly',
            label: 'گزارش‌های ماهانه',
            icon: FileSpreadsheet,
            iconColor: 'text-emerald-600',
            badge: monthlyReportsSummary.length > 0 ? `${toPersianDigits(monthlyReportsSummary.length)} ماه` : null,
            badgeClass: 'bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded-full'
          },
          {
            id: 'invoices',
            label: 'ریز فاکتورها و مشتریان',
            icon: CalendarDays,
            iconColor: 'text-blue-600',
            badge: processedSalesReports.length > 0 ? toPersianDigits(processedSalesReports.length) : null,
            badgeClass: 'bg-slate-200 text-slate-700 text-[10px] font-black px-1.5 py-0.5 rounded-full'
          },
          {
            id: 'all',
            label: 'نمایش یکجا',
            icon: Layers,
            iconColor: 'text-purple-600',
            badge: null
          }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id as SalesSection)}
            className={`px-3 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeSection === tab.id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${tab.iconColor}`} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span className={`mr-1 ${tab.badgeClass}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 4 Bento Metrics Cards */}
      {(activeSection === 'charts' || activeSection === 'all') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn" id="sales_metrics_bento">
        
        {/* Card 1: Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 overflow-hidden min-w-0">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] font-bold text-emerald-700 truncate">مجموع مبالغ فروخته شده</span>
            <div className="bg-emerald-500/10 p-1.5 rounded-lg text-emerald-600 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 mt-4 overflow-hidden min-w-0">
            <span className={`${getResponsiveFontClass(toPersianDigits(formatPrice(aggregates.totalRevenue)))} font-black text-emerald-600 font-sans truncate`} title={toPersianDigits(formatPrice(aggregates.totalRevenue))}>
              {toPersianDigits(formatPrice(aggregates.totalRevenue))}
            </span>
            <span className="text-[10px] text-emerald-700 font-bold shrink-0">تومان</span>
          </div>
          <div className="text-[10px] text-emerald-600 mt-3 flex items-center gap-1 font-bold min-w-0">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">تسویه نقدی/چک در این بازه</span>
          </div>
        </div>

        {/* Card 2: Total Holders Sold */}
        <div className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border border-orange-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 overflow-hidden min-w-0">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] font-bold text-orange-700 truncate">تعداد کل محصولات فروخته شده</span>
            <div className="bg-orange-500/10 p-1.5 rounded-lg text-orange-600 shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 mt-4 overflow-hidden min-w-0">
            <span className={`${getResponsiveFontClass(toPersianDigits(aggregates.totalQty))} font-black text-orange-600 font-sans truncate`} title={toPersianDigits(aggregates.totalQty)}>
              {toPersianDigits(aggregates.totalQty)}
            </span>
            <span className="text-[10px] text-orange-700 font-bold shrink-0">عدد کارتن</span>
          </div>
          <div className="text-[10px] text-orange-600 mt-3 flex items-center gap-1 font-bold min-w-0">
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">میانگین {toPersianDigits(aggregates.successfulInvoices > 0 ? Math.round(aggregates.totalQty / aggregates.successfulInvoices) : 0)} عدد در هر خرید</span>
          </div>
        </div>

        {/* Card 3: Total Invoices */}
        <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 overflow-hidden min-w-0">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] font-bold text-blue-700 truncate">تعداد فاکتورهای موفق</span>
            <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 mt-4 overflow-hidden min-w-0">
            <span className={`${getResponsiveFontClass(toPersianDigits(aggregates.successfulInvoices))} font-black text-blue-600 font-sans truncate`} title={toPersianDigits(aggregates.successfulInvoices)}>
              {toPersianDigits(aggregates.successfulInvoices)}
            </span>
            <span className="text-[10px] text-blue-700 font-bold shrink-0">فاکتور ثبت‌شده</span>
          </div>
          <div className="text-[10px] text-blue-600 mt-3 flex items-center gap-1 font-bold min-w-0">
            <Percent className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">نرخ موفقیت ویزیت: ٪{toPersianDigits(visitMetrics.conversionRate)}</span>
          </div>
        </div>

        {/* Card 4: Average Invoice Value */}
        <div className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border border-purple-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 overflow-hidden min-w-0">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] font-bold text-purple-700 truncate">میانگین ارزش فاکتورها</span>
            <div className="bg-purple-500/10 p-1.5 rounded-lg text-purple-600 shrink-0">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 mt-4 overflow-hidden min-w-0">
            <span className={`${getResponsiveFontClass(toPersianDigits(formatPrice(aggregates.avgInvoiceValue)))} font-black text-purple-600 font-sans truncate`} title={toPersianDigits(formatPrice(aggregates.avgInvoiceValue))}>
              {toPersianDigits(formatPrice(aggregates.avgInvoiceValue))}
            </span>
            <span className="text-[10px] text-purple-700 font-bold shrink-0">تومان</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 flex items-center gap-1 font-bold min-w-0">
            <Coffee className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="truncate">مجموع ویزیت‌ها در بازه: {toPersianDigits(visitMetrics.totalVisits)}</span>
          </div>
        </div>

      </div>
      )}

      {/* Upcoming Credit Due Dates Section (Next 3 Days) */}
      {(activeSection === 'dues' || activeSection === 'all') && (
      <div className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-white border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm animate-fadeIn" id="upcoming_credit_dues_section">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                <Clock className="w-3 h-3 text-amber-700" />
                مدیریت مطالبات اعتباری
              </span>
              {strict3DaysCount > 0 && (
                <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                  {toPersianDigits(strict3DaysCount)} موعد سررسید در ۳ روز آینده
                </span>
              )}
              {overdueCount > 0 && (
                <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-200">
                  {toPersianDigits(overdueCount)} فاکتور سررسید گذشته
                </span>
              )}
            </div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>موعد پرداخت‌های نزدیک (۳ روز آینده)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              فهرست کافه‌هایی که خرید اعتباری/نسیه داشته‌اند و موعد پرداخت و سررسید تسویه آن‌ها در ۳ روز آینده (یا امروز) فرا می‌رسد.
            </p>
          </div>

          {/* Right Side Header Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
            {/* CSV Export for Upcoming Dues */}
            <button
              type="button"
              onClick={handleExportUpcomingDuesCSV}
              disabled={upcomingCreditReports.length === 0}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
                upcomingCreditReports.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer hover:shadow shadow-amber-600/20 active:scale-[0.98]'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              title="دانلود فایل اکسل موعد پرداخت‌های نزدیک"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>خروجی اکسل سررسیدها</span>
            </button>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setCreditDueFilter('3days')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  creditDueFilter === '3days'
                    ? 'bg-white text-slate-800 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ۳ روز آینده ({toPersianDigits(strict3DaysCount)})
              </button>
              <button
                type="button"
                onClick={() => setCreditDueFilter('overdue_and_3days')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  creditDueFilter === 'overdue_and_3days'
                    ? 'bg-white text-slate-800 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                با سررسیدهای گذشته ({toPersianDigits(strict3DaysCount + overdueCount)})
              </button>
              <button
                type="button"
                onClick={() => setCreditDueFilter('all_unpaid')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  creditDueFilter === 'all_unpaid'
                    ? 'bg-white text-slate-800 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                همه ({toPersianDigits(allUnpaidCreditReports.length)})
              </button>
            </div>
          </div>
        </div>

        {/* Toast notification for successful settlement */}
        {settledSuccessToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{settledSuccessToast}</span>
          </div>
        )}

        {/* Mini KPI bar for dues */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold">مجموع مطالبات در ۳ روز آینده</span>
            <span className="font-black text-amber-700 text-sm font-sans mt-0.5">
              {toPersianDigits(formatPrice(upcoming3DaysTotalAmount))} <span className="text-[10px] text-slate-500 font-normal">تومان</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold">تعداد کافه‌های در نوبت وصول</span>
            <span className="font-black text-slate-800 text-sm font-sans mt-0.5">
              {toPersianDigits(strict3DaysCount)} <span className="text-[10px] text-slate-500 font-normal">کافه</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold">کل مطالبات باز اعتباری</span>
            <span className="font-black text-slate-800 text-sm font-sans mt-0.5">
              {toPersianDigits(allUnpaidCreditReports.length)} <span className="text-[10px] text-slate-500 font-normal">فاکتور</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold">وضعیت سررسیدها</span>
            <span className={`font-black text-xs mt-0.5 flex items-center gap-1 ${overdueCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {overdueCount > 0 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{toPersianDigits(overdueCount)} مورد تأخیر گذشته</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>بدون تأخیر معوق</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Content Cards / Empty State */}
        {upcomingCreditReports.length === 0 ? (
          <div className="text-center py-7 px-4 bg-white/80 rounded-xl border border-dashed border-amber-200 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            <span className="text-xs font-black text-slate-700">هیچ فاکتور اعتباری با موعد پرداخت در ۳ روز آینده یافت نشد.</span>
            <span className="text-[11px] text-slate-400 font-medium">تمامی سفارشات اعتباری تسویه شده‌اند یا موعد سررسید آن‌ها بیش از ۳ روز فاصله دارد.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {upcomingCreditReports.map((item) => {
              const r = item.report;
              return (
                <div
                  key={r.id}
                  className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between gap-3 shadow-xs hover:shadow-sm transition-all ${
                    item.daysRemaining < 0
                      ? 'border-rose-200 bg-rose-50/20'
                      : item.daysRemaining === 0
                      ? 'border-orange-300 bg-orange-50/20'
                      : 'border-slate-200/90'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 min-w-0 pb-2 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Coffee className="w-4 h-4 text-orange-600 shrink-0" />
                        <h4 className="text-xs font-black text-slate-900 truncate" title={item.cafeName}>
                          {item.cafeName}
                        </h4>
                      </div>
                      {item.managerName && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">مدیریت: {item.managerName}</span>
                        </div>
                      )}
                    </div>

                    {/* Urgency Badge */}
                    <div className="shrink-0">
                      {item.daysRemaining < 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>{toPersianDigits(Math.abs(item.daysRemaining))} روز تأخیر</span>
                        </span>
                      ) : item.daysRemaining === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-orange-100 text-orange-900 border border-orange-300 px-2 py-0.5 rounded-full animate-pulse">
                          <Clock className="w-3 h-3 text-orange-600" />
                          <span>سررسید امروز!</span>
                        </span>
                      ) : item.daysRemaining === 1 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>فردا (۱ روز مانده)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>{toPersianDigits(item.daysRemaining)} روز مانده</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Financial Details */}
                  <div className="space-y-1.5 text-xs min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[11px] text-slate-500 font-bold">مبلغ بدهی / فاکتور:</span>
                      <span className="text-sm font-black text-emerald-600 font-sans">
                        {toPersianDigits(formatPrice(r.totalPrice))} <span className="text-[10px] text-slate-400 font-normal">تومان</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 gap-1">
                      <span className="text-slate-400 font-medium">سفارش:</span>
                      <span className="font-extrabold truncate text-slate-700">
                        {toPersianDigits(r.quantitySold)} کارتن {r.productName || 'هولدر'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium gap-1 pt-1 border-t border-slate-50">
                      <span>تاریخ ثبت: {toPersianDigits(item.saleJalali)}</span>
                      <span className="font-bold text-slate-600">موعد: {toPersianDigits(item.dueJalali)}</span>
                    </div>

                    {item.address && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate pt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate" title={item.address}>{item.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions: Call and Settle */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {item.phone ? (
                      <a
                        href={`tel:${item.phone}`}
                        className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-lg py-1.5 px-2 text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                        title={`تماس تلفنی با کافه: ${item.phone}`}
                      >
                        <Phone className="w-3 h-3 text-amber-700" />
                        <span>تماس ({toPersianDigits(item.phone)})</span>
                      </a>
                    ) : (
                      <div className="flex-1 text-center text-[10px] text-slate-400 py-1.5 font-bold">بدون شماره تماس</div>
                    )}

                    {onUpdateReport && (
                      <button
                        type="button"
                        onClick={() => handleSettlePayment(r.id, item.cafeName)}
                        disabled={settlingReportId === r.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1.5 px-2.5 text-[10px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs shrink-0"
                        title="ثبت تسویه و وصول بدهی فاکتور"
                      >
                        <Check className="w-3 h-3" />
                        <span>{settlingReportId === r.id ? 'در حال ثبت...' : 'تسویه شد'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Visual Charts Section */}
      {(activeSection === 'charts' || activeSection === 'all') && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fadeIn" id="sales_visual_charts">
        
        {/* Sales Trend Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-orange-600" />
              <span>نمودار روند روزانه مبلغ کل فروش</span>
            </h3>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded font-bold">نمودار تعاملی</span>
          </div>

          <div className="h-[260px] w-full" id="trend_chart_container">
            {dailyTrendData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-bold">هیچ فروشی در این بازه ثبت نشده تا نمودار رسم شود.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => toPersianDigits(formatPrice(v))}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${toPersianDigits(formatPrice(value))} تومان`, 'مبلغ کل فروش']}
                    labelFormatter={(label) => `تاریخ: ${toPersianDigits(label)}`}
                    contentStyle={{
                      direction: 'rtl',
                      textAlign: 'right',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      fontSize: '11px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Product Sales Breakdown (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-orange-600" />
              <span>تفکیک و سهم فروش محصولات</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">سهم هر محصول از درآمد کل فاکتورها</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 my-2 max-h-[200px] pr-1">
            {productBreakdown.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-bold">
                محصولی ثبت نشده است.
              </div>
            ) : (
              productBreakdown.map((prod) => (
                <div key={prod.id} className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                    <span className="font-extrabold text-slate-700 truncate flex-1" title={prod.name}>{prod.name}</span>
                    <span className="font-black text-slate-800 font-sans shrink-0">
                      ٪{toPersianDigits(prod.sharePercent)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${prod.sharePercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold min-w-0 gap-2">
                    <span className="truncate">{toPersianDigits(prod.quantity)} عدد فروخته شده</span>
                    <span className="shrink-0">{toPersianDigits(formatPrice(prod.revenue))} تومان</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 flex items-center gap-2 text-[10px] text-emerald-800 font-bold overflow-hidden min-w-0">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate" title={productBreakdown[0]?.name}>محبوب‌ترین محصول: {productBreakdown[0]?.name || 'ثبت نشده'}</span>
          </div>
        </div>

      </div>
      )}

      {/* Monthly Reports Summary Table & Excel CSV Section */}
      {(activeSection === 'monthly' || activeSection === 'all') && (
      <div className="bg-gradient-to-br from-slate-50 to-emerald-50/20 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm animate-fadeIn" id="monthly_sales_reports_section">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                تحلیل و کارنامه ماهانه
              </span>
              <span className="text-[10px] text-slate-400 font-bold">فرمت استاندارد Microsoft Excel / CSV</span>
            </div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mt-1">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              <span>لیست گزارش‌های ماهانه فروش (بررسی و دریافت در اکسل)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              تفکیک عملکرد و درآمد به تفکیک ماه‌های شمسی؛ مدیر می‌تواند لیست تجمیعی کلیه ماه‌ها یا فاکتورهای هر ماه را به صورت فایل CSV جهت بررسی‌های حسابداری و مدیریتی در مایکروسافت اکسل دریافت کند.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={handleExportMonthlySummaryCSV}
              disabled={monthlyReportsSummary.length === 0}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm ${
                monthlyReportsSummary.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-md shadow-emerald-600/25 active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="دریافت تجمیعی تمامی ماه‌ها در قالب فایل اکسل"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>دریافت فایل اکسل گزارش‌های ماهانه (CSV)</span>
            </button>
          </div>
        </div>

        {/* Monthly Table / Empty State */}
        {monthlyReportsSummary.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-400 text-xs font-bold bg-white/80 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5">
            <Calendar className="w-6 h-6 text-slate-300" />
            <span>هنوز گزارشی در سیستم ثبت نشده است.</span>
            <span className="text-[10px] text-slate-400 font-normal">پس از ثبت ویزیت‌ها و فاکتورها، گزارش‌های ماهانه به صورت خودکار در این جدول تفکیک و قابل دریافت در اکسل خواهند شد.</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">ردیف</th>
                  <th className="py-3 px-3">ماه و سال</th>
                  <th className="py-3 px-3">سفارشات موفق</th>
                  <th className="py-3 px-3">تعداد کارتن</th>
                  <th className="py-3 px-3">مجموع فروش</th>
                  <th className="py-3 px-3">میانگین فاکتور</th>
                  <th className="py-3 px-3">کافه‌های خریدار</th>
                  <th className="py-3 px-3">پرفروش‌ترین کالا</th>
                  <th className="py-3 px-3 text-center">خروجی اکسل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-700">
                {monthlyReportsSummary.map((m, idx) => (
                  <tr key={m.key} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-3 px-3 font-sans text-slate-400 font-medium text-center">{toPersianDigits(idx + 1)}</td>
                    <td className="py-3 px-3 font-black text-slate-900">
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2 py-1 rounded-lg">
                        <Calendar className="w-3.5 h-3.5 text-orange-600" />
                        {m.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-800">
                      {toPersianDigits(m.soldCount)} <span className="text-[10px] text-slate-400 font-normal">فاکتور</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-orange-600 font-black">
                      {toPersianDigits(m.totalQuantity)} <span className="text-[10px] text-slate-400 font-normal">کارتن</span>
                    </td>
                    <td className="py-3 px-3 font-sans font-black text-emerald-600">
                      {toPersianDigits(formatPrice(m.totalRevenue))} <span className="text-[10px] text-slate-400 font-normal">تومان</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">
                      {toPersianDigits(formatPrice(m.averageInvoice))} <span className="text-[10px] text-slate-400 font-normal">تومان</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">
                      {toPersianDigits(m.uniqueCafesCount)} <span className="text-[10px] text-slate-400 font-normal">کافه</span>
                    </td>
                    <td className="py-3 px-3 text-slate-800 truncate max-w-[140px]" title={m.topProductName}>
                      {m.topProductName}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleExportSingleMonthCSV(m)}
                        disabled={m.soldReports.length === 0}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                        title={`دانلود فایل اکسل فاکتورهای ${m.label}`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>فاکتورها (CSV)</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {monthlyReportsSummary.length > 1 && (
                <tfoot>
                  <tr className="bg-slate-50 font-black text-slate-800 text-[11px] border-t-2 border-slate-200">
                    <td className="py-3 px-3 text-center text-slate-400">—</td>
                    <td className="py-3 px-3 font-black text-slate-900">مجموع کل ({toPersianDigits(monthlyReportsSummary.length)} ماه)</td>
                    <td className="py-3 px-3 font-sans">
                      {toPersianDigits(monthlyReportsSummary.reduce((sum, m) => sum + m.soldCount, 0))} <span className="text-[10px] text-slate-400 font-normal">فاکتور</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-orange-600">
                      {toPersianDigits(monthlyReportsSummary.reduce((sum, m) => sum + m.totalQuantity, 0))} <span className="text-[10px] text-slate-400 font-normal">کارتن</span>
                    </td>
                    <td className="py-3 px-3 font-sans font-black text-emerald-600">
                      {toPersianDigits(formatPrice(monthlyReportsSummary.reduce((sum, m) => sum + m.totalRevenue, 0)))} <span className="text-[10px] text-slate-400 font-normal">تومان</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-500">—</td>
                    <td className="py-3 px-3 font-sans text-slate-500">—</td>
                    <td className="py-3 px-3 text-slate-500">—</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={handleExportMonthlySummaryCSV}
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>خروجی کامل</span>
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      )}

      {/* Tables Row: Top Cafes & Detailed Logs */}
      {(activeSection === 'invoices' || activeSection === 'all') && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fadeIn" id="sales_tables_sections">
        
        {/* Top 5 Cafes (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 flex flex-col gap-3 overflow-hidden min-w-0">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 min-w-0 gap-2">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
              <Award className="w-4 h-4 text-orange-600 shrink-0" />
              <span>مشتریان برتر (۵ کافه اول پرخرید)</span>
            </h3>
            <span className="text-[9px] font-sans font-extrabold text-slate-400 shrink-0">بر اساس مبلغ خرید</span>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[280px]">
            {topCafes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-bold">
                هنوز داده خریدی برای کافه‌ها ثبت نشده است.
              </div>
            ) : (
              topCafes.map((cafe, idx) => (
                <div key={cafe.id} className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/40 rounded transition-all min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shrink-0 ${
                      idx === 0 ? 'bg-amber-100 text-amber-800' :
                      idx === 1 ? 'bg-slate-100 text-slate-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {toPersianDigits(idx + 1)}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-slate-800 truncate" title={cafe.name}>{cafe.name}</span>
                      <span className="text-[9px] text-slate-400 font-medium truncate">مجموع دفعات خرید: {toPersianDigits(cafe.visitsCount)} بار</span>
                    </div>
                  </div>

                  <div className="text-left flex flex-col items-end shrink-0">
                    <span className="text-xs font-black text-emerald-600 font-sans">{toPersianDigits(formatPrice(cafe.totalRevenue))} <span className="text-[9px] text-slate-400 font-medium">تومان</span></span>
                    <span className="text-[10px] text-slate-500 font-bold font-sans">{toPersianDigits(cafe.totalQty)} عدد کارتن</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detailed Logs & Export (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-orange-600" />
              <span>فهرست فاکتورها و ردیف‌های فروش ({toPersianDigits(processedSalesReports.length)})</span>
            </h3>
            
            {/* Export CSV Button */}
            {processedSalesReports.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shrink-0 self-start sm:self-auto"
                title="دانلود فایل اکسل فروش"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>خروجی اکسل (CSV)</span>
              </button>
            )}
          </div>

          {/* Table Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی کافه، راننده یا یادداشت..."
                className="w-full pl-2.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium focus:outline-none focus:border-orange-500 transition-all text-slate-700"
              />
            </div>

            {/* Product Selector Filter */}
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-700 focus:outline-none focus:border-orange-500 appearance-none transition-all cursor-pointer"
              >
                <option value="all">همه محصولات</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Table List Container - Compact Table Layout */}
          <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[300px] rounded-xl border border-slate-200/80 bg-white">
            {processedSalesReports.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-bold">
                فاکتور فروشی با فیلترهای بالا یافت نشد.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 text-[11px] sticky top-0 z-10">
                    <th className="py-2.5 px-2.5 w-8 text-center">#</th>
                    <th className="py-2.5 px-2.5">کافه و زمان</th>
                    <th className="py-2.5 px-2.5">محصول و تعداد</th>
                    <th className="py-2.5 px-2.5">مبلغ کل فاکتور</th>
                    <th className="py-2.5 px-2.5">توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-700">
                  {processedSalesReports.map((report, idx) => {
                    const timeStr = new Date(report.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
                    const fullDate = getPersianDateFull(report.timestamp);

                    return (
                      <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-2.5 text-center font-sans text-slate-400 font-medium">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex flex-col min-w-0">
                            <span className="font-extrabold text-slate-900 text-xs truncate max-w-[130px]" title={report.cafeName}>
                              {report.cafeName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans font-medium whitespace-nowrap">
                              {timeStr} <span className="text-slate-300">|</span> {fullDate}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <span className="text-slate-700">
                            <span className="font-black text-orange-600 font-sans">{toPersianDigits(report.quantitySold)}</span> کارتن{' '}
                            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px] inline-block align-bottom">
                              ({report.productName || 'هولدر'})
                            </span>
                          </span>
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <span className="font-black text-emerald-600 font-sans">
                            {toPersianDigits(formatPrice(report.totalPrice))} <span className="text-[9px] text-slate-400 font-normal">تومان</span>
                          </span>
                        </td>
                        <td className="py-2 px-2.5 max-w-[140px]">
                          {report.notes ? (
                            <span className="text-[10px] text-slate-500 font-medium truncate block" title={report.notes}>
                              {report.notes}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
      )}

    </div>
  );
}
