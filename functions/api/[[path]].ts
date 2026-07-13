interface Env {
  DB: any; // Using any to avoid rigid D1 types in compilation, but it will have the .prepare(), .run(), etc. methods
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Helper to create JSON response with CORS headers
  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  };

  // Handle OPTIONS for CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  };

  try {
    const db = env.DB;
    if (!db) {
      return jsonResponse({ error: "D1 Database binding 'DB' is missing. Please bind it in your Cloudflare dashboard." }, 500);
    }

    // --- 1. SETTINGS / AUTH ---
    if (path === "/api/settings/auth") {
      // Auto-create settings table if not exists for self-healing
      await db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();

      if (method === "GET") {
        const result = await db.prepare(`SELECT value FROM settings WHERE key = 'auth'`).first();
        if (!result) {
          // Initialize with default if empty
          await db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('auth', '123456')`).run();
          return jsonResponse({ passcode: "123456" });
        }
        return jsonResponse({ passcode: result.value });
      }

      if (method === "POST") {
        const { passcode } = await request.json() as any;
        await db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('auth', ?)`).bind(passcode).run();
        return jsonResponse({ success: true, passcode });
      }
    }

    // --- 2. CAFES ---
    if (path === "/api/cafes" || path.startsWith("/api/cafes/")) {
      const idParam = path.split("/")[3]; // /api/cafes/:id

      if (method === "GET") {
        const { results } = await db.prepare(`SELECT * FROM cafes ORDER BY createdAt DESC`).all();
        // Convert any SQLite 1/0 boolean equivalents back to boolean if needed, though they are stored as is
        return jsonResponse(results);
      }

      if (method === "POST") {
        const item = await request.json() as any;
        await db.prepare(
          `INSERT INTO cafes (id, name, managerName, phone, address, lat, lng, assignedDate, visitStatus, lastVisitDate, lastVisitReportId, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          item.id,
          item.name,
          item.managerName || null,
          item.phone || null,
          item.address || null,
          item.lat,
          item.lng,
          item.assignedDate || null,
          item.visitStatus || 'pending',
          item.lastVisitDate || null,
          item.lastVisitReportId || null,
          item.createdAt || Date.now()
        ).run();
        return jsonResponse({ success: true });
      }

      if (method === "PUT" && idParam) {
        const updates = await request.json() as any;
        
        // Dynamically build the update query to handle partial updates
        const keys = Object.keys(updates);
        if (keys.length === 0) {
          return jsonResponse({ error: "No fields to update" }, 400);
        }

        const setClause = keys.map(k => `${k} = ?`).join(", ");
        const values = keys.map(k => updates[k]);
        values.push(idParam);

        await db.prepare(`UPDATE cafes SET ${setClause} WHERE id = ?`).bind(...values).run();
        return jsonResponse({ success: true });
      }

      if (method === "DELETE" && idParam) {
        await db.prepare(`DELETE FROM cafes WHERE id = ?`).bind(idParam).run();
        return jsonResponse({ success: true });
      }
    }

    // --- 3. REPORTS ---
    if (path === "/api/reports" || path.startsWith("/api/reports/")) {
      const idParam = path.split("/")[3];

      if (method === "GET") {
        const { results } = await db.prepare(`SELECT * FROM visit_reports ORDER BY timestamp DESC`).all();
        return jsonResponse(results);
      }

      if (method === "POST") {
        const report = await request.json() as any;
        await db.prepare(
          `INSERT INTO visit_reports (id, cafeId, cafeName, driverName, status, quantitySold, totalPrice, notes, timestamp, productId, productName) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          report.id,
          report.cafeId,
          report.cafeName,
          report.driverName,
          report.status,
          report.quantitySold,
          report.totalPrice,
          report.notes || null,
          report.timestamp || Date.now(),
          report.productId || null,
          report.productName || null
        ).run();
        return jsonResponse({ success: true });
      }

      if (method === "DELETE" && idParam) {
        await db.prepare(`DELETE FROM visit_reports WHERE id = ?`).bind(idParam).run();
        return jsonResponse({ success: true });
      }
    }

    // --- 4. PRODUCTS ---
    if (path === "/api/products" || path.startsWith("/api/products/")) {
      const idParam = path.split("/")[3];

      if (method === "GET") {
        const { results } = await db.prepare(`SELECT * FROM products ORDER BY createdAt ASC`).all();
        return jsonResponse(results);
      }

      if (method === "POST") {
        const p = await request.json() as any;
        await db.prepare(
          `INSERT INTO products (id, name, price, description, createdAt) 
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          p.id,
          p.name,
          p.price,
          p.description || null,
          p.createdAt || Date.now()
        ).run();
        return jsonResponse({ success: true });
      }

      if (method === "PUT" && idParam) {
        const updates = await request.json() as any;
        const keys = Object.keys(updates);
        if (keys.length === 0) return jsonResponse({ error: "No fields to update" }, 400);

        const setClause = keys.map(k => `${k} = ?`).join(", ");
        const values = keys.map(k => updates[k]);
        values.push(idParam);

        await db.prepare(`UPDATE products SET ${setClause} WHERE id = ?`).bind(...values).run();
        return jsonResponse({ success: true });
      }

      if (method === "DELETE" && idParam) {
        await db.prepare(`DELETE FROM products WHERE id = ?`).bind(idParam).run();
        return jsonResponse({ success: true });
      }
    }

    // --- 5. DRIVER STATUS ---
    if (path === "/api/driverStatus" || path.startsWith("/api/driverStatus/")) {
      if (method === "GET") {
        // Auto-seed initial driver status if table is empty
        const driver = await db.prepare(`SELECT * FROM driver_status WHERE id = 'driver_mohammad'`).first();
        if (!driver) {
          const initialDriver = {
            id: 'driver_mohammad',
            name: 'محمد دزفولی',
            lat: 32.3855,
            lng: 48.4065,
            lastActive: Date.now(),
            isSharingLocation: 0
          };
          await db.prepare(
            `INSERT INTO driver_status (id, name, lat, lng, lastActive, isSharingLocation) 
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            initialDriver.id,
            initialDriver.name,
            initialDriver.lat,
            initialDriver.lng,
            initialDriver.lastActive,
            initialDriver.isSharingLocation
          ).run();
          return jsonResponse({ ...initialDriver, isSharingLocation: false });
        }
        return jsonResponse({
          ...driver,
          isSharingLocation: !!driver.isSharingLocation
        });
      }

      if (method === "PUT" || method === "POST") {
        const status = await request.json() as any;
        // Check if driverStatus exists
        const driverExists = await db.prepare(`SELECT id FROM driver_status WHERE id = 'driver_mohammad'`).first();
        if (!driverExists) {
          await db.prepare(
            `INSERT INTO driver_status (id, name, lat, lng, lastActive, isSharingLocation) 
             VALUES ('driver_mohammad', 'محمد دزفولی', ?, ?, ?, ?)`
          ).bind(
            status.lat || 32.3855,
            status.lng || 48.4065,
            status.lastActive || Date.now(),
            status.isSharingLocation ? 1 : 0
          ).run();
        } else {
          // Dynamic fields
          const keys = Object.keys(status);
          const fieldsToUpdate = keys.map(k => {
            if (k === 'isSharingLocation') return `isSharingLocation = ?`;
            return `${k} = ?`;
          });
          const values = keys.map(k => {
            if (k === 'isSharingLocation') return status[k] ? 1 : 0;
            return status[k];
          });
          values.push('driver_mohammad');

          await db.prepare(`UPDATE driver_status SET ${fieldsToUpdate.join(", ")} WHERE id = ?`).bind(...values).run();
        }
        return jsonResponse({ success: true });
      }
    }

    // --- 6. NOTIFICATIONS ---
    if (path === "/api/notifications" || path.startsWith("/api/notifications/")) {
      const idParam = path.split("/")[3];

      if (method === "GET") {
        const { results } = await db.prepare(`SELECT * FROM notifications WHERE driverId = 'driver_mohammad' AND "read" = 0 ORDER BY createdAt DESC`).all();
        return jsonResponse(results.map((r: any) => ({ ...r, read: !!r.read })));
      }

      if (method === "POST") {
        const n = await request.json() as any;
        await db.prepare(
          `INSERT INTO notifications (id, driverId, message, createdAt, "read") 
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          n.id,
          n.driverId,
          n.message,
          n.createdAt || Date.now(),
          n.read ? 1 : 0
        ).run();
        return jsonResponse({ success: true });
      }

      if (method === "PUT" && idParam) {
        const updates = await request.json() as any;
        const keys = Object.keys(updates);
        if (keys.length === 0) return jsonResponse({ error: "No fields to update" }, 400);

        const setClause = keys.map(k => {
          if (k === 'read') return `"read" = ?`;
          return `"${k}" = ?`;
        }).join(", ");

        const values = keys.map(k => {
          if (k === 'read') return updates[k] ? 1 : 0;
          return updates[k];
        });
        values.push(idParam);

        await db.prepare(`UPDATE notifications SET ${setClause} WHERE id = ?`).bind(...values).run();
        return jsonResponse({ success: true });
      }

      if (method === "DELETE" && idParam) {
        await db.prepare(`DELETE FROM notifications WHERE id = ?`).bind(idParam).run();
        return jsonResponse({ success: true });
      }
    }

    // --- 7. DELETION REQUESTS ---
    if (path === "/api/deletion-requests" || path.startsWith("/api/deletion-requests/")) {
      const idParam = path.split("/")[3];

      // Self-healing / table creation
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS deletion_requests (
          id TEXT PRIMARY KEY,
          reportId TEXT NOT NULL,
          cafeId TEXT NOT NULL,
          cafeName TEXT NOT NULL,
          driverName TEXT NOT NULL,
          reason TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
        )`
      ).run();

      if (method === "GET") {
        const { results } = await db.prepare(`SELECT * FROM deletion_requests ORDER BY timestamp DESC`).all();
        return jsonResponse(results);
      }

      if (method === "POST") {
        const req = await request.json() as any;
        await db.prepare(
          `INSERT INTO deletion_requests (id, reportId, cafeId, cafeName, driverName, reason, timestamp, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          req.id,
          req.reportId,
          req.cafeId,
          req.cafeName,
          req.driverName,
          req.reason,
          req.timestamp || Date.now(),
          req.status || 'pending'
        ).run();
        return jsonResponse({ success: true });
      }

      if (method === "PUT" && idParam) {
        const { status } = await request.json() as any;
        await db.prepare(`UPDATE deletion_requests SET "status" = ? WHERE id = ?`).bind(status, idParam).run();
        return jsonResponse({ success: true });
      }
    }

    return jsonResponse({ error: `Not found: ${method} ${path}` }, 404);
  } catch (error: any) {
    return jsonResponse({ error: error.message || String(error) }, 500);
  }
};
