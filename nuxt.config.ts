export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'cloudflare-module'
  },
  runtimeConfig: {
    googleClientSecret: '',
    sessionSecret: '',
    public: {
      googleClientId: '',
      appUrl: 'http://localhost:3000',
      penaltyHoursPerQuarter: 1.5,
      mayoPenaltyHours: 1,
      softDrinkPenaltyHours: 2,
      clarityId: ''
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
        },
        { name: 'theme-color', content: '#d1f64a' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' },
        { rel: 'manifest', href: '/favicon/site.webmanifest' }
      ]
    }
  }
})
