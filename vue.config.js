
module.exports = {
  devServer: {
    proxy: {
      // 匹配以/api-stream开头的请求，转发到目标地址
      '/api-stream': {
        target: 'http://live.hbjcws.com.cn', // 目标拉流服务器域名
        changeOrigin: true, // 开启跨域
        pathRewrite: {
          '^/api-stream': '' // 去掉/api-stream前缀（关键：转发时替换路径）
        },
        // 支持WebSocket（如果是直播流需要）
        ws: true,
        secure: false // 若目标是http，需设为false
      }
    }
  }
}