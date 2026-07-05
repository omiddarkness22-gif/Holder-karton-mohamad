-- Cloudflare D1 Database Schema for kartonholder-db

-- 1. settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. cafes Table
CREATE TABLE IF NOT EXISTS cafes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    managerName TEXT,
    phone TEXT,
    address TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    assignedDate TEXT,
    visitStatus TEXT DEFAULT 'pending',
    lastVisitDate TEXT,
    lastVisitReportId TEXT,
    createdAt INTEGER NOT NULL
);

-- 3. visit_reports Table
CREATE TABLE IF NOT EXISTS visit_reports (
    id TEXT PRIMARY KEY,
    cafeId TEXT NOT NULL,
    cafeName TEXT NOT NULL,
    driverName TEXT NOT NULL,
    status TEXT NOT NULL,
    quantitySold INTEGER NOT NULL,
    totalPrice INTEGER NOT NULL,
    notes TEXT,
    timestamp INTEGER NOT NULL,
    productId TEXT,
    productName TEXT
);

-- 4. products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    createdAt INTEGER NOT NULL
);

-- 5. driver_status Table
CREATE TABLE IF NOT EXISTS driver_status (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    lastActive INTEGER NOT NULL,
    isSharingLocation INTEGER NOT NULL
);

-- 6. notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    driverId TEXT NOT NULL,
    message TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    read INTEGER DEFAULT 0
);
