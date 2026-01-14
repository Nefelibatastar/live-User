<template>
  <div id="app">
    <!-- WatchLive 组件作为主页面 -->
    <WatchLive v-if="showWatchLive" />

    <!-- 路由内容（用于登录页面等其他页面） -->
    <router-view v-if="!showWatchLive" />
  </div>
</template>

<script>
import WatchLive from './views/index.vue'
import { mapState } from 'vuex'

export default {
  name: 'App',
  components: {
    WatchLive
  },
  computed: {
    ...mapState(['isLoginModalVisible']),
    showWatchLive() {
      // 当访问根路径时显示 WatchLive
      return this.$route.path === '/'
    }
  },
  created() {
    // 初始化检查登录状态
    this.$store.dispatch('checkLoginStatus')
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>