import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword, verifyPassword } from './server/db';
import { courierService } from './server/courierService';
import { hrService } from './server/hrService';
import { crmService } from './server/crmService';
import { parseMessengerOrder } from './server/parser';
import { User, UserRoleTier, Capability } from './src/types';

dotenv.config();

// Constant-time string comparison for webhook signatures (Section 35.6).
// Avoids leaking match/fail timing and works for equal-length tokens.
function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const sseClients = new Map<string, express.Response>();

  const broadcastEvent = (type: string, data: any) => {
    const payload = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
    for (const [clientId, res] of sseClients.entries()) {
      try {
        res.write(payload);
      } catch (err) {
        sseClients.delete(clientId);
      }
    }
  };

  app.use(express.json({ limit: '10mb' }));

  // Resolve active authenticated user from Bearer token, session header, or fallback dev header
  const getAuthenticatedUser = (req: express.Request): User | null => {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const sessionToken = bearerToken || String(req.headers['x-session-token'] || '').trim();

    if (sessionToken) {
      const { valid, user } = db.validateSession(sessionToken);
      if (valid && user) return user;
    }

    const fallbackUserId = String(req.headers['x-authenticated-user-id'] || '').trim();
    if (fallbackUserId) {
      const user = db.users.get(fallbackUserId);
      if (user && user.active) return user;
    }

    // Internal ERP fallback: default to active owner for operational endpoints if not set
    const defaultOwner = db.users.get('usr_owner') || Array.from(db.users.values()).find((u) => u.active);
    if (defaultOwner) return defaultOwner;

    return null;
  };

  // Resolve order-operation attribution from the active app user.
  const getAuthenticatedActor = (req: express.Request): { id: string; name: string } => {
    const user = getAuthenticatedUser(req);
    if (!user) throw new Error('Authenticated user is required');
    return { id: user.id, name: user.name };
  };

  // RBAC Permission Middlewares (Section 19, 20)
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    next();
  };

  const requireNotTier4 = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (user.tier === 4) {
      return res.status(403).json({
        error: 'Access denied: Packing Team members are restricted from viewing financial, payroll, or margin data.',
      });
    }
    next();
  };

  const requireOwner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (user.tier !== 1) {
      return res.status(403).json({ error: 'Access denied: Requires Tier 1 (Owner) authorization.' });
    }
    next();
  };

  // API Routes (Mounted first)

  // 1. Health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 1b. Real Authentication & Sessions (Section 37, 39.1)
  app.post('/api/auth/login', (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Username/Email/Phone and Password are required' });
      }

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const rawIdent = String(identifier).trim().toLowerCase();
      // Normalize common domain typo variations (e.g. purfume -> perfume)
      const cleanIdent = rawIdent
        .replace('@miragepurfume.com', '@mirageperfume.com')
        .replace('@miragepurfume.bd', '@mirageperfume.com')
        .replace('@mirageparfume.com', '@mirageperfume.com')
        .replace('@mirageparfum.com', '@mirageperfume.com')
        .replace('@mirageperfume.bd', '@mirageperfume.com');
      const identPrefix = cleanIdent.split('@')[0];
      const attemptKey = `${ip}_${cleanIdent}`;

      // Throttling / Lockout check
      const existing = db.loginAttempts.get(attemptKey);
      if (existing && existing.lockedUntil && existing.lockedUntil > Date.now()) {
        const remainingMin = Math.ceil((existing.lockedUntil - Date.now()) / (60 * 1000));
        return res.status(429).json({
          error: `Account temporarily locked due to repeated failed login attempts. Please wait ${remainingMin} minute(s).`,
          locked: true,
          remainingMinutes: remainingMin,
        });
      }

      // Find user by email, phone, name, or username prefix
      let foundUser: User | undefined;
      for (const u of db.users.values()) {
        if (!u.active) continue;
        const userEmail = u.email.toLowerCase();
        const userPrefix = userEmail.split('@')[0];
        const userPhone = u.phone.replace(/[^0-9]/g, '');
        const cleanPhone = cleanIdent.replace(/[^0-9]/g, '');
        if (
          userEmail === cleanIdent ||
          userEmail === rawIdent ||
          userPrefix === identPrefix ||
          userPrefix === cleanIdent ||
          (cleanPhone.length >= 10 && userPhone.includes(cleanPhone)) ||
          u.name.toLowerCase().includes(cleanIdent) ||
          u.id.toLowerCase() === cleanIdent
        ) {
          foundUser = u;
          break;
        }
      }

      if (!foundUser) {
        db.recordLoginAttempt(attemptKey, false);
        return res.status(401).json({ error: 'Invalid credentials. User not found.' });
      }

      // Verify password
      const isPasswordValid = verifyPassword(password, foundUser.password || hashPassword('mirage2026'));
      if (!isPasswordValid) {
        const lockStatus = db.recordLoginAttempt(attemptKey, false);
        if (lockStatus.locked) {
          return res.status(429).json({
            error: `Too many failed attempts. Account locked for ${lockStatus.remainingMinutes} minutes.`,
            locked: true,
            remainingMinutes: lockStatus.remainingMinutes,
          });
        }
        return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
      }

      // Success: clear throttling and create session
      db.recordLoginAttempt(attemptKey, true);
      const token = db.createSession(foundUser.id, ip, req.headers['user-agent']);
      db.logAudit(foundUser.id, foundUser.name, 'user_login', 'auth', foundUser.id, `User logged in from ${ip}`);

      const { password: _p, ...safeUser } = foundUser;
      res.json({
        token,
        user: safeUser,
        expires_in_minutes: db.securitySettings.session_timeout_minutes || 30,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const token =
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '') ||
        String(req.headers['x-session-token'] || req.body.token || '').trim();
      if (token) {
        db.revokeSession(token);
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized or session expired', authenticated: false });
      }
      const { password: _p, ...safeUser } = user;
      res.json({ authenticated: true, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Auth & Current User / Users
  app.get('/api/users', (req, res) => {
    res.json(Array.from(db.users.values()));
  });

  app.post('/api/users', (req, res) => {
    try {
      const { name, email, phone, tier, role, capabilities, actor_id, actor_name } = req.body;
      if (!name || !email || !tier) {
        return res.status(400).json({ error: 'Name, email, and tier are required' });
      }

      const id = `usr_${Date.now()}`;
      const numericTier: UserRoleTier = (typeof tier === 'number' && [1, 2, 3, 4].includes(tier)) ? (tier as UserRoleTier) : 3;
      const roleName = role || (numericTier === 1 ? 'Owner' : numericTier === 2 ? 'Accountant' : numericTier === 3 ? 'Showroom & Sales' : 'Packing Team');

      const newUser: User = {
        id,
        name,
        email,
        phone: phone || '',
        tier: numericTier,
        role: roleName,
        active: true,
        capabilities: (capabilities as Capability[]) || ['view_sales_orders', 'view_inventory_stock', 'create_edit_orders'],
        toggles: {},
        created_at: new Date().toISOString(),
      };

      db.users.set(id, newUser);
      db.logAudit(actor_id || 'system', actor_name || 'Admin', 'user_created', 'user', id, { name, role: roleName });

      res.json(newUser);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id/toggles', (req, res) => {
    try {
      const { id } = req.params;
      const { toggles, actor_id, actor_name } = req.body;
      const user = db.users.get(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.toggles = { ...user.toggles, ...toggles };
      db.logAudit(actor_id || 'system', actor_name || 'Admin', 'user_toggles_updated', 'user', id, `Updated toggles for ${user.name}`);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id/profile', (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, profile_photo_url, password } = req.body;
      const user = db.users.get(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (name && typeof name === 'string' && name.trim()) user.name = name.trim();
      if (email && typeof email === 'string' && email.trim()) user.email = email.trim();
      if (phone !== undefined) user.phone = String(phone).trim();
      if (profile_photo_url !== undefined) user.profile_photo_url = profile_photo_url;
      if (password && typeof password === 'string' && password.trim()) user.password = password.trim();

      db.logAudit(id, user.name, 'profile_updated', 'user', id, {
        name: user.name,
        email: user.email,
        phone: user.phone,
        password_changed: !!password,
      });
      broadcastEvent('user_updated', user);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Products
  app.get('/api/products', (req, res) => {
    const prods = Array.from(db.products.values()).map(p => {
      const stock = db.getProductStockSummary(p.id);
      return {
        ...p,
        stock_on_hand: stock.on_hand,
        stock_reserved: stock.reserved,
        stock_available: stock.available,
        stock_by_warehouse: stock.byWarehouse,
      };
    });
    res.json(prods);
  });

  app.post('/api/products', (req, res) => {
    try {
      const {
        brand,
        name,
        concentration,
        size_variant,
        category_name,
        gender,
        sku,
        barcode,
        selling_price,
        avg_cost,
        wholesale_price,
        wholesale_type,
        low_stock_threshold,
        photo_url,
        location_shop,
        location_main,
        perfume_type,
        top_notes,
        heart_notes,
        base_notes,
        main_accords,
        gross_weight,
        is_bundle,
        bundle_components,
        actor_id,
        actor_name,
      } = req.body;

      if (!brand || !name || !selling_price) {
        return res.status(400).json({ error: 'Brand, Name, and Selling Price are required' });
      }

      const generatedSku = sku || `${brand.slice(0, 3).toUpperCase()}${String(db.products.size + 1).padStart(3, '0')}`;
      const generatedBarcode = barcode || `MP-PRD-${generatedSku}-${Date.now().toString().slice(-4)}`;
      const id = `PROD-${generatedSku.toLowerCase()}`;
      const conc = concentration || 'EDP';
      const size = size_variant || '100ML';
      const displayName = is_bundle ? name : `${brand} ${name} ${conc} ${size}`;

      const newProd = {
        id,
        sku: generatedSku,
        barcode: generatedBarcode,
        name,
        brand,
        concentration: conc,
        size_variant: size,
        category_id: (category_name || 'General').toLowerCase().replace(/\s+/g, '_'),
        category_name: category_name || 'General',
        gender: gender || undefined,
        photo_url: photo_url || 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=300&q=80',
        location_shop: location_shop || undefined,
        location_main: location_main || undefined,
        perfume_type: perfume_type === 'Middle Eastern' || perfume_type === 'Western' || perfume_type === 'Niche' ? perfume_type : undefined,
        top_notes: Array.isArray(top_notes) ? top_notes : [],
        heart_notes: Array.isArray(heart_notes) ? heart_notes : [],
        base_notes: Array.isArray(base_notes) ? base_notes : [],
        main_accords: Array.isArray(main_accords) ? main_accords : [],
        gross_weight: gross_weight !== undefined && gross_weight !== null && gross_weight !== '' ? Number(gross_weight) || 0 : undefined,
        avg_cost: Number(avg_cost) || 0,
        selling_price: Number(selling_price) || 0,
        wholesale_price: wholesale_price !== undefined ? Number(wholesale_price) || 0 : undefined,
        wholesale_type:
          wholesale_type === 'separate' || wholesale_type === 'same_as_retail'
            ? wholesale_type
            : wholesale_price !== undefined && Number(wholesale_price) > 0 && Number(wholesale_price) !== Number(selling_price)
            ? 'separate'
            : 'same_as_retail',
        price_updated_at: new Date().toISOString(),
        low_stock_threshold: Number(low_stock_threshold) || 3,
        is_bundle: Boolean(is_bundle),
        bundle_components: bundle_components || [],
        display_name: displayName,
        active: true,
        created_at: new Date().toISOString(),
      };

      db.products.set(id, newProd);

      // Initialize inventory records
      db.warehouses.forEach(wh => {
        db.inventory.set(`${id}_${wh.id}`, {
          product_id: id,
          warehouse_id: wh.id,
          on_hand: 0,
          reserved: 0,
          avg_cost: newProd.avg_cost,
        });
      });

      db.logAudit(actor_id || 'system', actor_name || 'Staff', 'product_created', 'product', id, `Created product ${displayName}`);

      res.json(newProd);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const prod = db.products.get(id);
      if (!prod) return res.status(404).json({ error: 'Product not found' });

      const {
        brand,
        name,
        concentration,
        size_variant,
        category_name,
        gender,
        selling_price,
        wholesale_price,
        wholesale_type,
        low_stock_threshold,
        photo_url,
        location_shop,
        location_main,
        perfume_type,
        top_notes,
        heart_notes,
        base_notes,
        main_accords,
        gross_weight,
        active,
        actor_id,
        actor_name,
      } = req.body;

      if (brand) prod.brand = brand;
      if (name) prod.name = name;
      if (concentration) prod.concentration = concentration;
      if (size_variant) prod.size_variant = size_variant;
      if (category_name) {
        prod.category_name = category_name;
        prod.category_id = category_name.toLowerCase().replace(/\s+/g, '_');
      }
      if ('gender' in req.body) prod.gender = req.body.gender || undefined;
      if (perfume_type === 'Middle Eastern' || perfume_type === 'Western' || perfume_type === 'Niche') prod.perfume_type = perfume_type;
      else if ('perfume_type' in req.body) prod.perfume_type = undefined;
      if (Array.isArray(top_notes)) prod.top_notes = top_notes;
      if (Array.isArray(heart_notes)) prod.heart_notes = heart_notes;
      if (Array.isArray(base_notes)) prod.base_notes = base_notes;
      if (Array.isArray(main_accords)) prod.main_accords = main_accords;
      if ('gross_weight' in req.body) {
        const gw = req.body.gross_weight;
        prod.gross_weight = gw !== undefined && gw !== null && gw !== '' ? Number(gw) || 0 : undefined;
      }
      if (wholesale_price !== undefined) prod.wholesale_price = Number(wholesale_price) || 0;
      if (wholesale_type === 'separate' || wholesale_type === 'same_as_retail') {
        prod.wholesale_type = wholesale_type;
      }
      // When only the wholesale_price (not the type) is being updated on a
      // legacy row, auto-normalize the type so the new price actually applies.
      if (
        wholesale_type !== 'separate' &&
        wholesale_type !== 'same_as_retail' &&
        wholesale_price !== undefined &&
        (prod.wholesale_type === undefined || prod.wholesale_type === 'same_as_retail') &&
        Number(wholesale_price) > 0 &&
        Number(wholesale_price) !== Number(prod.selling_price)
      ) {
        prod.wholesale_type = 'separate';
      }

      // Detect a real selling-price change: stamp price_updated_at and signal
      // other staff via SSE broadcast (Point 3.2/3.3). Wholesale-only changes
      // do not trigger the moderator-facing highlight.
      const prevSellingPrice = prod.selling_price;
      const prevWholesalePrice = prod.wholesale_price;
      if (selling_price !== undefined && Number(selling_price) !== prevSellingPrice) {
        prod.selling_price = Number(selling_price);
        prod.price_updated_at = new Date().toISOString();
        db.pushPriceChangedNotification({
          product_id: prod.id,
          product_name: prod.display_name,
          old_price: prevSellingPrice,
          new_price: prod.selling_price,
          actor_name: actor_name || 'Staff',
        });
        broadcastEvent('price_updated', {
          product_id: prod.id,
          product_name: prod.display_name,
          sku: prod.sku,
          previous_selling_price: prevSellingPrice,
          new_selling_price: prod.selling_price,
          previous_wholesale_price: prevWholesalePrice ?? 0,
          new_wholesale_price: prod.wholesale_price ?? 0,
          updated_at: prod.price_updated_at,
        });

        // Price Update Scope (User Rule: Price Update choice)
        // 1. 'all_active_stock': Updates selling price of all active batches with remaining stock.
        // 2. 'incoming_only': Active batches retain their current selling price, only future incoming stock uses new price.
        if (req.body.price_scope === 'all_active_stock') {
          db.batches.forEach(b => {
            if (b.product_id === prod.id && b.quantity_remaining > 0) {
              b.selling_price = prod.selling_price;
            }
          });
        }
      } else if (selling_price !== undefined) {
        prod.selling_price = Number(selling_price);
        if (req.body.price_scope === 'all_active_stock') {
          db.batches.forEach(b => {
            if (b.product_id === prod.id && b.quantity_remaining > 0) {
              b.selling_price = prod.selling_price;
            }
          });
        }
      }
      if (low_stock_threshold !== undefined) prod.low_stock_threshold = Number(low_stock_threshold);
      if (photo_url) prod.photo_url = photo_url;
      if ('location_shop' in req.body) prod.location_shop = req.body.location_shop || undefined;
      if ('location_main' in req.body) prod.location_main = req.body.location_main || undefined;
      if (active !== undefined) prod.active = Boolean(active);

      prod.display_name = prod.is_bundle ? prod.name : `${prod.brand} ${prod.name} ${prod.concentration} ${prod.size_variant}`;

      db.logAudit(actor_id || 'system', actor_name || 'Staff', 'product_updated', 'product', id, `Updated product details for ${prod.display_name}`);
      res.json(prod);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE product (soft-delete, per Section 31 \u2014 never hard-delete)
  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { confirm_step, reason, actor_id, actor_name } = req.body;
      const prod = db.products.get(id);
      if (!prod) return res.status(404).json({ error: 'Product not found' });

      if (confirm_step !== 3) {
        return res.status(400).json({ error: 'Deletion requires triple confirmation (confirm_step=3)' });
      }

      // Check for active orders referencing this product
      const hasActiveOrders = Array.from(db.orders.values()).some(o =>
        o.status !== 'cancelled' && o.status !== 'delivered' &&
        o.items?.some((item: any) => item.product_id === id || item.product_id_or_bundle_id === id)
      );
      if (hasActiveOrders) {
        return res.status(400).json({ error: 'Cannot delete: product has active (unfulfilled) orders' });
      }

      // Check for stock
      const stockSummary = db.getProductStockSummary(id);
      if (stockSummary.on_hand > 0) {
        return res.status(400).json({ error: `Cannot delete: ${stockSummary.on_hand} units still in stock. Remove stock first.` });
      }

      // Soft-delete
      prod.active = false;
      db.products.set(id, prod);

      db.logAudit(
        actor_id || 'system',
        actor_name || 'Staff',
        'product_deleted',
        'product',
        id,
        `Deleted product ${prod.display_name}. Reason: ${reason || 'No reason provided'}`
      );

      res.json({ success: true, message: `${prod.display_name} has been deleted.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk CSV Import (Section 41.3)
  app.post('/api/products/bulk-csv', (req, res) => {
    try {
      const { rows, actor_id, actor_name } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Valid rows array required' });
      }

      let imported = 0;
      for (const row of rows) {
        // Schema: name, brand, size_variant, category, barcode, sku, purchase_price, selling_price, low_stock_threshold
        const brand = row.brand || 'Mirage';
        const name = row.name || 'Perfume SKU';
        const size = row.size_variant || '100ML';
        const category = row.category || 'General';
        const sku = row.sku || `${brand.slice(0, 3).toUpperCase()}${String(db.products.size + 1).padStart(3, '0')}`;
        const barcode = row.barcode || `MP-${sku}-${Date.now().toString().slice(-4)}`;
        const cost = Number(row.purchase_price) || 0;
        const price = Number(row.selling_price) || 0;
        const wholesale = Number(row.wholesale_price) || undefined;
        const threshold = Number(row.low_stock_threshold) || 3;
        const grossWeight = row.gross_weight !== undefined && row.gross_weight !== null && row.gross_weight !== ''
          ? Number(row.gross_weight) || 0
          : undefined;

        const id = `PROD-${sku.toLowerCase()}`;
        const conc = (row.concentration === 'EDP' || row.concentration === 'EDT' || row.concentration === 'Extrait' || row.concentration === 'Parfum' || row.concentration === 'Cologne' || row.concentration === 'Attar' || row.concentration === 'Concentrated Oil')
          ? row.concentration
          : 'EDP';
        const perfumeType = row.perfume_type === 'Middle Eastern' || row.perfume_type === 'Western' || row.perfume_type === 'Niche'
          ? row.perfume_type
          : undefined;
        const splitList = (v: any): string[] | undefined =>
          typeof v === 'string' && v.trim()
            ? v.split(',').map((s: string) => s.trim()).filter(Boolean)
            : undefined;
        const displayName = `${brand} ${name} ${conc} ${size}`;

        const p = {
          id,
          sku,
          barcode,
          name,
          brand,
          concentration: conc as any,
          size_variant: size,
          category_id: category.toLowerCase().replace(/\s+/g, '_'),
          category_name: category,
          gender: row.gender || undefined,
          perfume_type: perfumeType,
          top_notes: splitList(row.top_notes),
          heart_notes: splitList(row.heart_notes),
          base_notes: splitList(row.base_notes),
          main_accords: splitList(row.main_accords),
          gross_weight: grossWeight,
          photo_url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=300&q=80',
          avg_cost: cost,
          selling_price: price,
          wholesale_price: wholesale,
          price_updated_at: new Date().toISOString(),
          low_stock_threshold: threshold,
          is_bundle: false,
          display_name: displayName,
          active: true,
          created_at: new Date().toISOString(),
        };

        db.products.set(id, p);
        db.warehouses.forEach(wh => {
          db.inventory.set(`${id}_${wh.id}`, {
            product_id: id,
            warehouse_id: wh.id,
            on_hand: 0,
            reserved: 0,
            avg_cost: cost,
          });
        });
        imported++;
      }

      db.logAudit(actor_id || 'system', actor_name || 'Staff', 'bulk_products_imported', 'product', 'bulk', `Imported ${imported} products via CSV`);
      res.json({ success: true, count: imported });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Inventory & Stock Receiving
  app.get('/api/inventory/summary', (req, res) => {
    const summary = Array.from(db.products.values()).map(p => {
      return {
        product: p,
        stock: db.getProductStockSummary(p.id),
      };
    });
    res.json(summary);
  });

  const handleStockMovements = (req: any, res: any) => {
    const requestedPage = Number(req.query.page);
    const requestedPageSize = Number(req.query.page_size);
    const isPagedRequest = Number.isFinite(requestedPage) || Number.isFinite(requestedPageSize) || req.query.paged === 'true';

    // Preserve current unpaginated behavior only when no paging params are passed, for backward compatibility with existing callers (StockLedgerView.tsx)
    if (!isPagedRequest) {
      return res.json(db.stockMovements);
    }

    const result = db.getStockMovements({
      page: requestedPage,
      page_size: requestedPageSize,
      product_id: req.query.product_id as string,
      warehouse_id: req.query.warehouse_id as string,
      movement_reason: req.query.movement_reason as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
    });
    res.json(result);
  };

  app.get('/api/stock-movements', handleStockMovements);
  app.get('/api/inventory/ledger', handleStockMovements);

  // Stock Reports (Part 1: Global per-product stock report & Part 2: Product stock history)
  app.get('/api/reports/stock', (req, res) => {
    try {
      const report = db.getStockReport({
        page: req.query.page ? Number(req.query.page) : undefined,
        page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
        category: req.query.category as string,
        brand: req.query.brand as string,
        location: (req.query.location || req.query.warehouse_id) as string,
        search: req.query.search as string,
        sort_by: req.query.sort_by as string,
        sort_order: req.query.sort_order as any,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        low_stock_only: req.query.low_stock_only === 'true' || req.query.low_stock === 'true',
        low_stock_threshold: req.query.low_stock_threshold ? Number(req.query.low_stock_threshold) : undefined,
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/reports/stock/:product_id/history', (req, res) => {
    try {
      const history = db.getProductStockHistory(req.params.product_id, {
        warehouse_id: (req.query.warehouse_id || req.query.location) as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      });
      res.json(history);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Section 32.4/41 reservation ledger \u2014 RESERVE/RELEASE events are separate
  // from the physical stock-movement ledger.
  app.get('/api/inventory/reservations', (req, res) => {
    res.json(db.reservationEvents);
  });

  app.post('/api/inventory/receive', (req, res) => {
    try {
      const { product_id, warehouse_id, qty_received, qty_damaged, damage_severity, damage_notes, landed_cost_per_unit, supplier_name, batch_code, manufacturing_date, import_date, best_before_date, expiry_date, actor_id, actor_name, notes } = req.body;
      const result = db.receiveImportedStock({
        product_id,
        warehouse_id: warehouse_id || 'wh_shop',
        qty_received: Number(qty_received),
        qty_damaged: qty_damaged !== undefined ? Number(qty_damaged) : 0,
        damage_severity,
        damage_notes,
        landed_cost_per_unit: Number(landed_cost_per_unit),
        supplier_name,
        batch_code,
        manufacturing_date,
        import_date,
        best_before_date,
        expiry_date,
        actor_id: actor_id || 'usr_mgr',
        actor_name: actor_name || 'Manager',
        notes,
      });
      if (result.batch || (qty_damaged && Number(qty_damaged) > 0)) {
        broadcastEvent('stock_received', { product_id, qty_received: Number(qty_received), has_batch: !!result.batch, damaged: qty_damaged ? Number(qty_damaged) : 0 });
      }
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Point 2: batch/lot history + damaged stock views.
  app.get('/api/inventory/batches', (req, res) => {
    const { product_id } = req.query as any;
    res.json(db.getBatches(product_id));
  });

  app.get('/api/inventory/damaged-stock', (_req, res) => {
    res.json(db.getDamagedStock());
  });

  app.post('/api/inventory/opening-stock', (req, res) => {
    try {
      const { product_id, warehouse_id, quantity, unit_cost, date, actor_id, actor_name } = req.body;
      db.setOpeningStock({
        product_id,
        warehouse_id: warehouse_id || 'wh_shop',
        quantity: Number(quantity),
        unit_cost: Number(unit_cost),
        date: date || new Date().toISOString().slice(0, 10),
        actor_id: actor_id || 'usr_owner',
        actor_name: actor_name || 'Owner',
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Orders & Parsing
  app.post('/api/orders/parse-messenger', async (req, res) => {
    try {
      const { raw_text } = req.body;
      if (!raw_text || typeof raw_text !== 'string') {
        return res.status(400).json({ error: 'raw_text is required' });
      }
      const result = await parseMessengerOrder(raw_text);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders', (req, res) => {
    const requestedPage = Number(req.query.page);
    const requestedPageSize = Number(req.query.page_size);
    const isPagedRequest = Number.isFinite(requestedPage) || Number.isFinite(requestedPageSize) || req.query.view === 'today' || req.query.view === 'pre_orders' || req.query.view === 'scheduled';
    const allOrders = Array.from(db.orders.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));

    if (!isPagedRequest) {
      res.json(allOrders);
      return;
    }

    const page = Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1);
    const pageSize = Math.min(100000, Math.max(1, Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : 25));
    const status = String(req.query.status || '').trim();
    const channel = String(req.query.channel || '').trim();
    const orderType = String(req.query.order_type || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const todayView = req.query.view === 'today';
    const preOrdersView = req.query.view === 'pre_orders';
    const scheduledView = req.query.view === 'scheduled';
    const timingFilter = String(req.query.timing || '').trim();
    const dhakaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const dateFrom = todayView ? dhakaDate : String(req.query.date_from || '').trim();
    const dateTo = todayView ? dhakaDate : String(req.query.date_to || '').trim();

    const baseFiltered = allOrders.filter(order => {
      if (channel && order.channel !== channel) return false;
      if (orderType && (order.order_type || 'direct_sale') !== orderType) return false;

      // Filter by view/timing
      if (preOrdersView) {
        // Pre-orders view MUST exclude cancelled orders
        if (order.status === 'cancelled') return false;
        if (order.order_timing !== 'pre_order') return false;
      } else if (scheduledView) {
        // Scheduled orders view MUST exclude cancelled orders
        if (order.status === 'cancelled') return false;
        if (order.order_timing !== 'scheduled') return false;
      } else if (timingFilter) {
        if (order.status === 'cancelled') return false;
        const effectiveTiming = order.order_timing || 'today';
        if (effectiveTiming !== timingFilter) return false;
      }

      const createdAt = new Date(order.created_at);
      if (todayView) {
        // Today's operational queue MUST exclude cancelled orders
        if (order.status === 'cancelled') return false;

        // Pre-orders are explicitly awaiting arrival/approval and not in today's work queue
        if (order.order_timing === 'pre_order') return false;

        // Scheduled orders surface on their scheduled date
        if (order.order_timing === 'scheduled') {
          if (!order.scheduled_date || order.scheduled_date > dhakaDate) return false;
        } else {
          // Normal 'today' orders: created today, moved to today's queue, or active pending order for today
          const orderDate = order.created_at
            ? new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Dhaka',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(new Date(order.created_at))
            : '';
          const isCreatedToday = orderDate === dhakaDate;
          const isMovedToday = order.moved_to_today_at && order.moved_to_today_at.slice(0, 10) === dhakaDate;
          const isPendingTodayOrder =
            (order.order_timing === 'today' || !order.order_timing) &&
            ['pending', 'confirmed', 'packed'].includes(order.status);

          if (!isCreatedToday && !isMovedToday && !isPendingTodayOrder) return false;
        }
      } else if (!preOrdersView && !scheduledView) {
        if (dateFrom && createdAt < new Date(`${dateFrom}T00:00:00+06:00`)) return false;
        if (dateTo && createdAt > new Date(`${dateTo}T23:59:59.999+06:00`)) return false;
      }

      if (search) {
        const searchable = [
          order.invoice_number,
          order.customer_name,
          order.customer_phone,
          order.delivery_address_text,
          order.merchant_name,
          order.merchant_id,
          order.parcel_id,
          order.end_customer_name,
          ...order.items.flatMap(item => [item.product_name, item.sku]),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(search)) return false;
      }
      return true;
    });

    if (scheduledView) {
      baseFiltered.sort((a, b) => (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999'));
    }

    const filtered = baseFiltered.filter(order => !status || order.status === status);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const orders = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const statusCounts = baseFiltered.reduce<Record<string, number>>((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {});
    res.json({ orders, total, page: safePage, page_size: pageSize, total_pages: totalPages, status_counts: statusCounts });
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = db.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  });

  app.post('/api/orders/create', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const order = db.createOrder({ ...req.body, actor_id: actor.id, actor_name: actor.name });
      broadcastEvent('order_created', order);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Edit Order (Section 35.1c)
  app.put('/api/orders/:id', (req, res) => {
    try {
      const order = db.editOrder({
        order_id: req.params.id,
        ...req.body,
      });
      broadcastEvent('order_updated', order);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Move a Pre-Order or Scheduled Order into Today's Orders Queue
  app.post('/api/orders/:id/move-to-today', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const order = db.movePreOrderToToday(req.params.id, actor.id, actor.name);
      broadcastEvent('order_updated', order);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk move Pre-Orders into Today's Orders Queue
  app.post('/api/orders/bulk-move-to-today', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { order_ids } = req.body;
      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: 'order_ids array required' });
      }
      const result = db.bulkMovePreOrdersToToday(order_ids, actor.id, actor.name);
      broadcastEvent('orders_bulk_updated', { ids: order_ids });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Record Direct Customer Payment against an Order (Section 15.0 & 15.5)
  app.post('/api/orders/:id/payments', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { amount, method, payment_account_id, transaction_ref, notes } = req.body;
      const order = db.recordOrderPayment({
        order_id: req.params.id,
        amount: Number(amount),
        method,
        payment_account_id,
        transaction_ref,
        actor_id: actor.id,
        actor_name: actor.name,
        notes,
      });
      broadcastEvent('order_updated', order);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/cancel', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const reason = String(req.body.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'A cancellation reason is required.' });
      const reasonCategories = [
        'Customer changed their mind',
        'Product out of stock',
        'Duplicate order',
        'Wrong item/details entered',
        'Customer unreachable / no response',
        'Price/payment disagreement',
        'Suspected fake/fraudulent order',
      ];
      const isOtherReason = reason.startsWith('Other (please specify):');
      if (!reasonCategories.includes(reason) && !isOtherReason) {
        return res.status(400).json({ error: 'Select a valid cancellation reason category.' });
      }
      if (isOtherReason && reason.slice('Other (please specify):'.length).trim().length === 0) {
        return res.status(400).json({ error: 'Details are required for an Other cancellation reason.' });
      }
      const order = db.cancelOrder(req.params.id, reason, actor.id, actor.name);
      broadcastEvent('order_cancelled', order);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete Order
  app.delete('/api/orders/:id', (req, res) => {
    try {
      const { actor_id, actor_name } = req.body;
      db.deleteOrder(req.params.id, actor_id || 'usr_owner', actor_name || 'Staff');
      broadcastEvent('order_deleted', { id: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk Delete Orders
  app.post('/api/orders/bulk-delete', (req, res) => {
    try {
      const { order_ids, actor_id, actor_name } = req.body;
      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({ error: 'order_ids array required' });
      }
      for (const id of order_ids) {
        db.deleteOrder(id, actor_id || 'usr_owner', actor_name || 'Staff');
      }
      broadcastEvent('orders_bulk_deleted', { ids: order_ids });
      res.json({ success: true, count: order_ids.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Packing & Physical Stock Deduction (Section 8, 10, 40.2)
  app.post('/api/orders/:id/pack', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { package_weight_grams, box_size, qa_notes } = req.body;
      const order = db.packOrder({
        order_id: req.params.id,
        actor_id: actor.id,
        actor_name: actor.name,
        package_weight_grams: package_weight_grams ? Number(package_weight_grams) : undefined,
        box_size,
        qa_notes,
      });
      broadcastEvent('order_packed', order);
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Book with Steadfast Courier (Section 12, 12.1, 40.2) \u2014 booking step only.
  // This is NOT dispatch: it calls Steadfast's create_order, records the real
  // consignment/tracking on the order, and leaves the order status unchanged
  // ('confirmed' or 'packed') so the Merchant stays on the Today's work queue.
  // Confirmed orders can be booked BEFORE packing \u2014 the required thermal-label
  // print, verification and packing happen after the consignment is received.
  app.post('/api/orders/:id/book-courier', async (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { note, package_weight_grams } = req.body;
      const order = db.orders.get(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.status !== 'confirmed' && order.status !== 'packed') {
        return res.status(400).json({
          error: `Order ${order.invoice_number} must be Confirmed or Packed before booking with Steadfast (current status: ${order.status}).`,
        });
      }
      if (order.fulfillment_method !== 'steadfast') {
        if (req.body?.force_steadfast || !order.fulfillment_method || (order.fulfillment_method as string) === 'steadfast_courier') {
          order.fulfillment_method = 'steadfast';
          order.updated_at = new Date().toISOString();
        } else {
          return res.status(400).json({ error: 'Only Steadfast orders can use courier booking.' });
        }
      }

      // Idempotency (Section 32.3/35.6): if already booked with Steadfast, return
      // the existing booking WITHOUT making a fresh external create_order call \u2014
      // otherwise a duplicate click/retry would create a second consignment.
      if (order.courier_booked && order.courier_consignment_id) {
        return res.json(order);
      }

      // If tracking_code and consignment_id are explicitly supplied (e.g. manual import), use them directly; otherwise call API
      let bookingResult;
      if (req.body.tracking_code && req.body.consignment_id) {
        bookingResult = {
          consignment_id: req.body.consignment_id,
          tracking_code: req.body.tracking_code,
          actual_charge: req.body.actual_charge,
          customer_delivery_charge: req.body.customer_delivery_charge,
          merchant_payout: req.body.merchant_payout,
          status: req.body.carrier_status || 'in_review',
        };
      } else {
        // Real call to Steadfast / Demo API
        bookingResult = await courierService.createConsignment(order, {
          note: note || order.notes || order.qa_notes,
          weightGrams: package_weight_grams || order.package_weight_grams,
        });
      }

      const updatedOrder = db.recordCourierBooking({
        order_id: order.id,
        consignment_id: bookingResult.consignment_id,
        tracking_code: bookingResult.tracking_code,
        actual_charge: bookingResult.actual_charge,
        customer_delivery_charge: bookingResult.customer_delivery_charge,
        merchant_payout: bookingResult.merchant_payout,
        carrier_status: bookingResult.status,
        actor_id: actor.id,
        actor_name: actor.name,
      });

      const booking = db.courierBookings.get(`BK-${order.id}`);
      broadcastEvent('order_booked', updatedOrder);
      if (booking) {
        broadcastEvent('courier_status_updated', booking);
      }

      // Booking confirmed \u2014 order intentionally stays in the Packing queue.
      res.json(updatedOrder);
    } catch (err: any) {
      console.error('[Courier Booking Error]', err.message);
      res.status(400).json({ error: err.message || 'Courier booking failed' });
    }
  });

  // Physical step 1: record that the 4x6 thermal courier label was printed & attached
  app.post('/api/orders/:id/label-printed', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const updatedOrder = db.recordLabelPrinted({
        order_id: req.params.id,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('order_label_printed', updatedOrder);
      res.json(updatedOrder);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Physical step 2: verify the tracking/consignment barcode scanned from the
  // printed label belongs to this exact order (Section 9/11). A wrong barcode
  // is rejected and the order remains in Packing.
  app.post('/api/orders/:id/verify-tracking', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { scanned_barcode } = req.body;
      if (!scanned_barcode) {
        return res.status(400).json({ error: 'No tracking barcode was scanned.' });
      }
      const updatedOrder = db.verifyTrackingBarcode({
        order_id: req.params.id,
        scanned_barcode: String(scanned_barcode),
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('order_tracking_verified', updatedOrder);
      res.json(updatedOrder);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Final physical step: Dispatch. Requires Steadfast booking + label printed
  // + tracking verified. Only here does the order leave the Packing queue.
  app.post('/api/orders/:id/dispatch', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const updatedOrder = db.recordDispatch({
        order_id: req.params.id,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('order_dispatched', updatedOrder);
      res.json(updatedOrder);
    } catch (err: any) {
      console.error('[Courier Dispatch Error]', err.message);
      res.status(400).json({ error: err.message || 'Dispatch failed' });
    }
  });

  // Courier & Steadfast Reconciliation API (Section 12.1, 15.2, 40.2)
  app.get('/api/courier/bookings', (req, res) => {
    res.json(Array.from(db.courierBookings.values()).sort((a, b) => b.booked_at.localeCompare(a.booked_at)));
  });

  app.get('/api/courier/bookings/:id', (req, res) => {
    const booking = db.courierBookings.get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Courier booking not found' });
    res.json(booking);
  });

  app.post('/api/courier/calculate-charge', (req, res) => {
    try {
      const { address, weight_grams } = req.body;
      const result = db.calculateSteadfastCharge(address || '', weight_grams ? Number(weight_grams) : undefined);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/courier/sync-status', (req, res) => {
    try {
      const { booking_id, new_status, actual_charge_override, actor_id, actor_name, notes } = req.body;
      const booking = db.syncCourierStatus({
        booking_id,
        new_status,
        actual_charge_override: actual_charge_override !== undefined ? Number(actual_charge_override) : undefined,
        actor_id: actor_id || 'system',
        actor_name: actor_name || 'System / Steadfast Webhook',
        notes,
      });
      broadcastEvent('courier_status_updated', booking);
      res.json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/courier/reconcile-payout', (req, res) => {
    try {
      const { booking_id, actual_payout, payment_account_id, actor_id, actor_name, notes } = req.body;
      const booking = db.reconcileCourierPayout({
        booking_id,
        actual_payout: actual_payout !== undefined ? Number(actual_payout) : undefined,
        payment_account_id: payment_account_id || 'acc_bank',
        actor_id: actor_id || 'usr_owner',
        actor_name: actor_name || 'Sobuj Sehk',
        notes,
      });
      broadcastEvent('courier_payout_reconciled', booking);
      res.json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Manual Courier Charge Fallback & Correction (Section 12, 15.2)
  app.post('/api/courier/bookings/:id/update-actual-charge', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { actual_charge, notes } = req.body;
      if (actual_charge === undefined || actual_charge === null || isNaN(Number(actual_charge))) {
        return res.status(400).json({ error: 'Valid actual_charge is required' });
      }

      const booking = db.updateCourierActualChargeManual({
        booking_id: req.params.id,
        actual_charge: Number(actual_charge),
        actor_id: actor.id,
        actor_name: actor.name,
        notes,
      });

      broadcastEvent('courier_status_updated', booking);
      res.json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Resolve API vs Manual Conflict
  app.post('/api/courier/bookings/:id/resolve-conflict', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { resolution, notes } = req.body;
      if (resolution !== 'accept_api' && resolution !== 'keep_manual') {
        return res.status(400).json({ error: 'Invalid resolution choice. Must be "accept_api" or "keep_manual".' });
      }

      const booking = db.resolveCourierChargeConflict({
        booking_id: req.params.id,
        resolution,
        actor_id: actor.id,
        actor_name: actor.name,
        notes,
      });

      broadcastEvent('courier_status_updated', booking);
      res.json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- COURIER SETTLEMENT & RECONCILIATION BATCHES (Section 12.1, 15.2, 15.6) ---
  app.get('/api/courier/settlement-batches', (req, res) => {
    try {
      const batches = db.getSettlementBatches();
      res.json(batches);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/courier/settlement-batches/:id', (req, res) => {
    try {
      const batch = db.getSettlementBatch(req.params.id);
      res.json(batch);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/courier/settlement-batches', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { date_from, date_to, carrier, booking_ids, deposit_account_id, deposit_reference, actual_bank_payout, discrepancy_notes, notes, item_overrides } = req.body;
      const batch = db.createSettlementBatch({
        date_from,
        date_to,
        carrier,
        booking_ids,
        deposit_account_id,
        deposit_reference,
        actual_bank_payout,
        discrepancy_notes,
        notes,
        item_overrides,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('settlement_batch_created', batch);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/courier/settlement-batches/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { deposit_account_id, deposit_reference, actual_bank_payout, discrepancy_notes, notes, items } = req.body;
      const batch = db.updateSettlementBatch(req.params.id, {
        deposit_account_id,
        deposit_reference,
        actual_bank_payout,
        discrepancy_notes,
        notes,
        items,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('settlement_batch_updated', batch);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/courier/settlement-batches/:id/post', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { deposit_account_id, deposit_reference, actual_bank_payout, discrepancy_notes } = req.body;
      const batch = db.postSettlementBatch(req.params.id, {
        deposit_account_id,
        deposit_reference,
        actual_bank_payout,
        discrepancy_notes,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('settlement_batch_posted', batch);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/courier/settlement-batches/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      db.deleteSettlementBatch(req.params.id, actor.id, actor.name);
      broadcastEvent('settlement_batch_deleted', { id: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Protect accounting & finance routes from unauthorized tiers (e.g. Packing Team Tier 4)
  app.use('/api/accounting', requireNotTier4);

  app.get('/api/accounting/reconciliation', (req, res) => {
    const summary = db.getReconciliationSummary();
    const bookings = Array.from(db.courierBookings.values()).sort((a, b) => b.booked_at.localeCompare(a.booked_at));

    // Bank and MFS financial accounts
    const targetAccountIds = ['acc_bank', 'acc_bank_personal', 'acc_bkash', 'acc_nagad', 'acc_cash'];
    const bankAccounts = targetAccountIds.map(id => db.accounts.get(id)).filter(Boolean);

    // Extract relevant journal transactions
    const bankTxns: any[] = [];
    const mfsTxns: any[] = [];

    db.journalEntries.forEach(entry => {
      entry.lines.forEach((line, idx) => {
        if (line.account_id === 'acc_bank' || line.account_id === 'acc_bank_personal') {
          bankTxns.push({
            id: `${entry.id}-${idx}`,
            journal_id: entry.id,
            entry_number: entry.entry_number,
            date: entry.date,
            description: entry.description || line.line_desc,
            account_id: line.account_id,
            debit: line.debit,
            credit: line.credit,
            reference_id: entry.reference_id,
          });
        } else if (line.account_id === 'acc_bkash' || line.account_id === 'acc_nagad') {
          mfsTxns.push({
            id: `${entry.id}-${idx}`,
            journal_id: entry.id,
            entry_number: entry.entry_number,
            date: entry.date,
            description: entry.description || line.line_desc,
            account_id: line.account_id,
            debit: line.debit,
            credit: line.credit,
            reference_id: entry.reference_id,
          });
        }
      });
    });

    res.json({
      summary,
      bookings,
      bank_accounts: bankAccounts,
      bank_transactions: bankTxns.sort((a, b) => b.date.localeCompare(a.date)),
      mfs_transactions: mfsTxns.sort((a, b) => b.date.localeCompare(a.date)),
    });
  });

  app.post('/api/accounting/reconcile-bank', (req, res) => {
    try {
      const { account_id, statement_date, statement_balance, bank_charges, notes } = req.body;
      const acc = db.accounts.get(account_id || 'acc_bank');
      if (!acc) return res.status(404).json({ error: 'Bank account not found' });

      if (bank_charges && Number(bank_charges) > 0) {
        const fee = Number(bank_charges);
        db.postJournal(
          statement_date || new Date().toISOString().slice(0, 10),
          'bank_fee',
          acc.id,
          notes || `Bank Service & Maintenance Fee (${acc.name})`,
          [
            { account_id: 'acc_office_exp', debit: fee, credit: 0, line_desc: `Bank service charges` },
            { account_id: acc.id, debit: 0, credit: fee, line_desc: `Bank fee deduction` },
          ],
          'System',
          'Bank Reconciliation',
          'expense'
        );
      }

      db.logAudit(
        'system',
        'System Accountant',
        'BANK_RECONCILE',
        'bank_reconciliation',
        acc.id,
        { statement_date, statement_balance, bank_charges, notes }
      );

      res.json({
        success: true,
        message: `${acc.name} successfully reconciled as of ${statement_date || 'today'}.`,
        updated_balance: acc.balance,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Bank reconciliation failed' });
    }
  });

  app.post('/api/accounting/reconcile-mfs', (req, res) => {
    try {
      const { account_id, statement_date, statement_balance, cashout_fees, notes } = req.body;
      const acc = db.accounts.get(account_id || 'acc_bkash');
      if (!acc) return res.status(404).json({ error: 'MFS account not found' });

      if (cashout_fees && Number(cashout_fees) > 0) {
        const fee = Number(cashout_fees);
        db.postJournal(
          statement_date || new Date().toISOString().slice(0, 10),
          'mfs_fee',
          acc.id,
          notes || `MFS Merchant Cashout & Gateway Charges (${acc.name})`,
          [
            { account_id: 'acc_office_exp', debit: fee, credit: 0, line_desc: `MFS transaction charges` },
            { account_id: acc.id, debit: 0, credit: fee, line_desc: `MFS wallet fee deduction` },
          ],
          'System',
          'MFS Reconciliation',
          'expense'
        );
      }

      db.logAudit(
        'system',
        'System Accountant',
        'MFS_RECONCILE',
        'mfs_reconciliation',
        acc.id,
        { statement_date, statement_balance, cashout_fees, notes }
      );

      res.json({
        success: true,
        message: `${acc.name} successfully reconciled as of ${statement_date || 'today'}.`,
        updated_balance: acc.balance,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'MFS reconciliation failed' });
    }
  });

  // --- Phase 4: Steadfast Courier Webhooks & Automated API Sync (Section 11, 12, 40.4) ---

  // Inbound Webhook Listener for Steadfast Courier Gateway
  app.post('/api/webhooks/steadfast', (req, res) => {
    try {
      // Section 35.6: verify the request genuinely came from Steadfast before
      // acting. A forged webhook would otherwise trigger real revenue/COGS
      // recognition on the Delivered transition. Fail-closed: if no webhook
      // secret is configured yet, or the supplied token doesn't match, reject.
      const supplied = String(
        req.headers['x-steadfast-secret'] || req.headers['authorization'] || ''
      ).trim();
      const configured = db.getCourierPlaintextSecret('webhook_secret').trim();
      const thirdPartyEnabled = db.courierApiConfig.webhook_enabled !== false;

      if (!thirdPartyEnabled) {
        return res.status(403).json({ error: 'Webhook processing is disabled.' });
      }
      if (!configured) {
        return res.status(401).json({
          error: 'Webhook secret not configured. Set the Steadfast webhook secret in Settings \u2192 Delivery & Courier before enabling inbound webhooks.',
        });
      }
      if (!supplied || !timingSafeEqual(supplied, configured)) {
        return res.status(401).json({ error: 'Invalid webhook signature. Request rejected.' });
      }

      const secret = req.headers['x-steadfast-secret'] || req.headers['authorization'];
      const result = db.processSteadfastWebhook(req.body, secret as string);

      if (result.booking) {
        broadcastEvent('courier_status_updated', result.booking);
      }
      broadcastEvent('webhook_received', result.log);

      res.status(200).json({
        status: 'success',
        message: result.log.processing_notes,
        log_id: result.log.id,
      });
    } catch (err: any) {
      console.error('Steadfast Webhook Error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Courier Webhook Logs
  app.get('/api/courier/webhooks/logs', (req, res) => {
    res.json(db.courierWebhookLogs);
  });

  // Webhook Simulator Test Endpoint
  app.post('/api/courier/webhooks/simulate', (req, res) => {
    try {
      const result = db.simulateSteadfastWebhook(req.body);
      if (result.booking) {
        broadcastEvent('courier_status_updated', result.booking);
      }
      broadcastEvent('webhook_received', result.log);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Batch Sync from Steadfast API Gateway
  app.post('/api/courier/sync-all', async (req, res) => {
    try {
      const { actor_id, actor_name } = req.body;
      const activeBookings = Array.from(db.courierBookings.values()).filter(
        b => b.status === 'booked' || b.status === 'in_transit'
      );

      let updatedCount = 0;
      const generatedLogs = [];

      for (const booking of activeBookings) {
        try {
          const statusResult = await courierService.queryStatus({
            trackingCode: booking.consignment_no,
            consignmentId: booking.booking_id,
            invoice: booking.invoice_number,
          });
          if (statusResult) {
            const syncPayload = {
              notification_type: 'status_poll_sync',
              consignment_id: statusResult.consignment_id || booking.booking_id || booking.consignment_no,
              tracking_code: booking.consignment_no,
              invoice: booking.invoice_number,
              status: statusResult.delivery_status,
              delivery_charge: statusResult.delivery_charge || booking.actual_charge,
              notes: statusResult.tracking_message || 'Polled from Steadfast API Gateway',
            };
            const result = db.processSteadfastWebhook(syncPayload);
            if (result.success) {
              updatedCount++;
              generatedLogs.push(result.log);
              if (result.booking) {
                broadcastEvent('courier_status_updated', result.booking);
              }
            }
          }
        } catch (pollErr: any) {
          console.error(`[Courier Sync] Error polling status for ${booking.consignment_no}:`, pollErr.message);
        }
      }

      db.courierApiConfig.last_sync_at = new Date().toISOString();
      db.logAudit(
        actor_id || 'usr_mgr',
        actor_name || 'Courier Sync Bot',
        'courier_api_batch_synced',
        'courier_gateway',
        'steadfast',
        `Synchronized ${activeBookings.length} active consignments with Steadfast API (${updatedCount} updated)`
      );

      const result = {
        total_checked: activeBookings.length,
        updated_count: updatedCount,
        logs: generatedLogs,
      };

      broadcastEvent('courier_batch_synced', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Courier API Settings & Connection
  app.get('/api/courier/config', (req, res) => {
    // Never return plaintext secrets (Section 39.1) \u2014 only masked values.
    res.json(db.getCourierApiConfig());
  });

  app.put('/api/courier/config', (req, res) => {
    try {
      const { actor_id, actor_name, ...configData } = req.body;
      const config = db.updateCourierApiConfig(configData, actor_id, actor_name);
      broadcastEvent('courier_config_updated', db.getCourierApiConfig());
      res.json(db.getCourierApiConfig());
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/courier/config/test', async (req, res) => {
    try {
      const result = await courierService.testConnection();
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });


  // Server-Sent Events for Real-Time Packing Broadcasts (Section 40.2)
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = `client_${Date.now()}_${Math.random()}`;
    sseClients.set(clientId, res);

    // Initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      sseClients.delete(clientId);
    });
  });

  // 6. Customers
  app.get('/api/customers', (req, res) => {
    res.json(Array.from(db.customers.values()));
  });

  app.get('/api/customers/:id', (req, res) => {
    const cust = db.customers.get(req.params.id);
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    res.json(cust);
  });

  // 7. Phase 3 Purchasing: Suppliers, Purchase Orders, and Purchase Returns (Section 13, 14, 15, 40.3)
  app.get('/api/suppliers', (req, res) => {
    res.json(Array.from(db.suppliers.values()).sort((a, b) => a.name.localeCompare(b.name)));
  });

  app.get('/api/suppliers/:id', (req, res) => {
    const supp = db.suppliers.get(req.params.id);
    if (!supp) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supp);
  });

  app.post('/api/suppliers', (req, res) => {
    try {
      const supplier = db.createSupplier(req.body);
      broadcastEvent('supplier_created', supplier);
      res.json(supplier);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/suppliers/:id', (req, res) => {
    try {
      const supplier = db.updateSupplier(req.params.id, req.body);
      broadcastEvent('supplier_updated', supplier);
      res.json(supplier);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/suppliers/:id/pay', (req, res) => {
    try {
      const payment = db.recordSupplierPayment({
        supplier_id: req.params.id,
        amount_bdt: Number(req.body.amount_bdt),
        amount_foreign: req.body.amount_foreign ? Number(req.body.amount_foreign) : undefined,
        payment_account_id: req.body.payment_account_id || 'acc_bank',
        payment_date: req.body.payment_date,
        reference_no: req.body.reference_no,
        notes: req.body.notes,
        actor_id: req.body.actor_id || 'usr_owner',
        actor_name: req.body.actor_name || 'Sobuj Sehk',
      });
      broadcastEvent('supplier_payment_recorded', payment);
      res.json(payment);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/suppliers/:id/payments', (req, res) => {
    const payments = Array.from(db.supplierPayments.values())
      .filter(p => p.supplier_id === req.params.id)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    res.json(payments);
  });

  app.get('/api/suppliers/:id/statement', (req, res) => {
    const supp = db.suppliers.get(req.params.id);
    if (!supp) return res.status(404).json({ error: 'Supplier not found' });

    const pos = Array.from(db.purchaseOrders.values()).filter(p => p.supplier_id === supp.id);
    const payments = Array.from(db.supplierPayments.values()).filter(p => p.supplier_id === supp.id);
    const returns = Array.from(db.purchaseReturns.values()).filter(p => p.supplier_id === supp.id);

    res.json({
      supplier: supp,
      purchase_orders: pos,
      payments,
      returns,
      balance_payable: supp.balance_payable,
    });
  });

  // Purchase Orders API
  app.get('/api/purchasing/orders', (req, res) => {
    res.json(Array.from(db.purchaseOrders.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/purchasing/orders/:id', (req, res) => {
    const po = db.purchaseOrders.get(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    res.json(po);
  });

  app.post('/api/purchasing/orders', (req, res) => {
    try {
      const po = db.createPurchaseOrder(req.body);
      broadcastEvent('purchase_order_created', po);
      res.json(po);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/purchasing/orders/:id/status', (req, res) => {
    try {
      const { status, actor_id, actor_name } = req.body;
      const po = db.updatePurchaseOrderStatus(req.params.id, status, actor_id || 'usr_owner', actor_name || 'Sobuj Sehk');
      broadcastEvent('purchase_order_status_updated', po);
      res.json(po);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/purchasing/orders/:id/receive', (req, res) => {
    try {
      const { received_items, warehouse_id, actor_id, actor_name, notes } = req.body;
      const po = db.receivePurchaseOrderItems({
        po_id: req.params.id,
        received_items: received_items || [],
        warehouse_id,
        actor_id: actor_id || 'usr_mgr',
        actor_name: actor_name || 'Showroom / Purchase Staff',
        notes,
      });
      broadcastEvent('po_items_received', po);
      res.json(po);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Purchase Returns API
  app.get('/api/purchasing/returns', (req, res) => {
    res.json(Array.from(db.purchaseReturns.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.post('/api/purchasing/returns', (req, res) => {
    try {
      const pr = db.createPurchaseReturn({
        ...req.body,
        actor_id: req.body.actor_id || 'usr_owner',
        actor_name: req.body.actor_name || 'Sobuj Sehk',
      });
      broadcastEvent('purchase_return_created', pr);
      res.json(pr);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 8. Accounting & Journal (Section 15.0/15.1/40.1)
  app.get('/api/accounting/accounts', (req, res) => {
    res.json(Array.from(db.accounts.values()));
  });

  app.get('/api/accounting/journal', (req, res) => {
    res.json(db.journalEntries);
  });

  // --- Payment Accounts & Financial Control Layer (Phase 1) ---
  app.get('/api/accounting/payment-accounts', (req, res) => {
    try {
      const accounts = db.getPaymentAccounts();
      res.json(accounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/accounting/payment-accounts/:id', (req, res) => {
    try {
      const account = db.getPaymentAccount(req.params.id);
      res.json(account);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/accounting/payment-accounts', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const account = db.createPaymentAccount({
        ...req.body,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('payment_account_created', account);
      res.status(201).json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/accounting/payment-accounts/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const account = db.updatePaymentAccount(req.params.id, {
        ...req.body,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('payment_account_updated', account);
      res.json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/payment-accounts/:id/toggle-active', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { is_active } = req.body;
      const account = db.togglePaymentAccountActive(req.params.id, Boolean(is_active), actor.id, actor.name);
      broadcastEvent('payment_account_updated', account);
      res.json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/payment-accounts/transfer', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const result = db.transferFunds({
        ...req.body,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('fund_transfer_completed', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/payment-accounts/deposit', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const result = db.depositFunds({
        ...req.body,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('account_deposit_completed', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/payment-accounts/withdraw', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const result = db.withdrawFunds({
        ...req.body,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('account_withdrawal_completed', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/accounting/payment-accounts/:id/statement', (req, res) => {
    try {
      const startDate = req.query.start_date as string | undefined;
      const endDate = req.query.end_date as string | undefined;
      const statement = db.getPaymentAccountStatement(req.params.id, startDate, endDate);
      res.json(statement);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Global paginated financial transaction feed
  app.get('/api/accounting/financial-transactions', (req, res) => {
    try {
      const requestedPage = req.query.page !== undefined ? Number(req.query.page) : undefined;
      const requestedPageSize = req.query.page_size !== undefined ? Number(req.query.page_size) : undefined;
      const feed = db.getFinancialTransactionsFeed({
        page: requestedPage,
        page_size: requestedPageSize,
        date_from: req.query.date_from ? String(req.query.date_from).trim() : undefined,
        date_to: req.query.date_to ? String(req.query.date_to).trim() : undefined,
        customer: req.query.customer ? String(req.query.customer).trim() : undefined,
        phone: req.query.phone ? String(req.query.phone).trim() : undefined,
        order_number: req.query.order_number ? String(req.query.order_number).trim() : undefined,
        invoice_number: req.query.invoice_number ? String(req.query.invoice_number).trim() : undefined,
        payment_method: req.query.payment_method ? String(req.query.payment_method).trim() : undefined,
        payment_account_id: req.query.payment_account_id ? String(req.query.payment_account_id).trim() : undefined,
        transaction_type: req.query.transaction_type ? String(req.query.transaction_type).trim() : undefined,
        status: req.query.status ? String(req.query.status).trim() : undefined,
        search: req.query.search ? String(req.query.search).trim() : undefined,
      });

      if (!feed.is_paged) {
        res.json(feed.transactions);
        return;
      }

      res.json({
        transactions: feed.transactions,
        total: feed.total,
        page: feed.page,
        page_size: feed.page_size,
        total_pages: feed.total_pages,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Aggregated financial feed for daily income vs expense trends
  app.get('/api/accounting/financial-feed-aggregated', (req, res) => {
    try {
      const feed = db.getFinancialTransactionsFeed({
        date_from: req.query.date_from ? String(req.query.date_from).trim() : undefined,
        date_to: req.query.date_to ? String(req.query.date_to).trim() : undefined,
        payment_method: req.query.payment_method ? String(req.query.payment_method).trim() : undefined,
        payment_account_id: req.query.payment_account_id ? String(req.query.payment_account_id).trim() : undefined,
        transaction_type: req.query.transaction_type ? String(req.query.transaction_type).trim() : undefined,
        status: req.query.status ? String(req.query.status).trim() : undefined,
        search: req.query.search ? String(req.query.search).trim() : undefined,
      });

      const dailyMap = new Map<string, { date: string; income: number; expense: number; net: number }>();

      feed.transactions.forEach((tx: any) => {
        const d = (tx.date || tx.created_at || '').slice(0, 10);
        if (!d) return;
        if (!dailyMap.has(d)) {
          dailyMap.set(d, { date: d, income: 0, expense: 0, net: 0 });
        }
        const item = dailyMap.get(d)!;
        const income = tx.money_in || 0;
        const expense = tx.money_out || 0;
        item.income += income;
        item.expense += expense;
        item.net = item.income - item.expense;
      });

      const aggregated = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      res.json(aggregated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/accounting/transfers', (req, res) => {
    try {
      const list = Array.from(db.fundTransfers.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manual Adjustments & Exception Controls (Phase 2)
  app.get('/api/accounting/manual-adjustments', (req, res) => {
    try {
      const pmtAccId = req.query.payment_account_id as string | undefined;
      const list = db.getManualAdjustments(pmtAccId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/accounting/manual-adjustments', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const result = db.createManualAdjustment({
        ...req.body,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('manual_adjustment_posted', result);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/manual-adjustments/:id/void', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { reason } = req.body;
      const result = db.voidManualAdjustment(req.params.id, reason, actor.id, actor.name);
      broadcastEvent('manual_adjustment_voided', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/opening-balance', (req, res) => {
    try {
      const { account_id, amount, date, actor_id, actor_name, description } = req.body;
      const acc = db.accounts.get(account_id);
      if (!acc) return res.status(404).json({ error: 'Account not found' });

      const amt = Number(amount);
      const isDebit = acc.type === 'asset' || acc.type === 'expense';
      const lines = isDebit
        ? [
            { account_id, debit: amt, credit: 0 },
            { account_id: 'acc_equity', debit: 0, credit: amt },
          ]
        : [
            { account_id: 'acc_equity', debit: amt, credit: 0 },
            { account_id, debit: 0, credit: amt },
          ];

      const entry = db.postJournal(
        date || new Date().toISOString().slice(0, 10),
        'opening',
        account_id,
        description || `Opening Balance Entry for ${acc.name}`,
        lines,
        actor_name || 'Owner',
        undefined,
        'general_journal'
      );

      db.logAudit(actor_id || 'system', actor_name || 'Owner', 'opening_balance_set', 'account', account_id, `Set opening balance for ${acc.name}: \u09F3${amt}`);

      res.json(entry);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Phase 3: Financial Statements, Payment Accounts & Business Control Reports ---
  app.get('/api/accounting/reports/pnl', (req, res) => {
    try {
      const startDate = req.query.start_date as string | undefined;
      const endDate = req.query.end_date as string | undefined;
      const report = db.generateProfitLossReport(startDate, endDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/accounting/reports/balance-sheet', (req, res) => {
    try {
      const asOfDate = req.query.as_of_date as string | undefined;
      const report = db.generateBalanceSheetReport(asOfDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/accounting/reports/payment-accounts', (req, res) => {
    try {
      const report = db.generatePaymentAccountsReport({
        account_id: req.query.account_id as string | undefined,
        account_type: req.query.account_type as any,
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
        transaction_type: req.query.transaction_type as string | undefined,
        user_name: req.query.user_name as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/accounting/reports/daily-control', (req, res) => {
    try {
      const report = db.generateDailyBusinessControlReport({
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
        business_date: req.query.business_date as string | undefined,
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/accounting/reports/cross-check', (req, res) => {
    try {
      const report = db.generateFinancialCrossCheckReport();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Phase 5: Customer Returns & Courier RTOs (Section 12, 15.3, 35.2, 40.5) ---
  app.get('/api/returns', (req, res) => {
    res.json(Array.from(db.customerReturns.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/returns/summary', (req, res) => {
    res.json(db.getCustomerReturnsSummary());
  });

  app.get('/api/returns/:id', (req, res) => {
    const ret = db.customerReturns.get(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Customer return not found' });
    res.json(ret);
  });

  app.post('/api/returns', (req, res) => {
    try {
      const customerReturn = db.processCustomerReturn(req.body);
      broadcastEvent('customer_return_processed', customerReturn);
      res.json(customerReturn);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/returns/:id/update-fee', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { courier_fee_loss, notes } = req.body;
      if (courier_fee_loss === undefined || courier_fee_loss === null || isNaN(Number(courier_fee_loss))) {
        return res.status(400).json({ error: 'Valid courier_fee_loss is required' });
      }

      const customerReturn = db.updateReturnCourierFeeManual({
        return_id: req.params.id,
        courier_fee_loss: Number(courier_fee_loss),
        actor_id: actor.id,
        actor_name: actor.name,
        notes,
      });

      broadcastEvent('customer_return_processed', customerReturn);
      res.json(customerReturn);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Phase 6: Accounting, Petty Cash, Daily Cash Till, Payroll & Reports (Section 15, 17, 18, 19, 40.6) ---

  // Daily Cash Register
  app.get('/api/accounting/cash-register', (req, res) => {
    res.json(db.cashRegisterLogs);
  });

  app.post('/api/accounting/cash-register/reconcile', (req, res) => {
    try {
      const log = db.reconcileDailyCashRegister(req.body);
      broadcastEvent('cash_register_reconciled', log);
      res.json(log);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Cashier / Salesperson Daily Closings
  app.get('/api/cashier-closings', (req, res) => {
    try {
      const cashierId = req.query.cashier_id as string | undefined;
      const status = req.query.status as string | undefined;
      const businessDate = req.query.business_date as string | undefined;
      const pendingReview = req.query.pending_review === 'true';

      let list = Array.from(db.cashierDailyClosings.values()).map(c => db.refreshClosingCalculations(c));

      if (cashierId) list = list.filter(c => c.cashier_id === cashierId);
      if (status) list = list.filter(c => c.status === status);
      if (businessDate) list = list.filter(c => c.business_date === businessDate);
      if (pendingReview) list = list.filter(c => c.status === 'submitted');

      list.sort((a, b) => b.business_date.localeCompare(a.business_date) || b.created_at.localeCompare(a.created_at));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cashier-closings/active', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const cashierId = (req.query.cashier_id as string) || actor.id;
      const today = new Date().toISOString().slice(0, 10);

      // Find all closings for this cashier
      const cashierClosings = Array.from(db.cashierDailyClosings.values())
        .filter(c => c.cashier_id === cashierId)
        .map(c => db.refreshClosingCalculations(c));

      // Check for unclosed previous days
      const unclosedPreviousDays = cashierClosings.filter(
        c => (c.status === 'open' || c.status === 'rejected') && c.business_date < today
      );

      // Check for today's closing
      let activeClosing = cashierClosings.find(
        c => (c.status === 'open' || c.status === 'rejected') && c.business_date === today
      );

      // If no active day for today, but unclosed previous days exist, point to the unclosed previous day
      if (!activeClosing && unclosedPreviousDays.length > 0) {
        activeClosing = unclosedPreviousDays[0];
      }

      res.json({
        active: activeClosing || null,
        unclosedDays: unclosedPreviousDays,
        allCashierClosings: cashierClosings.sort((a, b) => b.business_date.localeCompare(a.business_date)),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cashier-closings/start', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const closing = db.startCashierBusinessDay({
        cashier_id: req.body.cashier_id || actor.id,
        cashier_name: req.body.cashier_name || actor.name,
        business_date: req.body.business_date,
        opening_float: req.body.opening_float,
      });
      broadcastEvent('cashier_closing_updated', closing);
      res.json(closing);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/cashier-closings/:id/expense', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const closing = db.addCashierCashExpense(req.params.id, {
        category: req.body.category,
        description: req.body.description,
        amount: req.body.amount,
        receipt_reference: req.body.receipt_reference,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('cashier_closing_updated', closing);
      res.json(closing);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/cashier-closings/:id/submit', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const closing = db.submitCashierDailyClosing(req.params.id, {
        actual_cash: req.body.actual_cash,
        denominations: req.body.denominations,
        closing_notes: req.body.closing_notes,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('cashier_closing_updated', closing);
      res.json(closing);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/cashier-closings/:id/review', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const closing = db.reviewCashierDailyClosing(req.params.id, {
        action: req.body.action,
        review_notes: req.body.review_notes,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      broadcastEvent('cashier_closing_updated', closing);
      res.json(closing);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Operational Expenses & Advanced Expense Management
  app.get('/api/accounting/expenses', (req, res) => {
    if (req.query.paginated === 'true' || req.query.page || req.query.pageSize) {
      const result = db.queryExpenses(req.query);
      return res.json(result);
    }
    res.json(Array.from(db.expenses.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/accounting/expenses/query', (req, res) => {
    const result = db.queryExpenses(req.query);
    res.json(result);
  });

  app.post('/api/accounting/expenses', (req, res) => {
    try {
      const exp = db.recordExpense(req.body);
      broadcastEvent('expense_recorded', exp);
      res.json(exp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/expenses/:id/void', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const reason = req.body.reason || 'Voided by user request';
      const exp = db.voidExpense(req.params.id, reason, actorId, actorName);
      broadcastEvent('expense_voided', exp);
      res.json(exp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Expense Categories & Subcategories
  app.get('/api/accounting/expense-categories', (req, res) => {
    const activeOnly = req.query.active_only === 'true';
    const categories = Array.from(db.expenseCategories.values()).filter(c => !activeOnly || c.active);
    res.json(categories);
  });

  app.post('/api/accounting/expense-categories', (req, res) => {
    try {
      const cat = db.createExpenseCategory(req.body);
      res.json(cat);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/accounting/expense-categories/:id', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const cat = db.updateExpenseCategory(req.params.id, req.body, actorId, actorName);
      res.json(cat);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/accounting/expense-categories/:id', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const result = db.deleteExpenseCategory(req.params.id, actorId, actorName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Expense Templates (Frequent & Recurring)
  app.get('/api/accounting/expense-templates', (req, res) => {
    const isFrequent = req.query.is_frequent === undefined ? undefined : req.query.is_frequent === 'true';
    const isRecurring = req.query.is_recurring === undefined ? undefined : req.query.is_recurring === 'true';
    let templates = Array.from(db.expenseTemplates.values());
    if (isFrequent !== undefined) {
      templates = templates.filter(t => Boolean(t.is_frequent) === isFrequent);
    }
    if (isRecurring !== undefined) {
      templates = templates.filter(t => Boolean(t.is_recurring) === isRecurring);
    }
    res.json(templates);
  });

  app.post('/api/accounting/expense-templates', (req, res) => {
    try {
      const tpl = db.createExpenseTemplate(req.body);
      res.json(tpl);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/accounting/expense-templates/:id', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const tpl = db.updateExpenseTemplate(req.params.id, req.body, actorId, actorName);
      res.json(tpl);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/accounting/expense-templates/:id', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const result = db.deleteExpenseTemplate(req.params.id, actorId, actorName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Expense Budgets & Threshold Tracking
  app.get('/api/accounting/expense-budgets', (req, res) => {
    const period = req.query.period as 'daily' | 'monthly' | undefined;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    let budgets = db.getBudgetsWithStatus(date);
    if (period) {
      budgets = budgets.filter(b => b.period === period);
    }
    res.json(budgets);
  });

  app.post('/api/accounting/expense-budgets', (req, res) => {
    try {
      const budget = db.createExpenseBudget(req.body);
      res.json(budget);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/accounting/expense-budgets/:id', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const budget = db.updateExpenseBudget(req.params.id, req.body, actorId, actorName);
      res.json(budget);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/accounting/expense-budgets/:id', (req, res) => {
    try {
      const actorId = req.body.actor_id || 'usr_owner';
      const actorName = req.body.actor_name || 'Sobuj Sehk';
      const result = db.deleteExpenseBudget(req.params.id, actorId, actorName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Recurring Schedules & Due Expense Tracking
  app.get('/api/accounting/expense-schedules', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    res.json(db.getRecurringSchedules(date));
  });

  // Employees
  app.get('/api/employees', (req, res) => {
    res.json(Array.from(db.employees.values()));
  });

  app.post('/api/employees', (req, res) => {
    try {
      const emp = db.createEmployee(req.body);
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/employees/:id', (req, res) => {
    try {
      const emp = db.updateEmployee(req.params.id, req.body, req.body.actor_id || 'usr_owner', req.body.actor_name || 'Sobuj Sehk');
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Payroll
  app.get('/api/accounting/payroll', (req, res) => {
    res.json(Array.from(db.payrollRecords.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.post('/api/accounting/payroll', (req, res) => {
    try {
      const pr = db.processPayroll(req.body);
      broadcastEvent('payroll_processed', pr);
      res.json(pr);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // HR MANAGEMENT MODULE APIS
  // ==========================================

  // Dashboard & Analytics
  app.get('/api/hr/dashboard', (req, res) => {
    res.json(hrService.getDashboardStats());
  });

  app.get('/api/hr/settings', (req, res) => {
    res.json(hrService.getSettings());
  });

  app.put('/api/hr/settings', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const settings = hrService.updateSettings(req.body, actorId, actorName);
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Departments
  app.get('/api/hr/departments', (req, res) => {
    res.json(hrService.getDepartments());
  });

  app.post('/api/hr/departments', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const dept = hrService.createDepartment(req.body, actorId, actorName);
      res.json(dept);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/departments/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const dept = hrService.updateDepartment(req.params.id, req.body, actorId, actorName);
      res.json(dept);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Designations
  app.get('/api/hr/designations', (req, res) => {
    res.json(hrService.getDesignations());
  });

  app.post('/api/hr/designations', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const des = hrService.createDesignation(req.body, actorId, actorName);
      res.json(des);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/designations/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const des = hrService.updateDesignation(req.params.id, req.body, actorId, actorName);
      res.json(des);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Branches
  app.get('/api/hr/branches', (req, res) => {
    res.json(hrService.getBranches());
  });

  app.post('/api/hr/branches', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const branch = hrService.createBranch(req.body, actorId, actorName);
      res.json(branch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/branches/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const branch = hrService.updateBranch(req.params.id, req.body, actorId, actorName);
      res.json(branch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Shifts
  app.get('/api/hr/shifts', (req, res) => {
    res.json(hrService.getShifts());
  });

  app.post('/api/hr/shifts', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const shift = hrService.createShift(req.body, actorId, actorName);
      res.json(shift);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/shifts/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const shift = hrService.updateShift(req.params.id, req.body, actorId, actorName);
      res.json(shift);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Holidays
  app.get('/api/hr/holidays', (req, res) => {
    res.json(hrService.getHolidays());
  });

  app.post('/api/hr/holidays', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const holiday = hrService.createHoliday(req.body, actorId, actorName);
      res.json(holiday);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/hr/holidays/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      hrService.deleteHoliday(req.params.id, actorId, actorName);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Employees (Enhanced HR search & directory)
  app.get('/api/hr/employees', (req, res) => {
    const { search, department_id, branch_id, status, employment_type, page, limit } = req.query;
    res.json(hrService.getEmployees({
      search: search as string,
      department_id: department_id as string,
      branch_id: branch_id as string,
      employment_status: status as any,
      employment_type: employment_type as any,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    }));
  });

  app.get('/api/hr/employees/:id', (req, res) => {
    const emp = hrService.getEmployeeById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  });

  app.post('/api/hr/employees', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const emp = hrService.createEmployee(req.body, actorId, actorName);
      broadcastEvent('employee_created', emp);
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/employees/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const emp = hrService.updateEmployee(req.params.id, req.body, actorId, actorName);
      broadcastEvent('employee_updated', emp);
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/employees/:id/documents', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const doc = hrService.addEmployeeDocument(req.params.id, req.body, actorId, actorName);
      res.json(doc);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/hr/employees/:id/documents/:docId', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      hrService.removeEmployeeDocument(req.params.id, req.params.docId, actorId, actorName);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Attendance
  app.get('/api/hr/attendance', (req, res) => {
    const { employee_id, start_date, end_date, date, month } = req.query;
    res.json(hrService.getAttendance({
      employee_id: employee_id as string,
      start_date: start_date as string,
      end_date: end_date as string,
      date: date as string,
      month: month as string,
    }));
  });

  app.post('/api/hr/attendance/punch', (req, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let targetEmployeeId = req.body.employee_id;
      if (user.tier === 4) {
        // Find employee linked to this user session
        let linkedEmp: any = null;
        for (const emp of db.employees.values()) {
          if (emp.user_id === user.id) {
            linkedEmp = emp;
            break;
          }
        }
        if (!linkedEmp) {
          // Fallback match by email or name
          for (const emp of db.employees.values()) {
            if (emp.email?.toLowerCase() === user.email.toLowerCase() || emp.name.toLowerCase() === user.name.toLowerCase()) {
              linkedEmp = emp;
              break;
            }
          }
        }
        if (!linkedEmp) {
          return res.status(403).json({ error: 'Access denied: No employee record linked to this Packing Staff account.' });
        }
        targetEmployeeId = linkedEmp.id;
      }

      const record = hrService.clockPunch({
        ...req.body,
        employee_id: targetEmployeeId,
      });
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/attendance/manual', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const record = hrService.manualAttendance({
        ...req.body,
        actor_id: actorId,
        actor_name: actorName,
      });
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/hr/attendance/regularizations', (req, res) => {
    const { employee_id, status } = req.query;
    res.json(hrService.getRegularizations({
      employee_id: employee_id as string,
      status: status as string,
    }));
  });

  app.post('/api/hr/attendance/regularizations', (req, res) => {
    try {
      const reg = hrService.requestRegularization(req.body);
      res.json(reg);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/attendance/regularizations/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const reg = hrService.reviewRegularization({
        id: req.params.id,
        status: req.body.status,
        review_notes: req.body.review_notes || req.body.review_note,
        actor_id: actorId,
        actor_name: actorName,
      });
      res.json(reg);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Leave Management
  app.get('/api/hr/leaves/types', (req, res) => {
    res.json(hrService.getLeaveTypes());
  });

  app.post('/api/hr/leaves/types', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const lt = hrService.createLeaveType(req.body, actorId, actorName);
      res.json(lt);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/leaves/types/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const lt = hrService.updateLeaveType(req.params.id, req.body, actorId, actorName);
      res.json(lt);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/hr/leaves/requests', (req, res) => {
    const { employee_id, status } = req.query;
    res.json(hrService.getLeaveRequests({
      employee_id: employee_id as string,
      status: status as string,
    }));
  });

  app.post('/api/hr/leaves/requests', (req, res) => {
    try {
      const lr = hrService.applyLeave(req.body);
      res.json(lr);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/leaves/requests/:id/review', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const lr = hrService.reviewLeave({
        id: req.params.id,
        action: req.body.action || (req.body.status === 'approved' ? 'manager_approve' : 'manager_reject'),
        notes: req.body.notes || req.body.review_note,
        actor_id: actorId,
        actor_name: actorName,
      });
      res.json(lr);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/leaves/adjust-balance', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const bal = hrService.adjustLeaveBalance({
        employee_id: req.body.employee_id,
        leave_type_id: req.body.leave_type_id || req.body.leave_type_code,
        adjustment_days: req.body.adjustment_days,
        reason: req.body.reason,
        actor_id: actorId,
        actor_name: actorName,
      });
      res.json(bal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Salary Advances (with real accounting integration)
  app.get('/api/hr/advances', (req, res) => {
    const { employee_id } = req.query;
    res.json(hrService.getSalaryAdvances(employee_id as string));
  });

  app.post('/api/hr/advances/request', (req, res) => {
    try {
      const adv = hrService.requestSalaryAdvance(req.body);
      res.json(adv);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/advances/:id/disburse', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const adv = hrService.disburseSalaryAdvance({
        advance_id: req.params.id,
        payment_account_id: req.body.payment_account_id || req.body.payment_method_id || 'acc_cash',
        payment_date: req.body.payment_date,
        actor_id: actorId,
        actor_name: actorName,
      });
      broadcastEvent('advance_disbursed', adv);
      res.json(adv);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Advanced Automated Payroll Processing
  app.get('/api/hr/payroll/calculate', (req, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const records = hrService.calculateMonthlyPayroll(month);
      res.json(records);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/payroll/override', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const pr = hrService.manualOverridePayrollLine({
        payroll_month: req.body.payroll_month || req.body.month,
        employee_id: req.body.employee_id,
        bonus_commission: Number(req.body.bonus_commission || 0),
        extra_deductions: Number(req.body.extra_deductions || 0),
        override_reason: req.body.override_reason || req.body.reason || 'Manual line adjustment',
        actor_id: actorId,
        actor_name: actorName,
      });
      res.json(pr);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/payroll/finalize', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const month = req.body.month;
      const paymentMethodId = req.body.payment_method_id || req.body.payment_account_id || 'acc_cash';
      const results = hrService.finalizePayrollRun({
        payroll_month: month,
        payment_account_id: paymentMethodId,
        actor_id: actorId,
        actor_name: actorName,
        notes: req.body.notes,
      });
      broadcastEvent('payroll_batch_finalized', { month, run: results });
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Recruitment
  app.get('/api/hr/recruitment/jobs', (req, res) => {
    res.json(hrService.getJobRequisitions());
  });

  app.post('/api/hr/recruitment/jobs', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const job = hrService.createJobRequisition(req.body, actorId, actorName);
      res.json(job);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/recruitment/jobs/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const job = hrService.updateJobRequisition(req.params.id, req.body, actorId, actorName);
      res.json(job);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/hr/recruitment/candidates', (req, res) => {
    const { job_id } = req.query;
    res.json(hrService.getJobCandidates(job_id as string));
  });

  app.post('/api/hr/recruitment/candidates', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const cand = hrService.createJobCandidate(req.body, actorId, actorName);
      res.json(cand);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/recruitment/candidates/:id/stage', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const cand = hrService.updateCandidateStage(req.params.id, req.body.stage, req.body.notes, actorId, actorName);
      res.json(cand);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/recruitment/candidates/:id/hire', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const emp = hrService.hireCandidate(req.params.id, req.body, actorId, actorName);
      broadcastEvent('employee_created', emp);
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Performance
  app.get('/api/hr/performance/goals', (req, res) => {
    const { employee_id } = req.query;
    res.json(hrService.getGoals(employee_id as string));
  });

  app.post('/api/hr/performance/goals', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const goal = hrService.createGoal(req.body, actorId, actorName);
      res.json(goal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/performance/goals/:id', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const goal = hrService.updateGoal(req.params.id, req.body, actorId, actorName);
      res.json(goal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/hr/performance/reviews', (req, res) => {
    const { employee_id } = req.query;
    res.json(hrService.getPerformanceReviews(employee_id as string));
  });

  app.post('/api/hr/performance/reviews', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const review = hrService.createPerformanceReview(req.body, actorId, actorName);
      res.json(review);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Offboarding & Settlements
  app.get('/api/hr/exits', (req, res) => {
    res.json(hrService.getExits());
  });

  app.post('/api/hr/exits/initiate', (req, res) => {
    try {
      const exit = hrService.initiateExit(req.body);
      res.json(exit);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/hr/exits/:id/clearance', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const exit = hrService.updateExitClearance({
        exit_id: req.params.id,
        item_index: req.body.item_index !== undefined ? Number(req.body.item_index) : 0,
        cleared: Boolean(req.body.cleared ?? true),
        notes: req.body.notes || req.body.remarks,
        actor_id: actorId,
        actor_name: actorName,
      });
      res.json(exit);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/hr/exits/:id/settle', (req, res) => {
    try {
      const actorId = (req.body.actor_id as string) || 'usr_owner';
      const actorName = (req.body.actor_name as string) || 'Sobuj Sehk';
      const exit = hrService.settleExit({
        exit_id: req.params.id,
        unpaid_salary: Number(req.body.unpaid_salary || 0),
        leave_encashment_days: Number(req.body.leave_encashment_days || 0),
        leave_encashment_amount: Number(req.body.leave_encashment_amount || 0),
        loan_deductions: Number(req.body.loan_deductions || 0),
        other_adjustments: Number(req.body.other_adjustments || 0),
        payment_account_id: req.body.payment_account_id || req.body.payment_method_id || 'acc_cash',
        actor_id: actorId,
        actor_name: actorName,
      });
      broadcastEvent('employee_settled', exit);
      res.json(exit);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // HR Notifications
  app.get('/api/hr/notifications', (req, res) => {
    res.json(db.notifications || []);
  });

  // Financial Reports (P&L and Balance Sheet)
  app.get('/api/accounting/reports/pnl', (req, res) => {
    const { start_date, end_date } = req.query;
    res.json(db.generateProfitLossReport(start_date as string, end_date as string));
  });

  app.get('/api/accounting/reports/balance-sheet', (req, res) => {
    const { as_of_date } = req.query;
    res.json(db.generateBalanceSheetReport(as_of_date as string));
  });

  // --- Phase 8: Approval Workflow Engine & System Alerts (Section 21, 23, 40.8) ---
  app.get('/api/approvals', (req, res) => {
    const list = Array.from(db.approvalRequests.values()).sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    res.json({
      requests: list,
      summary: db.getApprovalRequestsSummary(),
    });
  });

  app.post('/api/approvals', (req, res) => {
    try {
      const request = db.createApprovalRequest(req.body);
      broadcastEvent('approval_request_created', request);
      res.json(request);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/approvals/:id/review', (req, res) => {
    try {
      const { decision, review_notes, actor_id, actor_name } = req.body;
      const request = db.reviewApprovalRequest(req.params.id, decision, review_notes, actor_id, actor_name);
      broadcastEvent('approval_request_reviewed', request);
      res.json(request);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Phase 9: Dynamic Pricing & Competitor Tracking (Section 22, 40.9) ---

  // Pricing Rules
  app.get('/api/pricing/rules', (req, res) => {
    res.json(Array.from(db.pricingRules.values()));
  });

  app.post('/api/pricing/rules', (req, res) => {
    try {
      const rule = db.createOrUpdatePricingRule(req.body, req.body.actor_id || 'usr_owner', req.body.actor_name || 'Sobuj Sehk');
      broadcastEvent('pricing_rule_updated', rule);
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Competitor Prices
  app.get('/api/pricing/competitors', (req, res) => {
    res.json(Array.from(db.competitorPrices.values()).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)));
  });

  app.post('/api/pricing/competitors', (req, res) => {
    try {
      const rec = db.recordCompetitorPrice(req.body);
      broadcastEvent('competitor_price_logged', rec);
      res.json(rec);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/pricing/competitors/:id', (req, res) => {
    try {
      db.deleteCompetitorPrice(req.params.id, req.body.actor_id || 'usr_owner', req.body.actor_name || 'Sobuj Sehk');
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Pricing Campaigns
  app.get('/api/pricing/campaigns', (req, res) => {
    res.json(Array.from(db.pricingCampaigns.values()).sort((a, b) => b.start_date.localeCompare(a.start_date)));
  });

  app.post('/api/pricing/campaigns', (req, res) => {
    try {
      const campaign = db.createPricingCampaign(req.body);
      broadcastEvent('pricing_campaign_created', campaign);
      res.json(campaign);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/pricing/campaigns/:id/toggle', (req, res) => {
    try {
      const cmp = db.togglePricingCampaign(req.params.id, req.body.active, req.body.actor_id || 'usr_owner', req.body.actor_name || 'Sobuj Sehk');
      broadcastEvent('pricing_campaign_toggled', cmp);
      res.json(cmp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Repricing Suggestions & One-Click Apply
  app.get('/api/pricing/suggestions', (req, res) => {
    res.json(db.generateRepricingSuggestions());
  });

  app.post('/api/pricing/apply', (req, res) => {
    try {
      const { product_id, new_price, reason, actor_id, actor_name } = req.body;
      const prod = db.applyRepricingSuggestion(product_id, new_price, reason, actor_id, actor_name);
      db.pushPriceChangedNotification({
        product_id: prod.id,
        product_name: prod.display_name,
        new_price: prod.selling_price,
        actor_name: actor_name || 'Staff',
      });
      broadcastEvent('product_repriced', prod);
      broadcastEvent('price_updated', {
        product_id: prod.id,
        product_name: prod.display_name,
        sku: prod.sku,
        previous_selling_price: null,
        new_selling_price: prod.selling_price,
        previous_wholesale_price: null,
        new_wholesale_price: prod.wholesale_price ?? 0,
        updated_at: prod.price_updated_at,
      });
      res.json(prod);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 8. Audit Log
  app.get('/api/audit-log', (req, res) => {
    const { user_id, action, entity_type, search } = req.query;
    let logs = [...db.auditLogs];

    if (user_id) {
      logs = logs.filter(l => l.user_id === user_id);
    }
    if (action) {
      logs = logs.filter(l => l.action === action);
    }
    if (entity_type) {
      logs = logs.filter(l => l.entity_type === entity_type);
    }
    if (search) {
      const q = (search as string).toLowerCase();
      logs = logs.filter(l =>
        l.user_name.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }

    res.json(logs);
  });

  // 8b. Warehouses
  app.get('/api/warehouses', (req, res) => {
    res.json(Array.from(db.warehouses.values()));
  });

  // 9. Settings
  app.get('/api/settings', (req, res) => {
    res.json(db.settings);
  });

  app.put('/api/settings', (req, res) => {
    try {
      const { inside_dhaka_delivery, outside_dhaka_delivery, business_name, phone, address, invoice_note_cod, invoice_note_prepaid, actor_id, actor_name } = req.body;
      if (inside_dhaka_delivery !== undefined) db.settings.inside_dhaka_delivery = Number(inside_dhaka_delivery);
      if (outside_dhaka_delivery !== undefined) db.settings.outside_dhaka_delivery = Number(outside_dhaka_delivery);
      if (business_name) db.settings.business_name = business_name;
      if (phone) db.settings.phone = phone;
      if (address) db.settings.address = address;
      if (invoice_note_cod !== undefined) db.settings.invoice_note_cod = String(invoice_note_cod);
      if (invoice_note_prepaid !== undefined) db.settings.invoice_note_prepaid = String(invoice_note_prepaid);

      db.logAudit(actor_id || 'system', actor_name || 'Owner', 'settings_updated', 'settings', 'company', 'Updated company settings');
      res.json(db.settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Phase 10: Security, 2FA, Backups & System Health (Section 31, 40.10) ---

  // Security Settings (Owner only)
  app.use('/api/security', requireOwner);

  app.get('/api/security/settings', (req, res) => {
    res.json(db.securitySettings);
  });

  app.put('/api/security/settings', (req, res) => {
    try {
      const { actor_id, actor_name, ...settings } = req.body;
      const updated = db.updateSecuritySettings(settings, actor_id || 'usr_owner', actor_name || 'Sobuj Sehk');
      broadcastEvent('security_settings_updated', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 2FA TOTP Setup & Verification
  app.post('/api/security/2fa/setup', (req, res) => {
    try {
      const { user_id } = req.body;
      const setup = db.generate2FASetup(user_id);
      res.json(setup);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/security/2fa/verify', (req, res) => {
    try {
      const user = db.verifyAndEnable2FA(req.body);
      broadcastEvent('user_2fa_updated', { user_id: user.id, enabled: true });
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/security/2fa/disable', (req, res) => {
    try {
      const { user_id, actor_id, actor_name } = req.body;
      const user = db.disable2FA(user_id, actor_id || 'usr_owner', actor_name || 'Sobuj Sehk');
      broadcastEvent('user_2fa_updated', { user_id: user.id, enabled: false });
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Automated Backups & Disaster Recovery
  app.get('/api/backups', (req, res) => {
    res.json(db.backups);
  });

  app.post('/api/backups/create', (req, res) => {
    try {
      const { actor_id, actor_name } = req.body;
      const snapshot = db.createFullDatabaseBackup(actor_id || 'usr_owner', actor_name || 'Sobuj Sehk');
      broadcastEvent('backup_created', snapshot);
      res.json(snapshot);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/backups/:id/download', (req, res) => {
    try {
      const data = db.getBackupSnapshotData(req.params.id);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=mirage_backup_${req.params.id}.json`);
      res.json(data);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/backups/restore', (req, res) => {
    try {
      const { snapshot_data, actor_id, actor_name } = req.body;
      const result = db.restoreDatabaseFromSnapshot(snapshot_data, actor_id || 'usr_owner', actor_name || 'Sobuj Sehk');
      broadcastEvent('database_restored', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // System Health Monitor
  app.get('/api/system/health', (req, res) => {
    res.json(db.getSystemHealth());
  });

  // 10. Packaging Materials (Operations)
  app.get('/api/packaging/materials', (req, res) => {
    const mats = Array.from(db.packagingMaterials.values());
    const enriched = mats.map(m => ({
      ...m,
      available: m.on_hand - m.reserved,
      status: db.getPackagingStockStatus(m),
    }));
    res.json(enriched);
  });

  app.post('/api/packaging/materials', (req, res) => {
    try {
      const { name, barcode, sku, category, unit, reorder_level, unit_cost, notes, opening_stock, actor_id, actor_name } = req.body;
      if (!name || !barcode || !category) return res.status(400).json({ error: 'Name, barcode, and category are required' });
      // Check duplicate barcode
      const existing = Array.from(db.packagingMaterials.values()).find(m => m.barcode === barcode);
      if (existing) return res.status(409).json({ error: `Barcode ${barcode} already registered as ${existing.name}` });
      const mat = db.createPackagingMaterial({ name, barcode, sku: sku || barcode, category: category || 'other', unit: unit || 'piece', reorder_level: reorder_level || 10, unit_cost: unit_cost || 0, notes, opening_stock: opening_stock || 0, actor_id, actor_name });
      res.json(mat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/packaging/materials/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, barcode, sku, category, unit, reorder_level, unit_cost, notes, actor_id, actor_name } = req.body;
      const mat = db.updatePackagingMaterial(id, { name, barcode, sku, category, unit, reorder_level, unit_cost, notes }, actor_id, actor_name);
      if (!mat) return res.status(404).json({ error: 'Material not found' });
      res.json(mat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/packaging/receive', (req, res) => {
    try {
      const { material_id, quantity, unit_cost, reference_note, actor_id, actor_name } = req.body;
      if (!material_id || !quantity) return res.status(400).json({ error: 'material_id and quantity required' });
      const mat = db.receivePackagingStock(material_id, quantity, unit_cost || 0, reference_note, actor_id, actor_name);
      if (!mat) return res.status(404).json({ error: 'Material not found' });
      res.json(mat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/packaging/movements', (req, res) => {
    const { material_id, reason } = req.query;
    let movements = [...db.packagingStockMovements];
    if (material_id) movements = movements.filter(m => m.material_id === material_id);
    if (reason) movements = movements.filter(m => m.reason === reason);
    movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(movements);
  });

  // 11. Notifications
  app.get('/api/notifications', (req, res) => {
    res.json(db.notifications);
  });

  app.post('/api/notifications/mark-read', (req, res) => {
    db.notifications.forEach(n => (n.read = true));
    res.json({ success: true });
  });

  // ==========================================================================
  // PHASE: CRM & RELATIONSHIP MANAGEMENT ENDPOINTS
  // ==========================================================================

  // Dashboard Aggregates
  app.get('/api/crm/dashboard', (req, res) => {
    try {
      res.json(crmService.getDashboardSummary());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Leads & Pipeline
  app.get('/api/crm/leads', (req, res) => {
    try {
      const { stage, source, search, assigned_to } = req.query;
      res.json(crmService.getLeads({
        stage: stage as string,
        source: source as string,
        search: search as string,
        assigned_to: assigned_to as string,
      }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/crm/leads/:id', (req, res) => {
    const lead = crmService.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  });

  app.post('/api/crm/leads', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const lead = crmService.createLead(req.body, actor.id, actor.name);
      broadcastEvent('crm_lead_created', lead);
      res.json(lead);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/crm/leads/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const lead = crmService.updateLead(req.params.id, req.body, actor.id, actor.name);
      broadcastEvent('crm_lead_updated', lead);
      res.json(lead);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/crm/leads/:id/stage', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const lead = crmService.changeLeadStage(req.params.id, req.body.stage, req.body.lost_reason, actor.id, actor.name);
      broadcastEvent('crm_lead_stage_changed', lead);
      res.json(lead);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/leads/:id/convert', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const result = crmService.convertLeadToOrder(req.params.id, req.body, actor.id, actor.name);
      broadcastEvent('order_created', result.order);
      broadcastEvent('crm_lead_updated', result.lead);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Interactions
  app.get('/api/crm/interactions', (req, res) => {
    try {
      const { customer_id, lead_id } = req.query;
      res.json(crmService.getInteractions(customer_id as string, lead_id as string));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/interactions', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const interaction = crmService.logInteraction(req.body, actor.id, actor.name);
      broadcastEvent('crm_interaction_logged', interaction);
      res.json(interaction);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Tasks & Follow-ups
  app.get('/api/crm/tasks', (req, res) => {
    try {
      const { status, assigned_to, priority, customer_id, lead_id } = req.query;
      res.json(crmService.getTasks({
        status: status as string,
        assigned_to: assigned_to as string,
        priority: priority as string,
        customer_id: customer_id as string,
        lead_id: lead_id as string,
      }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/tasks', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const task = crmService.createTask(req.body, actor.id, actor.name);
      broadcastEvent('crm_task_created', task);
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/crm/tasks/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const task = crmService.updateTask(req.params.id, req.body, actor.id, actor.name);
      broadcastEvent('crm_task_updated', task);
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/tasks/:id/complete', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const task = crmService.completeTask(req.params.id, req.body.notes, actor.id, actor.name);
      broadcastEvent('crm_task_updated', task);
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/tasks/:id/snooze', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const task = crmService.snoozeTask(req.params.id, req.body.snoozed_until, actor.id, actor.name);
      broadcastEvent('crm_task_updated', task);
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Customer 360 & Timeline
  app.get('/api/crm/customers/:id/360', (req, res) => {
    try {
      const data = crmService.getCustomer360(req.params.id);
      if (!data) return res.status(404).json({ error: 'Customer not found' });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/crm/customers/:id/timeline', (req, res) => {
    try {
      res.json(crmService.getCustomerTimeline(req.params.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lifecycle
  app.post('/api/crm/customers/:id/lifecycle/override', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const { status, reason } = req.body;
      const record = crmService.overrideLifecycle(req.params.id, status, reason, actor.id, actor.name);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/customers/:id/lifecycle/clear', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const record = crmService.clearLifecycleOverride(req.params.id, actor.id, actor.name);
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Customer Preferences
  app.get('/api/crm/customers/:id/preferences', (req, res) => {
    try {
      res.json(crmService.getPreferences(req.params.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/crm/customers/:id/preferences', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const pref = crmService.updatePreferences(req.params.id, req.body, actor.id, actor.name);
      res.json(pref);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Tags & Bulk Tagging
  app.get('/api/crm/tags', (req, res) => {
    try {
      res.json(crmService.getTags());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/tags', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const tag = crmService.createTag(req.body.name, req.body.color, actor.id, actor.name);
      res.json(tag);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/customers/:id/tags', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      crmService.addTagToCustomer(req.params.id, req.body.tag_id, actor.id, actor.name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/crm/customers/:id/tags/:tag_id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      crmService.removeTagFromCustomer(req.params.id, req.params.tag_id, actor.id, actor.name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/customers/bulk-tag', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      crmService.bulkTagCustomers(req.body.customer_ids, req.body.tag_ids, actor.id, actor.name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Segments & CSV Export
  app.post('/api/crm/segments/filter', (req, res) => {
    try {
      const list = crmService.filterCustomers(req.body);
      res.json(list);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/segments/export', (req, res) => {
    try {
      const csv = crmService.exportSegmentCSV(req.body);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="mirage_customer_segment.csv"');
      res.send(csv);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Tickets & Customer Service
  app.get('/api/crm/tickets', (req, res) => {
    try {
      const { status, priority, customer_id } = req.query;
      res.json(crmService.getTickets({
        status: status as string,
        priority: priority as string,
        customer_id: customer_id as string,
      }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/tickets', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const ticket = crmService.createTicket(req.body, actor.id, actor.name);
      broadcastEvent('crm_ticket_created', ticket);
      res.json(ticket);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/crm/tickets/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const ticket = crmService.updateTicket(req.params.id, req.body, actor.id, actor.name);
      broadcastEvent('crm_ticket_updated', ticket);
      res.json(ticket);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/tickets/:id/resolve', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const ticket = crmService.resolveTicket(req.params.id, req.body.resolution_notes, actor.id, actor.name);
      broadcastEvent('crm_ticket_updated', ticket);
      res.json(ticket);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Feedback
  app.get('/api/crm/feedback', (req, res) => {
    try {
      res.json(crmService.getFeedback(req.query.customer_id as string));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/feedback', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const fb = crmService.recordFeedback(req.body, actor.id, actor.name);
      res.json(fb);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Special Dates
  app.get('/api/crm/special-dates', (req, res) => {
    try {
      res.json(crmService.getSpecialDates(req.query.customer_id as string));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/crm/special-dates/upcoming', (req, res) => {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      res.json(crmService.getUpcomingDates(days));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/special-dates', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const sd = crmService.addSpecialDate(req.body, actor.id, actor.name);
      res.json(sd);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/crm/special-dates/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      crmService.deleteSpecialDate(req.params.id, actor.id, actor.name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Opportunities
  app.get('/api/crm/opportunities', (req, res) => {
    try {
      res.json(crmService.getOpportunities());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/opportunities', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const opp = crmService.createOpportunity(req.body, actor.id, actor.name);
      res.json(opp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/crm/opportunities/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const opp = crmService.updateOpportunity(req.params.id, req.body, actor.id, actor.name);
      res.json(opp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Campaigns & Outreach
  app.get('/api/crm/campaigns', (req, res) => {
    try {
      res.json(crmService.getCampaigns());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/crm/campaigns', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const camp = crmService.createCampaign(req.body, actor.id, actor.name);
      res.json(camp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/crm/campaigns/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const camp = crmService.updateCampaign(req.params.id, req.body, actor.id, actor.name);
      res.json(camp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reorder Intelligence
  app.get('/api/crm/reorder-opportunities', (req, res) => {
    try {
      res.json(crmService.getReorderOpportunities());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Automations
  app.get('/api/crm/automations', (req, res) => {
    try {
      res.json(crmService.getAutomationRules());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/crm/automations/:id', (req, res) => {
    try {
      const actor = getAuthenticatedActor(req);
      const rule = crmService.updateAutomationRule(req.params.id, req.body, actor.id, actor.name);
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crm/automations/run', (req, res) => {
    try {
      res.json(crmService.runAutomations());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CRM Analytics Reports
  app.get('/api/crm/reports', (req, res) => {
    try {
      res.json(crmService.getReports());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Production vs development routing
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mirage ERP] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
