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
  AlertCircle
} from 'lucide-react';
import { VisitReport, Cafe, Product } from '../types';
import { g_to_j, JALALI_MONTH_NAMES, toPersianDigits as toPersianDigitsShamsi } from '../lib/shamsi';

interface SalesReportProps {
  reports: VisitReport[];
  cafes: Cafe[];
  products: Product[];
}

type TimePeriod = 'today' | '7days' | '30days' | 'all';

export default function SalesReport({ reports, cafes, products }: SalesReportProps) {
  const [period, setPeriod] = useState<TimePeriod>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

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
        r.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesProduct =
        selectedProductFilter === 'all' || r.productId === selectedProductFilter;

      return matchesSearch && matchesProduct;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [salesReports, searchQuery, selectedProductFilter]);

  // Handle simple CSV export of the sales data
  const handleExportCSV = () => {
    if (processedSalesReports.length === 0) return;

    // Headers
    const headers = ['تاریخ', 'ساعت', 'نام کافه', 'راننده / بازاریاب', 'محصول', 'تعداد فروخته شده', 'مبلغ کل (تومان)', 'توضیحات'];
    
    // Rows
    const rows = processedSalesReports.map((r) => {
      const dateObj = new Date(r.timestamp);
      const jalaliDate = getPersianDateFull(r.timestamp);
      const timeStr = dateObj.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      return [
        jalaliDate,
        timeStr,
        `"${r.cafeName.replace(/"/g, '""')}"`,
        `"${r.driverName.replace(/"/g, '""')}"`,
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

        {/* Period Selector Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto shrink-0">
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

      {/* 4 Bento Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="sales_metrics_bento">
        
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

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="sales_visual_charts">
        
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

      {/* Tables Row: Top Cafes & Detailed Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="sales_tables_sections">
        
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

          {/* Table List Container */}
          <div className="flex-1 overflow-y-auto max-h-[220px] divide-y divide-slate-100 pr-1">
            {processedSalesReports.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-bold">
                فاکتور فروشی با فیلترهای بالا یافت نشد.
              </div>
            ) : (
              processedSalesReports.map((report) => {
                const timeStr = new Date(report.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
                const fullDate = getPersianDateFull(report.timestamp);

                return (
                  <div key={report.id} className="py-2.5 flex flex-col gap-1.5 hover:bg-slate-50/50 rounded px-1.5 transition-all min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs font-black text-slate-800 truncate" title={report.cafeName}>{report.cafeName}</span>
                        <span className="text-[9px] text-slate-400 font-sans font-medium shrink-0">({fullDate} - {timeStr})</span>
                      </div>
                      <span className="text-[11px] font-black text-emerald-600 font-sans shrink-0">
                        {toPersianDigits(formatPrice(report.totalPrice))} <span className="text-[9px] text-slate-400 font-medium">تومان</span>
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-slate-500 min-w-0">
                      <div className="flex items-center gap-2 font-bold min-w-0 flex-1 truncate">
                        <span className="truncate">محصول: <span className="text-slate-700 font-extrabold">{report.productName || 'کارتن عمومی'}</span></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                        <span className="shrink-0">تعداد: <span className="text-slate-700 font-extrabold">{toPersianDigits(report.quantitySold)} عدد</span></span>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0">بازاریاب/راننده: <span className="text-slate-600 font-extrabold">{report.driverName}</span></span>
                    </div>

                    {report.notes && (
                      <p className="text-[10px] text-slate-400 italic bg-slate-50/30 p-1.5 rounded border border-slate-100/50 leading-relaxed font-medium">
                        {report.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
