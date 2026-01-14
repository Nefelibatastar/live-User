// store/index.js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null,
    token: localStorage.getItem('token') || '',
    isLoginModalVisible: false,
    loginRedirectPath: '/'
  },

  mutations: {
    SET_USER(state, user) {
      state.user = user
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
    // 手机号登录
    async login({ commit }, params) {
      try {
        // 从 params 中解构参数
        const { phone, code } = params
        const response = await this._vm.$api.userLogin({ phone, code })
        if (response.code === 200) {
          const userData = response.data
          const token = response.token || response.data?.token
          commit('SET_USER', userData)
          if (token) commit('SET_TOKEN', token)
          commit('SET_LOGIN_MODAL_VISIBLE', false)
          return { success: true, data: userData }
        } else {
          return { success: false, message: response.message || '登录失败' }
        }
      } catch (error) {
        console.error('登录失败:', error)
        return { success: false, message: error.message || '网络错误' }
      }
    },

    // 发送验证码 - 修正参数接收方式
    async sendCode(context, params) {
      try {
        // 从 params 中解构 phone
        const { phone } = params
        const response = await context._vm.$api.sendCode({ phone })
        return { success: response.code === 200 }
      } catch (error) {
        console.error('发送验证码失败:', error)
        return { success: false }
      }
    },

    async wechatLogin({ commit }, params) {
      try {
        const { code } = params
        const response = await this._vm.$api.wechatLogin({ code })
        if (response.code === 200 && response.data) {
          const userData = response.data
          commit('SET_USER', userData)
          if (response.token) commit('SET_TOKEN', response.token)
          return { success: true, data: userData }
        } else {
          return { success: false, message: response.message || '微信登录失败' }
        }
      } catch (error) {
        console.error('微信登录失败:', error)
        return { success: false, message: error.message || '网络错误' }
      }
    },

    // 显示登录弹框
    showLoginModal({ commit }, redirectPath = null) {
      if (redirectPath) commit('SET_LOGIN_REDIRECT_PATH', redirectPath)
      commit('SET_LOGIN_MODAL_VISIBLE', true)
    },

    // 隐藏登录弹框
    hideLoginModal({ commit }) {
      commit('SET_LOGIN_MODAL_VISIBLE', false)
    },

    // 检查登录状态
    checkLoginStatus({ commit }) {
      const userInfo = localStorage.getItem('userInfo');
      const token = localStorage.getItem('token');

      if (userInfo) {
        try {
          const user = JSON.parse(userInfo);
          commit('SET_USER', user);
          if (token) commit('SET_TOKEN', token);
          return true; // 返回布尔值
        } catch (e) {
          console.error('解析用户信息失败:', e);
          commit('CLEAR_USER');
          return false; // 返回布尔值
        }
      }
      return false; // 返回布尔值
    },

    // 退出登录
    logout({ commit }) {
      commit('CLEAR_USER')
      commit('SET_LOGIN_REDIRECT_PATH', '/')
      // 可以跳转到首页
      window.location.href = '/'
    }
  },

  getters: {
    userInfo: state => state.user,
    userId: state => {
      // console.log('Vuex getter userId 调用，state.user:', state.user);
      return state.user?.user.id || state.user?.user.userId || '';
    },
    isLoggedIn: state => {
      const isLogged = !!state.user.user;
      // console.log('Vuex getter isLoggedIn 调用:', isLogged);
      return isLogged;
    },
    isLoginModalVisible: state => state.isLoginModalVisible,
    loginRedirectPath: state => state.loginRedirectPath
  }
})