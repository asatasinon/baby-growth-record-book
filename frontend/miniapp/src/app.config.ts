export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/quick-record/index',
    'pages/update-record/index',
    'pages/records/index',
    'pages/trends/index',
    'pages/ai/index',
    'pages/profile/index',
    'pages/family-manage/index',
    'pages/baby-manage/index',
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
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/icons/tab/home.png',
        selectedIconPath: 'assets/icons/tab/home-active.png'
      },
      {
        pagePath: 'pages/records/index',
        text: '记录',
        iconPath: 'assets/icons/tab/records.png',
        selectedIconPath: 'assets/icons/tab/records-active.png'
      },
      {
        pagePath: 'pages/trends/index',
        text: '趋势',
        iconPath: 'assets/icons/tab/trends.png',
        selectedIconPath: 'assets/icons/tab/trends-active.png'
      },
      {
        pagePath: 'pages/ai/index',
        text: 'AI',
        iconPath: 'assets/icons/tab/ai.png',
        selectedIconPath: 'assets/icons/tab/ai-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/tab/profile.png',
        selectedIconPath: 'assets/icons/tab/profile-active.png'
      }
    ]
  }
})
