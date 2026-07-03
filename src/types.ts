export interface Cafe {
  id: string;
  name: string;
  managerName: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  assignedDate: string | null; // e.g. "YYYY-MM-DD" if assigned today
  visitStatus: 'pending' | 'sold' | 'no_sale' | 'closed' | 'callback';
  lastVisitDate: string | null;
  lastVisitReportId?: string | null;
  createdAt: number;
}

export interface VisitReport {
  id: string;
  cafeId: string;
  cafeName: string;
  driverName: string;
  status: 'sold' | 'no_sale' | 'closed' | 'callback';
  quantitySold: number; // number of cup holders sold
  totalPrice: number; // in Rials / Tomans
  notes: string;
  timestamp: number;
  productId?: string;
  productName?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number; // unit price in Tomans
  description?: string;
  createdAt: number;
}

export interface DriverStatus {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastActive: number;
  isSharingLocation: boolean;
}
