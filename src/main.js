import Vue from 'vue'
import App from './App.vue'
import router from './routes'
import iView from 'iview';
import 'iview/dist/styles/iview.css';  

Vue.use(iView);
router.beforeEach((to) => {
  if (to.path == '/') {
    // localStorage.removeItem('userInfo');
  }
  // let userInfo = JSON.parse(localStorage.getItem('userInfo'));
  // if (!userInfo && to.path != '/login') {
  //     next({ path: '/login' })
  // } else {
  //     next()
  // }
})

import api from './api/api';
Vue.prototype.$api = api;

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')
