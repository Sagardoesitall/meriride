import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './admin.css'
import './premium.css'
import './admin-actions.css'

const carImages = ['photo-1549317661-bd32c8ce0db2', 'photo-1552519507-da3b142c6e3d', 'photo-1533473359331-0135ef1b58bf', 'photo-1550355291-bbee04a92027', 'photo-1519641471654-76ce0107ad1b']
const mumbaiLocations = ['Mumbai Airport · Terminal 1', 'Mumbai Airport · Terminal 2', 'Bandra West', 'Bandra Kurla Complex', 'Andheri East', 'Andheri West', 'Juhu', 'Powai', 'Dadar', 'Lower Parel', 'Fort', 'Colaba', 'Vashi', 'Navi Mumbai · Belapur', 'Thane']
const bookingStatuses = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled']

async function readResponse(response) {
  const body = await response.text()
  try { return body ? JSON.parse(body) : {} }
  catch { throw new Error(body || `Server returned an unexpected response (${response.status}).`) }
}

const Icon = ({ name, size = 20 }) => {
  const paths = {
    car: <><path d="m5 11 1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v7H3zM6 18v2m12-2v2M6 14h.01M18 14h.01"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/></>,
    headset: <><path d="M3 12a9 9 0 0 1 18 0"/><path d="M3 12v5a2 2 0 0 0 2 2h2v-7H5a2 2 0 0 0-2 2Zm18 0v5a2 2 0 0 1-2 2h-2v-7h2a2 2 0 0 1 2 2Z"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function AdminDashboard({ user, onBack, onSignIn }) {
  const [tab, setTab] = useState('bookings')
  const [query, setQuery] = useState('')
  const [reload, setReload] = useState(0)
  const [dashboard, setDashboard] = useState({ overview: null, bookings: [], users: [], vehicles: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mutationId, setMutationId] = useState(null)

  useEffect(() => {
    if (!user || String(user.role).toLowerCase() !== 'admin') return
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      fetch('/api/admin/overview').then(async (r) => { const d = await readResponse(r); if (!r.ok) throw new Error(d.error || 'Could not load admin data.'); return d }),
      fetch('/api/admin/bookings').then(async (r) => { const d = await readResponse(r); if (!r.ok) throw new Error(d.error || 'Could not load admin data.'); return d }),
      fetch('/api/admin/users').then(async (r) => { const d = await readResponse(r); if (!r.ok) throw new Error(d.error || 'Could not load admin data.'); return d }),
      fetch('/api/admin/vehicles').then(async (r) => { const d = await readResponse(r); if (!r.ok) throw new Error(d.error || 'Could not load admin data.'); return d }),
    ]).then(([overview, bookings, users, vehicles]) => {
      if (active) setDashboard({ overview, bookings, users, vehicles })
    }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, reload])

  const denied = !user || String(user.role).toLowerCase() !== 'admin'
  const rows = dashboard[tab] || []
  const filtered = rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query.toLowerCase())))
  const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const money = (value) => value == null ? '—' : `₹${Number(value).toLocaleString('en-IN')}`

  const changeBookingStatus = async (booking, status) => {
    setMutationId(booking.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error || 'Could not update this booking.')
      setDashboard((current) => ({ ...current, bookings: current.bookings.map((row) => row.id === booking.id ? { ...row, status: data.status } : row) }))
      setNotice(`MR-${String(booking.id).padStart(6, '0')} status updated to ${data.status.replace('_', ' ')}.`)
    } catch (e) { setError(e.message) }
    finally { setMutationId(null) }
  }

  const deleteBooking = async (booking) => {
    const orderNumber = `MR-${String(booking.id).padStart(6, '0')}`
    if (!window.confirm(`Are you sure you want to delete order ${orderNumber}? This cannot be undone.`)) return
    setMutationId(booking.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, { method: 'DELETE' })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error || 'Could not delete this order.')
      setDashboard((current) => ({ ...current, bookings: current.bookings.filter((row) => row.id !== booking.id), overview: current.overview ? { ...current.overview, bookings: Math.max(0, Number(current.overview.bookings) - 1), pendingBookings: booking.status === 'requested' ? Math.max(0, Number(current.overview.pendingBookings) - 1) : current.overview.pendingBookings } : null }))
      setNotice(`Order ${orderNumber} was deleted.`)
    } catch (e) { setError(e.message) }
    finally { setMutationId(null) }
  }

  return <section className="admin-page">
    <div className="admin-heading"><div><span className="eyebrow blue">MERIRIDE MANAGEMENT</span><h1>Admin dashboard</h1><p>Bookings, customers and your complete vehicle inventory.</p></div>{!denied && <button className="admin-refresh" onClick={() => setReload((n) => n + 1)}>↻ &nbsp;Refresh data</button>}</div>
    {denied ? <div className="admin-gate"><span className="admin-gate-icon">⌑</span><h2>{user ? 'Admin access required' : 'Sign in to continue'}</h2><p>{user ? 'This account does not have the admin role. Ask the database administrator to grant access.' : 'Sign in with an administrator account to view business data.'}</p><div><button className="admin-secondary" onClick={onBack}>Back to website</button>{!user && <button className="admin-primary" onClick={onSignIn}>Sign in</button>}</div></div> : <>
      <div className="admin-metrics">{[
        ['Bookings', dashboard.overview?.bookings, 'All rental orders', 'calendar'],
        ['Needs attention', dashboard.overview?.pendingBookings, 'Requested bookings', 'clock'],
        ['Customers', dashboard.overview?.users, 'Registered accounts', 'users'],
        ['Fleet available', `${dashboard.overview?.availableVehicles ?? '—'} / ${dashboard.overview?.vehicles ?? '—'}`, 'Vehicles ready to rent', 'car'],
      ].map(([label, value, note, icon]) => <article className="admin-metric" key={label}><span className="admin-metric-icon"><Icon name={icon} size={19} /></span><div><small>{label}</small><strong>{value ?? '—'}</strong><span>{note}</span></div></article>)}</div>
      <div className="admin-data-card"><div className="admin-data-head"><div className="admin-tabs">{[['bookings', 'Bookings / orders'], ['users', 'Users'], ['vehicles', 'Cars']].map(([id, label]) => <button key={id} className={tab === id ? 'selected' : ''} onClick={() => { setTab(id); setQuery('') }}>{label}<span>{dashboard[id]?.length ?? 0}</span></button>)}</div><label className="admin-search">⌕<input placeholder={`Search ${tab}…`} value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
        {error && <div className="admin-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}{loading && <div className="admin-loading">Loading records…</div>}
        {!loading && !error && <div className="admin-table-scroll"><table className="admin-table">
          {tab === 'bookings' && <><thead><tr><th>Order</th><th>Customer</th><th>Vehicle</th><th>Pick-up</th><th>Drop-off</th><th>Total</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{filtered.map((b) => <tr key={b.id}><td><strong>MR-{String(b.id).padStart(6, '0')}</strong></td><td><strong>{b.customer_name || `User #${b.user_id}`}</strong><small>{b.customer_email || '—'}</small></td><td>{[b.vehicle_brand, b.vehicle_name].filter(Boolean).join(' ') || `Car #${b.vehicle_id}`}<small>{b.vehicle_type || ''}</small></td><td>{b.pickup_location || '—'}<small>{date(b.start_date)}{b.pickup_time ? ` · ${String(b.pickup_time).slice(0, 5)}` : ''}</small></td><td>{b.dropoff_location || '—'}<small>{date(b.end_date)}</small></td><td><strong>{money(b.total_amount)}</strong></td><td><select className="booking-status-select" aria-label={`Status for order MR-${b.id}`} value={bookingStatuses.includes(b.status) ? b.status : 'requested'} disabled={mutationId === b.id} onChange={(e) => changeBookingStatus(b, e.target.value)}>{!bookingStatuses.includes(b.status) && <option value={b.status}>{b.status || 'unknown'}</option>}{bookingStatuses.map((s) => <option value={s} key={s}>{s.replace('_', ' ')}</option>)}</select></td><td>{date(b.created_at)}</td><td><button className="admin-delete" disabled={mutationId === b.id} onClick={() => deleteBooking(b)}>Delete</button></td></tr>)}</tbody></>}
          {tab === 'users' && <><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th></tr></thead><tbody>{filtered.map((u) => <tr key={u.id}><td>#{u.id}</td><td><strong>{u.name || '—'}</strong></td><td>{u.email}</td><td>{u.phone || '—'}</td><td><span className={`admin-status ${String(u.role || 'customer').toLowerCase()}`}>{u.role || 'customer'}</span></td></tr>)}</tbody></>}
          {tab === 'vehicles' && <><thead><tr><th>ID</th><th>Vehicle</th><th>Type</th><th>Fuel</th><th>Seats</th><th>Rate / day</th><th>Availability</th></tr></thead><tbody>{filtered.map((v) => <tr key={v.id}><td>#{v.id}</td><td><strong>{v.brand} {v.name}</strong></td><td>{v.type}</td><td>{v.fuel || '—'}</td><td>{v.seats}</td><td>{money(v.price_per_day)}</td><td><span className={`admin-status ${v.available ? 'available' : 'unavailable'}`}>{v.available ? 'Available' : 'Unavailable'}</span></td></tr>)}</tbody></>}
          {filtered.length === 0 && <tbody><tr><td className="admin-empty" colSpan={tab === 'bookings' ? 9 : 8}>No matching records found.</td></tr></tbody>}
        </table></div>}
        <div className="admin-table-foot">Showing {filtered.length} of {rows.length} records</div>
      </div>
      <p className="admin-footnote">Order records are read from the existing <code>booking</code> table. Customer passwords are never shown.</p>
    </>}
  </section>
}

function AdminSetupPage({ onBack, onAdmin, onCreated }) {
  const [available, setAvailable] = useState(null)
  const [complete, setComplete] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/setup/status').then(readResponse).then((data) => setAvailable(Boolean(data.available))).catch(() => setAvailable(false))
  }, [])

  const create = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error || 'Could not create the admin account.')
      onCreated(data.user)
      setAvailable(false)
      setComplete(true)
      setForm({ name: '', email: '', phone: '', password: '' })
    } catch (e) { setError(e.message === 'Failed to fetch' ? 'The local API is unavailable. Start the server and try again.' : e.message) }
    finally { setSaving(false) }
  }

  return <section className="setup-page"><div className="setup-card"><a className="setup-brand" href="/" onClick={onBack}><span className="brand-mark"><Icon name="car" size={23} /></span><span>Meri<span>Ride</span></span></a><span className="eyebrow blue">ONE-TIME LOCAL SETUP</span>
    {complete ? <><span className="setup-success">✓</span><h1>Admin account created</h1><p>Your account is ready and this setup page is now closed. You can sign in with the email and password you just created.</p><button className="admin-primary" onClick={onAdmin}>Open admin dashboard <Icon name="arrow" size={15} /></button></> : available === null ? <><h1>Checking setup…</h1><p>Checking whether the first admin account can be created.</p></> : !available ? <><span className="setup-lock">⌑</span><h1>Setup is closed</h1><p>The first admin has already been created, or this page is not being opened locally. Sign in with your admin account to continue.</p><button className="admin-primary" onClick={onBack}>Back to MeriRide</button></> : <><h1>Create the first admin</h1><p>This local-only form creates one administrator. After that, this setup route disables itself.</p><form className="setup-form" onSubmit={create}><label>Full name<input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength="2" /></label><label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Phone <span>(optional)</span><input autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Password<input type="password" autoComplete="new-password" minLength="10" maxLength="128" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><small>At least 10 characters. It will be securely hashed before it is stored.</small></label>{error && <p className="setup-error" role="alert">{error}</p>}<button className="admin-primary" type="submit" disabled={saving}>{saving ? 'Creating account…' : 'Create admin account'} <Icon name="arrow" size={15} /></button></form></>}
  </div></section>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPage] = useState(window.location.pathname === '/admin' ? 'admin' : window.location.pathname === '/admin/setup' ? 'setup' : 'home')
  const [setupAvailable, setSetupAvailable] = useState(false)
  const [form, setForm] = useState({ pickupLocation: '', pickupDate: '', pickupTime: '', dropoffLocation: '', dropoffDate: '', vehicleId: '' })
  const [vehicles, setVehicles] = useState([])
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('register')
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const premiumVehicles = vehicles.filter((car) => /supercar|luxury|sport|performance|exotic/i.test(`${car.type} ${car.brand} ${car.name}`))

  useEffect(() => {
    const syncPage = () => setPage(window.location.pathname === '/admin' ? 'admin' : window.location.pathname === '/admin/setup' ? 'setup' : 'home')
    window.addEventListener('popstate', syncPage)
    return () => window.removeEventListener('popstate', syncPage)
  }, [])

  const goTo = (target) => (event) => {
    event.preventDefault()
    window.history.pushState({}, '', target === 'admin' ? '/admin' : target === 'setup' ? '/admin/setup' : '/')
    setPage(target)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  useEffect(() => {
    fetch('/api/vehicles').then((response) => response.ok ? response.json() : []).then(setVehicles).catch(() => setVehicles([]))
    fetch('/api/auth/me').then((response) => response.ok ? response.json() : null).then((data) => { if (data?.user) setUser(data.user) }).catch(() => {})
    fetch('/api/admin/setup/status').then(readResponse).then((data) => setSetupAvailable(Boolean(data.available))).catch(() => setSetupAvailable(false))
  }, [])
  const authenticate = async (event) => {
    event.preventDefault()
    setAuthError('')
    try {
      const response = await fetch(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password }),
      })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error || 'Could not sign in.')
      setUser(data.user)
      setAuthOpen(false)
      setAuthForm({ name: '', email: '', phone: '', password: '' })
      setStatus('You’re signed in. Complete your booking when you’re ready.')
    } catch (error) { setAuthError(error.message === 'Failed to fetch' ? 'The server is unavailable. Make sure both app terminals are running.' : error.message) }
  }
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setSetupAvailable(false)
    if (page === 'admin') goTo('home')({ preventDefault() {} })
  }
  const book = async (event) => {
    event.preventDefault()
    if (!user) { setAuthMode('register'); setAuthOpen(true); setStatus('Create an account or sign in to place your booking.'); return }
    if (!form.vehicleId) { setStatus('Please choose a car from the list.'); return }
    setLoading(true)
    setStatus('')
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, vehicleId: Number(form.vehicleId) }),
      })
      const data = await readResponse(response)
      if (!response.ok) throw new Error(data.error || 'Please check your booking details.')
      setStatus(`You’re all set! Booking ${data.bookingId} has been received. Total: ₹${data.totalAmount}.`)
    } catch (error) {
      setStatus(error.message === 'Failed to fetch' ? 'Booking service is unavailable. Start the API server and try again.' : error.message)
    } finally { setLoading(false) }
  }

  return <>
    <header className="topbar">
      <a className="brand" href="/" onClick={goTo('home')} aria-label="MeriRide home"><span className="brand-mark"><Icon name="car" size={23} /></span><span>Meri<span>Ride</span><small>Your journey, our responsibility</small></span></a>
      <button className="menu-toggle" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
      <nav className={menuOpen ? 'nav open' : 'nav'}>{page === 'admin' ? <><a href="/" onClick={goTo('home')}>← Website</a><a className="active" href="/admin" onClick={goTo('admin')}>Admin</a></> : page === 'setup' ? <><a href="/" onClick={goTo('home')}>← Website</a><a className="active" href="/admin/setup" onClick={goTo('setup')}>Admin setup</a></> : <><a className="active" href="#home" onClick={() => setMenuOpen(false)}>Home</a><a href="#cars" onClick={() => setMenuOpen(false)}>Cars</a><a href="#booking" onClick={() => setMenuOpen(false)}>Booking</a><a href="#about" onClick={() => setMenuOpen(false)}>About Us</a><a href="#contact" onClick={() => setMenuOpen(false)}>Contact Us</a>{user?.role?.toLowerCase() === 'admin' ? <a href="/admin" onClick={goTo('admin')}>Admin</a> : setupAvailable && <a href="/admin/setup" onClick={goTo('setup')}>Create admin</a>}</>}</nav>
      <a className="phone" href="tel:+919876543210"><span>☎</span> +91 98765 43210</a>
      {user ? <button className="login" onClick={signOut}>Hi, {user.name.split(' ')[0]} · Sign out</button> : <button className="login" onClick={() => { setAuthMode('register'); setAuthOpen(true) }}>Sign in / Join</button>}
    </header>

    <main>{page === 'admin' ? <AdminDashboard user={user} onBack={goTo('home')} onSignIn={() => { setAuthMode('login'); setAuthOpen(true) }} /> : page === 'setup' ? <AdminSetupPage onBack={goTo('home')} onAdmin={goTo('admin')} onCreated={(createdUser) => { setUser(createdUser); setSetupAvailable(false) }} /> : <>
      <section className="hero" id="home">
        <div className="hero-photo" />
        <div className="hero-copy"><span className="eyebrow"><i /> THE ROAD IS YOURS</span><h1>Drive your journey<br />with <span>MeriRide</span></h1><p>Choose from a wide range of cars and book<br className="desktop" /> your perfect ride in just a few clicks.</p><a className="primary-btn" href="#cars">Explore cars <Icon name="arrow" size={17} /></a></div>
        <form className="booking-card" id="booking" onSubmit={book}>
          <div className="booking-heading"><span><Icon name="car" size={19} /></span><div><h2>Book your ride</h2><p>Where would you like to go?</p></div></div>
          <div className="fields">
            <label><span><Icon name="pin" size={14} /> Pick-up location</span><select name="pickupLocation" value={form.pickupLocation} onChange={update} required><option value="">Select Mumbai location</option>{mumbaiLocations.map((location) => <option value={location} key={location}>{location}</option>)}</select></label>
            <label><span><Icon name="calendar" size={14} /> Pick-up date</span><input type="date" name="pickupDate" value={form.pickupDate} onChange={update} required /></label>
            <label><span><Icon name="clock" size={14} /> Pick-up time</span><input type="time" name="pickupTime" value={form.pickupTime} onChange={update} required /></label>
            <label><span><Icon name="calendar" size={14} /> Drop-off date</span><input type="date" name="dropoffDate" value={form.dropoffDate} onChange={update} required /></label>
            <label><span><Icon name="pin" size={14} /> Drop-off location</span><select name="dropoffLocation" value={form.dropoffLocation} onChange={update} required><option value="">Select Mumbai location</option>{mumbaiLocations.map((location) => <option value={location} key={location}>{location}</option>)}</select></label>
            <label><span><Icon name="car" size={14} /> Choose a car</span><select name="vehicleId" value={form.vehicleId} onChange={update} required><option value="">Select available car</option>{vehicles.map((car) => <option key={car.id} value={car.id}>{car.brand} {car.name} · ₹{Number(car.price_per_day).toLocaleString('en-IN')}/day</option>)}</select></label>
          </div>
          <button className="search-btn" type="submit" disabled={loading}>{loading ? 'Sending booking…' : 'Search cars'} <Icon name="arrow" size={16} /></button>
          {status && <p className="form-status" role="status">{status}</p>}
        </form>
        <div className="hero-note"><span>✦</span> YOUR NEXT ADVENTURE STARTS HERE</div>
      </section>

      <section className="benefits" aria-label="Why MeriRide"><article><span className="benefit-icon"><Icon name="car" /></span><div><h3>Wide range of cars</h3><p>From economy to luxury,<br />we have it all.</p></div></article><article><span className="benefit-icon"><Icon name="tag" /></span><div><h3>Affordable prices</h3><p>Best prices for short<br />and long-term rentals.</p></div></article><article><span className="benefit-icon"><Icon name="calendar" /></span><div><h3>Easy booking</h3><p>Book online in minutes<br />and hit the road.</p></div></article><article><span className="benefit-icon"><Icon name="headset" /></span><div><h3>24/7 support</h3><p>We're here to help you<br />anytime, anywhere.</p></div></article></section>

      <section className="popular section-wrap" id="cars"><div className="section-head"><div><span className="eyebrow blue">PICK YOUR RIDE</span><h2>Popular cars</h2></div><a href="#booking">View all cars <Icon name="arrow" size={16} /></a></div>{vehicles.length ? <div className="car-grid">{vehicles.slice(0, 10).map((car, index) => <article className="car-card" key={car.id}><div className="car-image"><img src={`https://images.unsplash.com/${carImages[index % carImages.length]}?auto=format&fit=crop&w=600&q=80`} alt={`${car.brand} ${car.name}`} loading="lazy" /></div><div className="car-info"><div className="car-title"><h3>{car.brand} {car.name}</h3><span className="available"><i /> Available</span></div><p>{car.type}{car.fuel ? ` · ${car.fuel}` : ''}</p><div className="car-specs"><span><Icon name="users" size={14} /> {car.seats} Seats</span></div><div className="car-foot"><div><strong>₹{Number(car.price_per_day).toLocaleString('en-IN')}</strong><span> / day</span></div><button type="button" className="card-book" onClick={() => { setForm({ ...form, vehicleId: String(car.id) }); document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth' }) }}>Choose car <Icon name="arrow" size={14} /></button></div></div></article>)}</div> : <p className="cars-empty">No available cars found in your database yet.</p>}</section>

      <section className="prestige" id="premium"><div className="prestige-hero"><div className="prestige-photo"/><div className="prestige-copy"><span className="eyebrow">MERIRIDE PRESTIGE</span><h2>Make the drive<br/>the <span>experience.</span></h2><p>Discover a little more power, presence and occasion with our premium collection.</p><a className="prestige-link" href="#premium-cars">Explore the collection <Icon name="arrow" size={16}/></a></div><span className="prestige-seal">A RIDE<br/>TO REMEMBER</span></div><div className="prestige-list" id="premium-cars"><div className="prestige-list-head"><div><span className="eyebrow blue">THE EXTRAORDINARY, ON DEMAND</span><h3>Supercar & luxury rentals</h3></div><span className="prestige-count">{premiumVehicles.length} available</span></div>{premiumVehicles.length ? <div className="premium-grid">{premiumVehicles.map((car, index) => <article className="premium-card" key={car.id}><div className="premium-image"><img src={`https://images.unsplash.com/${['photo-1503376780353-7e6692767b70','photo-1544829099-b9a0c07fad1a','photo-1511919884226-fd3cad34687c'][index % 3]}?auto=format&fit=crop&w=900&q=85`} alt={`${car.brand} ${car.name}`} loading="lazy"/><span>PRESTIGE COLLECTION</span></div><div className="premium-details"><div><h4>{car.brand} {car.name}</h4><p>{car.type}{car.fuel ? ` · ${car.fuel}` : ''} · {car.seats} seats</p></div><strong>₹{Number(car.price_per_day).toLocaleString('en-IN')}<small> / day</small></strong></div><button type="button" onClick={() => { setForm({ ...form, vehicleId: String(car.id) }); document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth' }) }}>Reserve this car <Icon name="arrow" size={15}/></button></article>)}</div> : <div className="premium-empty"><span>✦</span><div><strong>Curated drives are coming soon.</strong><p>Contact our team to ask about premium and supercar availability in Mumbai.</p></div><a href="mailto:hello@meriride.in?subject=Premium%20car%20rental">Enquire now <Icon name="arrow" size={15}/></a></div>}</div></section>

      <section className="about" id="about"><div className="about-copy"><span className="eyebrow">A BETTER WAY TO GET THERE</span><h2>Every journey<br />has a <span>good story.</span></h2><p>At MeriRide, the journey matters as much as the destination. Find the right car, enjoy transparent prices and let us take care of the details.</p><a href="#booking" className="about-link">Get on the road <Icon name="arrow" size={16} /></a></div><div className="stats"><div><span className="stat-icon"><Icon name="users" /></span><strong>10,000<span>+</span></strong><small>Happy customers</small></div><div><span className="stat-icon"><Icon name="car" /></span><strong>500<span>+</span></strong><small>Cars available</small></div><div><span className="stat-icon"><Icon name="pin" /></span><strong>25<span>+</span></strong><small>City locations</small></div><div><span className="stat-icon"><Icon name="shield" /></span><strong>100<span>%</span></strong><small>Customer satisfaction</small></div></div></section>
      <footer id="contact"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Icon name="car" size={22} /></span><span>Meri<span>Ride</span><small>Your journey, our responsibility</small></span></a><p>Good rides. Great memories.</p><a href="mailto:hello@meriride.in">hello@meriride.in</a><span>© 2025 MeriRide. All rights reserved.</span></footer>
    </>}</main>
    {authOpen && <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button><span className="eyebrow blue">WELCOME TO MERIRIDE</span><h2 id="auth-title">{authMode === 'register' ? 'Create your account' : 'Welcome back'}</h2><p>Sign in to book and manage your rides.</p><div className="auth-tabs"><button className={authMode === 'register' ? 'selected' : ''} onClick={() => { setAuthMode('register'); setAuthError('') }}>Create account</button><button className={authMode === 'login' ? 'selected' : ''} onClick={() => { setAuthMode('login'); setAuthError('') }}>Sign in</button></div><form onSubmit={authenticate}>{authMode === 'register' && <><label>Your name<input autoComplete="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required minLength="2" /></label><label>Phone (optional)<input autoComplete="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></label></>}<label>Email<input type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required /></label><label>Password<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 10 : undefined} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required />{authMode === 'register' && <small>Use at least 10 characters.</small>}</label>{authError && <p className="auth-error" role="alert">{authError}</p>}<button className="search-btn" type="submit">{authMode === 'register' ? 'Create account' : 'Sign in'} <Icon name="arrow" size={16} /></button></form></section></div>}
  </>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
