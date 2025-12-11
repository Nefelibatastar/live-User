// src/utils/request.js
import axios from 'axios'
import Vue from 'vue'
import { Message } from 'iview'
// import routes from '../routes'


// 创建axios实例
const service = axios.create({
  // baseURL: 'http://192.168.3.37:8082', // 基础URL，可根据环境配置
  baseURL: 'http://lives.hbjcws.com.cn/api',
  timeout: 5000 // 请求超时时间
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // const token = localStorage.getItem('admin_token')
    // if (token) {
    //   config.headers['Authorization'] = token
    // }
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data
    // 处理正常响应中的业务错误（如后端自定义code≠200）
    if (res.code !== 200) {
      console.error('接口错误:', res.message)
      Message.error(res.message || '接口请求失败')
    }
    return res
  },
  error => {
    console.error('响应错误:', error)
    // if (error.response && error.response.status === 401) {
    //   // 提示登录失效
    //   Message.error('登录已失效，请重新登录')
    //   // 清除本地存储的token和用户信息
    //   localStorage.removeItem('admin_token')
    //   localStorage.removeItem('userInfo')
    //   localStorage.removeItem('userName')
    //   // 跳转到登录页
    //   router.push('/login')
    // } else {
    //   return Promise.reject(new Error(res.message || 'Error'));
    // }

    return Promise.reject(error)
  }
)

// 封装请求方法
const request = {
  get(url, params = {}) {
    return service.get(url, params)
  },
  post(url, data = {}) {
    return service.post(url, data)
  },
  put(url, data = {}) {
    return service.put(url, data)
  },
  delete(url, params = {}) {
    return service.delete(url, { params })
  }
}

// 挂载到Vue原型
Vue.prototype.$request = request

export default request