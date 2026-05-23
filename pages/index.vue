<script setup lang="ts">
type Leader = {
  displayName: string
  avatarUrl: string | null
  mandiCount: number
  sessionCount: number
}

type LeaderboardResponse = {
  leaders: Leader[]
}

const {
  user,
  pending,
  error,
  profileCreated,
  lifeExpectancyYears,
  displayName,
  onboardingError,
  loginWithGoogle,
  completeOnboarding,
  logout,
  formatMandiQuantity
} = await useMandi()

const lifespanTooHigh = computed(() => Number(lifeExpectancyYears.value) > 150)
const onboardingDisabled = computed(
  () => lifespanTooHigh.value || !displayName.value.trim() || Number(lifeExpectancyYears.value) < 1
)

const route = useRoute()
const authError = computed(() => route.query.authError === 'google')

const { data: leaderboard } = await useFetch<LeaderboardResponse>('/api/leaderboard', {
  key: 'leaderboard',
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

function openDashboard() {
  navigateTo('/dashboard')
}
</script>

<template>
  <Transition name="swap" mode="out-in">
    <section v-if="pending" key="loading" class="workspace loading-state">
      <div class="spinner" aria-hidden="true" />
      <p class="muted">Checking your mandi paperwork...</p>
    </section>

    <div v-else-if="!user || profileCreated" key="login" class="landing-stack">
      <section class="landing-frame">
        <nav class="landing-nav" aria-label="Primary">
          <a class="brand-mark" href="/" aria-label="Mandi Theeta home">
            <img src="/images/logo.png" alt="Mandi Theeta" />
            <span class="brand-name">mandi.theeta.in</span>
          </a>
          <ProfileMenu v-if="user" :user="user" @logout="logout" />
          <button v-else class="nav-cta" type="button" @click="loginWithGoogle">SIGN IN</button>
        </nav>

        <div class="area-hero">
          <div class="area-left">
            <div class="area-panel">
              <h1 class="area-title">
                Every <span class="area-mark">mandi</span> matters
              </h1>
              <p class="area-desc">
                Log your mandi sessions, mayo decisions, and soft drink damage.
                We turn dinner into a leaderboard and your life expectancy into a countdown.
              </p>
              <button class="area-cta" type="button" @click="user ? openDashboard() : loginWithGoogle()">
                {{ user ? 'Open dashboard' : 'Get started' }}
              </button>

              <div class="area-footnote">
                <a class="area-star" href="https://github.com/ariyaam-project/mandiboard" target="_blank" rel="noopener">
                  <span aria-hidden="true">★</span>
                  Starring this repo may recover lifespan reduced by mandi.
                </a>
                <p class="area-credit">Made by mandi lovers</p>
              </div>
            </div>

            <div class="area-stat">
              <div class="area-stat-copy">
                <strong>500+</strong>
                <span>Mandi lovers</span>
              </div>
              <div class="face-row" aria-hidden="true">
                <img
                  v-for="(leader, index) in leaders"
                  :key="`${leader.displayName}-${index}`"
                  :src="leader.avatarUrl || ''"
                  :alt="leader.displayName"
                  referrerpolicy="no-referrer"
                />
                <span class="face-fill">+</span>
              </div>
            </div>
          </div>

          <div class="area-image">
            <img src="/images/hero.png" alt="Friends sharing a mandi platter" />
            <span class="area-badge badge-agro">Every plate counts</span>
            <span class="area-badge badge-acres">5.5 mandi logged</span>
            <span class="area-badge badge-green">Theeta</span>
          </div>
        </div>

        <div class="ticker" aria-hidden="true">
          <span>Track Your Mandi Every Day</span>
          <b>●</b>
          <span>Make Your Life Expectancy Nervous</span>
          <b>●</b>
          <span>Track Your Mandi Every Day</span>
        </div>

        <p v-if="authError" class="landing-error">Sign-in failed. Try again.</p>
        <p v-if="error" class="landing-error">Something went wrong. Refresh and try again.</p>
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

    <section v-else key="onboarding" class="workspace onboarding">
      <div>
        <p class="section-kicker">Onboarding</p>
        <h2>Set up your mandi profile</h2>
        <p class="muted">
          Tell us your name and how long you plan to stick around. Mandi will take it from there.
        </p>
      </div>

      <form class="form-grid" @submit.prevent="completeOnboarding">
        <label>
          <span>Your name</span>
          <input
            v-model="displayName"
            type="text"
            maxlength="80"
            placeholder="Name"
            autocomplete="name"
          />
        </label>

        <label>
          <span>Expected lifespan</span>
          <div class="input-with-unit">
            <input
              v-model.number="lifeExpectancyYears"
              inputmode="numeric"
              min="1"
              max="150"
              type="number"
              :class="{ 'input--error': lifespanTooHigh }"
            />
            <strong>years</strong>
          </div>
        </label>

        <p v-if="lifespanTooHigh" class="error">ath kurach athyagraham alle monu</p>
        <p v-else-if="onboardingError" class="error">{{ onboardingError }}</p>

        <button class="primary-button" type="submit" :disabled="onboardingDisabled">Start tracking</button>
        <button class="ghost-button" type="button" @click="logout">Sign out</button>
      </form>
    </section>
  </Transition>
</template>
