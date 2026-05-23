export type MandiSession = {
  id: string
  eatenAt: string
  portions: number
  quarterUnits: number
  mayoUnits: number
  softDrinks: number
  softDrinkType: string | null
  penaltyHours: number
}

export type AuthUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  initialLifeExpectancyYears: number | null
}

export type MeResponse = {
  user: AuthUser | null
  sessions: MandiSession[]
}

export async function useMandi() {
  const config = useRuntimeConfig()
  const { data, pending, error, refresh } = await useFetch<MeResponse>('/api/me', {
    key: 'me',
    default: () => ({ user: null, sessions: [] })
  })

  const lifeExpectancyYears = ref(75)
  const displayName = ref('')
  const onboardingError = ref('')
  const quarterUnits = ref(0)
  const mayoUnits = ref(0)
  const softDrinks = ref(0)
  const softDrinkType = ref('pepsi')
  const sessionError = ref('')
  const latestPenalty = ref(0)
  const pulseLife = ref(false)
  const showLogModal = ref(false)

  const user = computed(() => data.value.user)
  const sessions = computed(() => data.value.sessions)
  const profileCreated = computed(() => Boolean(user.value?.initialLifeExpectancyYears))
  const penaltyHoursPerQuarter = computed(() => Number(config.public.penaltyHoursPerQuarter) || 1.5)
  const mayoPenaltyHours = computed(() => Number(config.public.mayoPenaltyHours) || 1)
  const softDrinkPenaltyHours = computed(() => Number(config.public.softDrinkPenaltyHours) || 2)
  const estimatedPenalty = computed(
    () =>
      quarterUnits.value * penaltyHoursPerQuarter.value +
      mayoUnits.value * mayoPenaltyHours.value +
      softDrinks.value * softDrinkPenaltyHours.value
  )

  const totalPenaltyHours = computed(() =>
    sessions.value.reduce((total, session) => total + session.penaltyHours, 0)
  )
  const effectiveLifeExpectancyYears = computed(
    () => user.value?.initialLifeExpectancyYears || lifeExpectancyYears.value
  )
  const initialHours = computed(() => Math.max(0, effectiveLifeExpectancyYears.value * 365.25 * 24))
  const remainingHours = computed(() => Math.max(0, initialHours.value - totalPenaltyHours.value))
  const totalPortions = computed(() =>
    sessions.value.reduce((total, session) => total + session.portions, 0)
  )
  const totalMandiLabel = computed(() => formatMandiQuantity(totalPortions.value))
  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => new Date(b.eatenAt).getTime() - new Date(a.eatenAt).getTime())
  )
  const sessionDateKeys = computed(() =>
    [...new Set(sessions.value.map((session) => toDateKey(session.eatenAt)))].sort()
  )
  const currentStreak = computed(() => {
    const dates = new Set(sessionDateKeys.value)
    let cursor = new Date()
    let streak = 0

    while (dates.has(toDateKey(cursor))) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    return streak
  })
  const bestStreak = computed(() => {
    let best = 0
    let current = 0
    let previous: Date | null = null

    for (const dateKey of sessionDateKeys.value) {
      const date = new Date(`${dateKey}T00:00:00`)

      if (previous && dayDifference(previous, date) === 1) {
        current += 1
      } else {
        current = 1
      }

      best = Math.max(best, current)
      previous = date
    }

    return best
  })

  const remainingBreakdown = computed(() => {
    const hours = Math.floor(remainingHours.value)
    const years = Math.floor(hours / (365.25 * 24))
    const remainderAfterYears = hours - Math.floor(years * 365.25 * 24)
    const days = Math.floor(remainderAfterYears / 24)
    const leftoverHours = remainderAfterYears % 24

    return { years, days, hours: leftoverHours }
  })

  const totalLostLabel = computed(() => formatDuration(totalPenaltyHours.value))

  const impactLine = computed(() => {
    if (!sessions.value.length) {
      return 'No damage logged yet. Suspiciously responsible.'
    }

    if (totalPenaltyHours.value < 24) {
      return `${totalLostLabel.value} traded for rice, meat, and confidence.`
    }

    return `${totalLostLabel.value} donated to the mandi timeline.`
  })

  watchEffect(() => {
    if (user.value?.initialLifeExpectancyYears) {
      lifeExpectancyYears.value = user.value.initialLifeExpectancyYears
    }
    if (user.value?.displayName && !displayName.value) {
      displayName.value = user.value.displayName
    }
  })

  function loginWithGoogle() {
    window.location.href = '/api/auth/google'
  }

  async function completeOnboarding() {
    onboardingError.value = ''

    if (!displayName.value.trim()) {
      onboardingError.value = 'Tell us your name first.'
      return
    }

    if (!Number.isFinite(lifeExpectancyYears.value) || lifeExpectancyYears.value < 1) {
      onboardingError.value = 'Life expectancy needs to be at least 1 year. Be dramatic, not impossible.'
      return
    }

    if (lifeExpectancyYears.value > 150) {
      onboardingError.value = 'ath kurach athyagraham alle monu'
      return
    }

    try {
      await $fetch('/api/me', {
        method: 'PATCH',
        body: {
          initialLifeExpectancyYears: lifeExpectancyYears.value,
          displayName: displayName.value.trim()
        }
      })
      await refresh()
    } catch {
      onboardingError.value = 'Could not save your profile. Try again.'
    }
  }

  async function logMandiSession() {
    sessionError.value = ''

    if (!Number.isFinite(quarterUnits.value) || quarterUnits.value < 1) {
      sessionError.value = 'Log at least one quarter. Air mandi does not count.'
      return
    }

    const todayKey = toDateKey(new Date())
    const todayCount = sessions.value.filter((session) => toDateKey(session.eatenAt) === todayKey).length
    if (todayCount >= 4) {
      sessionError.value = 'ne jeevikan vendi thinnano atho thinnan vendi jeevikano? 🙂'
      return
    }

    const normalizedQuarterUnits = Math.min(4, Math.floor(quarterUnits.value))
    const normalizedMayoUnits = Math.min(20, Math.max(0, Math.floor(mayoUnits.value || 0)))
    const normalizedSoftDrinks = Math.min(20, Math.max(0, Math.floor(softDrinks.value || 0)))

    try {
      const response = await $fetch<{ session: MandiSession }>('/api/mandi', {
        method: 'POST',
        body: {
          quarterUnits: normalizedQuarterUnits,
          mayoUnits: normalizedMayoUnits,
          softDrinks: normalizedSoftDrinks,
          softDrinkType: normalizedSoftDrinks ? softDrinkType.value : null
        }
      })

      data.value.sessions = [response.session, ...data.value.sessions]
      resetOrder()
      showLogModal.value = false
      latestPenalty.value = response.session.penaltyHours
      pulseLife.value = true
      window.setTimeout(() => {
        pulseLife.value = false
      }, 900)
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode
      const message = (error as { statusMessage?: string })?.statusMessage
      if (status === 429 && message) {
        sessionError.value = message
      } else {
        sessionError.value = 'Could not log this session. The mandi survived the paperwork.'
      }
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    latestPenalty.value = 0
    pulseLife.value = false
    await refresh()
  }

  function addMandi(units: number) {
    quarterUnits.value = Math.min(4, quarterUnits.value + units)
  }

  function addMayo() {
    mayoUnits.value = Math.min(20, mayoUnits.value + 1)
  }

  function addSoftDrink(type: string) {
    softDrinkType.value = type
    softDrinks.value = Math.min(20, softDrinks.value + 1)
  }

  function resetOrder() {
    quarterUnits.value = 0
    mayoUnits.value = 0
    softDrinks.value = 0
    softDrinkType.value = 'pepsi'
  }

  function openLogModal() {
    sessionError.value = ''
    resetOrder()
    showLogModal.value = true
  }

  function closeLogModal() {
    showLogModal.value = false
  }

  function removeMandiQuarter() {
    quarterUnits.value = Math.max(0, quarterUnits.value - 1)
  }

  function removeMayo() {
    mayoUnits.value = Math.max(0, mayoUnits.value - 1)
  }

  function removeSoftDrink() {
    softDrinks.value = Math.max(0, softDrinks.value - 1)
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  }

  function formatMandiQuantity(portionsValue: number) {
    if (!portionsValue) {
      return '0'
    }

    if (Number.isInteger(portionsValue)) {
      return String(portionsValue)
    }

    return portionsValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  }

  function formatSessionQuantity(session: MandiSession) {
    const units = session.quarterUnits || Math.round(session.portions * 4)
    const full = Math.floor(units / 4)
    const remainder = units % 4
    const parts: string[] = []

    if (full) {
      parts.push(`${full} full`)
    }

    if (remainder) {
      parts.push(`${remainder}/4`)
    }

    return parts.length ? parts.join(' + ') : '0'
  }

  function formatShortHours(hoursValue: number) {
    return `${Number.isInteger(hoursValue) ? hoursValue : hoursValue.toFixed(1)}h`
  }

  function toDateKey(value: string | Date) {
    const date = typeof value === 'string' ? new Date(value) : value
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  function dayDifference(start: Date, end: Date) {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())

    return Math.round((endUtc - startUtc) / 86_400_000)
  }

  function formatDuration(hoursValue: number) {
    const totalMinutes = Math.round(hoursValue * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (totalMinutes <= 0) {
      return '0 hours'
    }

    const days = Math.floor(hours / 24)
    const leftoverHours = hours % 24

    if (!days) {
      return `${leftoverHours} hour${leftoverHours === 1 ? '' : 's'}${
        minutes ? ` ${minutes} min` : ''
      }`
    }

    if (!leftoverHours) {
      return `${days} day${days === 1 ? '' : 's'}${minutes ? ` ${minutes} min` : ''}`
    }

    return `${days} day${days === 1 ? '' : 's'} ${leftoverHours} hour${
      leftoverHours === 1 ? '' : 's'
    }${minutes ? ` ${minutes} min` : ''}`
  }

  return {
    data,
    pending,
    error,
    refresh,
    user,
    sessions,
    profileCreated,
    lifeExpectancyYears,
    displayName,
    onboardingError,
    quarterUnits,
    mayoUnits,
    softDrinks,
    softDrinkType,
    sessionError,
    latestPenalty,
    pulseLife,
    showLogModal,
    penaltyHoursPerQuarter,
    mayoPenaltyHours,
    softDrinkPenaltyHours,
    estimatedPenalty,
    totalPenaltyHours,
    remainingBreakdown,
    totalLostLabel,
    totalMandiLabel,
    currentStreak,
    bestStreak,
    impactLine,
    sortedSessions,
    loginWithGoogle,
    completeOnboarding,
    logMandiSession,
    logout,
    addMandi,
    addMayo,
    addSoftDrink,
    resetOrder,
    openLogModal,
    closeLogModal,
    removeMandiQuarter,
    removeMayo,
    removeSoftDrink,
    formatDate,
    formatMandiQuantity,
    formatSessionQuantity,
    formatShortHours
  }
}
