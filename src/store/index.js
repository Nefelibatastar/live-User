// store/index.js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)
export default new Vuex.Store({
  state: {
    user: null,  // 统一存储完整的用户信息（不再嵌套user字段）
    token: localStorage.getItem('token') || '',
    isLoginModalVisible: false,
    loginRedirectPath: '/'
  },

  mutations: {
    SET_USER(state, user) {
      state.user = user
      // 存储纯净的用户信息，避免嵌套
      localStorage.setItem('userInfo', JSON.stringify(user))
    },

    SET_TOKEN(state, token) {
      state.token = token
      localStorage.setItem('token', token)
    },

    CLEAR_USER(state) {
      state.user = null
      state.token = ''
      localStorage.removeItem('userInfo')
      localStorage.removeItem('token')
    },

    SET_LOGIN_MODAL_VISIBLE(state, visible) {
      state.isLoginModalVisible = visible
    },

    SET_LOGIN_REDIRECT_PATH(state, path) {
      state.loginRedirectPath = path
    }
  },

  actions: {
    // 手机号登录 - 统一数据结构
    async login({ commit }, params) {
      try {
        const { phone, code } = params
        const response = await this.$api.userLogin({ phone, code })
        if (response.code === 200) {
          const userData = response.data
          const token = response.token || userData.token

          // 统一存储结构：直接存储用户信息，不再嵌套user字段
          const pureUserInfo = userData.user || userData
          commit('SET_USER', pureUserInfo)
          
          // 确保token正确存储
          if (token) {
            commit('SET_TOKEN', token)
          }
          
          commit('SET_LOGIN_MODAL_VISIBLE', false)
          return { success: true, data: pureUserInfo }
        } else {
          return { success: false, message: response.message || '登录失败' }
        }
      } catch (error) {
        console.error('登录失败:', error)
        return { success: false, message: error.message || '网络错误' }
      }
    },

    // 微信登录 - 统一数据结构
    async wechatLogin({ commit }, params) {
      try {
        const { code } = params
        const response = await this.$api.wechatLogin({ code })
        if (response.code === 200 && response.data) {
          const userData = response.data
          // 统一存储结构
          const pureUserInfo = userData.user || userData
          commit('SET_USER', pureUserInfo)
          
          if (response.token) {
            commit('SET_TOKEN', response.token)
          }
          
          return { success: true, data: pureUserInfo }
        } else {
          return { success: false, message: response.message || '微信登录失败' }
        }
      } catch (error) {
        console.error('微信登录失败:', error)
        return { success: false, message: error.message || '网络错误' }
      }
    },

    //  ：检查登录状态（核心修改）
    checkLoginStatus({ commit, state }) {
      // 关键：移除先清空的逻辑，避免覆盖有效状态
      if (state.user && state.token) {
        return Promise.resolve(true) // 已有有效状态，直接返回
      }

      // 从localStorage读取
      const userInfoStr = localStorage.getItem('userInfo');
      const token = localStorage.getItem('token');

      // 只有同时存在userInfo和token时才恢复状态
      if (userInfoStr && token) {
        try {
          const user = JSON.parse(userInfoStr);
          // 宽松的校验逻辑：只要有id/用户标识就认为有效
          if (user && (user.id || user.userId)) {
            commit('SET_USER', user);
            commit('SET_TOKEN', token);
            return Promise.resolve(true);
          } else {
            // 数据不完整，清空
            commit('CLEAR_USER');
            return Promise.resolve(false);
          }
        } catch (e) {
          console.error('解析用户信息失败:', e);
          commit('CLEAR_USER');
          return Promise.resolve(false);
        }
      }
      // 无本地数据，返回未登录
      return Promise.resolve(false);
    },

    logout({ commit }) {
      commit('CLEAR_USER');
      return Promise.resolve(true);
    },

    showLoginModal({ commit }, redirectPath = null) {
      if (redirectPath) commit('SET_LOGIN_REDIRECT_PATH', redirectPath)
      commit('SET_LOGIN_MODAL_VISIBLE', true)
    },

    hideLoginModal({ commit }) {
      commit('SET_LOGIN_MODAL_VISIBLE', false)
    },
  },

  getters: {
    // 简化：直接返回纯净的用户信息
    userInfo: state => state.user,

    // 简化：获取用户ID
    userId: state => {
      return state.user?.id || state.user?.userId || ''
    },

    // 简化：判断是否登录
    isLoggedIn: state => {
      return !!state.user && !!state.token
    },

    isLoginModalVisible: state => state.isLoginModalVisible,
    loginRedirectPath: state => state.loginRedirectPath
  }
})