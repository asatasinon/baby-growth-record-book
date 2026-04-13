export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/records/index',
    'pages/trends/index',
    'pages/ai/index',
    'pages/profile/index',
    'pages/alerts/index',
    'pages/reports/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '成长记录',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#6b7280',
    selectedColor: '#0284c7',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/records/index', text: '记录' },
      { pagePath: 'pages/trends/index', text: '趋势' },
      { pagePath: 'pages/ai/index', text: 'AI' },
      { pagePath: 'pages/profile/index', text: '我的' }
    ]
  }
})
