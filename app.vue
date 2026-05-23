<script setup lang="ts">
type MandiSession = {
  id: string
  eatenAt: string
  portions: number
  quarterUnits: number
  mayoUnits: number
  softDrinks: number
  softDrinkType: string | null
  penaltyHours: number
}

type AuthUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  initialLifeExpectancyYears: number | null
}

type MeResponse = {
  user: AuthUser | null
  sessions: MandiSession[]
}

type Leader = {
  id: string
  displayName: string
  avatarUrl: string | null
  mandiCount: number
  sessionCount: number
}

type LeaderboardResponse = {
  leaders: Leader[]
}

const config = useRuntimeConfig()
const route = useRoute()
const { data, pending, error, refresh } = await useFetch<MeResponse>('/api/me', {
  default: () => ({ user: null, sessions: [] })
})
const { data: leaderboard } = await useFetch<LeaderboardResponse>('/api/leaderboard', {
  default: () => ({ leaders: [] })
})

const leaders = computed(() => leaderboard.value.leaders)
const podium = computed(() => ({
  first: leaders.value[0] ?? null,
  second: leaders.value[1] ?? null,
  third: leaders.value[2] ?? null
}))

function leaderInitial(leader: Leader) {
  return leader.displayName.trim().charAt(0).toUpperCase() || '?'
}

const lifeExpectancyYears = ref(75)
const onboardingError = ref('')
const quarterUnits = ref(0)
const mayoUnits = ref(0)
const softDrinks = ref(0)
const softDrinkType = ref('pepsi')
const sessionError = ref('')
const latestPenalty = ref(0)
const pulseLife = ref(false)
const showLogModal = ref(false)
const authError = computed(() => route.query.authError === 'google')
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
})

function loginWithGoogle() {
  window.location.href = '/api/auth/google'
}

async function completeOnboarding() {
  onboardingError.value = ''

  if (!Number.isFinite(lifeExpectancyYears.value) || lifeExpectancyYears.value < 1) {
    onboardingError.value = 'Life expectancy needs to be at least 1 year. Be dramatic, not impossible.'
    return
  }

  try {
    await $fetch('/api/me', {
      method: 'PATCH',
      body: {
        initialLifeExpectancyYears: lifeExpectancyYears.value
      }
    })
    await refresh()
  } catch {
    onboardingError.value = 'Could not save your profile. Check the Cloudflare DB binding and try again.'
  }
}

async function logMandiSession() {
  sessionError.value = ''

  if (!Number.isFinite(quarterUnits.value) || quarterUnits.value < 1) {
    sessionError.value = 'Log at least one quarter. Air mandi does not count.'
    return
  }

  const normalizedQuarterUnits = Math.min(80, Math.floor(quarterUnits.value))
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
  } catch {
    sessionError.value = 'Could not log this session. The mandi survived the paperwork.'
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  latestPenalty.value = 0
  pulseLife.value = false
  await refresh()
}

function addMandi(units: number) {
  quarterUnits.value = Math.min(80, quarterUnits.value + units)
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
</script>

<template>
  <main class="shell">
    <section v-if="user" class="hero-panel" aria-labelledby="app-title">
      <div class="hero-copy">
        <p class="eyebrow">Google login · Cloudflare D1</p>
        <h1 id="app-title">Mandi Theeta</h1>
        <p>
          A tiny accountability machine for every mandi decision that felt correct at the time.
        </p>
      </div>

      <div class="plate-orbit" aria-hidden="true">
        <div class="steam steam-one" />
        <div class="steam steam-two" />
        <div class="plate">
          <span class="rice" />
          <span class="meat meat-one" />
          <span class="meat meat-two" />
          <span class="leaf" />
        </div>
      </div>
    </section>

    <Transition name="swap" mode="out-in">
      <section v-if="pending" key="loading" class="workspace loading-state">
        <div class="spinner" aria-hidden="true" />
        <p class="muted">Checking your mandi paperwork...</p>
      </section>

      <div v-else-if="!user" key="login" class="landing-stack">
        <section class="landing-frame">
          <nav class="landing-nav" aria-label="Primary">
            <a class="brand-mark" href="/" aria-label="Mandi Theeta home">
              <span aria-hidden="true">◉</span>
              MANDI THEETA
            </a>
            <div class="nav-links" aria-hidden="true">
              <span>TRACK</span>
              <span>DAMAGE</span>
              <span>STREAKS</span>
            </div>
            <button class="nav-cta" type="button" @click="loginWithGoogle">SIGN IN</button>
          </nav>

          <div class="landing-grid">
            <section class="landing-main">
              <div class="title-row">
                <h2>Mandi<br />board</h2>
              </div>
              <p class="hero-caption">
                Every mandi matters.
              </p>
              <img class="hero-photo" src="/images/hero.png" alt="Friends sharing a mandi platter" />
            </section>

            <section class="landing-side">
              <div class="solar-system" aria-label="Mandi solar system">
                <span class="solar-ring ring-one" />
                <span class="solar-ring ring-two" />
                <span class="solar-ring ring-three" />
                <span class="solar-ring ring-four" />
                <img class="orbit-item orbit-mayo" src="/images/mayo.png" alt="Mayonnaise side" />
                <img class="orbit-item orbit-cola" src="/images/cola.png" alt="Pepsi and Coca-Cola soft drinks" />
                <div
                  v-for="(leader, index) in leaders"
                  :key="leader.id"
                  class="orbit-person"
                  :class="`orbit-person-${index + 1}`"
                  :title="`#${index + 1} ${leader.displayName}`"
                >
                  <img
                    v-if="leader.avatarUrl"
                    :src="leader.avatarUrl"
                    :alt="`#${index + 1} ${leader.displayName}`"
                    referrerpolicy="no-referrer"
                  />
                  <span v-else class="orbit-person-fallback">{{ leaderInitial(leader) }}</span>
                  <b class="rank-tag">#{{ index + 1 }}</b>
                </div>
                <img class="solar-core" src="/images/main_mandi.png" alt="Mandi platter" />
              </div>

              <div class="orbit-labels">
                <span class="sticker sticker-cream">Mandi</span>
                <span class="sticker sticker-lime">Mayo</span>
                <span class="sticker sticker-orange">Pepsi</span>
              </div>
            </section>
          </div>

          <div class="ticker" aria-hidden="true">
            <span>Track Your Mandi Every Day</span>
            <b>●</b>
            <span>Make Your Life Expectancy Nervous</span>
            <b>●</b>
            <span>Track Your Mandi Every Day</span>
          </div>

          <p v-if="authError" class="landing-error">Google sign-in failed. Try again.</p>
          <p v-if="error" class="landing-error">The app could not reach Cloudflare D1. Check your runtime binding.</p>
        </section>

        <section class="leaderboard-section" aria-labelledby="leaderboard-title">
          <div class="leaderboard-copy">
            <p class="section-kicker">Next section</p>
            <h2 id="leaderboard-title">Mandi podium</h2>
            <p>
              The weekly table for people who turned dinner into a ranked sporting event.
            </p>
          </div>

          <div v-if="leaders.length" class="podium-stage" aria-label="Mandi leaderboard podium">
            <article v-if="podium.second" class="podium-person second">
              <div class="avatar-head">
                <img v-if="podium.second.avatarUrl" :src="podium.second.avatarUrl" :alt="`${podium.second.displayName} avatar`" referrerpolicy="no-referrer" />
                <template v-else>{{ leaderInitial(podium.second) }}</template>
              </div>
              <div class="stick-body" aria-hidden="true"><span /></div>
              <div class="podium-block">
                <strong>2</strong>
                <span>{{ podium.second.displayName }}</span>
                <small>{{ formatMandiQuantity(podium.second.mandiCount) }} mandi</small>
              </div>
            </article>

            <article v-if="podium.first" class="podium-person first">
              <div class="avatar-head champion">
                <img v-if="podium.first.avatarUrl" :src="podium.first.avatarUrl" :alt="`${podium.first.displayName} avatar`" referrerpolicy="no-referrer" />
                <template v-else>{{ leaderInitial(podium.first) }}</template>
              </div>
              <div class="stick-body" aria-hidden="true"><span /></div>
              <div class="podium-block">
                <strong>1</strong>
                <span>{{ podium.first.displayName }}</span>
                <small>{{ formatMandiQuantity(podium.first.mandiCount) }} mandi</small>
              </div>
            </article>

            <article v-if="podium.third" class="podium-person third">
              <div class="avatar-head">
                <img v-if="podium.third.avatarUrl" :src="podium.third.avatarUrl" :alt="`${podium.third.displayName} avatar`" referrerpolicy="no-referrer" />
                <template v-else>{{ leaderInitial(podium.third) }}</template>
              </div>
              <div class="stick-body" aria-hidden="true"><span /></div>
              <div class="podium-block">
                <strong>3</strong>
                <span>{{ podium.third.displayName }}</span>
                <small>{{ formatMandiQuantity(podium.third.mandiCount) }} mandi</small>
              </div>
            </article>
          </div>

          <div v-else class="podium-empty">
            <strong>No rankings yet</strong>
            <span>Be the first to log a mandi and claim the podium.</span>
          </div>
        </section>
      </div>

      <section v-else-if="!profileCreated" key="onboarding" class="workspace onboarding">
        <div>
          <p class="section-kicker">Onboarding</p>
          <h2>Set your life expectancy</h2>
          <p class="muted">
            Signed in as {{ user.displayName }}. Pick the starting number before mandi starts auditing your timeline.
          </p>
        </div>

        <form class="form-grid" @submit.prevent="completeOnboarding">
          <label>
            <span>Initial life expectancy</span>
            <div class="input-with-unit">
              <input
                v-model.number="lifeExpectancyYears"
                inputmode="numeric"
                min="1"
                max="140"
                type="number"
              />
              <strong>years</strong>
            </div>
          </label>

          <p v-if="onboardingError" class="error">{{ onboardingError }}</p>
          <button class="primary-button" type="submit">Start tracking</button>
          <button class="ghost-button" type="button" @click="logout">Sign out</button>
        </form>
      </section>

      <section v-else key="dashboard" class="workspace dashboard">
        <div class="top-row">
          <div class="profile-head">
            <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="`${user.displayName} avatar`" />
            <div>
              <p class="section-kicker">Signed in</p>
              <h2>{{ user.displayName }}</h2>
              <p class="muted">{{ impactLine }}</p>
            </div>
          </div>

          <button class="ghost-button" type="button" @click="logout">Sign out</button>
        </div>

        <div v-if="error" class="error-banner">
          Could not sync with Cloudflare right now. Try refreshing before trusting the numbers.
        </div>

        <div class="stats-grid">
          <article class="life-card" :class="{ 'life-card--pulse': pulseLife }">
            <span class="stat-label">Remaining life expectancy</span>
            <strong>
              {{ remainingBreakdown.years }}y {{ remainingBreakdown.days }}d {{ remainingBreakdown.hours }}h
            </strong>
            <em v-if="latestPenalty">-{{ formatShortHours(latestPenalty) }} from latest session</em>
          </article>

          <article>
            <span class="stat-label">Life lost</span>
            <strong>{{ totalLostLabel }}</strong>
          </article>

          <article>
            <span class="stat-label">Mandi eaten</span>
            <strong>{{ totalMandiLabel }}</strong>
          </article>

          <article>
            <span class="stat-label">Current streak</span>
            <strong>{{ currentStreak }}</strong>
          </article>

          <article>
            <span class="stat-label">Best streak</span>
            <strong>{{ bestStreak }}</strong>
          </article>
        </div>

        <div class="log-cta">
          <div>
            <p class="section-kicker">Menu card</p>
            <h3>Log today's mandi damage</h3>
          </div>
          <button class="primary-button" type="button" @click="openLogModal">+ Log mandi</button>
        </div>

        <div class="history">
          <div class="history-head">
            <h3>Recent sessions</h3>
            <span>{{ sessions.length }} total</span>
          </div>

          <TransitionGroup v-if="sortedSessions.length" name="list" tag="ul">
            <li v-for="session in sortedSessions" :key="session.id">
              <div>
                <strong>{{ formatSessionQuantity(session) }} mandi</strong>
                <span>
                  {{ formatDate(session.eatenAt) }}
                  <template v-if="session.mayoUnits"> · {{ session.mayoUnits }} mayo</template>
                  <template v-if="session.softDrinks">
                    · {{ session.softDrinks }} {{ session.softDrinkType || 'soft drink' }}
                  </template>
                </span>
              </div>
              <b>-{{ formatShortHours(session.penaltyHours) }}</b>
            </li>
          </TransitionGroup>

          <div v-else class="empty-state">
            <strong>No sessions yet</strong>
            <span>The ledger waits. The rice probably does not.</span>
          </div>
        </div>

        <Teleport to="body">
          <Transition name="modal">
            <div v-if="showLogModal" class="modal-backdrop" @click.self="closeLogModal">
              <form class="modal-card menu-card" @submit.prevent="logMandiSession">
                <div class="menu-head">
                  <div>
                    <p class="section-kicker">Menu card</p>
                    <h3>Build this session</h3>
                  </div>
                  <button class="icon-button" type="button" aria-label="Close" @click="closeLogModal">×</button>
                </div>

                <div class="menu-grid">
                  <section class="menu-category">
                    <div class="category-head">
                      <span class="category-icon plate-icon" aria-hidden="true"><i /></span>
                      <div>
                        <strong>Main</strong>
                        <small>Mandi in quarter multiples</small>
                      </div>
                    </div>

                    <div class="menu-items">
                      <button class="menu-item" type="button" @click="addMandi(1)">
                        <span class="item-icon plate-quarter" aria-hidden="true"><i /></span>
                        <strong>Quarter</strong>
                        <small>+{{ formatShortHours(penaltyHoursPerQuarter) }}</small>
                      </button>
                      <button class="menu-item" type="button" @click="addMandi(2)">
                        <span class="item-icon plate-half" aria-hidden="true"><i /></span>
                        <strong>Half</strong>
                        <small>+{{ formatShortHours(penaltyHoursPerQuarter * 2) }}</small>
                      </button>
                      <button class="menu-item" type="button" @click="addMandi(4)">
                        <span class="item-icon plate-full" aria-hidden="true"><i /></span>
                        <strong>Full</strong>
                        <small>+{{ formatShortHours(penaltyHoursPerQuarter * 4) }}</small>
                      </button>
                    </div>
                  </section>

                  <section class="menu-category">
                    <div class="category-head">
                      <span class="category-icon mayo-icon" aria-hidden="true" />
                      <div>
                        <strong>Sides</strong>
                        <small>Mayonnaise damage control, allegedly</small>
                      </div>
                    </div>

                    <div class="menu-items single">
                      <button class="menu-item" type="button" @click="addMayo">
                        <span class="item-icon mayo-cup" aria-hidden="true" />
                        <strong>Mayo cup</strong>
                        <small>+{{ formatShortHours(mayoPenaltyHours) }}</small>
                      </button>
                    </div>
                  </section>

                  <section class="menu-category">
                    <div class="category-head">
                      <span class="category-icon drink-icon" aria-hidden="true" />
                      <div>
                        <strong>Drinks</strong>
                        <small>Soft drinks for multiplier energy</small>
                      </div>
                    </div>

                    <div class="menu-items">
                      <button class="menu-item" type="button" @click="addSoftDrink('pepsi')">
                        <span class="item-icon can-icon can-blue" aria-hidden="true" />
                        <strong>Pepsi</strong>
                        <small>+{{ formatShortHours(softDrinkPenaltyHours) }}</small>
                      </button>
                      <button class="menu-item" type="button" @click="addSoftDrink('coca-cola')">
                        <span class="item-icon can-icon can-red" aria-hidden="true" />
                        <strong>Coca-Cola</strong>
                        <small>+{{ formatShortHours(softDrinkPenaltyHours) }}</small>
                      </button>
                      <button class="menu-item" type="button" @click="addSoftDrink('other')">
                        <span class="item-icon can-icon can-neutral" aria-hidden="true" />
                        <strong>Other</strong>
                        <small>+{{ formatShortHours(softDrinkPenaltyHours) }}</small>
                      </button>
                    </div>
                  </section>
                </div>

                <aside class="order-summary">
                  <div>
                    <span class="stat-label">Current order</span>
                    <strong>{{ formatMandiQuantity(quarterUnits / 4) }} mandi</strong>
                  </div>

                  <div class="order-lines">
                    <div>
                      <span>Main</span>
                      <b>{{ quarterUnits }} quarter{{ quarterUnits === 1 ? '' : 's' }}</b>
                      <button type="button" aria-label="Remove one mandi quarter" @click="removeMandiQuarter">−</button>
                    </div>
                    <div>
                      <span>Sides</span>
                      <b>{{ mayoUnits }} mayo</b>
                      <button type="button" aria-label="Remove one mayo" @click="removeMayo">−</button>
                    </div>
                    <div>
                      <span>Drinks</span>
                      <b>{{ softDrinks }} {{ softDrinkType }}</b>
                      <button type="button" aria-label="Remove one soft drink" @click="removeSoftDrink">−</button>
                    </div>
                  </div>

                  <div class="damage-ticket">
                    <span>Estimated damage</span>
                    <strong>{{ formatShortHours(estimatedPenalty) }}</strong>
                  </div>

                  <p v-if="sessionError" class="error">{{ sessionError }}</p>

                  <div class="modal-actions">
                    <button class="ghost-button compact-button" type="button" @click="resetOrder">Clear</button>
                    <button class="primary-button" type="submit">Log order</button>
                  </div>
                </aside>
              </form>
            </div>
          </Transition>
        </Teleport>
      </section>
    </Transition>

    <footer class="site-footer" aria-label="Footer">
      <p class="footer-credit">Created with ❤️ by a Mandi lover</p>
      <strong aria-hidden="true">THEETA</strong>
    </footer>
  </main>
</template>

<style>
:root {
  color-scheme: light;
  --bg: #050505;
  --cream: #f3eee7;
  --cream-2: #fff2df;
  --ink: #050505;
  --muted: #565049;
  --line: #050505;
  --panel: #f3eee7;
  --panel-strong: #d1f64a;
  --accent: #ff5a13;
  --accent-dark: #050505;
  --green: #d1f64a;
  --lavender: #b7a2d4;
  --shadow: 8px 8px 0 #050505;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background: var(--cream);
  color: var(--ink);
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.shell {
  width: 100%;
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

.landing-frame {
  position: relative;
  border: 2px solid var(--line);
  border-left: 0;
  border-right: 0;
  border-top: 0;
  background: var(--cream);
  overflow: hidden;
  box-shadow: none;
}

.landing-nav {
  display: grid;
  grid-template-columns: 1fr auto 150px;
  align-items: center;
  gap: 24px;
  min-height: 88px;
  padding: 0 56px;
  border-bottom: 2px solid var(--line);
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-weight: 900;
  text-decoration: none;
}

.brand-mark span {
  font-size: 1.2rem;
}

.nav-links {
  display: flex;
  gap: 52px;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 700;
}

.nav-cta {
  min-height: 48px;
  border: 2px solid var(--line);
  background: #050505;
  color: #fff;
  padding: 0 26px;
  font-weight: 900;
  text-transform: uppercase;
}

.landing-grid {
  display: grid;
  grid-template-columns: 58% 42%;
  grid-template-rows: 1fr;
  min-height: calc(100vh - 150px);
}

.landing-main,
.landing-side {
  position: relative;
  border-bottom: 2px solid var(--line);
}

.landing-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 56px 44px 64px;
  border-right: 2px solid var(--line);
  background:
    radial-gradient(circle at 10% 10%, rgba(255, 242, 223, 0.8), transparent 24rem),
    var(--cream);
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 22px;
  max-width: 640px;
}

.title-row h2 {
  margin: 0;
  font-size: clamp(4.6rem, 9vw, 8.5rem);
  line-height: 0.82;
  letter-spacing: -0.04em;
  font-weight: 900;
  text-transform: uppercase;
}

.hero-caption {
  max-width: 620px;
  margin: 22px 0 0;
  color: var(--muted);
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.35;
}

.hero-photo {
  width: min(720px, 96%);
  margin: 16px 0 0;
  margin-left: -12px;
  object-fit: contain;
}

.landing-side {
  position: relative;
  display: grid;
  place-items: center;
  padding: 54px 40px;
  background: var(--lavender);
  overflow: hidden;
}

.orbit-labels {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.sticker {
  position: absolute;
  display: inline-block;
  width: max-content;
  max-width: 60%;
  padding: 6px 20px;
  color: #050505;
  font-size: clamp(1.5rem, 2.2vw, 2rem);
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  clip-path: polygon(2% 12%, 11% 8%, 10% 0, 20% 8%, 29% 2%, 31% 10%, 43% 7%, 44% 15%, 55% 5%, 58% 14%, 71% 11%, 72% 19%, 89% 12%, 98% 24%, 95% 88%, 86% 92%, 84% 100%, 74% 92%, 62% 98%, 58% 89%, 45% 94%, 42% 86%, 29% 94%, 26% 85%, 13% 90%, 8% 79%);
}

.sticker-cream {
  top: 7%;
  right: 8%;
  background: #eadcc8;
  transform: rotate(-6deg);
}

.sticker-lime {
  bottom: 12%;
  left: 5%;
  background: var(--green);
  transform: rotate(5deg);
}

.sticker-orange {
  bottom: 6%;
  right: 9%;
  background: var(--accent);
  transform: rotate(-4deg);
}

.solar-system {
  position: relative;
  min-height: 430px;
  display: grid;
  place-items: center;
  isolation: isolate;
}

.solar-ring {
  position: absolute;
  border: 2px solid rgba(5, 5, 5, 0.42);
  border-radius: 50%;
}

.ring-one {
  width: 230px;
  height: 140px;
}

.ring-two {
  width: 340px;
  height: 220px;
}

.ring-three {
  width: 450px;
  height: 300px;
}

.ring-four {
  width: 560px;
  height: 372px;
  border-color: rgba(5, 5, 5, 0.22);
}

.solar-core {
  position: relative;
  z-index: 2;
  width: min(210px, 52%);
  filter: drop-shadow(10px 12px 0 rgba(5, 5, 5, 0.8));
  animation: solarFloat 5s ease-in-out infinite;
}

.orbit-item {
  position: absolute;
  z-index: 3;
  object-fit: contain;
  filter: drop-shadow(6px 8px 0 rgba(5, 5, 5, 0.55));
}

.orbit-mayo {
  width: 104px;
  offset-path: ellipse(170px 110px at 50% 50%);
  offset-rotate: 0deg;
  animation: orbitPath 16s linear infinite;
}

.orbit-cola {
  width: 104px;
  offset-path: ellipse(225px 150px at 50% 50%);
  offset-rotate: 0deg;
  animation: orbitPath 20s linear infinite;
  animation-delay: -10s;
}

.orbit-person {
  position: absolute;
  z-index: 4;
  width: 58px;
  height: 58px;
  offset-rotate: 0deg;
  animation: orbitPath 24s linear infinite;
}

.orbit-person img,
.orbit-person-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 2px solid var(--line);
  border-radius: 50%;
  background: linear-gradient(135deg, #f7c96b, #ffefe0);
  object-fit: cover;
  color: #050505;
  font-weight: 900;
  box-shadow: 4px 4px 0 #050505;
}

.rank-tag {
  position: absolute;
  top: -10px;
  right: -10px;
  display: grid;
  min-width: 26px;
  height: 26px;
  place-items: center;
  padding: 0 6px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--green);
  color: #050505;
  font-size: 0.8rem;
  font-weight: 900;
}

.orbit-person-1 {
  offset-path: ellipse(115px 70px at 50% 50%);
  offset-distance: 55%;
  animation-duration: 22s;
}

.orbit-person-2 {
  offset-path: ellipse(170px 110px at 50% 50%);
  offset-distance: 80%;
  animation-duration: 26s;
}

.orbit-person-2 .rank-tag {
  background: #eadcc8;
}

.orbit-person-3 {
  offset-path: ellipse(225px 150px at 50% 50%);
  offset-distance: 35%;
  animation-duration: 30s;
}

.orbit-person-3 .rank-tag {
  background: var(--accent);
  color: #fffaf2;
}

.leaderboard-section {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 44px;
  align-items: end;
  padding: 76px 70px 86px;
  border-bottom: 2px solid var(--line);
  background: linear-gradient(180deg, #fff7eb, #f2e7da);
}

.leaderboard-copy h2 {
  margin: 0 0 14px;
  font-size: clamp(3.5rem, 8vw, 7rem);
  line-height: 0.85;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}

.leaderboard-copy p:not(.section-kicker) {
  max-width: 420px;
  margin: 0;
  color: var(--muted);
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.45;
}

.podium-stage {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 12px;
  min-height: 470px;
  padding: 36px 34px 0;
  border: 2px solid var(--line);
  background:
    radial-gradient(circle at 50% 10%, rgba(209, 246, 74, 0.38), transparent 18rem),
    var(--lavender);
  box-shadow: 10px 10px 0 #050505;
}

.podium-person {
  display: grid;
  justify-items: center;
  align-items: end;
}

.avatar-head {
  display: grid;
  width: 78px;
  height: 78px;
  place-items: center;
  overflow: hidden;
  border: 3px solid var(--line);
  border-radius: 50%;
  background: linear-gradient(135deg, #f7c96b, #ffefe0);
  color: #050505;
  font-size: 2rem;
  font-weight: 900;
  box-shadow: 6px 6px 0 #050505;
}

.avatar-head img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-head.champion {
  width: 96px;
  height: 96px;
  background: linear-gradient(135deg, var(--green), #fff0b3);
  font-size: 2.45rem;
}

.stick-body {
  position: relative;
  width: 120px;
  height: 120px;
  margin-top: 12px;
}

.stick-body::before,
.stick-body::after,
.stick-body span,
.stick-body span::before,
.stick-body span::after {
  content: "";
  position: absolute;
  background: #050505;
  border-radius: 999px;
}

.stick-body::before {
  left: 58px;
  top: 0;
  width: 6px;
  height: 78px;
}

.stick-body::after {
  left: 25px;
  top: 34px;
  width: 72px;
  height: 6px;
  transform: rotate(-8deg);
}

.stick-body span::before,
.stick-body span::after {
  top: 72px;
  width: 6px;
  height: 58px;
  transform-origin: top;
}

.stick-body span::before {
  left: 58px;
  transform: rotate(28deg);
}

.stick-body span::after {
  left: 58px;
  transform: rotate(-28deg);
}

.podium-block {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 8px;
  width: 100%;
  border: 2px solid var(--line);
  border-bottom: 0;
  background: var(--cream);
  text-align: center;
}

.podium-block strong {
  font-size: 4.8rem;
  line-height: 0.85;
}

.podium-block span {
  max-width: 150px;
  font-weight: 900;
}

.podium-block small {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.podium-empty {
  display: grid;
  gap: 6px;
  align-content: center;
  min-height: 470px;
  padding: 36px;
  border: 2px dashed var(--line);
  background: var(--lavender);
  box-shadow: 10px 10px 0 #050505;
  text-align: center;
}

.podium-empty strong {
  font-size: 1.6rem;
}

.podium-empty span {
  color: var(--muted);
  font-weight: 800;
}

.first .podium-block {
  min-height: 230px;
  background: var(--green);
}

.second .podium-block {
  min-height: 176px;
}

.third .podium-block {
  min-height: 138px;
  background: #ffefe0;
}

.ticker {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 100%;
  gap: 32px;
  align-items: center;
  justify-content: center;
  min-height: 58px;
  padding: 0 18px;
  border-top: 2px solid var(--line);
  background: #111;
  color: #fff;
  font-size: 1.08rem;
  font-weight: 800;
  white-space: nowrap;
}

.ticker b {
  color: var(--green);
}

.landing-error {
  position: absolute;
  left: 58px;
  bottom: 66px;
  z-index: 5;
  margin: 0;
  color: #9e1f16;
  font-weight: 900;
}

.site-footer {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  min-height: 360px;
  margin-top: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, #fff4e2 0%, #fff7eb 44%, #f1dfc9 100%);
}

.footer-credit {
  position: relative;
  z-index: 2;
  margin: 0;
  color: var(--ink);
  font-size: 1.4rem;
  font-weight: 900;
  text-align: center;
}

.site-footer > strong {
  position: absolute;
  left: 50%;
  bottom: -46px;
  transform: translateX(-50%);
  color: transparent;
  background: linear-gradient(180deg, rgba(96, 79, 64, 0.13), rgba(96, 79, 64, 0.015));
  -webkit-background-clip: text;
  background-clip: text;
  font-family: "Bungee Shade", Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(8rem, 27vw, 26rem);
  font-weight: 400;
  line-height: 0.72;
  letter-spacing: 0;
  white-space: nowrap;
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 28px;
  align-items: center;
  min-height: 280px;
  padding: 48px 56px;
  border: 0;
  border-bottom: 2px solid var(--line);
  border-radius: 0;
  background: var(--lavender);
  box-shadow: none;
  overflow: hidden;
}

.hero-panel h1 {
  text-transform: uppercase;
}

.hero-copy {
  max-width: 680px;
}

.eyebrow,
.section-kicker,
.stat-label {
  margin: 0 0 10px;
  color: var(--accent-dark);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 14px;
  font-size: clamp(3rem, 7vw, 5.8rem);
  line-height: 0.9;
}

h2 {
  margin-bottom: 10px;
  font-size: clamp(2rem, 5vw, 3.8rem);
  line-height: 1;
}

h3 {
  margin-bottom: 0;
  font-size: 1.1rem;
}

.hero-copy p:not(.eyebrow),
.muted {
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.6;
}

.plate-orbit {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
}

.plate {
  position: relative;
  width: 210px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, #f6d790 0 46%, #eee3d2 47% 67%, #d5c5b2 68% 100%);
  box-shadow: inset 0 -12px 24px rgba(99, 65, 22, 0.15), 0 24px 40px rgba(99, 65, 22, 0.18);
  animation: plateFloat 4.5s ease-in-out infinite;
}

.rice,
.meat,
.leaf {
  position: absolute;
  display: block;
}

.rice {
  inset: 50px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 38%, #fff8de 0 7px, transparent 8px),
    radial-gradient(circle at 68% 52%, #fff1c1 0 8px, transparent 9px),
    #f1c66e;
}

.meat {
  width: 52px;
  height: 34px;
  border-radius: 45% 55% 52% 48%;
  background: #7b3b22;
  box-shadow: inset 0 5px 0 rgba(255, 255, 255, 0.12);
}

.meat-one {
  top: 76px;
  left: 66px;
  transform: rotate(-18deg);
}

.meat-two {
  right: 62px;
  bottom: 70px;
  transform: rotate(18deg);
}

.leaf {
  right: 62px;
  top: 70px;
  width: 44px;
  height: 22px;
  border-radius: 100% 0;
  background: var(--green);
  transform: rotate(-24deg);
}

.steam {
  position: absolute;
  top: 18px;
  width: 14px;
  height: 86px;
  border-radius: 999px;
  border-left: 3px solid rgba(133, 45, 34, 0.28);
  animation: steamRise 2.8s ease-in-out infinite;
}

.steam-one {
  left: 104px;
}

.steam-two {
  right: 102px;
  animation-delay: 0.8s;
}

.workspace {
  margin: 0;
  padding: 48px 56px 64px;
  border: 0;
  border-radius: 0;
  background: var(--cream);
  box-shadow: none;
}

.onboarding {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 34px;
}

.loading-state,
.login-panel {
  display: grid;
  gap: 14px;
  align-content: center;
}

.loading-state {
  justify-items: center;
  min-height: 180px;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid rgba(179, 63, 47, 0.16);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 760ms linear infinite;
}

.form-grid,
.log-form {
  display: grid;
  gap: 18px;
}

label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-weight: 700;
}

input,
select {
  width: 100%;
  border: 2px solid var(--line);
  border-radius: 0;
  background: #fffdf8;
  color: var(--ink);
  padding: 14px 15px;
  outline: none;
  transition: box-shadow 160ms ease;
}

input:focus {
  box-shadow: 4px 4px 0 var(--accent);
}

select:focus {
  box-shadow: 4px 4px 0 var(--accent);
}

select:disabled {
  opacity: 0.55;
}

label small {
  color: var(--muted);
  font-weight: 600;
}

.input-with-unit {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
}

.input-with-unit strong {
  color: var(--ink);
}

.primary-button,
.ghost-button {
  min-height: 48px;
  border: 2px solid var(--line);
  border-radius: 0;
  padding: 0 22px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  box-shadow: 4px 4px 0 var(--line);
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.primary-button {
  background: var(--ink);
  color: #fff;
}

.primary-button:hover,
.ghost-button:hover {
  transform: translate(-1px, -1px);
  box-shadow: 6px 6px 0 var(--line);
}

.primary-button:active,
.ghost-button:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--line);
}

.ghost-button {
  background: var(--cream);
  color: var(--ink);
}

.google-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 54px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fffdf8;
  color: var(--ink);
  font-weight: 800;
  box-shadow: 0 12px 28px rgba(91, 62, 27, 0.1);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.google-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 34px rgba(91, 62, 27, 0.14);
}

.google-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: #4285f4;
  font-weight: 800;
  box-shadow: inset 0 0 0 1px #e2e2e2;
}

.error {
  margin: 0;
  color: #9e1f16;
  font-weight: 700;
}

.error-banner {
  margin-top: 18px;
  padding: 14px 16px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--accent);
  box-shadow: 4px 4px 0 var(--line);
  color: #fffaf2;
  font-weight: 800;
}

.top-row,
.history-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-head img {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  border: 2px solid var(--line);
  border-radius: 50%;
  box-shadow: 4px 4px 0 var(--line);
}

.profile-head h2 {
  text-transform: uppercase;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1.45fr repeat(4, 1fr);
  gap: 18px;
  margin: 28px 0;
}

.stats-grid article {
  min-height: 146px;
  padding: 20px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--cream);
  box-shadow: 6px 6px 0 var(--line);
}

.stats-grid strong {
  display: block;
  font-size: clamp(1.9rem, 4vw, 3.5rem);
  line-height: 1;
  font-weight: 900;
}

.life-card {
  position: relative;
  overflow: hidden;
  background: var(--green) !important;
}

.life-card em {
  display: inline-block;
  margin-top: 16px;
  color: var(--ink);
  font-style: normal;
  font-weight: 900;
}

.life-card--pulse {
  animation: lifePulse 880ms ease;
}

.log-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 26px;
  border: 2px solid var(--line);
  background: var(--lavender);
  box-shadow: 6px 6px 0 var(--line);
}

.log-cta h3 {
  font-size: 1.5rem;
  text-transform: uppercase;
}

.menu-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
}

.menu-head {
  display: flex;
  grid-column: 1 / -1;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.compact-button {
  min-height: 40px;
}

.menu-grid {
  display: grid;
  gap: 14px;
}

.menu-category,
.order-summary {
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--cream);
  padding: 16px;
}

.category-head strong {
  text-transform: uppercase;
}

.category-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.category-head div {
  display: grid;
  gap: 2px;
}

.category-head strong,
.menu-item strong {
  color: var(--ink);
}

.category-head small,
.menu-item small {
  color: var(--muted);
  font-weight: 700;
}

.category-icon,
.item-icon {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
}

.category-icon {
  width: 42px;
  height: 42px;
  border-radius: 0;
  border: 2px solid var(--line);
  background: var(--cream-2);
}

.menu-items {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.menu-items.single {
  grid-template-columns: minmax(0, 1fr);
}

.menu-item {
  display: grid;
  min-height: 132px;
  gap: 8px;
  justify-items: center;
  align-content: center;
  border: 2px solid var(--line);
  border-radius: 0;
  background: #fff8ec;
  color: var(--ink);
  padding: 14px 10px;
  text-align: center;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.menu-item strong {
  text-transform: uppercase;
}

.menu-item:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--line);
}

.menu-item:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.item-icon {
  width: 54px;
  height: 54px;
}

.plate-icon,
.plate-quarter,
.plate-half,
.plate-full {
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #f4c96d 0 38%, transparent 39%),
    #efe3d3;
  box-shadow: inset 0 0 0 3px #d5c5b2;
}

.plate-icon {
  width: 42px;
  height: 42px;
}

.plate-icon i,
.plate-quarter i,
.plate-half i,
.plate-full i {
  position: absolute;
  inset: 11px;
  border-radius: 50%;
  background: #7b3b22;
}

.plate-quarter i {
  clip-path: polygon(50% 50%, 100% 0, 100% 100%);
}

.plate-half i {
  clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
}

.mayo-icon::before,
.mayo-cup::before {
  content: "";
  width: 25px;
  height: 28px;
  border-radius: 6px 6px 12px 12px;
  background: linear-gradient(#fffef7 0 58%, #f4d786 59%);
  box-shadow: inset 0 0 0 2px #d9c894;
}

.drink-icon::before,
.can-icon::before {
  content: "";
  width: 24px;
  height: 38px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.36);
}

.drink-icon::before,
.can-blue::before {
  background: #2556a7;
}

.can-red::before {
  background: #bc2e28;
}

.can-neutral::before {
  background: #6e665b;
}

.order-summary {
  position: sticky;
  top: 18px;
  align-self: start;
  display: grid;
  gap: 18px;
}

.order-summary > div:first-child strong {
  display: block;
  font-size: 2.2rem;
  line-height: 1;
}

.order-lines {
  display: grid;
  gap: 10px;
}

.order-lines div {
  display: grid;
  grid-template-columns: 1fr auto 34px;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: #fff8ec;
}

.order-lines span {
  color: var(--muted);
  font-weight: 800;
}

.order-lines button {
  width: 34px;
  height: 34px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: #fffdf8;
  color: var(--ink);
  font-size: 1.2rem;
  font-weight: 900;
}

.damage-ticket {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--ink);
  color: var(--green);
}

.damage-ticket span {
  font-weight: 800;
}

.damage-ticket strong {
  font-size: 1.6rem;
}

.history {
  margin-top: 36px;
}

.history-head h3 {
  text-transform: uppercase;
  font-size: 1.4rem;
}

.history-head span {
  color: var(--muted);
  font-weight: 800;
}

ul {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 18px 0 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--cream);
  box-shadow: 4px 4px 0 var(--line);
}

li div {
  display: grid;
  gap: 3px;
}

li span {
  color: var(--muted);
  font-size: 0.92rem;
}

li b {
  color: var(--accent);
  font-size: 1.25rem;
  font-weight: 900;
}

.empty-state {
  display: grid;
  gap: 4px;
  margin-top: 16px;
  padding: 28px;
  border: 2px dashed var(--line);
  border-radius: 0;
  color: var(--muted);
  background: var(--cream);
}

.empty-state strong {
  color: var(--ink);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 5, 5, 0.55);
  overflow-y: auto;
}

.modal-card {
  width: min(900px, 100%);
  max-height: 90vh;
  margin: auto;
  overflow-y: auto;
  padding: 28px;
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--cream);
  box-shadow: 12px 12px 0 var(--line);
}

.modal-card .menu-head h3 {
  text-transform: uppercase;
  font-size: 1.5rem;
}

.modal-card .order-summary {
  position: static;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  border: 2px solid var(--line);
  border-radius: 0;
  background: var(--cream);
  color: var(--ink);
  font-size: 1.6rem;
  font-weight: 900;
  line-height: 1;
  box-shadow: 3px 3px 0 var(--line);
}

.icon-button:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.modal-actions {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
}

.modal-actions .primary-button {
  width: 100%;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 180ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 180ms ease;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: translateY(12px);
}

.swap-enter-active,
.swap-leave-active,
.list-enter-active,
.list-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.swap-enter-from,
.swap-leave-to,
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.list-move {
  transition: transform 220ms ease;
}

@keyframes plateFloat {
  0%,
  100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-10px) rotate(2deg);
  }
}

@keyframes steamRise {
  0%,
  100% {
    opacity: 0.2;
    transform: translateY(16px) scaleY(0.75);
  }
  45% {
    opacity: 0.9;
    transform: translateY(-8px) scaleY(1);
  }
}

@keyframes lifePulse {
  0% {
    box-shadow: 0 0 0 rgba(179, 63, 47, 0);
  }
  45% {
    box-shadow: 0 0 0 8px rgba(179, 63, 47, 0.12);
    transform: translateY(-2px);
  }
  100% {
    box-shadow: 0 0 0 rgba(179, 63, 47, 0);
  }
}

@keyframes solarFloat {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-10px) rotate(2deg);
  }
}

@keyframes orbitPath {
  from {
    offset-distance: 0%;
  }
  to {
    offset-distance: 100%;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 820px) {
  .shell {
    width: 100%;
    padding: 0;
  }

  .landing-nav {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 22px;
  }

  .nav-links {
    display: none;
  }

  .landing-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    min-height: 0;
  }

  .landing-main,
  .landing-side {
    border-right: 0;
  }

  .landing-main {
    min-height: auto;
    padding: 42px 22px 64px;
  }

  .title-row {
    flex-direction: column;
  }

  .landing-side {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 38px 22px;
  }

  .orbit-labels {
    gap: 18px;
  }

  .solar-system {
    min-height: 320px;
  }

  .solar-core {
    width: 210px;
  }

  .ring-one {
    width: 190px;
    height: 116px;
  }

  .ring-two {
    width: 270px;
    height: 180px;
  }

  .ring-three {
    width: 330px;
    height: 230px;
  }

  .ring-four {
    width: 410px;
    height: 280px;
  }

  .orbit-mayo {
    width: 70px;
    offset-path: ellipse(135px 90px at 50% 50%);
  }

  .orbit-cola {
    width: 70px;
    offset-path: ellipse(165px 115px at 50% 50%);
  }

  .orbit-person {
    width: 46px;
    height: 46px;
  }

  .orbit-person-1 {
    offset-path: ellipse(95px 58px at 50% 50%);
  }

  .orbit-person-2 {
    offset-path: ellipse(135px 90px at 50% 50%);
  }

  .orbit-person-3 {
    offset-path: ellipse(165px 115px at 50% 50%);
  }

  .rank-tag {
    min-width: 22px;
    height: 22px;
    font-size: 0.7rem;
  }

  .leaderboard-section {
    grid-template-columns: 1fr;
    padding: 46px 18px 58px;
  }

  .podium-stage {
    gap: 6px;
    min-height: 390px;
    padding: 26px 12px 0;
  }

  .avatar-head {
    width: 58px;
    height: 58px;
  }

  .avatar-head.champion {
    width: 70px;
    height: 70px;
  }

  .stick-body {
    width: 82px;
    height: 96px;
  }

  .stick-body::before {
    left: 38px;
    height: 60px;
  }

  .stick-body::after {
    left: 14px;
    width: 58px;
  }

  .stick-body span::before,
  .stick-body span::after {
    left: 38px;
    top: 58px;
    height: 44px;
  }

  .podium-block strong {
    font-size: 3.4rem;
  }

  .ticker {
    font-size: 1rem;
  }

  .site-footer {
    min-height: 230px;
  }

  .hero-panel,
  .onboarding,
  .stats-grid,
  .menu-card,
  .menu-items {
    grid-template-columns: 1fr;
  }

  .log-cta {
    flex-direction: column;
    align-items: flex-start;
  }

  .modal-card {
    padding: 20px;
  }

  .menu-head {
    flex-direction: column;
  }

  .order-summary {
    position: static;
  }

  .hero-panel,
  .workspace {
    padding: 22px;
  }

  .plate-orbit {
    max-width: 240px;
    justify-self: center;
  }

  .top-row {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-head {
    align-items: flex-start;
  }

  .ghost-button,
  .primary-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
}
</style>
