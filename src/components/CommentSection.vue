<template>
  <div class="comment-section">
    <div class="section-header">
      <h3 class="section-title">互动</h3>
      <!-- 在线人数显示 -->
      <div v-if="showOnlineCount && onlineCount > 0" class="online-count-indicator">
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
      <!-- 加载提示 -->
      <div v-if="loading" class="loading-comments">
        <div class="loading-spinner small"></div>
        <div class="loading-text">加载中...</div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && comments.length === 0" class="comment-empty">
        <div class="empty-icon">💬</div>
        <div class="empty-text">还没有评论，快来第一个评论吧~</div>
      </div>

      <!-- 评论列表 -->
      <div v-else class="comments-container">
        <div v-for="comment in comments" :key="comment.id" class="comment-item"
          :class="{ 'own-comment': comment.userId === currentUserId }">
          <div class="comment-avatar">
            <img v-if="comment.userAvatar" :src="comment.userAvatar" alt="avatar" class="avatar-img" />
            <div v-else class="avatar-default">
              {{ comment.userName?.charAt(0) || '用户' }}
            </div>
          </div>

          <div class="comment-content">
            <div class="comment-header">
              <span class="comment-author">{{ comment.userName || '匿名用户' }}</span>
              <span class="comment-time">{{ formatTime(comment.createTime) }}</span>
            </div>
            <div class="comment-text">{{ comment.content }}</div>

            <!-- 评论操作 - 只保留删除（管理员） -->
            <div class="comment-actions" v-if="isAdmin">
              <span class="action-btn delete-btn" @click="deleteComment(comment)">
                <Icon type="ios-trash" size="16" />
                删除
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 评论输入区域 -->
    <div class="comment-input-area">
      <input type="text" placeholder="说点什么~" class="comment-input" v-model="commentText" @keyup.enter="submitComment"
        :disabled="!isLoggedIn" />
      <button class="comment-submit" @click="submitComment" :disabled="!isLoggedIn || submitting">
        <span v-if="submitting">发送中...</span>
        <span v-else>发送</span>
      </button>
    </div>

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

    liveId() {
      // 直播ID变化时，重置状态并重新加载
      this.resetComments();
      this.stopPolling();
      this.loadComments();
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
    // 页面加载时只加载一次评论
    this.loadComments();
  },

  beforeDestroy() {
    console.log('CommentSection 组件销毁，清理轮询');
    this.cleanup();
  },

  methods: {
    // 加载评论列表
    async loadComments() {
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

          // 直接替换评论列表
          this.comments = newComments;

          // 滚动到最新位置
          if (newComments.length > 0) {
            this.$nextTick(() => {
              this.scrollToBottom();
            });
          }

          // 只有在首次加载且未启动轮询时才启动轮询
          if (!this.hasStartedPolling) {
            console.log('首次加载完成，启动轮询');
            // this.startPolling();
            this.hasStartedPolling = true;
          }
        } else {
          console.error('加载评论失败:', res.message);
          this.$Message.error('加载评论失败');
        }
      } catch (error) {
        console.error('加载评论失败:', error);
        this.$Message.error('加载评论失败，请检查网络连接');
      } finally {
        this.loading = false;
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

          // console.log('轮询获取到评论和在线人数:', {
          //   comments: newComments.length,
          //   onlineCount
          // });

          // 更新在线人数（只在直播中时）
          if (this.liveStatus === '1') {
            this.$emit('update-comments', { onlineCount });
          }

          // 检查是否有新评论
          if (newComments.length > 0 && this.comments.length > 0) {
            const existingIds = new Set(this.comments.map(c => c.id));
            const actualNewComments = newComments.filter(comment => !existingIds.has(comment.id));

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
          } else if (this.comments.length === 0 && newComments.length > 0) {
            this.comments = newComments;
          }
        }
      } catch (error) {
        console.error('轮询获取评论失败:', error);
        this.pollingEnabled = false;
        setTimeout(() => {
          this.pollingEnabled = true;
          console.log('轮询已重新启用');
        }, 30000);
      }
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
      this.submitting = true;

      try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        const commentData = {
          liveStreamId: this.liveId,
          userId: this.userId,
          userName: userInfo.nickname || userInfo.name || '用户',
          content: this.commentText.trim(),
          parentId: '0',
          createTime: new Date().toISOString(),
          status: '1',
          userAvatar: userInfo.avatar || ''
        };

        const res = await this.$api.addComment(commentData);

        if (res.code === 200) {
          const newComment = {
            id: res.data.id || Date.now(),
            content: this.commentText.trim(),
            userId: this.userId,
            userName: userInfo.nickname || userInfo.name || '我',
            userAvatar: userInfo.avatar || '',
            createTime: new Date(),
            status: '1'
          };

          this.comments.unshift(newComment);
          this.commentText = '';

          this.$nextTick(() => {
            this.scrollToBottom();
          });

          this.$Message.success('评论成功');
          this.$emit('comment-submitted', newComment);

          // 不立即触发轮询，等待定时器自然触发
        } else {
          this.$Message.error(res.message || '评论失败');
        }
      } catch (error) {
        console.error('提交评论失败:', error);
        this.$Message.error('评论失败，请重试');
      } finally {
        this.submitting = false;
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
        container.scrollTop = container.scrollHeight;
      }
    },

    // 格式化时间
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

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;

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
      this.hasStartedPolling = false; // 重置轮询状态
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

<style scoped>
.comment-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

/* 修改标题区域样式 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 15px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.section-title {
  font-size: 18px;
  color: #333;
  margin: 0;
}

/* 在线人数指示器样式 */
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
}

.online-count-indicator:hover {
  background: #e8e8e8;
}

.online-icon {
  font-size: 14px;
}

.online-number {
  font-weight: 600;
  color: #1890ff;
  animation: countUpdate 0.3s ease;
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

/* 新评论提示样式 */
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
}

.new-comments-notice:hover {
  background: rgba(24, 144, 255, 1);
}

.notice-icon {
  font-size: 14px;
}

/* 评论列表样式 */
.comment-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
  position: relative;
}

/* 加载中 */
.loading-comments {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #999;
}

.loading-spinner.small {
  width: 24px;
  height: 24px;
  border-width: 2px;
  margin-bottom: 10px;
}

.loading-text {
  font-size: 14px;
}

/* 空状态 */
.comment-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 15px;
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
}

/* 评论项 */
.comments-container {
  padding: 10px 0;
}

.comment-item {
  display: flex;
  padding: 15px 0;
  border-bottom: 1px solid #f5f5f5;
  animation: fadeIn 0.3s ease;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-item.own-comment {
  background-color: #f9f9f9;
  border-radius: 8px;
  margin: 5px -10px;
  padding: 15px 10px;
}

/* 头像 */
.comment-avatar {
  flex-shrink: 0;
  margin-right: 12px;
}

.avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-default {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
}

/* 评论内容 */
.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.comment-author {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.comment-time {
  font-size: 12px;
  color: #999;
}

.comment-text {
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  margin-bottom: 10px;
  word-break: break-word;
}

/* 评论操作 */
.comment-actions {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #999;
  transition: color 0.2s;
  user-select: none;
}

.action-btn:hover {
  color: #666;
}

.delete-btn:hover {
  color: #ff4757;
}

/* 评论输入区域 */
.comment-input-area {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.comment-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.comment-input:focus {
  outline: none;
  border-color: #1890ff;
}

.comment-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.comment-submit {
  padding: 10px 24px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
  min-width: 80px;
}

.comment-submit:hover:not(:disabled) {
  background: #40a9ff;
}

.comment-submit:disabled {
  background: #bae7ff;
  cursor: not-allowed;
}

/* 登录提示 */
.login-tip {
  text-align: center;
  padding: 10px 20px;
  font-size: 14px;
  color: #666;
  background: #f9f9f9;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.login-tip a {
  color: #1890ff;
  text-decoration: none;
  margin: 0 4px;
}

.login-tip a:hover {
  text-decoration: underline;
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

/* 滚动条样式 */
.comment-list::-webkit-scrollbar {
  width: 6px;
}

.comment-list::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.comment-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.comment-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .comment-section {
    height: 400px;
  }

  .section-header {
    padding: 15px;
  }

  .section-title {
    font-size: 16px;
  }

  .online-count-indicator {
    font-size: 12px;
    padding: 3px 8px;
  }

  .online-icon {
    font-size: 12px;
  }

  .new-comments-notice {
    top: 55px;
    font-size: 11px;
    padding: 6px 12px;
  }

  .comment-list {
    padding: 0 15px;
  }

  .comment-input-area {
    padding: 12px 15px;
  }

  .comment-input {
    padding: 8px 10px;
  }

  .comment-submit {
    padding: 8px 16px;
    min-width: 60px;
  }

  .comment-item {
    padding: 12px 0;
  }

  .comment-avatar {
    margin-right: 10px;
  }

  .avatar-img,
  .avatar-default {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .comment-author {
    font-size: 13px;
  }

  .comment-text {
    font-size: 13px;
  }

  .comment-actions {
    gap: 12px;
  }

  .action-btn {
    font-size: 11px;
  }
}
</style>