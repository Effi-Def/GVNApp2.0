import { useEffect, useMemo, useRef, useState } from 'react'
import { Event } from '../../types'

interface MonthCalendarProps {
  events: Event[]
  onSelectEvent: (eventId: string) => void
  date?: Date // optional; if omitted, calendar manages its own current month
  compact?: boolean // render a smaller, denser calendar
  onMonthChange?: (date: Date) => void // notify parent when month changes
  currentUserId: string // used to color and filter events by participation
}

// Utility to get start of day
const startOfDay = (d: Date) => {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

// Returns dates for the grid (Mon-Sun), including leading/trailing days to fill 6 rows
function getMonthGrid(target: Date) {
  const firstDayOfMonth = new Date(target.getFullYear(), target.getMonth(), 1)
  const lastDayOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0)

  // Week starts on Monday (Intl ISO standard: Monday=1, Sunday=7)
  const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7 // convert Sunday(0) to 6
  const gridStart = new Date(firstDayOfMonth)
  gridStart.setDate(firstDayOfMonth.getDate() - dayOfWeek)

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return { firstDayOfMonth, lastDayOfMonth, days }
}

const MonthCalendar = ({ events, onSelectEvent, date, compact = false, onMonthChange, currentUserId }: MonthCalendarProps) => {
  const today = startOfDay(new Date())
  const [viewDate, setViewDate] = useState<Date>(() => new Date(date ?? new Date()))
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipedRef = useRef(false)

  useEffect(() => {
    // keep in sync if parent provides date prop; ignore if undefined
    if (!date) return
    if (date.getFullYear() !== viewDate.getFullYear() || date.getMonth() !== viewDate.getMonth()) {
      setViewDate(new Date(date))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date?.getFullYear(), date?.getMonth()])

  const changeMonth = (delta: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1)
    setViewDate(next)
    onMonthChange?.(next)
  }

  const goToToday = () => {
    const now = new Date()
    const current = new Date(now.getFullYear(), now.getMonth(), 1)
    setViewDate(current)
    onMonthChange?.(current)
  }

  // Touch handlers for mobile swipe navigation (left = next, right = prev)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    swipedRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    // If horizontal movement dominates and exceeds threshold, consider it a swipe
    const threshold = 40
    if (!swipedRef.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) {
        changeMonth(1) // swipe left → next month
      } else {
        changeMonth(-1) // swipe right → previous month
      }
      swipedRef.current = true
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipedRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
    touchStartRef.current = null
    swipedRef.current = false
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const ev of events) {
      // Determine user's participation status
      const me = ev.participants?.find(p => p.userId === currentUserId)
      const status = me?.status || 'none'
      if (status === 'no') continue // do not show events the user declined

      const d = startOfDay(new Date(ev.date))
      const key = d.toISOString()
      const arr = map.get(key) || []
      arr.push(ev)
      map.set(key, arr)
    }
    return map
  }, [events, currentUserId])

  const { firstDayOfMonth, days } = useMemo(() => getMonthGrid(viewDate), [viewDate])

  const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(firstDayOfMonth)
  const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

  const isSameDay = (a: Date, b: Date) => a.getTime() === b.getTime()
  const isCurrentMonth = (d: Date) => d.getMonth() === firstDayOfMonth.getMonth()

  const getEventStyleClasses = (ev: Event) => {
    const me = ev.participants?.find(p => p.userId === currentUserId)
    const status = me?.status || 'none'
    // two colors only: participates (yes/maybe) vs no response
    const participates = status === 'yes' || status === 'maybe'
    return participates
      ? { label: 'bg-primary-50 text-primary-700 hover:bg-primary-100', dot: 'bg-primary-500 hover:bg-primary-600' }
      : { label: 'bg-accent-50 text-accent-700 hover:bg-accent-100', dot: 'bg-accent-500 hover:bg-accent-600' }
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        {/* Left controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mese precedente"
            onClick={() => changeMonth(-1)}
            className={`rounded-md border border-gray-200 ${compact ? 'p-1' : 'p-1.5'} hover:bg-gray-50`}
            title="Mese precedente"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Mese successivo"
            onClick={() => changeMonth(1)}
            className={`rounded-md border border-gray-200 ${compact ? 'p-1' : 'p-1.5'} hover:bg-gray-50`}
            title="Mese successivo"
          >
            ›
          </button>
        </div>

        <h2 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 capitalize`}>{monthLabel}</h2>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mese precedente"
            onClick={() => changeMonth(-1)}
            className={`rounded-md border border-gray-200 ${compact ? 'p-1' : 'p-1.5'} hover:bg-gray-50`}
            title="Mese precedente"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Oggi"
            onClick={goToToday}
            className={`rounded-md border border-gray-200 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} hover:bg-gray-50 hidden lg:inline`}
            title="Torna al mese corrente"
          >
            Oggi
          </button>
          <button
            type="button"
            aria-label="Mese successivo"
            onClick={() => changeMonth(1)}
            className={`rounded-md border border-gray-200 ${compact ? 'p-1' : 'p-1.5'} hover:bg-gray-50`}
            title="Mese successivo"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekdays header */}
      <div className={`grid grid-cols-7 ${compact ? 'gap-1.5' : 'gap-2'} text-center text-[10px] sm:text-xs font-medium text-gray-500 ${compact ? 'mb-1.5' : 'mb-2'}`}>
        {weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* Days grid */}
      <div
        className={`grid grid-cols-7 ${compact ? 'gap-1.5' : 'gap-2'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {days.map((d) => {
          const key = startOfDay(d).toISOString()
          const dayEvents = eventsByDay.get(key) || []
          const isToday = isSameDay(startOfDay(d), today)
          const inMonth = isCurrentMonth(d)
          return (
            <div
              key={key}
              className={`relative ${compact ? 'rounded-md' : 'rounded-lg'} border ${compact ? 'p-1 h-10 sm:p-1.5 sm:h-16' : 'p-2 h-24'} flex flex-col ${
                inMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200/60 text-gray-400'
              }`}
              title={new Intl.DateTimeFormat('it-IT').format(d)}
            >
              <div className={`flex items-center justify-between ${compact ? 'text-[10px]' : 'text-xs'} font-semibold mb-0.5 sm:mb-1`}>
                <span>{d.getDate()}</span>
                {isToday && (
                  <span className="text-[12px] sm:text-sm" title="Oggi">🐷</span>
                )}
              </div>

              {/* Event markers */}
              <div className="flex-1 overflow-hidden">
                {/* Ultra-compact markers on mobile: dots */}
                <div className="flex items-center gap-0.5 mt-0.5 sm:hidden">
                  {dayEvents.slice(0, 3).map(ev => {
                    const cls = getEventStyleClasses(ev)
                    return (
                    <button
                      key={ev.id}
                      onClick={() => onSelectEvent(ev.id)}
                      className={`w-1.5 h-1.5 rounded-full ${cls.dot}`}
                      title={ev.title}
                    />
                  )})}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-500 ml-0.5">+{dayEvents.length - 3}</div>
                  )}
                </div>

                {/* Text labels on sm+ screens */}
                <div className="hidden sm:block">
                  {dayEvents.slice(0, compact ? 1 : 2).map((ev) => {
                    const cls = getEventStyleClasses(ev)
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvent(ev.id)}
                        className={`w-full text-left truncate ${compact ? 'text-[10px]' : 'text-xs'} py-0.5 px-1 rounded ${cls.label}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    )
                  })}
                  {dayEvents.length > (compact ? 1 : 2) && (
                    <div className="text-[10px] text-gray-500 mt-0.5">+{dayEvents.length - (compact ? 1 : 2)} altri</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MonthCalendar
