import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Cafe, DriverStatus } from '../types';

interface MapComponentProps {
  cafes: Cafe[];
  driverLocation: DriverStatus | null;
  selectedCafeId: string | null;
  onCafeSelect: (cafeId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  isAdmin?: boolean;
  isAddingCafeMode?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  activeDate?: string;
}

const toPersianDigits = (str: string | number) => {
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

const getPersianDateString = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date);
  } catch (e) {
    return dateStr;
  }
};

// Dezful Coordinates as Default Center
const DEZFUL_CENTER: [number, number] = [32.3855, 48.4065];

export default function MapComponent({
  cafes,
  driverLocation,
  selectedCafeId,
  onCafeSelect,
  onMapClick,
  isAdmin = false,
  isAddingCafeMode = false,
  userLocation = null,
  activeDate,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  const [isLegendOpen, setIsLegendOpen] = useState(false);

  const isAddingCafeModeRef = useRef(isAddingCafeMode);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    isAddingCafeModeRef.current = isAddingCafeMode;
  }, [isAddingCafeMode]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Invalidate map size on mounts, layout changes, and cafe updates to guarantee markers render correctly
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, isAddingCafeMode, cafes, driverLocation]);

  // Helper to create custom HTML markers
  const getMarkerIcon = (status: Cafe['visitStatus'], isTodayTarget: boolean, isSelected: boolean) => {
    let color = '#78350f'; // Dark brown default (Karton)
    let ringColor = 'rgba(120, 53, 15, 0.3)';

    if (isTodayTarget) {
      if (status === 'pending') {
        color = '#3b82f6'; // Blue for pending today
        ringColor = 'rgba(59, 130, 246, 0.4)';
      } else if (status === 'sold') {
        color = '#10b981'; // Green for success
        ringColor = 'rgba(16, 185, 129, 0.4)';
      } else if (status === 'no_sale') {
        color = '#ef4444'; // Red for visited no sale
        ringColor = 'rgba(239, 68, 68, 0.4)';
      } else if (status === 'callback') {
        color = '#ea580c'; // Orange for callback
        ringColor = 'rgba(234, 88, 12, 0.4)';
      } else if (status === 'closed') {
        color = '#6b7280'; // Gray for closed
        ringColor = 'rgba(107, 114, 128, 0.4)';
      }
    } else {
      // Not targeted today
      color = '#94a3b8'; // Cool gray for inactive today
      ringColor = 'rgba(148, 163, 184, 0.2)';
    }

    const scale = isSelected ? 'scale-125 z-[1000]' : 'hover:scale-110';
    const border = isSelected ? 'border-2 border-white shadow-lg' : 'border border-white/50';

    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="relative flex items-center justify-center ${scale} transition-all duration-300">
          <div class="absolute w-8 h-8 rounded-full animate-ping" style="background-color: ${ringColor}; animation-duration: 2s;"></div>
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-white ${border} shadow-md relative z-10" style="background-color: ${color};">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
              <line x1="6" y1="2" x2="6" y2="4"/>
              <line x1="10" y1="2" x2="10" y2="4"/>
              <line x1="14" y1="2" x2="14" y2="4"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 rotate-45 z-0" style="background-color: ${color};"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use OpenStreetMap tiles in Persian/English
    const map = L.map(mapContainerRef.current, {
      center: DEZFUL_CENTER,
      zoom: 14,
      zoomControl: false, // will position it nicely on the right
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    // Force size recalculation to prevent grey map or misaligned markers on slow mounts
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    // Click handler for Admin adding cafe
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isAddingCafeModeRef.current && onMapClickRef.current) {
        const { lat, lng } = e.latlng;
        onMapClickRef.current(lat, lng);

        // Place a temporary marker
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setLatLng(e.latlng);
        } else {
          const tempIcon = L.divIcon({
            className: 'temp-marker',
            html: `
              <div class="flex items-center justify-center animate-bounce">
                <div class="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white border-2 border-white shadow-lg">
                  📍
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          });
          tempMarkerRef.current = L.marker(e.latlng, { icon: tempIcon }).addTo(map);
        }
      }
    });

    return () => {
      clearTimeout(timer);
      // Remove any open popups or tooltips to avoid Leaflet lifecycle/fade-out bugs
      try {
        map.closePopup();
        map.closeTooltip();
      } catch (e) {
        console.warn(e);
      }

      // Remove all markers explicitly to prevent memory leaks and DOM leftover issues
      Object.keys(markersRef.current).forEach((key) => {
        const marker = markersRef.current[key];
        if (marker) {
          try {
            marker.remove();
          } catch (e) {}
        }
      });
      if (driverMarkerRef.current) {
        try {
          driverMarkerRef.current.remove();
        } catch (e) {}
      }
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.remove();
        } catch (e) {}
      }
      if (tempMarkerRef.current) {
        try {
          tempMarkerRef.current.remove();
        } catch (e) {}
      }

      try {
        map.remove();
      } catch (e) {
        console.error('Error removing leaflet map:', e);
      }

      mapRef.current = null;
      markersRef.current = {};
      driverMarkerRef.current = null;
      userMarkerRef.current = null;
      tempMarkerRef.current = null;
    };
  }, []);

  // Remove temporary marker if no longer in adding mode
  useEffect(() => {
    if (!isAddingCafeMode && tempMarkerRef.current && mapRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  }, [isAddingCafeMode]);

  const getPopupContent = (cafe: Cafe) => {
    const isTodayTarget = activeDate ? cafe.assignedDate === activeDate : cafe.assignedDate !== null;
    let statusLabel = activeDate ? `سایر کافه‌ها (بدون برنامه ${toPersianDigits(getPersianDateString(activeDate))})` : 'سایر کافه‌ها (بدون برنامه امروز)';
    let statusColor = '#94a3b8';

    if (isTodayTarget) {
      if (cafe.visitStatus === 'pending') {
        statusLabel = 'هدف امروز (منتظر بازدید)';
        statusColor = '#3b82f6';
      } else if (cafe.visitStatus === 'sold') {
        statusLabel = 'بازدید شده و فروش موفق';
        statusColor = '#10b981';
      } else if (cafe.visitStatus === 'no_sale') {
        statusLabel = 'عدم خرید / بسته بودن';
        statusColor = '#ef4444';
      } else if (cafe.visitStatus === 'callback') {
        statusLabel = 'نیاز به تماس مجدد امروز';
        statusColor = '#ea580c';
      } else if (cafe.visitStatus === 'closed') {
        statusLabel = 'بسته بودن کافه';
        statusColor = '#6b7280';
      }
    }

    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    const navUrl = isIOS
      ? `maps://?q=${cafe.lat},${cafe.lng}`
      : `geo:${cafe.lat},${cafe.lng}?q=${cafe.lat},${cafe.lng}(${encodeURIComponent(cafe.name)})`;

    return `
      <div class="font-sans text-right rtl p-1 flex flex-col gap-1.5 text-slate-800" style="direction: rtl; text-align: right;">
        <div class="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1 gap-2" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <h4 class="font-extrabold text-xs text-slate-900" style="margin: 0; font-weight: 800; font-size: 12px; color: #1e293b;">${cafe.name}</h4>
            <a href="${navUrl}" class="nav-btn" style="display: inline-flex; align-items: center; justify-content: center; background-color: #ea580c; color: white; border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: 800; text-decoration: none; border: none; margin-right: 6px; cursor: pointer; border: 1px solid #d97706; transition: all 0.2s;" title="مسیریابی با گوشی">
              🚗 مسیریابی
            </a>
          </div>
          <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${statusColor}; width: 10px; height: 10px; border-radius: 9999px; flex-shrink: 0;"></span>
        </div>
        <div class="space-y-1 text-[11px] font-medium" style="font-size: 11px;">
          <div class="flex justify-between gap-4 flex-row-reverse" style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: #94a3b8;">مدیر کافه:</span>
            <span style="font-weight: 700; color: #334155;">${cafe.managerName || 'نامشخص'}</span>
          </div>
          <div class="flex justify-between gap-4 flex-row-reverse" style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span style="color: #94a3b8; font-weight: bold;">شماره تماس:</span>
            <span style="font-weight: 700; color: #ea580c; font-family: sans-serif;"><a href="tel:${cafe.phone || ''}" style="color: #ea580c; text-decoration: underline; font-weight: bold;">${cafe.phone || 'ثبت نشده'}</a></span>
          </div>
          <div class="flex justify-between gap-4 flex-row-reverse pb-1" style="display: flex; justify-content: space-between; border-bottom: 1px solid #f8fafc; padding-bottom: 4px; margin-bottom: 4px;">
            <span style="color: #94a3b8;">برنامه امروز:</span>
            <span style="font-weight: 800; color: ${statusColor};">${statusLabel}</span>
          </div>
          <div style="text-align: right; margin-top: 4px;">
            <span style="display: block; margin-bottom: 2px; color: #94a3b8;">آدرس:</span>
            <span style="font-size: 10px; line-height: 1.4; display: block; color: #475569; font-weight: 600;">${cafe.address}</span>
          </div>
        </div>
      </div>
    `;
  };

  // 2. Sync Cafe Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!cafes.some((c) => c.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    cafes.forEach((cafe) => {
      const isTodayTarget = activeDate ? cafe.assignedDate === activeDate : cafe.assignedDate !== null;
      const isSelected = selectedCafeId === cafe.id;
      const icon = getMarkerIcon(cafe.visitStatus, isTodayTarget, isSelected);

      if (markersRef.current[cafe.id]) {
        // Update existing marker
        const marker = markersRef.current[cafe.id];
        marker.setLatLng([cafe.lat, cafe.lng]);
        marker.setIcon(icon);
        marker.setZIndexOffset(isSelected ? 1000 : (isTodayTarget ? 500 : 0));
        marker.setPopupContent(getPopupContent(cafe));
        
        if (isSelected && !marker.isPopupOpen()) {
          marker.openPopup();
        }
      } else {
        // Create new marker
        const marker = L.marker([cafe.lat, cafe.lng], { icon })
          .addTo(map)
          .on('click', () => {
            onCafeSelect(cafe.id);
          });

        // Add tooltip with Cafe name
        marker.bindTooltip(cafe.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -28],
          className: 'px-2 py-1 font-sans text-xs font-semibold rounded bg-slate-900 text-white border-0 shadow-md',
        });

        // Add rich Popup
        marker.bindPopup(getPopupContent(cafe), {
          className: 'custom-leaflet-popup',
          minWidth: 220,
        });

        markersRef.current[cafe.id] = marker;

        if (isSelected) {
          marker.openPopup();
        }
      }
    });
  }, [cafes, selectedCafeId, onCafeSelect]);

  // 3. Zoom/Center to Selected Cafe
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCafeId) return;

    const selectedCafe = cafes.find((c) => c.id === selectedCafeId);
    if (selectedCafe) {
      map.setView([selectedCafe.lat, selectedCafe.lng], 16, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedCafeId, cafes]);

  // 4. Sync Driver Position Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driverLocation && driverLocation.isSharingLocation) {
      const driverIcon = L.divIcon({
        className: 'driver-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-blue-500/30 animate-ping" style="animation-duration: 1.5s;"></div>
            <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white shadow-xl relative z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div class="absolute -top-8 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded shadow-md whitespace-nowrap border border-blue-500">
              موقعیت راننده
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
        driverMarkerRef.current.setIcon(driverIcon);
      } else {
        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
          .addTo(map);
      }
    } else {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
    }
  }, [driverLocation]);

  // 5. Sync User Live Location (for Driver self position)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 8,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map);
        
        userMarkerRef.current.bindTooltip('موقعیت شما', {
          permanent: false,
          direction: 'top',
        });
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-full min-h-[400px] md:min-h-[500px]">
      <div ref={mapContainerRef} className="w-full h-full" id="dezful_map_container" />
      
      {/* Map Legends - Compact and Collapsible to keep map highly visible */}
      <div className="absolute top-3 left-3 z-[999] flex flex-col items-end gap-1.5 font-sans rtl text-right">
        {!isLegendOpen ? (
          <button
            type="button"
            onClick={() => setIsLegendOpen(true)}
            className="bg-white/95 hover:bg-white border border-slate-200 shadow-md px-2.5 py-1.5 rounded-xl text-slate-700 hover:text-orange-600 transition-all duration-200 flex items-center gap-1.5 text-[10px] font-extrabold cursor-pointer"
            id="btn_show_legend"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span>راهنمای نقشه</span>
          </button>
        ) : (
          <div className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200 shadow-lg text-[10px] w-48 max-w-[calc(100vw-32px)] transition-all duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-black cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md"
              >
                بستن ×
              </button>
              <h4 className="font-extrabold text-slate-800 text-[10px]">راهنمای نقشه</h4>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-start gap-1.5 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block border border-white shadow-sm shrink-0"></span>
                <span className="text-slate-600 font-bold">هدف امروز (منتظر بازدید)</span>
              </div>
              <div className="flex items-center justify-start gap-1.5 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block border border-white shadow-sm shrink-0"></span>
                <span className="text-slate-600 font-bold">بازدید شده و فروش موفق</span>
              </div>
              <div className="flex items-center justify-start gap-1.5 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 block border border-white shadow-sm shrink-0"></span>
                <span className="text-slate-600 font-bold">نیاز به تماس مجدد امروز</span>
              </div>
              <div className="flex items-center justify-start gap-1.5 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block border border-white shadow-sm shrink-0"></span>
                <span className="text-slate-600 font-bold">عدم خرید / بسته بودن</span>
              </div>
              <div className="flex items-center justify-start gap-1.5 flex-row-reverse">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 block border border-white shadow-sm shrink-0"></span>
                <span className="text-slate-600 font-bold">سایر کافه‌ها (برنامه دیگر)</span>
              </div>
              {driverLocation?.isSharingLocation && (
                <div className="flex items-center justify-start gap-1.5 flex-row-reverse pt-1 border-t border-slate-100 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block border border-white shadow-sm animate-pulse shrink-0"></span>
                  <span className="text-blue-600 font-extrabold">موقعیت آنلاین راننده</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
