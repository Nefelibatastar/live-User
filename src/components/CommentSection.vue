<template>
  <div class="comment-section">
    <div class="section-header">
      <h3 class="section-title">互动</h3>
      <!-- 在线人数显示  v-if="showOnlineCount && onlineCount > 0" -->
      <div class="online-count-indicator" v-if="showOnlineCount && onlineCount > 0">
        <span class="online-icon">👥</span>
        <span class="online-number">{{ onlineCount }}</span>
      </div>
    </div>

    <!-- 新评论提示 -->
    <div v-if="showNewCommentsNotice && newCommentsCount > 0" class="new-comments-notice" @click="scrollToNewComments">
      <span>有 {{ newCommentsCount }} 条新评论</span>
      <span class="notice-icon">👇</span>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list" ref="commentList">
      <!-- 已加载全部提示 -->
      <div v-if="allLoadedTipVisible" class="all-loaded-tip">
        <span>没有更多消息了</span>
      </div>

      <!-- 加载更多提示 -->
      <div v-if="loadingMore" class="loading-more">
        <div class="loading-spinner small"></div>
        <div class="loading-text">加载更多...</div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && comments.length === 0" class="comment-empty">
        <div class="empty-icon">💬</div>
        <div class="empty-text">还没有评论，快来第一个评论吧~</div>
      </div>

      <!-- 分组评论列表 -->
      <div v-else class="comments-container">
        <div v-for="(group, groupIndex) in groupedComments" :key="groupIndex" class="comment-group">
          <!-- 时间标签 -->
          <div class="time-label">
            {{ formatGroupTime(group.time) }}
          </div>

          <!-- 该时间段内的评论 -->
          <div v-for="comment in group.comments" :key="comment.id" class="comment-item" :class="{
            'own-comment': comment.userId === currentUserId,
            'reply-comment': comment.parentId,
            'sending': comment.status === '0'
          }" @click="replyToComment(comment)">
            <div class="comment-avatar">
              <div class="avatar-icon">
                <img src="https://img1.baidu.com/it/u=2925226694,390810694&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=500"
                  alt="" style="width: 36px;height: 36px;border-radius: 8px;">
              </div>
            </div>

            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">{{ comment.userName || '匿名用户' }}</span>
              </div>

              <!-- 回复评论显示父评论信息 -->
              <div v-if="comment.parentId && comment.replyToName" class="reply-info">
                回复 <span class="reply-user">{{ comment.replyToName }}</span>：
                <span class="reply-content">{{ getParentCommentContent(comment.parentId) }}</span>
              </div>

              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 评论输入区域 -->
    <div class="comment-input-area">
      <!-- 回复提示 -->
      <div v-if="replyingTo" class="reply-hint">
        回复 <span class="reply-to-name">{{ replyingTo.userName }}</span>
        <span class="cancel-reply" @click="cancelReply">取消</span>
      </div>

      <div class="input-container">
        <input type="text" :placeholder="replyingTo ? `回复 ${replyingTo.userName}：` : '说点什么~'" class="comment-input"
          v-model="commentText" @keyup.enter="submitComment" :disabled="!isLoggedIn" maxlength="500" />
        <button class="comment-submit" @click="submitComment" :disabled="!isLoggedIn || submitting">
          <span v-if="submitting">发送中...</span>
          <span v-else>{{ replyingTo ? '回复' : '发送' }}</span>
        </button>
      </div>
    </div>
    <div v-if="showOnlineCount && onlineCount > 0" style="padding: 10px 0;font-size: 13px;">👥 <span
        class="online-badge">{{ onlineCount }}</span></div>
    <!-- 登录提示 -->
    <div v-if="!isLoggedIn" class="login-tip">
      请先<a href="javascript:void(0)" @click="gotoLogin">登录</a>后评论
    </div>
  </div>
</template>

<script>
export default {
  name: 'CommentSection',
  props: {
    liveId: {
      type: String,
      required: true
    },
    userId: {
      type: String,
      default: ''
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    onlineCount: {
      type: Number,
      default: 0
    },
    liveStatus: {
      type: String,
      default: '0'
    }
  },

  data() {
    return {
      // 评论列表
      comments: [],
      limit: 30, // 每次获取的评论数量
      loading: false,
      lastLoadTime: 0, // 记录上次加载时间，防止重复加载

      // 当前评论
      commentText: '',
      submitting: false,

      // 回复相关
      replyingTo: null, // 当前回复的评论对象

      // 用户信息
      currentUserId: '',

      // 轮询相关
      pollingTimer: null,
      pollingInterval: 5000, // 5秒轮询一次
      pollingEnabled: true,
      isFirstPoll: true, // 标记是否为第一次轮询

      // 新评论相关
      newCommentsCount: 0,
      showNewCommentsNoticeFlag: false,
      // 滚动
      hasMoreHistory: true, // 是否还有历史消息
      loadingMore: false, // 是否正在加载更多
      allLoadedTipVisible: false, // 是否显示已加载全部提示
      scrollThreshold: 50, // 距离顶部的阈值
      loadedCount: 0, // 已加载的评论数量
    };
  },

  computed: {
    isLoggedIn() {
      return !!this.currentUserId;
    },
    // 使用计算属性来提供模板中使用的 showNewCommentsNotice
    showNewCommentsNotice() {
      return this.showNewCommentsNoticeFlag && this.newCommentsCount > 0;
    },

    // 根据直播状态判断是否显示在线人数
    showOnlineCount() {
      return this.liveStatus === '1' && this.onlineCount > 0;
    },

    // 分组评论 - 按分钟分组
    groupedComments() {
      if (this.comments.length === 0) return [];

      const groups = [];
      let currentGroup = null;

      // 按时间倒序排序（最新的在前面）
      const sortedComments = [...this.comments].sort((a, b) => {
        return new Date(b.createTime) - new Date(a.createTime);
      });

      sortedComments.forEach(comment => {
        const timeKey = this.getTimeKey(comment.createTime); // 获取分钟级的时间key

        if (!currentGroup || currentGroup.timeKey !== timeKey) {
          currentGroup = {
            timeKey,
            time: comment.createTime,
            comments: []
          };
          groups.unshift(currentGroup); // 倒序显示，最新的在最后
        }

        currentGroup.comments.unshift(comment); // 同一分钟内按时间倒序
      });

      return groups;
    }
  },

  watch: {
    userId(newVal) {
      console.log('CommentSection userId 变化:', newVal);
      this.currentUserId = newVal;
      // 如果用户ID变化，重新加载评论
      if (newVal) {
        this.loadComments();
      }
    },

    liveId(newVal) {
      console.log('直播ID变化:', newVal);
      // 直播ID变化时，重置状态并重新加载
      this.resetComments();
      this.stopPolling();
      if (newVal) {
        this.loadComments();
      }
      // this.startPolling();
    },

    liveStatus(newStatus) {
      console.log('直播状态变化:', newStatus);
    },

    onlineCount(newCount) {
      console.log('在线人数变化:', newCount);
    }
  },

  mounted() {
    this.currentUserId = this.userId;
    // 检查 liveId 是否有效
    if (this.liveId && this.liveId.trim()) {
      // 页面加载时只加载一次评论
      this.loadComments();
    } else {
      console.warn('liveId 为空，不加载评论');
    }
    this.$nextTick(() => {
      const container = this.$refs.commentList;
      if (container) {
        container.addEventListener('scroll', this.handleScroll);
      }
    });
  },

  beforeDestroy() {
    console.log('CommentSection 组件销毁，清理轮询');
    this.cleanup();
    const container = this.$refs.commentList;
    if (container) {
      container.removeEventListener('scroll', this.handleScroll);
    }
  },

  methods: {
    // 获取时间键（精确到分钟）
    getTimeKey(dateTime) {
      try {
        const d = new Date(dateTime);
        if (isNaN(d.getTime())) {
          console.warn('无效的时间格式:', dateTime);
          return 'unknown';
        }
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
      } catch (error) {
        console.error('获取时间键失败:', error, dateTime);
        return 'error';
      }
    },

    // 格式化分组时间（显示在时间标签上）
    formatGroupTime(time) {
      try {
        const date = new Date(time);
        if (isNaN(date.getTime())) {
          return '';
        }
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
      } catch (error) {
        console.error('格式化分组时间失败:', error, time);
        return '';
      }
    },
    // 获取父评论内容
    getParentCommentContent(parentId) {
      const parentComment = this.comments.find(c => c.id === parentId);
      return parentComment ? parentComment.content : '原评论';
    },
    // 手机号脱敏显示
    maskPhoneNumber(phone) {
      if (!phone) return '用户';

      // 检查是否是手机号格式（11位数字，以1开头）
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (phoneRegex.test(phone.toString())) {
        // 将手机号中间4位替换为*
        return phone.toString().replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      }

      // 如果不是手机号格式，返回原值
      return phone;
    },

    // 处理401登录失效
    handleLoginExpired() {
      console.log('登录已失效，清除登录状态');

      // 清除本地存储
      localStorage.removeItem('userInfo');
      localStorage.removeItem('token');
      localStorage.removeItem('remembered_phone');

      // 清除Vuex状态（如果有）
      if (this.$store && this.$store.commit) {
        this.$store.commit('CLEAR_USER');
      }

      // 清除组件状态
      this.currentUserId = '';
      this.commentText = '';
      this.replyingTo = null;

      // 通知父组件
      this.$emit('login-expired');

      // 显示提示消息
      this.$Message.error('登录已失效，请重新登录');

      // 重新加载评论
      if (this.liveId && this.liveId.trim()) {
        this.loadComments();
      }
    },

    // 加载评论列表
    async loadComments() {
      // 检查 liveId 是否有效
      if (!this.liveId || !this.liveId.trim()) {
        console.warn('liveId 为空，跳过加载评论');
        return;
      }

      // 防止短时间内重复调用
      const now = Date.now();
      if (this.loading || (now - this.lastLoadTime < 1000)) {
        return;
      }

      this.loading = true;
      this.lastLoadTime = now;

      try {
        const params = {
          liveStreamId: this.liveId,
          limit: this.limit
        };

        console.log('加载评论参数:', params);

        const res = await this.$api.getCommentListWithOnline(params);

        if (res.code === 200) {
          const data = res.data;
          const newComments = data.comments || [];
          const onlineCount = data.onlineCount || 0;

          console.log('获取到评论和在线人数:', {
            comments: newComments.length,
            onlineCount
          });

          // 更新在线人数（只在直播中时）
          if (this.liveStatus === '1') {
            this.$emit('update-comments', { onlineCount });
          }

          const processedComments = this.processComments(newComments);

          // 直接替换评论列表
          this.comments = processedComments;
          this.loadedCount = processedComments.length;

          // 如果获取到的评论数量小于限制数量，说明没有更多历史消息了
          if (processedComments.length < this.limit) {
            this.hasMoreHistory = false;
          } else {
            this.hasMoreHistory = true;
          }

          // 滚动到最新位置
          if (processedComments.length > 0) {
            this.$nextTick(() => {
              this.scrollToBottom();
            });
          }
        } else if (res.code === 401) {
          // 登录失效
          console.log('加载评论时登录失效');
          this.handleLoginExpired();
        } else {
          console.error('加载评论失败:', res.message);
          this.$Message.error('加载评论失败');
        }
      } catch (error) {
        console.error('加载评论失败:', error);

        // 处理axios响应错误
        if (error.response && error.response.status === 401) {
          console.log('请求评论时登录失效');
          this.handleLoginExpired();
        } else {
          this.$Message.error('加载评论失败，请检查网络连接');
        }
      } finally {
        this.loading = false;
      }
    },
    // 处理滚动事件
    handleScroll() {
      const container = this.$refs.commentList;
      if (!container) return;

      // 检查是否接近顶部
      const isNearTop = container.scrollTop <= this.scrollThreshold;

      // 如果接近顶部且还有历史消息且不在加载中，加载更多
      if (isNearTop && this.hasMoreHistory && !this.loadingMore && !this.loading) {
        this.loadMoreComments();
      }

      // 如果接近顶部且没有更多历史消息，显示提示
      if (isNearTop && !this.hasMoreHistory && !this.allLoadedTipVisible) {
        this.showAllLoadedTip();
      }
    },

    // 显示已加载全部提示
    showAllLoadedTip() {
      this.allLoadedTipVisible = true;
    },

    // 加载更多历史评论
    async loadMoreComments() {
      if (this.loadingMore || !this.hasMoreHistory) return;

      this.loadingMore = true;

      try {
        // 保持接口参数不变，仍然是获取最新的评论
        const params = {
          liveStreamId: this.liveId,
          limit: this.limit
        };

        const res = await this.$api.getCommentListWithOnline(params);

        if (res.code === 200) {
          const data = res.data;
          const newComments = data.comments || [];

          // 处理评论数据
          const processedComments = this.processComments(newComments);

          // 计算新增的评论（排除重复的）
          const existingIds = new Set(this.comments.map(c => c.id));
          const actualNewComments = processedComments.filter(comment => !existingIds.has(comment.id));

          if (actualNewComments.length === 0) {
            // 如果没有新评论，标记为没有更多
            this.hasMoreHistory = false;
            this.showAllLoadedTip();
          } else {
            // 将新数据合并到现有列表中，保持时间顺序
            const allComments = [...this.comments, ...actualNewComments];

            // 按时间倒序排序
            allComments.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

            this.comments = allComments;
            this.loadedCount = this.comments.length;

            // 如果获取到的评论数量达到限制，假设还有更多
            // 这里可以根据实际情况调整，如果希望更准确需要后端支持分页
            this.hasMoreHistory = true;
          }
        }
      } catch (error) {
        console.error('加载更多评论失败:', error);
      } finally {
        this.loadingMore = false;
      }
    },

    // 轮询获取最新评论和在线人数
    async pollComments() {
      // 如果轮询被禁用或正在加载，直接返回
      if (!this.pollingEnabled || this.loading) {
        return;
      }

      try {
        const params = {
          liveStreamId: this.liveId,
          limit: this.limit
        };

        const res = await this.$api.getCommentListWithOnline(params);

        if (res.code === 200) {
          const data = res.data;
          const newComments = data.comments || [];
          const onlineCount = data.onlineCount || 0;

          // 处理用户名脱敏
          const processedNewComments = newComments.map(comment => ({
            ...comment,
            createTime: comment.createTime ? new Date(comment.createTime) : new Date(),
            userName: this.maskPhoneNumber(comment.userName)
          }));

          // 更新在线人数（只在直播中时）
          if (this.liveStatus === '1') {
            this.$emit('update-comments', { onlineCount });
          }

          // 检查是否有新评论
          if (processedNewComments.length > 0 && this.comments.length > 0) {
            const existingIds = new Set(this.comments.map(c => c.id));
            const actualNewComments = processedNewComments.filter(comment => !existingIds.has(comment.id));

            if (actualNewComments.length > 0) {
              console.log('发现新评论:', actualNewComments.length);

              this.comments = [...actualNewComments, ...this.comments];

              if (!this.isAtBottom()) {
                this.showNewCommentsNoticeMethod(actualNewComments.length);
              }

              if (this.comments.length > this.limit) {
                this.comments = this.comments.slice(0, this.limit);
              }
            }
          } else if (this.comments.length === 0 && processedNewComments.length > 0) {
            this.comments = processedNewComments;
          }
        } else if (res.code === 401) {
          // 登录失效
          console.log('轮询时登录失效');
          this.handleLoginExpired();
        }
      } catch (error) {
        console.error('轮询获取评论失败:', error);

        // 处理axios响应错误
        if (error.response && error.response.status === 401) {
          console.log('轮询请求时登录失效');
          this.handleLoginExpired();
        }

        this.pollingEnabled = false;
        setTimeout(() => {
          this.pollingEnabled = true;
          console.log('轮询已重新启用');
        }, 30000);
      }
    },

    // 回复评论（点击整个评论项触发）
    replyToComment(comment) {
      if (!this.isLoggedIn) {
        this.$Message.warning('请先登录后再回复');
        this.$emit('require-login');
        return;
      }

      console.log('回复评论:', comment);
      this.replyingTo = comment;

      // 聚焦到输入框
      this.$nextTick(() => {
        const input = this.$el.querySelector('.comment-input');
        if (input) {
          input.focus();
        }
      });
    },

    // 取消回复
    cancelReply() {
      this.replyingTo = null;
    },

    // 提交评论
    async submitComment() {
      if (!this.currentUserId) {
        this.$Message.warning('请先登录');
        this.$emit('require-login');
        return;
      }
      if (!this.commentText.trim()) {
        this.$Message.warning('请输入评论内容');
        return;
      }
      if (this.commentText.trim().length > 500) {
        this.$Message.warning('评论内容不能超过500字');
        return;
      }

      const currentText = this.commentText.trim(); // 保存当前文本
      this.commentText = ''; // 立即清空输入框，让用户看到反馈
      this.submitting = true;

      try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        // 构建评论参数
        const commentData = {
          liveStreamId: this.liveId,
          content: currentText,
          parentId: this.replyingTo ? this.replyingTo.id : ''
        };

        console.log('提交评论的参数:', commentData);

        // 先显示临时评论（乐观更新）
        const tempComment = {
          id: `temp-${Date.now()}`,
          content: currentText,
          userId: this.currentUserId,
          userName: this.maskPhoneNumber(userInfo.user?.userName),
          userAvatar: '',
          createTime: new Date(),
          status: '0', // 0表示发送中
          parentId: this.replyingTo ? this.replyingTo.id : '',
          replyToName: this.replyingTo ? this.replyingTo.userName : ''
        };

        // 添加到评论列表开头
        this.comments.unshift(tempComment);

        // 立即滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
        });

        const res = await this.$api.addComment(commentData);

        if (res.code === 200) {
          // 更新临时评论为正式评论
          const newComment = {
            id: res.data.id || tempComment.id.replace('temp-', ''),
            content: currentText,
            userId: this.currentUserId,
            userName: tempComment.userName,
            userAvatar: '',
            createTime: new Date(),
            status: '1', // 1表示发送成功
            parentId: tempComment.parentId,
            replyToName: tempComment.replyToName
          };

          // 替换临时评论
          const tempIndex = this.comments.findIndex(c => c.id === tempComment.id);
          if (tempIndex !== -1) {
            this.comments.splice(tempIndex, 1, newComment);
          }

          this.$Message.success(this.replyingTo ? '回复成功' : '评论成功');
          this.$emit('comment-submitted', newComment);

        } else if (res.code === 401) {
          // 登录失效
          console.log('提交评论时登录失效');
          this.handleLoginExpired();
          // 移除临时评论
          const tempIndex = this.comments.findIndex(c => c.id === tempComment.id);
          if (tempIndex !== -1) {
            this.comments.splice(tempIndex, 1);
          }
          this.commentText = currentText; // 恢复文本
        } else {
          this.$Message.error(res.message || '评论失败');
          // 移除临时评论
          const tempIndex = this.comments.findIndex(c => c.id === tempComment.id);
          if (tempIndex !== -1) {
            this.comments.splice(tempIndex, 1);
          }
          this.commentText = currentText; // 恢复文本
        }
      } catch (error) {
        console.error('提交评论失败:', error);
        this.$Message.error('评论失败，请重试');

        // 移除临时评论
        const tempIndex = this.comments.findIndex(c => c.id.startsWith('temp-'));
        if (tempIndex !== -1) {
          this.comments.splice(tempIndex, 1);
        }
        this.commentText = currentText; // 恢复文本

        // 处理axios响应错误
        if (error.response && error.response.status === 401) {
          console.log('提交评论请求时登录失效');
          this.handleLoginExpired();
        }
      } finally {
        this.submitting = false;
        this.replyingTo = null; // 清空回复状态
      }
    },

    // 显示新评论提示
    showNewCommentsNoticeMethod(count) {
      this.newCommentsCount += count;
      this.showNewCommentsNoticeFlag = true;
    },

    // 判断是否在底部
    isAtBottom() {
      const container = this.$refs.commentList;
      if (!container) return true;

      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;

      return scrollHeight - scrollTop - clientHeight <= 10;
    },

    // 滚动到底部
    scrollToBottom() {
      const container = this.$refs.commentList;
      if (container) {
        // 使用平滑滚动
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 100);
      }
    },

    // 滚动到新评论位置
    scrollToNewComments() {
      const container = this.$refs.commentList;
      if (container) {
        container.scrollTop = container.scrollHeight;
        this.newCommentsCount = 0;
        this.showNewCommentsNoticeFlag = false;
      }
    },

    // 格式化时间（显示相对时间）
    formatTime(time) {
      if (!time) return '';

      let date;
      if (time instanceof Date) {
        date = time;
      } else if (typeof time === 'string') {
        date = new Date(time);
      } else {
        return '';
      }

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return '';
      }

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;

      // 超过7天显示具体日期
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // 跳转登录
    gotoLogin() {
      this.$emit('require-login');
    },

    // 重置评论
    resetComments() {
      console.log('重置评论列表');
      this.comments = [];
      this.newCommentsCount = 0;
      this.showNewCommentsNoticeFlag = false;
      this.replyingTo = null;
      this.hasStartedPolling = false; // 重置轮询状态
    },
    // 处理评论数据，完善回复信息
    processComments(comments) {
      // 先创建id到评论的映射，方便查找
      const commentMap = {};
      comments.forEach(comment => {
        commentMap[comment.id] = comment;
      });

      // 处理每条评论
      return comments.map(comment => {
        const processed = {
          ...comment,
          createTime: comment.createTime ? new Date(comment.createTime) : new Date(),
          userName: this.maskPhoneNumber(comment.userName),
          // 确保replyToName被正确设置
          replyToName: comment.replyToName ? this.maskPhoneNumber(comment.replyToName) : undefined
        };

        // 如果有parentId但没有replyToName，尝试从父评论中获取
        if (processed.parentId && !processed.replyToName) {
          const parentComment = commentMap[processed.parentId];
          if (parentComment) {
            processed.replyToName = this.maskPhoneNumber(parentComment.userName);
          }
        }

        return processed;
      });
    },
    // 启动轮询
    startPolling() {
      // 先停止现有的定时器
      this.stopPolling();

      // 启动新的定时器
      this.pollingTimer = setInterval(() => {
        this.pollComments();
      }, this.pollingInterval);

      console.log('评论轮询已启动，间隔:', this.pollingInterval);
    },

    // 停止轮询
    stopPolling() {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = null;
        console.log('评论轮询已停止');
      }
    },

    // 清理资源
    cleanup() {
      this.stopPolling();
    }
  }
};
</script>

<style lang="scss" scoped>
.comment-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 15px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;

    .section-title {
      font-size: 18px;
      color: #333;
      margin: 0;
    }

    .online-count-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      background: #f5f5f5;
      padding: 4px 10px;
      border-radius: 15px;
      font-size: 13px;
      color: #666;
      transition: all 0.3s ease;

      &:hover {
        background: #e8e8e8;
      }

      .online-icon {
        font-size: 14px;
        margin-top: -4px;
      }

      .online-number {
        font-weight: 600;
        color: #1890ff;
        animation: countUpdate 0.3s ease;
      }
    }
  }

  .new-comments-notice {
    position: absolute;
    top: 65px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(24, 144, 255, 0.95);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    animation: slideDown 0.3s ease;
    display: flex;
    align-items: center;
    gap: 6px;

    &:hover {
      background: rgba(24, 144, 255, 1);
    }

    .notice-icon {
      font-size: 14px;
    }
  }

  .comment-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 15px;
    position: relative;

    .all-loaded-tip {
      color: #b0b0b0;
    }

    .loading-comments {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 0;
      color: #999;

      .loading-spinner.small {
        width: 24px;
        height: 24px;
        border-width: 2px;
        margin-bottom: 10px;
      }

      .loading-text {
        font-size: 14px;
      }
    }

    .comment-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      color: #999;

      .empty-icon {
        font-size: 48px;
        margin-bottom: 15px;
        opacity: 0.6;
      }

      .empty-text {
        font-size: 14px;
      }
    }

    .comments-container {
      height: 200px;
      padding: 10px 0;

      .comment-group {
        margin-bottom: 10px;
        width: 290px;

        .time-label {
          text-align: center;
          font-size: 12px;
          color: #999;
          position: relative;

          &:before,
          &:after {
            content: '';
            position: absolute;
            top: 50%;
            width: 30%;
            height: 1px;
            background: #eee;
          }

          &:before {
            left: 0;
          }

          &:after {
            right: 0;
          }
        }

        .comment-item {
          display: flex;
          padding: 3px 0;
          cursor: pointer;

          &:hover {
            background-color: #f9f9f9;
          }

          &:last-child {
            border-bottom: none;
          }

          &.own-comment {
            border-radius: 8px;
          }

          .comment-avatar {
            flex-shrink: 0;
            margin-right: 12px;
            display: flex;
            justify-content: center;

            .avatar-icon {
              width: 36px;
              height: 36px;
              border-radius: 50%;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
            }
          }

          .comment-content {
            flex: 1;
            min-width: 0;
            text-align: left;

            .comment-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 6px;
              text-align: left;

              .comment-author {
                font-weight: 600;
                color: #333;
              }

              .comment-time {
                font-size: 12px;
                color: #999;
              }
            }

            .comment-text {
              line-height: 1.5;
              color: #333;
              word-break: break-word;
              text-align: left;
              max-width: 100%;
              overflow-wrap: break-word;
              word-break: break-word;
              white-space: pre-wrap;
              margin-right: 5px;
            }
          }
        }
      }
    }

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: #f5f5f5;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;

      &:hover {
        background: #a8a8a8;
      }
    }
  }

  .comment-input-area {
    padding: 7px 20px;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;

    .reply-hint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f0f7ff;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      color: #1890ff;
      margin-bottom: 10px;

      .reply-to-name {
        font-weight: 600;
        margin: 0 4px;
      }

      .cancel-reply {
        cursor: pointer;
        color: #999;
        font-size: 11px;

        &:hover {
          color: #ff4d4f;
        }
      }
    }

    .input-container {
      display: flex;
      gap: 10px;

      .comment-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        font-size: 13px;
        text-align: left;

        &:focus {
          outline: none;
          border-color: #1890ff;
        }

        &:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }
      }

      .comment-submit {
        padding: 10px 24px;
        background: #1890ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.3s;
        min-width: 80px;

        &:hover:not(:disabled) {
          background: #40a9ff;
        }

        &:disabled {
          background: #bae7ff;
          cursor: not-allowed;
        }
      }
    }
  }

  .login-tip {
    text-align: center;
    padding: 10px 20px;
    font-size: 14px;
    color: #666;
    background: #f9f9f9;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;

    a {
      color: #1890ff;
      text-decoration: none;
      margin: 0 4px;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

@keyframes countUpdate {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.2);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .comment-section {
    height: 420px;

    .section-header {
      padding: 15px;
      display: none;

      .section-title {
        font-size: 16px;
      }

      .online-count-indicator {
        font-size: 12px;
        padding: 3px 8px;

        .online-icon {
          font-size: 12px;

        }
      }
    }

    .new-comments-notice {
      top: 55px;
      font-size: 11px;
      padding: 6px 12px;
    }

    .comment-list {
      padding: 0 15px;

      .comments-container {
        .comment-group {
          .time-label {
            font-size: 11px;
            padding: 6px 0;
            margin: 8px 0;

            &:before,
            &:after {
              width: 25%;
            }
          }

          .comment-item {
            padding: 5px 0;

            .comment-avatar {
              margin-right: 10px;

              .avatar-icon {
                width: 32px;
                height: 32px;
                font-size: 16px;
              }
            }

            .comment-content {
              .comment-header {
                .comment-author {
                  font-size: 13px;
                }
              }

              .comment-text {
                font-size: 13px;
                margin-right: 2px;
              }
            }
          }
        }
      }
    }

    .comment-input-area {
      padding: 12px 15px;

      .input-container {

        .comment-input {
          padding: 8px 10px;
        }

        .comment-submit {
          padding: 8px 16px;
          min-width: auto;
        }
      }
    }
  }
}
</style>