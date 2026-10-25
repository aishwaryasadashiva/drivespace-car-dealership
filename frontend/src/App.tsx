import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

const API = 'http://127.0.0.1:8000/api'

type Vehicle = {
  id: number
  make: string
  model: string
  category: string
  price: number
  quantity_in_stock: number
}

type User = {
  id: number
  email: string
  is_admin: boolean
}

type CustomerOrder = {
  order_number: string
  vehicle: string | null
  exterior_colour: string
  unit_price: number
  created_at: string
}

type VehicleForm = {
  make: string
  model: string
  category: string
  price: string
  quantity_in_stock: string
}

const emptyVehicleForm: VehicleForm = {
  make: '',
  model: '',
  category: 'Sedan',
  price: '',
  quantity_in_stock: '0',
}

const money = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

async function apiRequest<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    throw new Error(
      typeof detail === 'string' ? detail : `Request failed (${response.status})`,
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function VehicleImage({ make, model }: { make: string; model: string }) {
  const [imageUrl, setImageUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${make} ${model} car`,
      gsrnamespace: '6',
      gsrlimit: '5',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '900',
      format: 'json',
      origin: '*',
    })

    fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error('Image search failed')
        return response.json()
      })
      .then((data) => {
        if (!active) return

        const pages = Object.values(data.query?.pages ?? []) as Array<{
          title?: string
          imageinfo?: Array<{ thumburl?: string; url?: string }>
        }>

        const matchingPage =
          pages.find((page) =>
            page.title?.toLowerCase().includes(model.toLowerCase()),
          ) ?? pages[0]

        const info = matchingPage?.imageinfo?.[0]
        const url = info?.thumburl || info?.url

        if (url) {
          setImageUrl(url)
        } else {
          setFailed(true)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [make, model])

  if (failed || !imageUrl) {
    return (
      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 text-white">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-blue-300">
            {make}
          </p>
          <p className="mt-2 text-xl font-bold">{model}</p>
          <p className="mt-2 text-xs text-slate-400">
            {failed ? 'Image unavailable' : 'Loading vehicle image…'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-44 overflow-hidden bg-white">
      <img
        src={imageUrl}
        alt={`${make} ${model}`}
        className="h-full w-full object-contain p-3"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function App() {
  const [checkoutVehicle, setCheckoutVehicle] = useState<Vehicle | null>(null)
  const [exteriorColour, setExteriorColour] = useState('Pearl White')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [orderBusy, setOrderBusy] = useState(false)
  const [lastOrder, setLastOrder] = useState<CustomerOrder | null>(null)
  const [orderHistory, setOrderHistory] = useState<CustomerOrder[]>([])

  const [token, setToken] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [vehicleForm, setVehicleForm] =
    useState<VehicleForm>(emptyVehicleForm)
  const [editingVehicleId, setEditingVehicleId] =
    useState<number | null>(null)
  const [restockQuantities, setRestockQuantities] =
    useState<Record<number, string>>({})

  const loadVehicles = useCallback(async (accessToken: string) => {
    setLoading(true)
    try {
      const data = await apiRequest<Vehicle[]>('/vehicles', accessToken)
      setVehicles(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load vehicles')
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (authMode === 'register') {
        await apiRequest<User>('/auth/register', undefined, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        setMessage('Account created successfully. Please log in.')
        setAuthMode('login')
        setPassword('')
      } else {
        const form = new URLSearchParams()
        form.set('username', email)
        form.set('password', password)

        const response = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(
            typeof body?.detail === 'string'
              ? body.detail
              : 'Login failed. Check your credentials.',
          )
        }

        const result: { access_token: string } = await response.json()
        const currentUser = await apiRequest<User>(
          '/auth/me',
          result.access_token,
        )

        setToken(result.access_token)
        setUser(currentUser)
        await loadVehicles(result.access_token)
        await loadOrderHistory(result.access_token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  function purchaseVehicle(id: number) {
    const vehicle = vehicles.find((item) => item.id === id)
    if (!vehicle) return
    setCheckoutVehicle(vehicle)
    setExteriorColour('Pearl White')
    setLastOrder(null)
    setError('')
    setMessage('')
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !checkoutVehicle) return
    setOrderBusy(true)
    setError('')
    setMessage('')
    try {
      const order = await apiRequest<CustomerOrder>(
        `/orders?vehicle_id=${checkoutVehicle.id}`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            exterior_colour: exteriorColour,
          }),
        },
      )
      setLastOrder(order)
      setMessage(`Order ${order.order_number} confirmed successfully.`)
      await loadVehicles(token)
      setOrderHistory(await apiRequest<CustomerOrder[]>('/orders/me', token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order')
    } finally {
      setOrderBusy(false)
    }
  }

  async function loadOrderHistory(accessToken: string = token) {
    if (!accessToken) return
    try {
      const history = await apiRequest<CustomerOrder[]>('/orders/me', accessToken)
      setOrderHistory(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order history')
    }
  }

  function resetVehicleForm() {
    setVehicleForm(emptyVehicleForm)
    setEditingVehicleId(null)
  }

  function startEditing(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id)
    setVehicleForm({
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: String(vehicle.price),
      quantity_in_stock: String(vehicle.quantity_in_stock),
    })
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !user?.is_admin) return

    setError('')
    setMessage('')

    const payload = {
      make: vehicleForm.make.trim(),
      model: vehicleForm.model.trim(),
      category: vehicleForm.category.trim(),
      price: Number(vehicleForm.price),
      quantity_in_stock: Number(vehicleForm.quantity_in_stock),
    }

    if (
      !payload.make ||
      !payload.model ||
      !payload.category ||
      !Number.isFinite(payload.price) ||
      payload.price <= 0 ||
      !Number.isInteger(payload.quantity_in_stock) ||
      payload.quantity_in_stock < 0
    ) {
      setError(
        'Enter valid vehicle details. Price must be positive and stock must be a whole number of zero or more.',
      )
      return
    }

    try {
      if (editingVehicleId === null) {
        await apiRequest<Vehicle>('/vehicles', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Vehicle added successfully.')
      } else {
        await apiRequest<Vehicle>(`/vehicles/${editingVehicleId}`, token, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Vehicle updated successfully.')
      }
      resetVehicleForm()
      await loadVehicles(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vehicle')
    }
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!token || !user?.is_admin) return
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model}?`)) return

    setError('')
    setMessage('')

    try {
      await apiRequest<{ message: string }>(`/vehicles/${vehicle.id}`, token, {
        method: 'DELETE',
      })
      setMessage(`${vehicle.make} ${vehicle.model} deleted successfully.`)
      if (editingVehicleId === vehicle.id) resetVehicleForm()
      await loadVehicles(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete vehicle')
    }
  }

  async function restockVehicle(vehicle: Vehicle) {
    if (!token || !user?.is_admin) return
    const quantity = Number(restockQuantities[vehicle.id])

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError('Enter a restock quantity greater than zero.')
      return
    }

    setError('')
    setMessage('')

    try {
      await apiRequest<Vehicle>(`/vehicles/${vehicle.id}/restock`, token, {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      })
      setMessage(`${vehicle.make} ${vehicle.model} restocked successfully.`)
      setRestockQuantities((current) => ({
        ...current,
        [vehicle.id]: '',
      }))
      await loadVehicles(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restock vehicle')
    }
  }
    function logout() {
    setToken('')
    setUser(null)
    setVehicles([])
    setOrderHistory([])
    setLastOrder(null)
    setCheckoutVehicle(null)
    setPassword('')
    setMessage('')
    setError('')
    setSearch('')
    setCategory('All')
    setMinPrice('')
    setMaxPrice('')
    resetVehicleForm()
  }

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const matchesSearch =
          `${vehicle.make} ${vehicle.model} ${vehicle.category}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())

        const matchesCategory =
          category === 'All' || vehicle.category === category

        const matchesMinPrice =
          minPrice === '' || vehicle.price >= Number(minPrice)

        const matchesMaxPrice =
          maxPrice === '' || vehicle.price <= Number(maxPrice)

        return (
          matchesSearch &&
          matchesCategory &&
          matchesMinPrice &&
          matchesMaxPrice
        )
      }),
    [vehicles, search, category, minPrice, maxPrice],
  )

  const availableCount = vehicles.filter(
    (vehicle) => vehicle.quantity_in_stock > 0,
  ).length

  const totalUnits = vehicles.reduce(
    (total, vehicle) => total + vehicle.quantity_in_stock,
    0,
  )

  const manufacturerCount = new Set(vehicles.map((vehicle) => vehicle.make)).size

  if (!token || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-900">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
          <div className="relative flex min-h-64 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 p-8 text-white md:p-10">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10" />
            <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full border border-white/10" />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-300">
                DriveSpace
              </p>
              <h1 className="mt-10 text-4xl font-bold leading-tight sm:text-5xl">
                Find the car
                <br />
                that moves you.
              </h1>
              <p className="mt-4 max-w-sm leading-7 text-slate-300">
                A thoughtfully curated collection of everyday favourites and
                premium drives, all in one place.
              </p>
            </div>
            <p className="relative mt-12 text-xs uppercase tracking-[0.2em] text-slate-400">
              Your next journey starts here
            </p>
          </div>

          <form onSubmit={handleAuth} className="p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              Welcome to DriveSpace
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {authMode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {authMode === 'login'
                ? 'Log in to discover the collection and explore available vehicles.'
                : 'Register to access the DriveSpace vehicle collection.'}
            </p>

            {message && (
              <p
                role="status"
                className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {message}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <label className="mt-7 block text-sm font-medium" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />

            <label
              className="mt-5 block text-sm font-medium"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                authMode === 'login' ? 'current-password' : 'new-password'
              }
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />

            <button
              disabled={loading}
              className="mt-7 w-full rounded-xl bg-blue-700 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {loading
                ? 'Please wait…'
                : authMode === 'login'
                  ? 'Log in'
                  : 'Create account'}
            </button>

            <p className="mt-6 text-center text-sm text-slate-600">
              {authMode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}{' '}
              <button
                type="button"
                className="font-semibold text-blue-700 hover:text-blue-900"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login')
                  setError('')
                  setMessage('')
                }}
              >
                {authMode === 'login' ? 'Register' : 'Log in'}
              </button>
            </p>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-700">
              DriveSpace
            </p>
            <p className="mt-1 text-sm text-slate-500">
              The art of finding your drive
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-slate-500">
                {user.is_admin ? 'Administrator' : 'Customer account'}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-7 py-10 text-white shadow-xl sm:px-12 sm:py-14">
          <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-8 -top-12 h-60 w-60 rounded-full border border-white/10" />
          <div className="absolute bottom-0 right-0 h-1/2 w-1/2 bg-gradient-to-tl from-blue-500/10 to-transparent" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
              The DriveSpace Collection
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              Discover your
              <br />
              next drive.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              From practical city companions to premium performance, explore
              a collection of vehicles for every road and every ambition.
            </p>
            <a
              href="#collection"
              className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-blue-100"
            >
              Explore the collection <span className="ml-2">↓</span>
            </a>
          </div>
          <div className="relative mt-10 flex flex-wrap gap-3 text-xs font-medium text-slate-300 sm:mt-12">
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
              {vehicles.length} unique models
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
              {manufacturerCount} manufacturers
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
              {totalUnits} units available
            </span>
          </div>
        </section>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {user.is_admin && (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
              Admin workspace
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {editingVehicleId === null
                ? 'Add a vehicle'
                : `Edit vehicle #${editingVehicleId}`}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Manage vehicle details and showroom availability.
            </p>

            <form
              onSubmit={saveVehicle}
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="text-sm font-medium">
                Manufacturer
                <input
                  required
                  maxLength={100}
                  className={inputClass}
                  value={vehicleForm.make}
                  onChange={(event) =>
                    setVehicleForm({ ...vehicleForm, make: event.target.value })
                  }
                  placeholder="e.g. Toyota"
                />
              </label>

              <label className="text-sm font-medium">
                Model
                <input
                  required
                  maxLength={100}
                  className={inputClass}
                  value={vehicleForm.model}
                  onChange={(event) =>
                    setVehicleForm({
                      ...vehicleForm,
                      model: event.target.value,
                    })
                  }
                  placeholder="e.g. Fortuner"
                />
              </label>

              <label className="text-sm font-medium">
                Category
                <select
                  required
                  className={inputClass}
                  value={vehicleForm.category}
                  onChange={(event) =>
                    setVehicleForm({
                      ...vehicleForm,
                      category: event.target.value,
                    })
                  }
                >
                  <option>Sedan</option>
                  <option>SUV</option>
                  <option>Hatchback</option>
                  <option>MPV</option>
                  <option>Luxury Sedan</option>
                  <option>Luxury SUV</option>
                  <option>Coupe</option>
                  <option>Truck</option>
                  <option>Other</option>
                </select>
              </label>

              <label className="text-sm font-medium">
                Price (₹)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  value={vehicleForm.price}
                  onChange={(event) =>
                    setVehicleForm({
                      ...vehicleForm,
                      price: event.target.value,
                    })
                  }
                  placeholder="1500000"
                />
              </label>

              <label className="text-sm font-medium">
                Quantity in stock
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={vehicleForm.quantity_in_stock}
                  onChange={(event) =>
                    setVehicleForm({
                      ...vehicleForm,
                      quantity_in_stock: event.target.value,
                    })
                  }
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
                >
                  {editingVehicleId === null ? 'Add vehicle' : 'Save changes'}
                </button>
                {editingVehicleId !== null && (
                  <button
                    type="button"
                    onClick={resetVehicleForm}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Unique vehicle models</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {vehicles.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Across the collection
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Models available</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">
              {availableCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              With at least one unit in stock
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total units available</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {totalUnits}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Across all vehicle models
            </p>
          </div>
        </section>
                {!user.is_admin && (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                  Your account
                </p>
                <h2 className="mt-2 text-2xl font-bold">Purchase history</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Orders placed using this DriveSpace account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadOrderHistory()}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh history
              </button>
            </div>

            {orderHistory.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No orders yet. Your completed purchases will appear here.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {orderHistory.map((order) => (
                  <article
                    key={order.order_number}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {order.vehicle ?? 'Vehicle'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Order {order.order_number} · {order.exterior_colour}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {money(order.unit_price)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
        Your account
      </p>
      <h2 className="mt-2 text-2xl font-bold">Purchase history</h2>
    </div>

    <button
      type="button"
      onClick={() => void loadOrderHistory()}
      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
    >
      Refresh
    </button>
  </div>

  {orderHistory.length === 0 ? (
    <p className="mt-4 text-sm text-slate-500">
      No orders found. Your purchases will appear here.
    </p>
  ) : (
    <div className="mt-4 space-y-3">
      {orderHistory.map((order) => (
        <div
          key={order.order_number}
          className="rounded-xl border border-slate-100 p-4"
        >
          <p className="font-semibold">
            {order.vehicle ?? 'Vehicle order'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Order: {order.order_number}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Colour: {order.exterior_colour}
          </p>
          <p className="mt-2 font-bold">{money(order.unit_price)}</p>
        </div>
      ))}
    </div>
  )}
</section>
        <section id="collection" className="mt-12 scroll-mt-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                Find your match
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Explore the collection
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Browse distinctive models, compare prices, and find the right
                vehicle for your next journey.
              </p>
            </div>
            <span className="text-sm font-medium text-slate-500">
              {filteredVehicles.length} of {vehicles.length} models
            </span>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <input
              aria-label="Search vehicles"
              className={inputClass.replace('mt-1 ', '')}
              placeholder="Search make or model..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter by category"
              className={inputClass.replace('mt-1 ', '')}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>All</option>
              <option>Sedan</option>
              <option>SUV</option>
              <option>Hatchback</option>
              <option>MPV</option>
              <option>Luxury Sedan</option>
              <option>Luxury SUV</option>
              <option>Coupe</option>
              <option>Truck</option>
              <option>Other</option>
            </select>
            <input
              aria-label="Minimum price"
              type="number"
              min="0"
              className={inputClass.replace('mt-1 ', '')}
              placeholder="Minimum price (₹)"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
            <input
              aria-label="Maximum price"
              type="number"
              min="0"
              className={inputClass.replace('mt-1 ', '')}
              placeholder="Maximum price (₹)"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </div>

          {loading && (
            <p className="mt-5 text-sm text-slate-500">
              Updating the collection…
            </p>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <article
                key={vehicle.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <div className="relative">
                  <VehicleImage make={vehicle.make} model={vehicle.model} />
                  <span
                    className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      vehicle.quantity_in_stock > 0
                        ? 'bg-emerald-400/15 text-emerald-200'
                        : 'bg-red-400/15 text-red-200'
                    }`}
                  >
                    {vehicle.quantity_in_stock > 0 ? 'Available' : 'Sold out'}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                        {vehicle.make}
                      </p>
                      <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                        {vehicle.model}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                      {vehicle.category}
                    </span>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">
                      Indicative showroom price
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                      {money(vehicle.price)}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span
                      className={`text-xs font-semibold ${
                        vehicle.quantity_in_stock > 0
                          ? 'text-emerald-700'
                          : 'text-red-600'
                      }`}
                    >
                      {vehicle.quantity_in_stock > 0
                        ? `${vehicle.quantity_in_stock} units in stock`
                        : 'Currently unavailable'}
                    </span>

                    {!user.is_admin && (
                      <button
                        disabled={vehicle.quantity_in_stock === 0 || loading}
                        onClick={() => purchaseVehicle(vehicle.id)}
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Purchase
                      </button>
                    )}
                  </div>

                  {user.is_admin && (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                        Inventory management
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(vehicle)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteVehicle(vehicle)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          aria-label={`Restock quantity for ${vehicle.make} ${vehicle.model}`}
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Quantity"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={restockQuantities[vehicle.id] ?? ''}
                          onChange={(event) =>
                            setRestockQuantities((current) => ({
                              ...current,
                              [vehicle.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => restockVehicle(vehicle)}
                          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {!loading && filteredVehicles.length === 0 && !error && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="font-semibold">No matching vehicles found</p>
              <p className="mt-2 text-sm text-slate-500">
                Try adjusting your search or filters to explore more models.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setCategory('All')
                  setMinPrice('')
                  setMaxPrice('')
                }}
                className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
                {checkoutVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4">
            <div className="my-6 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
              {lastOrder ? (
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                    ✓
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-700">
                    Order confirmed
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    Your DriveSpace order is placed
                  </h2>
                  <p className="mt-3 text-slate-600">
                    Order number: <strong>{lastOrder.order_number}</strong>
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {lastOrder.vehicle} · {lastOrder.exterior_colour}
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {money(lastOrder.unit_price)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    This is an order confirmation, not a final dealer invoice.
                    Confirm final on-road charges with the dealership.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCheckoutVehicle(null)}
                    className="mt-6 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white"
                  >
                    Back to showroom
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                        DriveSpace checkout
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        {checkoutVehicle.make} {checkoutVehicle.model}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose a colour and enter customer details to place
                        your order.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutVehicle(null)}
                      aria-label="Close checkout"
                      className="rounded-lg px-3 py-2 text-slate-500"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">
                      Indicative showroom price
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {money(checkoutVehicle.price)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Bengaluru on-road totals depend on variant, registration,
                      road tax, insurance and applicable charges. This is not a
                      dealer quotation.
                    </p>
                  </div>

                  <form className="mt-5 space-y-4" onSubmit={submitOrder}>
                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Exterior colour
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          'Pearl White',
                          'Midnight Black',
                          'Silver',
                          'Red',
                          'Blue',
                        ].map((colour) => (
                          <button
                            key={colour}
                            type="button"
                            onClick={() => setExteriorColour(colour)}
                            className={`rounded-full border px-3 py-2 text-sm ${
                              exteriorColour === colour
                                ? 'border-blue-700 bg-blue-50 font-semibold text-blue-800 ring-2 ring-blue-100'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {colour}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Colour availability varies by model and variant;
                        confirm with the dealer.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Full name
                        <input
                          required
                          minLength={2}
                          value={customerName}
                          onChange={(event) =>
                            setCustomerName(event.target.value)
                          }
                          className={inputClass}
                          autoComplete="name"
                        />
                      </label>

                      <label className="text-sm font-semibold text-slate-700">
                        Email
                        <input
                          required
                          type="email"
                          value={customerEmail}
                          onChange={(event) =>
                            setCustomerEmail(event.target.value)
                          }
                          className={inputClass}
                          autoComplete="email"
                        />
                      </label>

                      <label className="text-sm font-semibold text-slate-700">
                        Phone number
                        <input
                          required
                          minLength={7}
                          value={customerPhone}
                          onChange={(event) =>
                            setCustomerPhone(event.target.value)
                          }
                          className={inputClass}
                          autoComplete="tel"
                        />
                      </label>

                      <label className="text-sm font-semibold text-slate-700">
                        Address
                        <input
                          required
                          minLength={5}
                          value={customerAddress}
                          onChange={(event) =>
                            setCustomerAddress(event.target.value)
                          }
                          className={inputClass}
                          autoComplete="street-address"
                        />
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setCheckoutVehicle(null)}
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={orderBusy}
                        type="submit"
                        className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {orderBusy
                          ? 'Placing order…'
                          : 'Review & place order'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="mt-14 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          DriveSpace · Discover your next drive.
        </footer>
      </div>
    </main>
  )
}

export default App
