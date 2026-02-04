<template>
  <div class="live-container">
    <!-- 左侧直播区域 -->
    <div class="live-left">
      <VideoPlayer :streamUrl="streamUrl" :liveStatus="liveStatus" :streamType="streamType" :startTime="startTime"
        :coverImageUrl="coverImageUrl" :streamData="streamData" @refresh="refreshLiveStatus" />
      <!-- 桌面端显示LiveInfo -->
      <div class="desktop-live-info">
        <LiveInfo :liveShowName="liveShowName" :startTime="startTime" :introduce="introduce" />
      </div>
    </div>

    <!-- 右侧信息区域 -->
    <div class="live-right">
      <!-- 桌面端：直接显示评论 -->
      <div class="desktop-comments" v-if="!isMobile">
        <CommentSection ref="commentSection" :liveId="id" :userId="userId" :liveStatus="liveStatus"
          :onlineCount="onlineCount" :comments="comments" @require-login="handleRequireLogin"
          @submit-comment="handleSubmitComment" @reply-comment="handleReplyComment" />
      </div>

      <!-- 移动端：使用tab切换 -->
      <div class="mobile-tabs-section" v-else>
        <!-- Tab标签 -->
        <div class="mobile-tabs">
          <div class="tab-item" :class="{ active: activeTab === 'info' }" @click="switchTab('info')">
            <span class="tab-icon">📝</span>
            <span class="tab-text">直播信息</span>
          </div>
          <div class="tab-item" :class="{ active: activeTab === 'comments' }" @click="switchTab('comments')">
            <span class="tab-icon">💬</span>
            <span class="tab-text">互动评论</span>
          </div>
        </div>

        <!-- Tab内容 -->
        <div class="tab-content">
          <!-- 直播信息内容 -->
          <div v-show="activeTab === 'info'" class="tab-pane">
            <LiveInfo :liveShowName="liveShowName" :startTime="startTime" :introduce="introduce" />
          </div>

          <!-- 评论内容 -->
          <div v-show="activeTab === 'comments'" class="tab-pane">
            <div class="mobile-comments">
              <CommentSection ref="commentSection" :liveId="id" :userId="userId" :onlineCount="onlineCount"
                :liveStatus="liveStatus" :comments="comments" @require-login="handleRequireLogin"
                @submit-comment="handleSubmitComment" @reply-comment="handleReplyComment" />
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

    <!-- 使用封装的报名表单组件 -->
    <RegistrationForm ref="registrationFormRef" :visible="showRegistrationModal" :live-show-name="liveShowName"
      :entry-from-data="entryFromData" :is-registered="isRegistered" :live-id="id" :user-id="userId"
      :entry-from-id="entryFromId" @update:visible="showRegistrationModal = $event"
      @success="handleRegistrationSuccess" />

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
import RegistrationForm from '../components/RegistrationForm.vue';
import { config } from '../config';
import { mapState, mapGetters, mapActions } from 'vuex';

export default {
  name: "LivePlayerPage",
  components: {
    VideoPlayer,
    LiveInfo,
    CommentSection,
    PhoneLoginModal,
    RegistrationForm
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
      introduce: '暂无介绍',
      liveStatus: '0',
      coverImageUrl: '',
      streamUrl: "",
      id: '',
      streamType: null,
      streamData: {},
      onlineCount: 0,
      showOnlineCount: true,
      showRegistrationModal: false,
      isRegistered: false,
      entryFromData: [],
      isEntryFrom: '0',
      entryFromId: '',
      showLoginPromptModal: false,
      userId: '',
      formInitialized: false,
      isAutoOpenRegistration: false,
      hasAutoOpenedRegistration: false,
      // 新增：当前激活的tab
      activeTab: 'comments',
      // 新增：是否是移动端
      isMobile: false,
      // WebSocket相关
      websocket: null,
      wsReconnectInterval: 5000,
      wsReconnectAttempts: 0,
      maxWsReconnectAttempts: 10,
      // 评论数据 - 统一管理
      comments: [],
      tempComments: {}, // 存储临时评论
      shouldScrollToBottom: true,
      // WebSocket连接状态
      wsConnected: false,
      wsAuthenticated: false, // 是否已认证
      // 重复登录相关
      duplicateLoginVisible: false, // 重复登录提示弹窗
      duplicateLoginMessage: '', // 重复登录提示消息
      duplicateLoginTimer: null, // 关闭页面的定时器
      isDuplicateLogin: false, // 是否检测到重复登录
    };
  },
  created() {
    this.$store.dispatch('checkLoginStatus').then(isLoggedIn => {
      this.userId = isLoggedIn ? this.$store.getters.userId : '';
    });
  },
  mounted() {
    this.initPage();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
    this.cleanup();
    this.closeWebSocket();
    // 清理定时器
    if (this.duplicateLoginTimer) {
      clearTimeout(this.duplicateLoginTimer);
      this.duplicateLoginTimer = null;
    }
  },

  watch: {
    // 监听用户信息变化
    '$store.state.user': {
      deep: true,
      handler(newUser) {
        console.log('Vuex登录态用户状态变化:', newUser);
        if (newUser && this.$store.getters.isLoggedIn) {
          const newUserId = this.$store.getters.userId;
          console.log('同步Vuex登录态用户ID:', newUserId);

          // 用户ID发生变化时，重新认证WebSocket
          if (newUserId !== this.userId) {
            this.userId = newUserId;
            this.authenticateWebSocket();
          }

          this.userId = newUserId;

          // 更新评论组件状态
          this.$nextTick(() => {
            if (this.$refs.commentSection) {
              this.$refs.commentSection.currentUserId = this.userId;
            }
          });
        } else {
          this.userId = '';
          this.isRegistered = false;

          // 更新评论组件状态
          this.$nextTick(() => {
            if (this.$refs.commentSection) {
              this.$refs.commentSection.currentUserId = '';
            }
          });
        }
      }
    },
  },
  methods: {
    ...mapActions(['showLoginModal', 'hideLoginModal', 'logout']),

    // 初始化WebSocket连接
    initWebSocket() {
      if (!this.id) {
        console.warn('直播ID为空，无法建立WebSocket连接');
        return;
      }

      // 如果已经检测到重复登录，不再重新连接
      if (this.isDuplicateLogin) {
        console.log('检测到重复登录，不再建立WebSocket连接');
        return;
      }

      // 关闭现有连接
      if (this.websocket) {
        this.closeWebSocket();
      }

      // 构建WebSocket URL - 游客连接
      const wsUrl = `ws://${config.websocketUrl}/websocket/online/${this.id}`;
      console.log('正在建立WebSocket连接（游客身份）:', wsUrl);

      try {
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          console.log('WebSocket连接已建立（游客身份）');
          this.wsConnected = true;
          this.wsReconnectAttempts = 0;

          // 连接建立后，如果用户已登录，发送认证消息
          if (this.userId) {
            this.authenticateWebSocket();
          }
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('收到WebSocket消息:', data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('解析WebSocket消息失败:', error, '原始数据:', event.data);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket连接错误:', error);
        };

        this.websocket.onclose = (event) => {
          console.log('WebSocket连接关闭:', event.code, event.reason);
          this.wsConnected = false;
          this.wsAuthenticated = false;

          // 如果已经检测到重复登录，不再重连
          if (this.isDuplicateLogin) {
            return;
          }

          // 如果不是正常关闭，尝试重连
          if (event.code !== 1000 && this.wsReconnectAttempts < this.maxWsReconnectAttempts) {
            console.log(`WebSocket连接断开，${this.wsReconnectInterval / 1000}秒后尝试重连...`);
            setTimeout(() => {
              this.wsReconnectAttempts++;
              this.initWebSocket();
            }, this.wsReconnectInterval);
          }
        };
      } catch (error) {
        console.error('创建WebSocket失败:', error);
      }
    },

    // 认证WebSocket连接（用户登录后调用）
    authenticateWebSocket() {
      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket未连接，无法认证');
        return;
      }

      if (!this.userId) {
        console.warn('用户未登录，无法认证WebSocket');
        return;
      }

      // 获取token
      let token = '';
      try {
        token = localStorage.getItem('token') || '';
      } catch (e) {
        console.error('获取token失败:', e);
      }

      if (!token) {
        console.warn('token为空，无法认证');
        return;
      }

      // 发送认证消息
      const authMessage = {
        type: 'auth',
        data: token,
        userId: this.userId
      };

      try {
        this.websocket.send(JSON.stringify(authMessage));
        console.log('发送WebSocket认证消息:', authMessage);
      } catch (error) {
        console.error('发送认证消息失败:', error);
      }
    },

    // 处理WebSocket消息
    handleWebSocketMessage(data) {
      const { type, data: messageData } = data;

      switch (type) {
        case 'initialization':
          this.handleInitializationData(messageData);
          break;

        case 'onlineCount':
          this.onlineCount = messageData;
          console.log('在线人数更新:', this.onlineCount);
          break;

        case 'newComment':
          this.handleNewComment(messageData);
          break;

        case 'updateComments':
          this.handleUpdateComments(messageData);
          break;

        case 'commentDeleted':
          this.handleCommentDeleted(messageData);
          break;

        case 'authResponse':
          this.handleAuthResponse(messageData);
          break;
        case 'authSuccess':
          console.log(messageData)
          break;
        case 'authFailed':
          this.clearLoginStatus(messageData)
          break;
        case 'duplicateLogin':
          // 处理重复登录
          this.handleDuplicateLogin(messageData);
          break;

        default:
          console.warn('未知的WebSocket消息类型:', type, data);
      }
    },

    // 处理重复登录
    handleDuplicateLogin(messageData) {
      console.log('检测到重复登录:', messageData);

      // 设置重复登录标志
      this.isDuplicateLogin = true;

      // 设置提示消息
      const msg = messageData.message || '您的账号已在其他地方登录，您已被强制下线。';
      this.duplicateLoginMessage = msg;

      // 立即关闭WebSocket连接
      // this.closeWebSocket();

      // 清除本地登录状态
      // this.clearLoginStatus();

      // 禁止所有用户操作
      this.disableUserOperations();

      // 添加全局遮罩层
      this.addGlobalMask();
    },

    // 清除登录状态
    clearLoginStatus() {
      // 清除本地存储的登录信息
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('refreshToken');
      } catch (e) {
        console.error('清除本地存储失败:', e);
      }

      // 清除Vuex中的用户状态
      this.logout();

      // 重置用户ID
      this.userId = '';

      // 更新评论组件状态
      this.$nextTick(() => {
        if (this.$refs.commentSection) {
          this.$refs.commentSection.currentUserId = '';
        }
      });
    },

    // 禁止用户操作
    disableUserOperations() {
      // 禁用页面所有输入和按钮
      document.body.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'not-allowed';

      // 禁用所有input、textarea、button、select元素
      const disableElements = ['input', 'textarea', 'button', 'select', 'a'];
      disableElements.forEach(tag => {
        const elements = document.getElementsByTagName(tag);
        for (let i = 0; i < elements.length; i++) {
          elements[i].setAttribute('disabled', 'disabled');
          elements[i].style.pointerEvents = 'none';
          elements[i].style.opacity = '0.5';
        }
      });
    },

    // 添加全局遮罩层
    addGlobalMask() {
      // 移除已存在的遮罩层
      const existingMask = document.getElementById('duplicate-login-mask');
      if (existingMask) {
        document.body.removeChild(existingMask);
      }

      // 创建遮罩层
      const mask = document.createElement('div');
      mask.id = 'duplicate-login-mask';
      mask.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        color: white;
        font-size: 18px;
        text-align: center;
        padding: 20px;
      `;

      // 添加提示内容
      mask.innerHTML = `
        <div style="margin-bottom: 20px; font-size: 24px; color: #ff4d4f;">⚠️</div>
        <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">账号在其他地方登录</div>
        <div style="font-size: 14px; margin-bottom: 20px; line-height: 1.5;">${this.duplicateLoginMessage}</div>
        <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">请您关闭当前页！</div>
      `;
      // <div style="font-size: 12px; color: #ccc; margin-bottom: 30px;">页面将在 <span id="countdown">5</span> 秒后关闭...</div>
      // <button id="close-now-btn" style="padding: 8px 20px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">立即关闭</button>
      document.body.appendChild(mask);
    },

    // 关闭页面
    closePage() {
      console.log('正在关闭页面...');

      // 清理资源
      this.cleanup();

      // 移除全局遮罩层
      const mask = document.getElementById('duplicate-login-mask');
      if (mask) {
        document.body.removeChild(mask);
      }

      // 恢复页面样式
      document.body.style.pointerEvents = '';
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // 尝试关闭当前标签页（如果浏览器允许）
      if (window.history.length > 1) {
        // 如果有历史记录，返回上一页
        window.history.back();
      } else {
        // 否则跳转到空白页或首页
        window.location.href = 'about:blank';

      }
    },

    // 处理认证响应
    handleAuthResponse(responseData) {
      console.log('收到WebSocket认证响应:', responseData);
      if (responseData.success) {
        this.wsAuthenticated = true;
        console.log('WebSocket认证成功');
      } else {
        this.wsAuthenticated = false;
        console.warn('WebSocket认证失败:', responseData.message);
      }
    },

    // 处理初始化数据
    handleInitializationData(initData) {
      console.log('处理初始化数据:', initData);

      // 更新在线人数
      if (initData.onlineCount !== undefined) {
        this.onlineCount = initData.onlineCount;
      }

      // 更新直播信息
      if (initData.liveStream) {
        const liveStream = initData.liveStream;
        this.updateLiveInfo(liveStream);
      }

      // 更新评论数据
      if (initData.comments && Array.isArray(initData.comments)) {
        console.log('收到初始评论数据，数量:', initData.comments.length);
        this.comments = this.processComments(initData.comments);

        // 初始化完成后滚动到底部
        this.$nextTick(() => {
          this.scrollCommentsToBottom();
        });
      }
    },

    // 更新直播信息
    updateLiveInfo(liveStream) {
      this.liveShowName = liveStream.liveShowName || '';
      this.startTime = liveStream.startTime || '';
      this.liveStatus = liveStream.liveStatus || '0';
      this.introduce = liveStream.introduce || '暂无介绍';
      this.isEntryFrom = liveStream.isEntryFrom || '0';
      this.entryFromId = liveStream.entryFromId || '';

      // 处理封面图
      if (liveStream.liveCover) {
        this.coverImageUrl = `${config.fileBaseUrl}/api/sysFile/image/${liveStream.liveCover}`;
      }

      // 处理流数据
      if (liveStream.liveStatus === '1' && (liveStream.pullFlvUrl || liveStream.pullM3u8Url)) {
        this.parseStreamData(liveStream);
      }

      // 更新streamData
      this.streamData = liveStream;

      // 如果有报名表单数据需要处理
      if (this.isEntryFrom === '1' && this.entryFromId) {
        this.fetchEntryFromData();
      }
    },

    // 处理新评论（实时推送）
    handleNewComment(commentData) {
      console.log('收到新评论:', commentData);
      const processedComment = this.processSingleComment(commentData);

      // 防止重复添加
      const exists = this.comments.some(c => c.id === processedComment.id);
      if (!exists) {
        this.comments.push(processedComment); // 新评论添加到末尾

        // 限制评论数量
        if (this.comments.length > 100) {
          this.comments = this.comments.slice(0, 100);
        }

        // 如果有对应的临时评论，移除它
        if (processedComment.id && this.tempComments[processedComment.id]) {
          delete this.tempComments[processedComment.id];
        }

        // 通知子组件滚动到底部
        this.$nextTick(() => {
          this.scrollCommentsToBottom();
        });
      }
    },

    scrollCommentsToBottom() {
      if (this.$refs.commentSection && this.$refs.commentSection.scrollToBottom) {
        this.$refs.commentSection.scrollToBottom();
      }
    },

    // 批量更新评论
    handleUpdateComments(commentsData) {
      console.log('批量更新评论:', commentsData);
      if (Array.isArray(commentsData)) {
        const processedComments = this.processComments(commentsData);
        this.comments = processedComments;
      }
    },

    // 处理评论删除
    handleCommentDeleted(commentId) {
      console.log('评论被删除:', commentId);
      this.comments = this.comments.filter(comment => comment.id !== commentId);
    },

    // 处理评论提交（用户主动提交）
    async handleSubmitComment(commentData) {
      if (!this.userId) {
        this.handleRequireLogin();
        return;
      }

      // 检查是否检测到重复登录
      if (this.isDuplicateLogin) {
        this.$Message.warning('账号已在其他地方登录，无法提交评论');
        return;
      }

      try {
        // 直接提交到服务器，不使用乐观更新
        const res = await this.$api.addComment(commentData);

        if (res.code === 200) {
          console.log('评论提交成功:', res.data);
          this.$Message.success(commentData.parentId ? '回复成功' : '评论成功');

          // 服务器返回的数据会通过WebSocket推送回来
          // 这里不需要做任何处理，等待WebSocket推送即可
        } else {
          this.$Message.error(res.message || '评论失败');
        }
      } catch (error) {
        console.error('提交评论失败:', error);
        this.$Message.error('评论失败，请重试');
      }
    },

    // 处理回复评论
    handleReplyComment(replyData) {
      // 这里可以处理特定的回复逻辑
      console.log('回复评论:', replyData);
      // 实际提交由handleSubmitComment处理
    },

    // 移除临时评论
    removeTempComment(tempId) {
      this.comments = this.comments.filter(comment => comment.id !== tempId);
      if (this.tempComments[tempId]) {
        delete this.tempComments[tempId];
      }
    },

    // 处理评论数据
    processComments(comments) {
      // 先处理所有评论
      const processedComments = comments.map(comment => this.processSingleComment(comment));

      // 再次遍历，为回复评论设置replyToName（可能这次能找到父评论了）
      return processedComments.map(comment => {
        if (comment.parentId && !comment.replyToName) {
          // 在当前批次的评论中查找父评论
          const parentComment = processedComments.find(c => c.id === comment.parentId);
          if (parentComment) {
            comment.replyToName = parentComment.userName;
          }
        }
        return comment;
      });
    },

    // 处理单条评论
    processSingleComment(comment) {
      const processedComment = {
        ...comment,
        createTime: comment.createTime ? new Date(comment.createTime).toISOString() : new Date().toISOString(),
        userName: this.maskPhoneNumber(comment.userName),
        replyToName: comment.replyToName ? this.maskPhoneNumber(comment.replyToName) : undefined,
        isTemp: false
      };

      // 如果是回复评论，尝试从现有评论中查找父评论的用户名
      if (processedComment.parentId && !processedComment.replyToName) {
        const parentComment = this.comments.find(c => c.id === processedComment.parentId);
        if (parentComment) {
          processedComment.replyToName = parentComment.userName;
        }
      }

      return processedComment;
    },

    // 手机号脱敏
    maskPhoneNumber(phone) {
      if (!phone) return '用户';
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (phoneRegex.test(phone.toString())) {
        return phone.toString().replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      }
      return phone;
    },

    // 关闭WebSocket连接
    closeWebSocket() {
      if (this.websocket) {
        // 发送离开消息（如果有的话）
        try {
          const leaveMessage = {
            type: 'leave',
            liveStreamId: this.id,
            userId: this.userId || 'guest'
          };
          this.websocket.send(JSON.stringify(leaveMessage));
        } catch (error) {
          console.log('发送离开消息失败（可能连接已断开）:', error);
        }

        // 关闭连接
        this.websocket.close(1000, '正常关闭');
        this.websocket = null;
        this.wsConnected = false;
        this.wsAuthenticated = false;
      }
    },

    // 处理窗口大小变化
    handleResize() {
      this.isMobile = window.innerWidth <= 768;
      if (this.isMobile) {
        this.activeTab = 'comments';
      }
    },

    // 切换tab
    switchTab(tab) {
      this.activeTab = tab;
    },

    // 处理手机号登录成功
    handlePhoneLoginSuccess(loginData) {
      const userInfo = loginData.userInfo || loginData;

      if (userInfo) {
        const user = userInfo.user || userInfo;
        this.userId = user.id || user.userId || '';

        this.$nextTick(async () => {
          await this.loadRegistrationDataIfNeeded();

          if (this.$refs.commentSection) {
            this.$refs.commentSection.currentUserId = this.userId;
          }

          // 用户登录成功后，重新认证WebSocket连接
          this.authenticateWebSocket();
        });
      }

      if (this.showLoginPromptModal) {
        this.showLoginPromptModal = false;
      }
    },

    async initPage() {
      const isLoggedIn = await this.initUserInfo();

      this.tryLoadFromLocalStorage();
      await this.initFromUrlParams();
      this.cleanupExpiredLocalRegistrations();

      await this.handleWechatCallback();

      if (isLoggedIn && this.userId) {
        await this.loadRegistrationDataIfNeeded();
      }

      this.$nextTick(() => {
        if (isLoggedIn && this.userId) {
          if (this.$refs.commentSection) {
            this.$refs.commentSection.currentUserId = this.userId;
          }
        }
      });

      if (!this.isRegistered && !this.hasAutoOpenedRegistration) {
        await this.$nextTick();
        this.checkAutoOpenRegistration();
      }
    },

    // 初始化用户信息
    async initUserInfo() {
      try {
        await this.$store.dispatch('checkLoginStatus');
        const userLoggedIn = this.$store.getters.isLoggedIn;
        const userInfo = this.$store.getters.userInfo;

        if (userLoggedIn && userInfo) {
          this.userId = userInfo.id || userInfo.userId || '';

          this.$nextTick(() => {
            if (this.$refs.commentSection) {
              this.$refs.commentSection.currentUserId = this.userId;
            }
          });

          await this.checkRegistrationStatus();
          return true;
        } else {
          this.userId = '';
          return false;
        }
      } catch (error) {
        this.userId = '';
        return false;
      }
    },

    // 从localStorage加载数据
    tryLoadFromLocalStorage() {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        const storageKey = `registration_${id}`;
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            this.isRegistered = !!parsedData.registrationId;
            this.registrationId = parsedData.registrationId || null;

            if (this.isRegistered) {
              this.hasAutoOpenedRegistration = true;
            }
          } catch (e) {
            console.log('e', e);
          }
        }
      }
    },

    async initFromUrlParams() {
      const urlParams = new URLSearchParams(window.location.search);
      this.id = urlParams.get('id');
      this.streamType = urlParams.get('type');

      if (!this.id) {
        this.$Message.error('未找到直播ID参数');
        return;
      }

      // 初始化WebSocket连接（游客身份）
      this.initWebSocket();
    },

    // 获取报名表单数据
    async fetchEntryFromData() {
      if (!this.entryFromId) return;

      try {
        // 这里根据实际API调用获取报名表单数据
        // const res = await this.$api.getEntryFormById({ id: this.entryFromId });
        // if (res.code === 200 && res.data) {
        //   this.processEntryFromData(res.data);
        // }
      } catch (error) {
        console.error('获取报名表单数据失败:', error);
      }
    },

    // 处理报名表单数据
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

        // 字段验证规则
        this.addFieldValidationRules(field, uniqueKey);
      });

      await this.fillFormDataFromLocalStorage();
      this.formInitialized = true;
    },

    // 添加字段验证规则
    addFieldValidationRules(field, uniqueKey) {
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
      if (this.isEntryFrom === '1' &&
        this.entryFromData &&
        this.entryFromData.length > 0) {

        const hasLocalRegistration = await this.checkLocalRegistration();

        if (!hasLocalRegistration) {
          console.log('用户未报名，自动打开报名表和登录提示');

          setTimeout(() => {
            this.showRegistrationModal = true;

            this.$nextTick(() => {
              setTimeout(() => {
                if (!this.userId) {
                  this.showLoginPromptModal = true;
                }
              }, 300);
            });
          }, 1000);
        } else {
          console.log('用户已报名，不自动弹出报名表');
        }
      }
    },

    async loadRegistrationDataIfNeeded() {
      if (!this.userId) {
        console.log('用户未登录，不加载报名数据');
        return;
      }

      const hasLocalRegistration = await this.checkLocalRegistration();

      if (hasLocalRegistration) {
        await this.checkRegistrationStatus();
      } else {
        console.log('首次报名，不需要调用接口获取历史数据');
      }
    },

    async openRegistrationModal() {
      if (!this.entryFromData || this.entryFromData.length === 0) {
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
      }
    },

    handleRegistrationSuccess(data) {
      console.log('报名成功回调:', data);
      this.isRegistered = true;
      this.registrationId = data.registrationId;
      this.hasAutoOpenedRegistration = true;
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
            return true;
          }
        }
        this.isRegistered = false;
        this.registrationId = null;
        return false;
      } catch (error) {
        console.error('检查本地报名信息失败:', error);
        this.isRegistered = false;
        this.registrationId = null;
        return false;
      }
    },

    clearLocalRegistration() {
      const storageKey = `registration_${this.id}`;
      localStorage.removeItem(storageKey);
      this.isRegistered = false;
      this.registrationId = null;
      console.log('已清除本地报名记录');
    },

    async checkRegistrationStatus() {
      if (!this.userId) {
        console.log('未登录，不检查报名状态');
        return;
      }

      const hasLocalRegistration = await this.checkLocalRegistration();

      if (!hasLocalRegistration) {
        console.log('本地无报名记录，可能是首次报名，不调用getId接口');
        this.isRegistered = false;
        this.registrationId = null;
        return;
      }

      console.log('本地有报名记录，调用接口验证状态');
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
          console.log('服务器没有报名记录，但本地有，重置本地状态');
          this.clearLocalRegistration();
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

    // 处理微信授权回调
    async handleWechatCallback() {
      if (!this.isWechatBrowser) return;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state) {
        try {
          const savedState = localStorage.getItem('wechat_auth_state');
          if (state !== savedState) {
            return;
          }

          const result = await this.$store.dispatch('wechatLogin', { code });

          if (result.success) {
            this.userId = this.$store.getters.userId;

            localStorage.removeItem('wechat_auth_state');
            this.clearWechatAuthParams();

            if (this.showRegistrationModal) {
              await this.checkLocalRegistration();
              await this.checkRegistrationStatus();
            }

            this.showLoginPromptModal = false;

            this.$nextTick(() => {
              if (this.$refs.commentSection) {
                this.$refs.commentSection.currentUserId = this.userId;
              }
            });

            // 微信登录成功后，重新认证WebSocket连接
            this.authenticateWebSocket();
          }
        } catch (error) {
          console.error('微信授权回调处理失败:', error);
        }
      }
    },

    // 清理定时器
    cleanup() {
      // 清除WebSocket连接
      this.closeWebSocket();

      // 清理临时评论
      this.tempComments = {};
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
        console.log('微信环境，使用微信授权登录');
        this.wechatAuth();
      } else {
        console.log('非微信环境，显示手机号登录弹框');
        this.$store.dispatch('showLoginModal');
      }
    },

    // 处理需要登录 - 区分环境
    handleRequireLogin() {
      console.log('需要登录，当前环境:', this.isWechatBrowser ? '微信' : '普通浏览器');

      if (this.isWechatBrowser) {
        this.wechatAuth();
      } else {
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
      // 尝试重新连接WebSocket
      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        this.initWebSocket();
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

    // 刷新用户登录状态
    refreshLoginStatus() {
      console.log('刷新用户登录状态');
      this.$store.dispatch('checkLoginStatus').then(() => {
        const userInfo = this.$store.getters.userInfo;
        if (userInfo) {
          this.userId = userInfo.id || userInfo.userId;
          console.log('刷新后用户ID:', this.userId);

          this.$nextTick(() => {
            if (this.$refs.commentSection) {
              this.$refs.commentSection.currentUserId = this.userId;
            }
          });
        }
      });
    },

    handleLogout() {
      this.$store.dispatch('logout').then(() => {
        this.$Message.success('已退出登录');
        // 重置页面状态
        this.userId = '';
        this.isRegistered = false;
        this.registrationId = null;
        this.clearLocalRegistration();

        // 用户登出后，重新建立WebSocket连接（游客身份）
        this.initWebSocket();
      });
    },
  }
};
</script>

<style scoped>
/* 样式保持不变 */
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