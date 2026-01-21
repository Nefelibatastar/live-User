<template>
  <div class="live-container">
    <!-- 左侧直播区域 -->
    <div class="live-left">
      <VideoPlayer :streamUrl="streamUrl" :liveStatus="liveStatus" :streamType="streamType" :startTime="startTime"
        :coverImageUrl="coverImageUrl" :streamData="streamData" @refresh="refreshLiveStatus" />
      <!-- 桌面端显示LiveInfo -->
      <div class="desktop-live-info">
        <LiveInfo :liveShowName="liveShowName" :startTime="startTime" />
      </div>
    </div>

    <!-- 右侧信息区域 -->
    <div class="live-right">
      <!-- 桌面端显示完整的CommentSection -->
      <div class="desktop-comments">
        <CommentSection ref="commentSection" :liveId="id" :userId="userId" :onlineCount="onlineCount"
          @require-login="handleRequireLogin" @update-comments="handleCommentsUpdate" />
      </div>

      <!-- 移动端tab切换 -->
      <div class="mobile-tabs-section">
        <!-- Tab标签 -->
        <div class="mobile-tabs">
          <div class="tab-item" :class="{ active: activeTab === 'info' }" @click="switchTab('info')">
            <span class="tab-icon">📝</span>
            <span class="tab-text">直播信息</span>
          </div>
          <div class="tab-item" :class="{ active: activeTab === 'comments' }" @click="switchTab('comments')">
            <span class="tab-icon">💬</span>
            <span class="tab-text">互动评论</span>
            <!-- <span v-if="onlineCount > 0" class="online-badge">在线人数{{ onlineCount }}</span> -->
          </div>
        </div>

        <!-- Tab内容 -->
        <div class="tab-content">
          <!-- 直播信息内容 -->
          <div v-show="activeTab === 'info'" class="tab-pane">
            <LiveInfo :liveShowName="liveShowName" :startTime="startTime" />
          </div>

          <!-- 评论内容 -->
          <div v-show="activeTab === 'comments'" class="tab-pane">
            <div class="mobile-comments">
              <CommentSection ref="mobileCommentSection" :liveId="id" :userId="userId" :onlineCount="onlineCount"
                @require-login="handleRequireLogin" @update-comments="handleCommentsUpdate" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 报名表单悬浮按钮 -->
    <div v-if="isEntryFrom === '1' && entryFromData && entryFromData.length > 0" class="registration-fab"
      @click="openRegistrationModal">
      <div class="fab-icon">📝</div>
      <div class="fab-text">报名表</div>
    </div>

    <!-- 报名表单弹框 -->
    <Modal v-model="showRegistrationModal" :title="isRegistered ? '修改报名信息' : liveShowName + ' - 报名表'" width="500"
      :styles="{ margin: '0' }" :mask-closable="false" @on-ok="submitRegistration" @on-cancel="cancelRegistration"
      class-name="registration-modal">
      <div class="registration-modal-content">
        <div class="modal-header-section">
          <Alert v-if="isRegistered" type="info" show-icon style="margin-bottom: 15px;">
            您已报名，可修改信息
          </Alert>
          <div class="registration-title">
            {{ isRegistered ? '修改报名信息' : '请如实填写以下信息' }}
          </div>
        </div>
        <div class="modal-form-section">
          <Form ref="registrationForm" :model="registrationData" :rules="registrationRules" label-position="top">
            <Form-item v-for="(field, index) in entryFromData" :key="field.uniqueKey || field.type + index"
              :label="(index + 1).toString().padStart(2, '0') + ' ' + field.name" :prop="field.uniqueKey">
              <Select v-if="field.type === 'gender'" v-model="registrationData[field.uniqueKey]" placeholder="请选择性别"
                clearable>
                <Option value="male">男</Option>
                <Option value="female">女</Option>
              </Select>
              <DatePicker v-else-if="field.type === 'birthday'" type="date"
                :value="registrationData[field.uniqueKey] ? new Date(registrationData[field.uniqueKey]) : null"
                @on-change="(date) => handleBirthdayChange(date, field.uniqueKey)"
                :placeholder="field.placeholder || '请选择出生日期'" style="width: 100%" clearable format="yyyy-MM-dd" />
              <Input v-else v-model="registrationData[field.uniqueKey]"
                :placeholder="field.placeholder || '请输入' + field.name" clearable />
            </Form-item>
          </Form>
        </div>
      </div>
    </Modal>

    <!-- 登录提示弹框 - 修改为登录确认弹框 -->
    <Modal v-model="showLoginPromptModal" title="温馨提示" width="400" :mask-closable="false" :closable="true"
      :footer-hide="true" class-name="login-modal">
      <div class="login-modal-content">
        <div class="login-header">
          <div class="login-title">您当前尚未登录，请前往登录</div>
        </div>
        <div class="login-body">
          <div class="login-icon">
            <img src="https://j.weizan.cn/live-statics/yingxiao-wx-front/mk-static/img/loginTips.f28e6b8e.png" alt=""
              style="width: 100%;">
          </div>
        </div>
        <div class="login-footer">
          <Button type="text" @click="handleLoginCancel" class="login-cancel-btn">暂不登录，继续操作</Button>
          <Button type="primary" @click="handleLoginConfirm" class="login-confirm-btn">前往登录</Button>
        </div>
      </div>
    </Modal>

    <!-- 手机号登录弹框 -->
    <PhoneLoginModal v-model="phoneLoginModalVisible" @login-success="handlePhoneLoginSuccess" />
  </div>
</template>

<script>
import VideoPlayer from '../components/VideoPlayer.vue';
import LiveInfo from '../components/LiveInfo.vue';
import CommentSection from '../components/CommentSection.vue';
import PhoneLoginModal from '../components/login/login.vue';
import { config } from '../config';
import { mapState, mapGetters, mapActions } from 'vuex';

export default {
  name: "LivePlayerPage",
  components: {
    VideoPlayer,
    LiveInfo,
    CommentSection,
    PhoneLoginModal
  },
  computed: {
    ...mapState(['isLoginModalVisible']),
    ...mapGetters(['userInfo', 'isLoggedIn']),

    // 手机号登录弹框的显示状态
    phoneLoginModalVisible: {
      get() {
        return this.isLoginModalVisible;
      },
      set(value) {
        if (value) {
          this.$store.dispatch('showLoginModal');
        } else {
          this.$store.dispatch('hideLoginModal');
        }
      }
    },

    // 判断是否为微信浏览器
    isWechatBrowser() {
      const userAgent = navigator.userAgent.toLowerCase();
      return userAgent.includes('micromessenger');
    }
  },
  data() {
    return {
      liveShowName: '',
      startTime: '',
      liveStatus: '0',
      coverImageUrl: '',
      streamUrl: "",
      id: '',
      streamType: null,
      streamData: {},
      onlineCount: 0,
      showOnlineCount: true,
      showRegistrationModal: false,
      registrationLoading: false,
      entryFromData: [],
      registrationData: {},
      registrationRules: {},
      isRegistered: false,
      registrationId: null,
      isEntryFrom: '0',
      entryFromId: '',
      showLoginPromptModal: false,
      userId: '',
      formInitialized: false,
      isAutoOpenRegistration: false,
      hasAutoOpenedRegistration: false,
      commentPollingTimer: null,
      pollingInterval: 5000,
      // 新增：当前激活的tab
      activeTab: 'comments'
    };
  },

  mounted() {
    this.$nextTick(() => {
      // 如果 Vuex 中有用户信息但本地没有同步，强制同步一次
      if (this.$store.getters.isLoggedIn && !this.userId) {
        const userInfo = this.$store.getters.userInfo;
        if (userInfo) {
          this.userId = userInfo.id || userInfo.userId;
          console.log('强制同步用户ID:', this.userId);
        }
      }
    });
    this.initPage();

    // 监听窗口大小变化
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  },

  beforeDestroy() {
    this.cleanup();
    window.removeEventListener('resize', this.handleResize);
  },

  watch: {
    // 监听用户信息变化
    userInfo(newUser) {
      if (newUser) {
        console.log('用户信息已更新:', newUser);
        // 更新本地 userId
        this.userId = newUser.id || newUser.userId;

        // 登录成功后，如果报名表弹框还在显示，更新表单数据
        if (this.showRegistrationModal) {
          this.$nextTick(async () => {
            await this.checkLocalRegistration();
            await this.checkRegistrationStatus();
          });
        }

        // 关闭登录提示弹框
        if (this.showLoginPromptModal) {
          this.showLoginPromptModal = false;
        }
      } else {
        // 用户信息为空时，清空 userId
        console.log('用户信息已清空');
        this.userId = '';
      }
    }
  },

  methods: {
    ...mapActions(['showLoginModal', 'hideLoginModal']),

    // 处理窗口大小变化
    handleResize() {
      // 移动端默认显示评论tab
      if (window.innerWidth <= 768) {
        this.activeTab = 'comments';
      }
    },

    // 切换tab
    switchTab(tab) {
      this.activeTab = tab;
    },

    // 处理手机号登录成功
    handlePhoneLoginSuccess(userInfo) {
      console.log('手机号登录成功:', userInfo);
      // 用户信息已经在 Vuex 中更新，watch 会监听到并执行相应操作
      // 不需要额外处理，只需要关闭提示弹框（如果还显示的话）
      if (this.showLoginPromptModal) {
        this.showLoginPromptModal = false;
      }
    },

    async initPage() {
      console.log('页面加载，开始初始化');
      this.tryLoadFromLocalStorage();
      await this.initFromUrlParams();
      this.cleanupExpiredLocalRegistrations();
      this.initUserInfo();

      // 处理微信授权回调
      await this.handleWechatCallback();

      if (!this.hasAutoOpenedRegistration) {
        this.checkAutoOpenRegistration();
        this.hasAutoOpenedRegistration = true;
      }
    },

    tryLoadFromLocalStorage() {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        const storageKey = `registration_${id}`;
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            console.log('从本地存储预加载数据:', parsedData);
            this.userId = parsedData.userId || '';
            this.isRegistered = !!parsedData.registrationId;
            this.registrationId = parsedData.registrationId || null;
          } catch (e) {
            console.error('解析本地存储数据失败:', e);
          }
        }
      }
    },

    async initFromUrlParams() {
      console.log('=== 开始解析URL参数 ===');
      const urlParams = new URLSearchParams(window.location.search);
      this.id = urlParams.get('id');
      this.streamType = urlParams.get('type');

      if (!this.id) {
        this.$Message.error('未找到直播ID参数');
        return;
      }

      try {
        await this.getStreamDataById(this.id);
      } catch (error) {
        console.error('获取流地址信息失败:', error);
        this.$Message.error('获取直播信息失败，请检查网络连接');
      }
    },

    async getStreamDataById(id) {
      console.log('调用接口获取流地址信息，ID:', id);
      try {
        const res = await this.$api.getById({ id: id });
        if (res.code === 200) {
          const data = res.data;
          this.liveShowName = data.liveShowName;
          this.startTime = data.startTime;
          this.liveStatus = data.liveStatus;
          this.isEntryFrom = data.isEntryFrom || '0';
          this.entryFromId = data.entryFromId || '';
          await this.processEntryFromData(data.entryFromData);

          if (data.liveCover) {
            this.coverImageUrl = `${config.playerBaseUrl}/api/sysFile/image/${data.liveCover}`;
          }

          if (this.liveStatus === '1') {
            this.parseStreamData(data);
          }
        }
      } catch (error) {
        console.error('获取直播信息失败:', error);
        throw error;
      }
    },

    async processEntryFromData(entryFromData) {
      if (!entryFromData || !Array.isArray(entryFromData)) {
        this.entryFromData = [];
        this.registrationData = {};
        this.registrationRules = {};
        this.formInitialized = false;
        return;
      }

      this.entryFromData = [];
      this.registrationRules = {};
      this.formInitialized = false;
      const typeCount = {};

      entryFromData.forEach((field, index) => {
        if (!typeCount[field.type]) {
          typeCount[field.type] = 0;
        }
        typeCount[field.type]++;

        let fieldKey;
        if (typeCount[field.type] === 1) {
          fieldKey = field.type;
        } else {
          fieldKey = `${field.type}${typeCount[field.type]}`;
        }

        const uniqueKey = `${field.type}_${index}`;
        const fieldWithKey = { ...field, uniqueKey, fieldKey };
        this.entryFromData.push(fieldWithKey);
        this.$set(this.registrationRules, uniqueKey, []);

        if (field.required) {
          this.registrationRules[uniqueKey].push({
            required: true,
            message: `${field.name}不能为空`,
            trigger: []
          });
        }

        if (field.type === 'phone') {
          this.registrationRules[uniqueKey].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) callback();
                else callback(new Error(`${field.name}不能为空`));
                return;
              }
              const phonePattern = /^1[3-9]\d{9}$/;
              if (!phonePattern.test(value)) {
                callback(new Error('请输入正确的手机号码'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        } else if (field.type === 'idCard') {
          this.registrationRules[uniqueKey].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) callback();
                else callback(new Error(`${field.name}不能为空`));
                return;
              }
              const idCardPattern = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
              if (!idCardPattern.test(value)) {
                callback(new Error('请输入正确的身份证号'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        } else if (field.type === 'email') {
          this.registrationRules[uniqueKey].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) callback();
                else callback(new Error(`${field.name}不能为空`));
                return;
              }
              const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailPattern.test(value)) {
                callback(new Error('请输入正确的邮箱地址'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        } else if (field.type === 'age') {
          this.registrationRules[uniqueKey].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) callback();
                else callback(new Error(`${field.name}不能为空`));
                return;
              }
              const age = parseInt(value);
              if (isNaN(age) || age < 0 || age > 150) {
                callback(new Error('请输入有效的年龄(0-150)'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        }
      });

      await this.fillFormDataFromLocalStorage();
      this.formInitialized = true;
    },

    async fillFormDataFromLocalStorage() {
      try {
        const storageKey = `registration_${this.id}`;
        const localData = localStorage.getItem(storageKey);
        if (!localData) {
          this.initEmptyForm();
          return;
        }

        const parsedData = JSON.parse(localData);
        console.log('读取本地存储:', parsedData);
        this.registrationId = parsedData.registrationId || null;
        this.isRegistered = !!this.registrationId;
        this.entryFromId = parsedData.entryFromId || this.entryFromId;
        const storedData = parsedData.registrationData || {};
        this.registrationData = {};

        if (parsedData.format === 'dynamic_chinese' && parsedData.formConfigSnapshot) {
          this.fillWithConfigSnapshot(parsedData.formConfigSnapshot, storedData);
        } else {
          this.fillWithCurrentConfig(storedData);
        }
      } catch (error) {
        console.error('填充失败:', error);
        this.initEmptyForm();
      }
    },

    fillWithConfigSnapshot(formConfigSnapshot, storedData) {
      formConfigSnapshot.forEach(snapshot => {
        const currentField = this.entryFromData.find(f =>
          f.uniqueKey === snapshot.uniqueKey ||
          (f.name === snapshot.name && f.type === snapshot.type)
        );
        if (currentField && storedData[snapshot.name] !== undefined) {
          const value = this.transformValueForForm(currentField.type, storedData[snapshot.name]);
          this.$set(this.registrationData, currentField.uniqueKey, value);
        }
      });
    },

    fillWithCurrentConfig(storedData) {
      this.entryFromData.forEach(field => {
        if (!field.name) return;
        let value = '';
        if (storedData[field.name] !== undefined) {
          value = storedData[field.name];
        } else {
          const matchingKey = Object.keys(storedData).find(key =>
            key.includes(field.name) || (field.name && field.name.includes(key))
          );
          if (matchingKey) {
            value = storedData[matchingKey];
          }
        }
        value = this.transformValueForForm(field.type, value);
        if (value !== undefined && value !== null && value !== '') {
          this.$set(this.registrationData, field.uniqueKey, value);
        }
      });
    },

    transformValueForForm(fieldType, value) {
      if (value === undefined || value === null || value === '') return value;
      if (fieldType === 'gender') {
        if (value === '男') return 'male';
        if (value === '女') return 'female';
      }
      return value;
    },

    initEmptyForm() {
      this.registrationData = {};
      this.entryFromData.forEach(field => {
        this.$set(this.registrationData, field.uniqueKey, '');
      });
    },

    async checkAutoOpenRegistration() {
      console.log('检查自动打开报名表条件:', {
        isEntryFrom: this.isEntryFrom,
        entryFromData: this.entryFromData?.length,
        userId: this.userId,
        isRegistered: this.isRegistered,
        isAutoOpenRegistration: this.isAutoOpenRegistration
      });

      if (this.userId) {
        await this.checkRegistrationStatus();
      }

      if (this.isEntryFrom === '1' &&
        this.entryFromData &&
        this.entryFromData.length > 0 &&
        !this.userId &&
        !this.isRegistered &&
        !this.isAutoOpenRegistration) {

        console.log('自动打开报名表和登录提示');
        this.isAutoOpenRegistration = true;
        this.showRegistrationModal = true;
        this.$nextTick(() => {
          setTimeout(() => {
            this.showLoginPromptModal = true;
          }, 100);
        });
      } else if (this.isRegistered) {
        console.log('本地已报名，不自动弹出报名表和登录提示');
      }
    },

    async openRegistrationModal() {
      console.log('用户点击报名表单按钮，当前用户ID:', this.userId);
      if (!this.entryFromData || this.entryFromData.length === 0) {
        console.log('没有报名表数据');
        this.$Message.info('暂无报名表');
        return;
      }

      this.showRegistrationModal = true;

      if (!this.userId) {
        console.log('用户未登录，显示登录提示弹框');
        this.$nextTick(() => {
          setTimeout(() => {
            this.showLoginPromptModal = true;
          }, 100);
        });
      } else {
        console.log('用户已登录，检查报名状态');
        await this.checkLocalRegistration();
        await this.checkRegistrationStatus();
        this.$nextTick(() => {
          if (this.$refs.registrationForm) {
            setTimeout(() => {
              if (this.$refs.registrationForm) {
                this.$refs.registrationForm.resetFields();
                this.clearFormValidation();
              }
            }, 100);
          }
        });
      }
    },

    async checkLocalRegistration() {
      try {
        const storageKey = `registration_${this.id}`;
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          const parsedData = JSON.parse(localData);
          console.log('从本地存储检查报名信息:', parsedData);
          if (parsedData.registrationId) {
            this.registrationId = parsedData.registrationId;
            this.isRegistered = true;
            if (parsedData.entryFromId) {
              this.entryFromId = parsedData.entryFromId;
            }
            console.log('检查本地报名信息: 已报名，registrationId:', this.registrationId, 'entryFromId:', this.entryFromId);
            const registrationData = parsedData.registrationData || {};
            console.log('本地存储的中文数据:', registrationData);
            this.entryFromData.forEach(field => {
              if (!field.name) return;
              let value = '';
              if (registrationData[field.name] !== undefined) {
                value = registrationData[field.name];
              } else {
                for (const [chineseKey, chineseValue] of Object.entries(registrationData)) {
                  if (field.name.includes(chineseKey) || chineseKey.includes(field.name)) {
                    value = chineseValue;
                    break;
                  }
                }
              }
              if (field.type === 'gender' && value) {
                if (value === '男') value = 'male';
                else if (value === '女') value = 'female';
              }
              console.log(`为字段 ${field.name} (${field.uniqueKey}) 设置值:`, value);
              if (value !== undefined && value !== '' && value !== null) {
                this.$set(this.registrationData, field.uniqueKey, value);
              }
            });
            console.log('填充后的registrationData:', this.registrationData);
            return;
          }
        }
        this.isRegistered = false;
        this.registrationId = null;
      } catch (error) {
        console.error('检查本地报名信息失败:', error);
        this.isRegistered = false;
        this.registrationId = null;
      }
    },

    async checkRegistrationStatus() {
      if (!this.userId) return;
      try {
        const res = await this.$api.getId({ liveId: this.id });
        if (res.code === 200 && res.data && res.data.length > 0) {
          const registrationRecord = res.data[0];
          this.isRegistered = true;
          this.registrationId = registrationRecord.id;
          if (registrationRecord.entryFromId) {
            this.entryFromId = registrationRecord.entryFromId;
            console.log('从服务器状态检查更新 entryFromId:', this.entryFromId);
          }
          await this.processServerJsonData(registrationRecord);
        } else {
          if (!this.isRegistered) {
            this.isRegistered = false;
            this.registrationId = null;
          }
        }
      } catch (error) {
        console.error('检查服务器报名状态失败:', error);
      }
    },

    async processServerJsonData(serverData) {
      try {
        let parsedData = {};
        if (serverData?.jsonData) {
          try {
            parsedData = JSON.parse(serverData.jsonData);
          } catch (e) {
            console.error('解析jsonData失败:', e);
          }
        }
        this.entryFromData.forEach(field => {
          let value = '';
          if (parsedData[field.fieldKey] !== undefined) {
            value = parsedData[field.fieldKey];
          } else if (parsedData[field.type] !== undefined) {
            value = parsedData[field.type];
          }
          if (value !== undefined && value !== null) {
            this.$set(this.registrationData, field.uniqueKey, value);
          }
        });
        await this.saveRegistrationToLocal({
          registrationId: serverData.id,
          registrationData: parsedData
        });
      } catch (error) {
        console.error('处理服务器jsonData失败:', error);
      }
    },

    handleBirthdayChange(date, uniqueKey) {
      if (date) {
        try {
          if (typeof date === 'string') {
            this.registrationData[uniqueKey] = date;
          } else if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            this.registrationData[uniqueKey] = `${year}-${month}-${day}`;
          } else {
            this.registrationData[uniqueKey] = String(date);
          }
        } catch (error) {
          console.error('处理日期出错:', error);
          this.registrationData[uniqueKey] = '';
        }
      } else {
        this.registrationData[uniqueKey] = '';
      }
      if (this.registrationData[uniqueKey]) {
        this.$nextTick(() => {
          if (this.$refs.registrationForm && this.$refs.registrationForm.validateField) {
            this.$refs.registrationForm.validateField(uniqueKey);
          }
        });
      }
    },

    async submitRegistration() {
      this.$refs.registrationForm.validate(async (valid) => {
        if (!valid) {
          this.$Message.error('请填写完整的报名信息');
          return;
        }
        if (this.registrationLoading) return;
        this.registrationLoading = true;

        try {
          const { chineseData, submitData } = this.prepareSubmissionData();
          const serverResponse = await this.submitToServer(submitData);
          if (!serverResponse.success) {
            throw new Error(serverResponse.message || '服务器提交失败');
          }
          await this.handleServerSuccess(serverResponse.data, chineseData, serverResponse.isUpdate);
          this.showRegistrationModal = false;
        } catch (error) {
          this.handleSubmissionError(error);
        } finally {
          this.registrationLoading = false;
        }
      });
    },

    prepareSubmissionData() {
      const chineseData = {};
      this.entryFromData.forEach(field => {
        const value = this.registrationData[field.uniqueKey];
        if (this.hasValue(value) && field.name) {
          chineseData[field.name] = this.transformValueForStorage(field.type, value);
        }
      });
      const submitData = {
        liveStreamId: this.id,
        entryFromId: this.entryFromId || undefined,
        registrationData: chineseData
      };
      console.log('准备提交的数据:', submitData);
      return { chineseData, submitData };
    },

    transformValueForStorage(fieldType, value) {
      if (fieldType === 'gender') {
        if (value === 'male') return '男';
        if (value === 'female') return '女';
      }
      return value;
    },

    hasValue(value) {
      return value !== undefined && value !== null && value !== '';
    },

    async submitToServer(submitData) {
      try {
        let res;
        let isUpdate = false;
        if (this.registrationId) {
          isUpdate = true;
          console.log('执行修改操作，registrationId:', this.registrationId);
          res = await this.$api.update({ id: this.registrationId, ...submitData });
        } else {
          isUpdate = false;
          console.log('执行新增操作');
          res = await this.$api.add(submitData);
        }
        return {
          success: res.code === 200,
          data: res.data,
          message: res.message,
          isUpdate: isUpdate
        };
      } catch (error) {
        console.error('API调用失败:', error);
        return { success: false, message: '网络错误，请检查网络连接', isUpdate: false };
      }
    },

    async handleServerSuccess(serverData, chineseData, isUpdate) {
      const wasUpdate = isUpdate !== undefined ? isUpdate : !!this.registrationId;
      this.isRegistered = true;
      if (serverData?.id && !wasUpdate) {
        this.registrationId = serverData.id;
        console.log('新增成功，设置 registrationId:', this.registrationId);
      }
      if (serverData?.entryFromId) {
        this.entryFromId = serverData.entryFromId;
        console.log('从服务器响应更新 entryFromId:', this.entryFromId);
      }
      await this.saveRegistrationToLocal({
        registrationId: this.registrationId,
        registrationData: chineseData,
        entryFromId: serverData.entryFromId,
        serverData: serverData,
        isUpdate: isUpdate
      });
      const message = wasUpdate ? '修改成功！' : '报名成功！';
      this.$Message.success(message);
      await this.checkRegistrationStatus();
    },

    handleSubmissionError(error) {
      console.error('提交过程失败:', error);
      if (error.message.includes('网络错误')) {
        this.$Message.error('网络连接失败，请检查网络后重试');
      } else if (error.message.includes('服务器')) {
        this.$Message.error(error.message);
      } else {
        this.$Message.error('提交失败，请重试');
      }
    },

    async saveRegistrationToLocal(data) {
      try {
        const storageKey = `registration_${this.id}`;
        const finalEntryFromId = data.serverData?.entryFromId || data.entryFromId || this.entryFromId;
        let registrationData = data.registrationData;
        if (data.serverData?.jsonData) {
          try {
            registrationData = JSON.parse(data.serverData.jsonData);
            console.log('使用服务器返回的 jsonData:', registrationData);
          } catch (e) {
            console.error('解析服务器 jsonData 失败，使用本地数据:', e);
          }
        }
        const storageData = {
          registrationId: data.registrationId || data.serverData?.id,
          registrationData: registrationData,
          liveStreamId: this.id,
          entryFromId: finalEntryFromId,
          serverData: data.serverData,
          saveTime: new Date().getTime(),
          userId: this.userId,
          format: 'dynamic_chinese',
          submittedToServer: true,
          lastSubmitTime: new Date().toISOString(),
          operationType: data.isUpdate ? 'update' : 'add'
        };
        localStorage.setItem(storageKey, JSON.stringify(storageData));
        console.log('已保存服务器验证过的数据到本地:', storageData);
      } catch (error) {
        console.error('保存到本地存储失败:', error);
      }
    },

    cancelRegistration() {
      this.showRegistrationModal = false;
    },

    clearFormValidation() {
      if (this.$refs.registrationForm) {
        this.$refs.registrationForm.clearValidate();
        this.entryFromData.forEach(field => {
          const uniqueKey = field.uniqueKey;
          if (this.$refs.registrationForm.fields) {
            const formItem = this.$refs.registrationForm.fields.find(f => f.prop === uniqueKey);
            if (formItem) {
              formItem.validateState = '';
              formItem.validateMessage = '';
            }
          }
        });
      }
    },

    // 初始化用户信息
    async initUserInfo() {
      try {
        // 等待 checkLoginStatus 完成
        await this.$store.dispatch('checkLoginStatus');

        // 通过 getter 获取状态
        const userLoggedIn = this.$store.getters.isLoggedIn;
        const userIdFromStore = this.$store.getters.userId;

        console.log('initUserInfo 检查结果:', {
          用户是否登录: userLoggedIn,
          用户ID: userIdFromStore,
          本地存储: localStorage.getItem('userInfo')
        });

        if (userLoggedIn) {
          this.userId = userIdFromStore;
          console.log('✅ 用户已登录，用户ID:', this.userId);
        } else {
          // console.log('❌ 用户未登录');
          this.userId = '';
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        this.userId = '';
      }
    },

    // 处理微信授权回调
    async handleWechatCallback() {
      if (!this.isWechatBrowser) return;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state) {
        try {
          // 验证 state
          const savedState = localStorage.getItem('wechat_auth_state');
          if (state !== savedState) {
            console.error('state验证失败');
            return;
          }

          console.log('处理微信授权回调，code:', code);
          // 使用 Vuex action 处理微信登录
          const result = await this.$store.dispatch('wechatLogin', { code });

          if (result.success) {
            // 更新用户ID
            this.userId = this.$store.getters.userId;
            console.log('微信登录成功，用户ID:', this.userId);
            this.$Message.success('登录成功');

            // 清除微信授权状态
            localStorage.removeItem('wechat_auth_state');

            // 清除URL中的code和state参数
            this.clearWechatAuthParams();

            // 登录成功后，如果报名表弹框还在显示，更新表单数据
            if (this.showRegistrationModal) {
              await this.checkLocalRegistration();
              await this.checkRegistrationStatus();
            }

            this.showLoginPromptModal = false;
          } else {
            this.$Message.error(result.message || '微信登录失败');
          }
        } catch (error) {
          console.error('微信授权回调处理失败:', error);
          this.$Message.error('微信登录失败，请重试');
        }
      }
    },

    // 清除URL中的微信授权参数
    clearWechatAuthParams() {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('from');
      window.history.replaceState({}, document.title, url.toString());
    },

    // 微信授权登录（只在微信浏览器中调用）
    wechatAuth() {
      if (!this.isWechatBrowser) {
        console.log('非微信环境，不使用微信授权');
        return;
      }

      const appid = 'wx9e05ef34b2bc54b6';
      const redirectUri = encodeURIComponent(window.location.href);
      const scope = 'snsapi_userinfo';
      const state = Math.random().toString(36).substr(2, 10);

      localStorage.setItem('wechat_auth_state', state);
      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
      console.log('跳转微信授权页面');
      window.location.href = authUrl;
    },

    handleLoginCancel() {
      this.showLoginPromptModal = false;
    },

    // 登录弹框确认按钮处理 - 区分环境
    handleLoginConfirm() {
      console.log('点击登录确认按钮');
      this.showLoginPromptModal = false;

      if (this.isWechatBrowser) {
        // 微信环境：使用微信授权登录
        console.log('微信环境，使用微信授权登录');
        this.wechatAuth();
      } else {
        // 非微信环境：显示手机号登录弹框
        console.log('非微信环境，显示手机号登录弹框');
        this.$store.dispatch('showLoginModal');
      }
    },

    // 处理需要登录 - 区分环境
    handleRequireLogin() {
      console.log('需要登录，当前环境:', this.isWechatBrowser ? '微信' : '普通浏览器');

      if (this.isWechatBrowser) {
        // 微信环境：直接使用微信授权
        this.wechatAuth();
      } else {
        // 非微信环境：直接显示手机号登录弹框，不再显示提示弹框
        console.log('非微信环境，直接显示手机号登录弹框');
        this.$store.dispatch('showLoginModal');
      }
    },

    async parseStreamData(data) {
      let streamUrl = '';
      if (this.streamType) {
        if (this.streamType.toLowerCase() === 'flv' && data.pullFlvUrl) {
          streamUrl = data.pullFlvUrl;
        } else if (this.streamType.toLowerCase() === 'm3u8' && data.pullM3u8Url) {
          streamUrl = data.pullM3u8Url;
        }
      } else {
        if (data.pullFlvUrl) {
          streamUrl = data.pullFlvUrl;
        } else if (data.pullM3u8Url) {
          streamUrl = data.pullM3u8Url;
        }
      }

      if (!streamUrl) {
        console.error('未找到有效的流地址');
        this.$Message.error('未找到有效的流地址');
        return;
      }

      this.streamUrl = streamUrl;
      this.streamData = data;
    },

    async refreshLiveStatus() {
      if (!this.id) return;
      try {
        const res = await this.$api.getById({ id: this.id });
        if (res.code === 200) {
          const data = res.data;
          const oldStatus = this.liveStatus;
          const newStatus = data.liveStatus;
          this.liveShowName = data.liveShowName;
          this.startTime = data.startTime;
          this.liveStatus = newStatus;
          await this.processEntryFromData(data.entryFromData);
          if (data.liveCover) {
            this.coverImageUrl = `${config.playerBaseUrl}/api/sysFile/image/${data.liveCover}`;
          }
          if (oldStatus !== newStatus && newStatus === '1') {
            await this.parseStreamData(data);
          }
        }
      } catch (error) {
        console.error('刷新直播状态失败:', error);
      }
    },

    cleanupExpiredLocalRegistrations() {
      const oneWeekAgo = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('registration_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data.saveTime && data.saveTime < oneWeekAgo) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
      }
    },

    handleCommentsUpdate(data) {
      this.onlineCount = data.onlineCount;
    },

    cleanup() {
      if (this.commentPollingTimer) {
        clearInterval(this.commentPollingTimer);
        this.commentPollingTimer = null;
      }
    }
  }
};
</script>

<style scoped>
/* 保持原有的样式不变 */
.live-container {
  display: flex;
  max-width: 1200px;
  margin: 20px auto;
  gap: 20px;
  padding: 0 20px;
  position: relative;
}

.live-left {
  flex: 3;
  min-width: 0;
}

.live-right {
  display: flex;
  min-width: 300px;
  flex-direction: column;
  gap: 15px;
}

/* 桌面端LiveInfo和CommentSection */
.desktop-live-info,
.desktop-comments {
  display: block;
}

.desktop-comments {
  height: 100%;
}

/* 移动端Tabs容器 */
.mobile-tabs-section {
  display: none;
  /* 默认隐藏，在移动端显示 */
}

/* 报名表单悬浮按钮 */
.registration-fab {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: white;
  width: 55px;
  height: 55px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
  transition: all 0.3s ease;
  z-index: 1000;
}

.registration-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(24, 144, 255, 0.4);
}

.fab-icon {
  font-size: 24px;
}

.fab-text {
  font-size: 12px;
  font-weight: 500;
}

.registration-modal-content {
  display: flex;
  flex-direction: column;
  height: 500px;
  max-height: 70vh;
}

.modal-header-section {
  flex-shrink: 0;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 15px;
  text-align: center;
}

.registration-title {
  font-size: 15px;
  font-weight: 600;
  color: #646464;
  margin-top: 10px;
}

.modal-form-section {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 15px;
}

.login-modal-content {
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  min-height: 200px;
}

.login-header {
  text-align: center;
  margin-bottom: 20px;
}

.login-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  line-height: 1.5;
  padding: 0 10px;
}

.login-body {
  text-align: center;
  margin: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}

.login-icon {
  width: 100%;
  margin: 0 auto;
}

.login-icon img {
  width: 100%;
  height: auto;
  display: block;
}

.login-footer {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.login-cancel-btn {
  padding: 10px 25px;
  font-size: 14px;
  color: #666;
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 140px;
}

.login-confirm-btn {
  padding: 10px 25px;
  font-size: 14px;
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 140px;
}

.login-cancel-btn:hover {
  color: #333;
  background: #f5f5f5;
  border-color: #d9d9d9;
}

.login-confirm-btn:hover {
  background: #40a9ff;
  border-color: #40a9ff;
}

/* 响应式样式 */
@media (max-width: 768px) {
  .live-container {
    flex-direction: column;
    padding: 10px;
    gap: 15px;
  }

  .live-left,
  .live-right {
    width: 100%;
  }

  /* 桌面端元素在移动端隐藏 */
  .desktop-live-info,
  .desktop-comments {
    display: none;
  }

  /* 移动端显示Tabs */
  .mobile-tabs-section {
    display: block;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  /* Tab标签样式 */
  .mobile-tabs {
    display: flex;
    background: #f8f8f8;
    /* padding: 0 10px; */
    border-bottom: 1px solid #eee;
  }

  .tab-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    position: relative;
    cursor: pointer;
    font-size: 13px;
    color: #666;
    transition: all 0.3s;
    border-bottom: 1px solid transparent;
  }

  .tab-item.active {
    color: #1890ff;
    /* font-weight: 600; */
    border-bottom-color: #1890ff;
    background: white;
  }

  .tab-item:hover {
    color: #40a9ff;
  }

  .tab-icon {
    margin-right: 6px;
    font-size: 16px;
  }

  .tab-text {
    font-size: 14px;
  }

  .online-badge {
    position: absolute;
    top: 8px;
    right: 15px;
    background: #ff4d4f;
    color: white;
    font-size: 10px;
    font-weight: 600;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  /* Tab内容样式 */
  .tab-content {
    padding: 0;
  }

  .tab-pane {
    /* height: 400px; */
    overflow: hidden;
  }

  .mobile-comments {
    height: 100%;
  }

  .registration-fab {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
  }

  .fab-icon {
    font-size: 20px;
  }

  .fab-text {
    font-size: 10px;
  }

  .login-footer {
    flex-direction: column;
    gap: 10px;
  }

  .login-cancel-btn,
  .login-confirm-btn {
    width: 100%;
    min-width: auto;
  }
}
</style>