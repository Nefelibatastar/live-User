// 环境配置
const ENV_CONFIG = {
  development: {
    // playerBaseUrl: 'http://localhost:8080',
    playerBaseUrl: 'http://localhost:8080',
    apiBaseUrl: 'http://192.168.3.37:8082',
    fileBaseUrl: 'http://localhost:8080',
    websocketUrl: '192.168.3.37:8082'
  },
  // test: {
  //   playerBaseUrl: 'http://test-player.yourdomain.com'
  // },
  production: {
    playerBaseUrl: 'http://lives.hbjcws.com.cn/',
    apiBaseUrl: 'http://lives.hbjcws.com.cn/api', // 生产环境直接访问
    fileBaseUrl: 'http://lives.hbjcws.com.cn/',
    websocketUrl: '112.126.72.150:8082'
  }
};

// 获取当前环境
const getEnv = () => {
  const hostname = window.location.hostname;
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')|| hostname.includes('192.168.3.190')) {
    return 'development';
  } else if (hostname.includes('test.')) {
    return 'test';
  } else {
    return 'production';
  }
};

// 导出配置
export const config = ENV_CONFIG[getEnv()];