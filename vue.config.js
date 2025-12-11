
module.exports = {
  devServer: {
    historyApiFallback: true,
    proxy: {
      // 匹配以/api开头的请求，转发到目标地址
      '/api': {
        target: 'http://live.hbjcws.com.cn', // 目标拉流服务器域名
        changeOrigin: true, // 开启跨域
        pathRewrite: {
          '^/api': '' // 去掉/api前缀（关键：转发时替换路径）
        },
        // 支持WebSocket（如果是直播流需要）
        ws: true,
        secure: false // 若目标是http，需设为false
      }
    }
  }
}