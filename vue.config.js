
module.exports = {
  devServer: {
    historyApiFallback: true,
    proxy: {
      // 仅保留其他必要代理（如果有的话），删除/api相关配置
    }
  }
}