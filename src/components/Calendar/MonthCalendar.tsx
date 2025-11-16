import { useEffect, useMemo, useRef, useState } from 'react'
import { Event } from '../../types'

interface MonthCalendarProps {
  events: Event[]
  onSelectEvent: (eventId: string) => void
  date?: Date // optional; if omitted, calendar manages its own current month
  compact?: boolean // render a smaller, denser calendar
  onMonthChange?: (date: Date) => void // notify parent when month changes
  currentUserId: string // used to color and filter events by participation
  onCreateEvent?: (date: Date) => void // create event when clicking on empty day
}

// Utility to get start of day
const startOfDay = (d: Date) => {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

// Local date key (timezone-safe) YYYY-MM-DD
const dateKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

const MonthCalendar = ({ events, onSelectEvent, date, compact = false, onMonthChange, currentUserId, onCreateEvent }: MonthCalendarProps) => {
  const today = startOfDay(new Date())
  const [viewDate, setViewDate] = useState<Date>(() => new Date(date ?? new Date()))
  const [openDay, setOpenDay] = useState<string | null>(null) // for mobile multi-event popup
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

  // Build day-indexed map AND precompute multi-day spans
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const ev of events) {
      // Determine user's participation status
      const me = ev.participants?.find(p => p.userId === currentUserId)
      const status = me?.status || 'none'
      if (status === 'no') continue // do not show events the user declined

      const start = startOfDay(new Date(ev.date))
      const end = ev.endDate ? startOfDay(new Date(ev.endDate)) : start
      // iterate days from start to end inclusive
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = dateKey(d)
        const arr = map.get(key) || []
        arr.push(ev)
        map.set(key, arr)
      }
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
    const status = me?.status || 'none' // none = non ha ancora risposto → nuovo
    switch (status) {
      case 'yes':
        // Stronger green for better visibility
        return { label: 'bg-green-100 text-green-800 hover:bg-green-200', dot: 'bg-green-600 hover:bg-green-700' }
      case 'maybe':
        return { label: 'bg-gray-50 text-gray-700 hover:bg-gray-100', dot: 'bg-gray-400 hover:bg-gray-500' }
      // 'no' viene escluso a monte, quindi non serve gestirlo qui
      default: // none → nuovo
        return { label: 'bg-red-50 text-red-700 hover:bg-red-100', dot: 'bg-red-500 hover:bg-red-600' }
    }
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
          const key = dateKey(startOfDay(d))
          const dayEvents = eventsByDay.get(key) || []
          const isToday = isSameDay(startOfDay(d), today)
          const inMonth = isCurrentMonth(d)

          // Aggregate day status: red if any 'none', else green if any 'yes'
          let dayColor: 'red' | 'green' | null = null
          if (dayEvents.length > 0) {
            const statuses = dayEvents.map(ev => (ev.participants?.find(p => p.userId === currentUserId)?.status || 'none'))
            if (statuses.includes('none')) dayColor = 'red'
            else if (statuses.includes('yes')) dayColor = 'green'
          }

          const bgClass = !inMonth
            ? 'bg-gray-50 border-gray-200/60 text-gray-400'
            : dayColor === 'red'
            ? 'bg-red-50 border-red-200'
            : dayColor === 'green'
            ? 'bg-green-100 border-green-300'
            : 'bg-white border-gray-200'

          const handleDayClick = () => {
            if (dayEvents.length === 0) {
              onCreateEvent?.(startOfDay(d))
              return
            }
            if (dayEvents.length === 1) {
              onSelectEvent(dayEvents[0].id)
              return
            }
            setOpenDay((prev) => (prev === key ? null : key))
          }

          return (
            <div
              key={key}
              className={`relative ${compact ? 'rounded-md' : 'rounded-lg'} border ${compact ? 'p-1 h-10 sm:p-1.5 sm:h-16' : 'p-2 h-24'} flex flex-col ${bgClass}`}
              title={new Intl.DateTimeFormat('it-IT').format(d)}
              onClick={handleDayClick}
            >
              <div className={`flex items-center justify-between ${compact ? 'text-[10px]' : 'text-xs'} font-semibold mb-0.5 sm:mb-1`}>
                <span>{d.getDate()}</span>
                {isToday && (
                  <span className="text-[12px] sm:text-sm" title="Oggi">🐷</span>
                )}
              </div>

              {/* Event markers + multi-day bars */}
              <div className="flex-1 overflow-hidden">
                {/* Mobile dots/bars */}
                <div className="sm:hidden mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => {
                    const cls = getEventStyleClasses(ev)
                    const isMulti = !!ev.endDate && startOfDay(new Date(ev.endDate)).getTime() !== startOfDay(new Date(ev.date)).getTime()
                    return (
                      <span
                        key={ev.id}
                        className={`${isMulti ? 'block h-1.5 rounded-sm w-full' : 'inline-block w-1.5 h-1.5 rounded-full'} ${cls.dot}`}
                        title={ev.title}
                      />
                    )
                  })}
                </div>

                {/* Text labels on sm+ screens */}
                <div className="hidden sm:block">
                  {dayEvents.slice(0, compact ? 1 : 2).map((ev) => {
                    const cls = getEventStyleClasses(ev)
                    return (
                      <button
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onSelectEvent(ev.id) }}
                        className={`w-full text-left truncate ${compact ? 'text-[10px]' : 'text-xs'} py-0.5 px-1 rounded ${cls.label}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Balloon chooser with list and + (all sizes) */}
              {openDay === key && dayEvents.length >= 1 && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-1 z-30 bg-white border border-gray-200 rounded-md shadow-lg p-2 space-y-2
                             w-[92vw] sm:w-[85vw] md:w-[75vw] lg:w-[60vw] xl:w-[50vw] max-w-5xl min-w-[18rem]
                             max-h-[80vh] overflow-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2 px-1 py-0.5">
                    <span className="text-[11px] text-gray-600">{dayEvents.length} evento{dayEvents.length > 1 ? 'i' : ''}</span>
                    {onCreateEvent && (
                      <button
                        onClick={() => { onCreateEvent(startOfDay(d)); setOpenDay(null) }}
                        className="text-[12px] px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                        title="Aggiungi evento"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="pr-1">
                    {dayEvents.map(ev => {
                      const cls = getEventStyleClasses(ev)
                      const isMulti = !!ev.endDate && startOfDay(new Date(ev.endDate)).getTime() !== startOfDay(new Date(ev.date)).getTime()
                      return (
                        <button
                          key={ev.id}
                          onClick={() => { onSelectEvent(ev.id); setOpenDay(null) }}
                          className={`w-full text-left ${compact ? 'text-[11px]' : 'text-[12px]'} py-1 px-1.5 rounded ${cls.label} flex items-center gap-2`}
                          title={ev.title}
                        >
                          <span className={`${isMulti ? 'w-3.5 h-1.5 rounded-sm' : 'w-1.5 h-1.5 rounded-full'} ${cls.dot} inline-block`}></span>
                          <span className="whitespace-normal break-words leading-snug">{ev.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MonthCalendar
