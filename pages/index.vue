<script setup lang="ts">
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

const {
  user,
  pending,
  error,
  profileCreated,
  lifeExpectancyYears,
  onboardingError,
  loginWithGoogle,
  completeOnboarding,
  logout,
  formatMandiQuantity
} = await useMandi()

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

if (user.value && profileCreated.value) {
  await navigateTo('/dashboard')
}

watch([user, profileCreated], () => {
  if (user.value && profileCreated.value) {
    navigateTo('/dashboard')
  }
})
</script>

<template>
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

    <section v-else key="onboarding" class="workspace onboarding">
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
  </Transition>
</template>
