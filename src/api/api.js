// import axios from 'axios';
import request from '../utils/request'; // 引入封装好的request（而非直接用axios）

// let base = '/api';

// 统一封装所有API接口
const api = {
  // liveStream/getById 前端不登录根据id查询直播创建和推/播流信息
  getById: (params) => request.get(`/liveStream/getById`, { params }),
  // 新增菜单
  // addProgram: (params) => request.post(`${base}/program/addProgram`, params),
  // userRegistrationData/add 用户报名信息新增
  add: (params) => request.post(`/userRegistrationData/add`, params),
  // userRegistrationData/getId 用户报名信息回显
  getId: (params) => request.get(`/userRegistrationData/getId`, { params }),
  // userRegistrationData/list 用户报名信息查询
  // list: (params) => request.get(`/userRegistrationData/list`, { params }),
  // userRegistrationData/update 用户报名信息修改
  update: (params) => request.put(`userRegistrationData/update`, params),
};

export default api;