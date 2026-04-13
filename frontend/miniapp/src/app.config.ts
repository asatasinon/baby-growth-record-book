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
    navigationBarBackgroundColor: '#f4f8ff',
    navigationBarTitleText: '成长记录',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#5d6f85',
    selectedColor: '#0e8fd1',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/records/index', text: '记录' },
      { pagePath: 'pages/trends/index', text: '趋势' },
      { pagePath: 'pages/ai/index', text: 'AI' },
      { pagePath: 'pages/profile/index', text: '我的' }
    ]
  }
})
