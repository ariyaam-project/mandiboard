export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'cloudflare-pages'
  },
  runtimeConfig: {
    googleClientSecret: '',
    sessionSecret: '',
    public: {
      googleClientId: '',
      appUrl: 'http://localhost:3000',
      penaltyHoursPerQuarter: 1.5,
      mayoPenaltyHours: 1,
      softDrinkPenaltyHours: 2
    }
  },
  modules: ['@nuxtjs/google-fonts'],
  googleFonts: {
    families: {
      Inter: [400, 500, 600, 700, 800],
      'Bungee Shade': [400]
    },
    display: 'swap'
  },
  app: {
    head: {
      title: 'Mandi Theeta',
      meta: [
        {
          name: 'description',
          content: 'Track mandi sessions and the suspicious amount of life expectancy they consume.'
        }
      ]
    }
  }
})
