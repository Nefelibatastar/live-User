import Vue from 'vue'
import Router from 'vue-router'
// 引入你的根组件
import Index from './components/index.vue'
// 可选：如果有404页面，取消注释并创建NotFound组件
// import NotFound from './components/NotFound.vue'

// 注册Router插件（核心：你之前缺失的关键步骤）
Vue.use(Router)

let routes = [
    {
        path: '/',
        component: Index,
        name: 'Index', // 建议给路由命名，方便跳转
        hidden: true
    },
    // 可选：启用404路由（需创建NotFound.vue）
    // {
    //     path: '/404',
    //     component: NotFound,
    //     name: 'NotFound',
    //     hidden: true
    // },
    // 通配符路由：匹配所有未定义的路由
    {
        path: '*',
        hidden: true,
        redirect: { path: '/' } // 暂时重定向到首页，可改为/404
    }
];

// 创建并导出Router实例（核心：你之前缺失的关键步骤）
export default new Router({
    mode: 'history', // 默认hash模式，URL带#，无需后端配置
    routes: routes
})