import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'
import { z } from 'zod'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 4000)
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDist = path.join(appRoot, 'dist')
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in .env')

app.disable('x-powered-by')
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://images.unsplash.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    },
  },
}))
app.use(cors({ origin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type'] }))
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' }),
}))

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'meriride_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'meriride',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
})

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }),
})
const accountSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(255).optional().default(''),
  password: z.string().min(10).max(128),
}).strict()
const loginSchema = z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(128) }).strict()
const bookingStatusSchema = z.object({ status: z.enum(['requested', 'confirmed', 'in_progress', 'completed', 'cancelled']) }).strict()
const bookingSchema = z.object({
  vehicleId: z.number().int().positive(),
  pickupLocation: z.string().trim().min(2).max(255),
  dropoffLocation: z.string().trim().min(2).max(255),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  dropoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user.id), name: user.name, email: user.email, role: user.role || 'customer' }, jwtSecret, { expiresIn: '7d' })
  res.cookie('meriride_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

function currentUser(req, res, next) {
  try {
    const token = req.cookies.meriride_session
    if (!token) return res.status(401).json({ error: 'Please sign in to book a car.' })
    req.user = jwt.verify(token, jwtSecret)
    next()
  } catch {
    res.clearCookie('meriride_session', { httpOnly: true, sameSite: 'lax', path: '/' })
    return res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.' })
  }
}

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || ''
  return address === '::1' || address === '127.0.0.1' || address.startsWith('::ffff:127.')
}

async function adminSetupIsAvailable(req) {
  if (process.env.NODE_ENV === 'production' || !isLocalRequest(req)) return false
  const [admins] = await pool.execute("SELECT id FROM users WHERE LOWER(role) = 'admin' LIMIT 1")
  return admins.length === 0
}

async function requireAdmin(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT role FROM users WHERE id = ? LIMIT 1', [String(req.user.sub)])
    if (!rows.length) return res.status(401).json({ error: 'Your account could not be found. Please sign in again.' })
    if (String(rows[0].role || '').toLowerCase() !== 'admin') return res.status(403).json({ error: 'Admin access is required.' })
    next()
  } catch (error) {
    console.error('Admin role check failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not verify admin access.' })
  }
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }) }
  catch { res.status(503).json({ status: 'unavailable' }) }
})

app.get('/api/admin/setup/status', async (req, res) => {
  try { res.json({ available: await adminSetupIsAvailable(req) }) }
  catch (error) {
    console.error('Admin setup status failed:', error.code || 'database error')
    res.status(503).json({ available: false })
  }
})

app.post('/api/admin/setup', authLimit, async (req, res) => {
  if (process.env.NODE_ENV === 'production' || !isLocalRequest(req)) return res.status(404).json({ error: 'This setup page is only available locally.' })
  const parsed = accountSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 10 characters.' })
  const { name, email, phone, password } = parsed.data
  const passwordHash = await bcrypt.hash(password, 12)
  const connection = await pool.getConnection()
  let lockHeld = false
  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK('meriride_first_admin_setup', 5) AS acquired")
    if (Number(lockRows[0]?.acquired) !== 1) return res.status(503).json({ error: 'Admin setup is busy. Please try again.' })
    lockHeld = true
    const [admins] = await connection.query("SELECT id FROM users WHERE LOWER(role) = 'admin' LIMIT 1")
    if (admins.length) return res.status(410).json({ error: 'Admin setup is already complete. Sign in with your admin account.' })
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing.length) return res.status(409).json({ error: 'An account with that email already exists. Use a different email for the first admin.' })
    await connection.beginTransaction()
    const [result] = await connection.execute(
      'INSERT INTO users (email, name, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [email, name, passwordHash, phone || null, 'admin'],
    )
    await connection.commit()
    const user = { id: result.insertId, name, email, role: 'admin' }
    setSession(res, user)
    res.status(201).json({ user })
  } catch (error) {
    try { await connection.rollback() } catch {}
    console.error('Admin setup failed:', error.code || 'database error')
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ error: error.code === 'ER_DUP_ENTRY' ? 'An account with that email already exists.' : 'Could not create the admin account.' })
  } finally {
    if (lockHeld) {
      try { await connection.query("SELECT RELEASE_LOCK('meriride_first_admin_setup')") } catch {}
    }
    connection.release()
  }
})

app.get('/api/vehicles', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, brand, name, fuel, price_per_day, seats, type FROM vehicle WHERE available = 1 ORDER BY id DESC LIMIT 100',
    )
    res.json(rows)
  } catch (error) {
    console.error('Vehicle query failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not load available cars.' })
  }
})

// Admin endpoints return only the fields needed for the dashboard; password hashes are never exposed.
app.get('/api/admin/overview', currentUser, requireAdmin, async (_req, res) => {
  try {
    const [[counts]] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM booking) AS bookings,
        (SELECT COUNT(*) FROM booking WHERE status = 'requested') AS pendingBookings,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM vehicle) AS vehicles,
        (SELECT COUNT(*) FROM vehicle WHERE available = 1) AS availableVehicles
    `)
    res.json(counts)
  } catch (error) {
    console.error('Admin overview failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not load dashboard summary.' })
  }
})

app.get('/api/admin/bookings', currentUser, requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT b.id, b.created_at, b.start_date, b.end_date, b.pickup_time,
        b.pickup_location, b.dropoff_location, b.status, b.total_amount,
        u.id AS user_id, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
        v.id AS vehicle_id, v.brand AS vehicle_brand, v.name AS vehicle_name, v.type AS vehicle_type
      FROM booking b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN vehicle v ON v.id = b.vehicle_id
      ORDER BY b.id DESC
    `)
    res.json(rows)
  } catch (error) {
    console.error('Admin bookings query failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not load bookings.' })
  }
})

app.get('/api/admin/users', currentUser, requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, phone, role FROM users ORDER BY id DESC')
    res.json(rows)
  } catch (error) {
    console.error('Admin users query failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not load users.' })
  }
})

app.get('/api/admin/vehicles', currentUser, requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, available, brand, fuel, name, price_per_day, seats, type FROM vehicle ORDER BY id DESC')
    res.json(rows)
  } catch (error) {
    console.error('Admin vehicles query failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not load vehicle inventory.' })
  }
})

app.patch('/api/admin/bookings/:id/status', currentUser, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const parsed = bookingStatusSchema.safeParse(req.body)
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
    return res.status(400).json({ error: 'Choose a valid booking and status.' })
  }
  try {
    const [result] = await pool.execute('UPDATE booking SET status = ? WHERE id = ?', [parsed.data.status, id])
    if (result.affectedRows === 0) {
      const [rows] = await pool.execute('SELECT id FROM booking WHERE id = ? LIMIT 1', [id])
      if (!rows.length) return res.status(404).json({ error: 'Booking not found.' })
    }
    res.json({ id, status: parsed.data.status })
  } catch (error) {
    console.error('Admin booking update failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not update this booking.' })
  }
})

app.delete('/api/admin/bookings/:id', currentUser, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Choose a valid booking.' })
  try {
    const [result] = await pool.execute('DELETE FROM booking WHERE id = ?', [id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Booking not found.' })
    res.json({ deleted: true, id })
  } catch (error) {
    console.error('Admin booking delete failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not delete this booking.' })
  }
})

app.post('/api/auth/register', authLimit, async (req, res) => {
  const parsed = accountSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 10 characters.' })
  const { name, email, phone, password } = parsed.data
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing.length) return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' })
    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.execute(
      'INSERT INTO users (email, name, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [email, name, passwordHash, phone || null, 'customer'],
    )
    const user = { id: result.insertId, name, email, role: 'customer' }
    setSession(res, user)
    res.status(201).json({ user })
  } catch (error) {
    console.error('Registration failed:', error.code || 'database error')
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ error: error.code === 'ER_DUP_ENTRY' ? 'An account with that email already exists.' : 'Could not create your account.' })
  }
})

app.post('/api/auth/login', authLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' })
  try {
    const [rows] = await pool.execute('SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1', [parsed.data.email])
    const user = rows[0]
    if (!user || !user.password || !await bcrypt.compare(parsed.data.password, user.password)) {
      return res.status(401).json({ error: 'Email or password was incorrect.' })
    }
    setSession(res, user)
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (error) {
    console.error('Sign in failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not sign in right now.' })
  }
})

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('meriride_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })
  res.json({ ok: true })
})

app.get('/api/auth/me', currentUser, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [String(req.user.sub)])
    if (!rows.length) return res.status(401).json({ error: 'Please sign in again.' })
    res.json({ user: rows[0] })
  } catch (error) {
    console.error('Current user lookup failed:', error.code || 'database error')
    res.status(503).json({ error: 'Could not load your account.' })
  }
})

app.post('/api/bookings', currentUser, async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Please provide valid booking details.' })
  const { vehicleId, pickupLocation, dropoffLocation, pickupDate, pickupTime, dropoffDate } = parsed.data
  const pickup = new Date(`${pickupDate}T${pickupTime}:00`)
  const dropoff = new Date(`${dropoffDate}T00:00:00`)
  const [year, month, day] = pickupDate.split('-').map(Number)
  const [hour, minute] = pickupTime.split(':').map(Number)
  const [dropYear, dropMonth, dropDay] = dropoffDate.split('-').map(Number)
  const validPickup = Number.isFinite(pickup.valueOf()) && pickup.getFullYear() === year && pickup.getMonth() + 1 === month && pickup.getDate() === day && pickup.getHours() === hour && pickup.getMinutes() === minute
  const validDropoff = Number.isFinite(dropoff.valueOf()) && dropoff.getFullYear() === dropYear && dropoff.getMonth() + 1 === dropMonth && dropoff.getDate() === dropDay
  if (!validPickup || !validDropoff) {
    return res.status(400).json({ error: 'Please choose valid booking dates and times.' })
  }
  if (dropoffDate < pickupDate) return res.status(400).json({ error: 'Drop-off date must be the same as or after pick-up.' })
  if (pickup < new Date(Date.now() - 60_000)) return res.status(400).json({ error: 'Pick-up time must be in the future.' })

  try {
    const [vehicles] = await pool.execute('SELECT price_per_day FROM vehicle WHERE id = ? AND available = 1 LIMIT 1', [vehicleId])
    if (!vehicles.length) return res.status(404).json({ error: 'That car is no longer available. Please choose another.' })
    const days = Math.max(1, Math.ceil((Date.parse(`${dropoffDate}T00:00:00Z`) - Date.parse(`${pickupDate}T00:00:00Z`)) / 86400000))
    const total = (Number(vehicles[0].price_per_day) * days).toFixed(2)
    const [result] = await pool.execute(
      'INSERT INTO booking (user_id, vehicle_id, start_date, end_date, status, total_amount, pickup_location, dropoff_location, pickup_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [String(req.user.sub), vehicleId, pickupDate, dropoffDate, 'requested', total, pickupLocation, dropoffLocation, pickupTime],
    )
    res.status(201).json({ bookingId: `MR-${String(result.insertId).padStart(6, '0')}`, totalAmount: total })
  } catch (error) {
    console.error('Booking insert failed:', error.code || 'database error')
    res.status(503).json({ error: 'Booking service is temporarily unavailable.' })
  }
})

// Railway (and other Node hosts) serve the built SPA and API from one origin.
app.use(express.static(frontendDist, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }))
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (error) => { if (error) next(error) })
})

app.listen(port, '0.0.0.0', () => console.log(`MeriRide listening on port ${port}`))
