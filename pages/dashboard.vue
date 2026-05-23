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
    <section class="hero-panel" aria-labelledby="app-title">
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

        <button class="ghost-button" type="button" @click="logout">Sign out</button>
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
  </div>
</template>
