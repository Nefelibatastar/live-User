// 环境配置
const ENV_CONFIG = {
  development: {
    playerBaseUrl: 'http://localhost:8080',
    apiBaseUrl: '/api'
  },
  // test: {
  //   playerBaseUrl: 'http://test-player.yourdomain.com'
  // },
  production: {
    playerBaseUrl: 'http://lives.hbjcws.com.cn/',
    apiBaseUrl: 'http://lives.hbjcws.com.cn/api' // 生产环境直接访问
  }
};

// 获取当前环境
const getEnv = () => {
  const hostname = window.location.hostname;
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'development';
  } else if (hostname.includes('test.')) {
    return 'test';
  } else {
    return 'production';
  }
};

// 导出配置
export const config = ENV_CONFIG[getEnv()];