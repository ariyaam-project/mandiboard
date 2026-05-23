<script setup lang="ts">
const {
  user,
  error,
  profileCreated,
  sessions,
  sortedSessions,
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
  remainingBreakdown,
  totalLostLabel,
  totalMandiLabel,
  currentStreak,
  bestStreak,
  impactLine,
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
} = await useMandi()

const activityWeeks = computed(() => {
  const counts = new Map<string, number>()
  for (const session of sessions.value) {
    const d = new Date(session.eatenAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const weeks = 27
  const pastWeeks = Math.floor(weeks / 2)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay())
  start.setDate(start.getDate() - pastWeeks * 7)

  const columns: { key: string; level: number; count: number; isToday: boolean; isFuture: boolean }[][] = []
  const cursor = new Date(start)
  for (let week = 0; week < weeks; week += 1) {
    const column: { key: string; level: number; count: number; isToday: boolean; isFuture: boolean }[] = []
    for (let i = 0; i < 7; i += 1) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const isFuture = cursor > today
      const count = isFuture ? 0 : counts.get(key) || 0
      const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 3 : 4
      column.push({ key, level, count, isToday: key === todayKey, isFuture })
      cursor.setDate(cursor.getDate() + 1)
    }
    columns.push(column)
  }
  return columns
})

if (!user.value || !profileCreated.value) {
  await navigateTo('/')
}

watch([user, profileCreated], () => {
  if (!user.value || !profileCreated.value) {
    navigateTo('/')
  }
})
</script>

<template>
  <div v-if="user && profileCreated">
    <header class="dash-nav">
      <a class="brand-mark" href="/" aria-label="Mandi Theeta home">
        <img src="/images/logo.png" alt="Mandi Theeta" />
        <span class="brand-name">mandi.theeta.in</span>
      </a>
      <ProfileMenu :user="user" @logout="logout" />
    </header>

    <section class="workspace dashboard">
      <div class="top-row">
        <div class="profile-head">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="`${user.displayName} avatar`" />
          <div>
            <p class="section-kicker">Signed in</p>
            <h2>{{ user.displayName }}</h2>
            <p class="muted">{{ impactLine }}</p>
          </div>
        </div>

        <div class="activity">
          <span class="activity-title">Mandi activity</span>
          <div class="activity-grid">
            <div v-for="(column, ci) in activityWeeks" :key="ci" class="activity-col">
              <span
                v-for="cell in column"
                :key="cell.key"
                class="activity-cell"
                :data-level="cell.level"
                :data-today="cell.isToday"
                :data-future="cell.isFuture"
                :title="`${cell.key} · ${cell.count} mandi`"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-banner">
        Could not sync right now. Try refreshing before trusting the numbers.
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
            <form class="modal-card simple-modal" @submit.prevent="logMandiSession">
              <div class="menu-head">
                <div>
                  <p class="section-kicker">Log mandi</p>
                  <h3>How much today?</h3>
                </div>
                <button class="icon-button" type="button" aria-label="Close" @click="closeLogModal">×</button>
              </div>

              <div class="step-rows">
                <div class="step-row">
                  <div class="step-info">
                    <strong>Mandi</strong>
                    <small>{{ formatMandiQuantity(quarterUnits / 4) }} plate · +{{ formatShortHours(penaltyHoursPerQuarter) }} per quarter</small>
                  </div>
                  <div class="step-control">
                    <button type="button" aria-label="Less mandi" @click="removeMandiQuarter">−</button>
                    <b>{{ quarterUnits }}/4</b>
                    <button type="button" aria-label="More mandi" @click="addMandi(1)">+</button>
                  </div>
                </div>

                <div class="step-row">
                  <div class="step-info">
                    <strong>Mayo</strong>
                    <small>+{{ formatShortHours(mayoPenaltyHours) }} per cup</small>
                  </div>
                  <div class="step-control">
                    <button type="button" aria-label="Less mayo" @click="removeMayo">−</button>
                    <b>{{ mayoUnits }}</b>
                    <button type="button" aria-label="More mayo" @click="addMayo">+</button>
                  </div>
                </div>

                <div class="step-row">
                  <div class="step-info">
                    <strong>Soft drink</strong>
                    <select v-model="softDrinkType">
                      <option value="pepsi">Pepsi</option>
                      <option value="coca-cola">Coca-Cola</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="step-control">
                    <button type="button" aria-label="Less drinks" @click="removeSoftDrink">−</button>
                    <b>{{ softDrinks }}</b>
                    <button type="button" aria-label="More drinks" @click="addSoftDrink(softDrinkType)">+</button>
                  </div>
                </div>
              </div>

              <div class="damage-ticket">
                <span>Estimated damage</span>
                <strong>{{ formatShortHours(estimatedPenalty) }}</strong>
              </div>

              <p v-if="quarterUnits > 2" class="modal-warn">ne jeevikan vendi thinnano atho thinnan vendi jeevikano? 🙂</p>
              <p v-if="sessionError" class="error">{{ sessionError }}</p>

              <div class="modal-actions">
                <button class="ghost-button compact-button" type="button" @click="resetOrder">Clear</button>
                <button class="primary-button" type="submit" :disabled="quarterUnits < 1">Log mandi</button>
              </div>
            </form>
          </div>
        </Transition>
      </Teleport>
    </section>
  </div>
</template>
