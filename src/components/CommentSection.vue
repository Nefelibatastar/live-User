<template>
  <div class="comment-section">
    <div class="section-header">
      <h3 class="section-title">互动</h3>
      <div class="online-count-indicator" v-if="showOnlineCount && onlineCount > 0 && !isMobile">
        <span class="online-icon">👥</span>
        <span class="online-number">{{ onlineCount }}</span>
      </div>
    </div>

    <div class="comment-list" ref="commentList">
      <div v-if="!loading && comments.length === 0" class="comment-empty">
        <div class="empty-icon">💬</div>
        <div class="empty-text">还没有评论，快来第一个评论吧~</div>
      </div>

      <div v-else class="comments-container">
        <div v-for="(group, groupIndex) in groupedComments" :key="groupIndex" class="comment-group">
          <div class="time-label">
            {{ formatGroupTime(group.time) }}
          </div>

          <div v-for="comment in group.comments" :key="comment.id" class="comment-item" :class="{
            'own-comment': comment.userId === currentUserId,
            'reply-comment': comment.parentId
          }" @click="replyToComment(comment)">
            <div class="comment-avatar">
              <div class="avatar-icon">
                <img src="https://img1.baidu.com/it/u=2925226694,390810694&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=500"
                  alt="用户头像" style="width: 36px;height: 36px;border-radius: 8px;">
              </div>
            </div>

            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">{{ comment.userName || '匿名用户' }}</span>
              </div>

              <!-- 显示回复信息 -->
              <div v-if="comment.parentId" class="reply-info">
                <span v-if="comment.replyToName">回复 {{ comment.replyToName }}：</span>
                <span v-else>回复：</span>
                <span class="reply-content" v-if="getParentCommentContent(comment.parentId)">{{
                  getParentCommentContent(comment.parentId) }}</span>
              </div>

              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="comment-input-area">
      <div v-if="replyingTo" class="reply-hint">
        回复 <span class="reply-to-name">{{ replyingTo.userName }}</span>
        <span class="cancel-reply" @click="cancelReply">取消</span>
      </div>

      <div class="input-container">
        <input type="text" :placeholder="replyingTo ? `回复 ${replyingTo.userName}：` : '说点什么~'" class="comment-input"
          v-model="commentText" @keyup.enter="submitComment" :disabled="!actualIsLoggedIn || submitting"
          maxlength="500" />
        <button class="comment-submit" @click="submitComment"
          :disabled="!actualIsLoggedIn || submitting || !commentText.trim()">
          <span>{{ replyingTo ? '回复' : '发送' }}</span>
        </button>
      </div>
    </div>

    <div v-if="showOnlineCount && onlineCount > 0 && isMobile" class="fixed-online-count">
      <span class="online-icon">👥</span>
      <span class="online-number">{{ onlineCount }}</span>
    </div>

    <div v-if="!actualIsLoggedIn" class="login-tip" style="z-index: 10; position: relative;">
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
    },
    comments: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      commentText: '',
      submitting: false,
      replyingTo: null,
      currentUserId: '',
      isMobile: false,

      // UI相关状态
      loading: false,

      // 滚动相关
      scrollThreshold: 50,
      allLoadedTipVisible: false,
      isNearBottom: true,
    };
  },

  computed: {
    isLoggedIn() {
      return !!this.currentUserId;
    },

    actualIsLoggedIn() {
      if (this.isLoggedIn) return true;
      if (this.$store && this.$store.getters && this.$store.getters.isLoggedIn) return true;
      try {
        return !!localStorage.getItem('token');
      } catch (e) {
        return false;
      }
    },

    showOnlineCount() {
      return this.onlineCount > 0;
    },

    groupedComments() {
      if (this.comments.length === 0) return [];

      const groups = [];
      let currentGroup = null;

      // 按时间正序排序（旧的在前面，新的在后面）
      const sortedComments = [...this.comments].sort((a, b) => {
        return new Date(a.createTime).getTime() - new Date(b.createTime).getTime();
      });

      sortedComments.forEach(comment => {
        const timeKey = this.getTimeKey(comment.createTime, 5); // 5分钟一组

        if (!currentGroup || currentGroup.timeKey !== timeKey) {
          currentGroup = {
            timeKey,
            time: comment.createTime,
            comments: []
          };
          groups.push(currentGroup);
        }

        currentGroup.comments.push(comment);
      });

      return groups;
    },
  },

  watch: {
    userId: {
      immediate: true,
      handler() {
        this.updateLoginState();
      },
    },

    '$store.getters.isLoggedIn': {
      immediate: true,
      handler() {
        this.updateLoginState();
      },
    },
    comments: {
      handler(newComments, oldComments) {
        // 添加空值检查
        const oldLength = oldComments ? oldComments.length : 0;
        const newLength = newComments ? newComments.length : 0;

        // 如果有新评论，就滚动到底部
        if (newLength > oldLength && this.isNearBottom) {
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        }
      },
      deep: true,
      immediate: true
    },
  },

  created() {
    this.syncLoginStatus();
  },

  mounted() {
    this.updateLoginState();
    this.checkIsMobile();
    window.addEventListener('resize', this.checkIsMobile);

    const container = this.$refs.commentList;
    if (container) {
      container.addEventListener('scroll', this.handleScroll);
      // 初始时滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    }
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.checkIsMobile);
    const container = this.$refs.commentList;
    if (container) {
      container.removeEventListener('scroll', this.handleScroll);
    }
  },

  methods: {
    // 检查是否为移动端
    checkIsMobile() {
      this.isMobile = window.innerWidth <= 768;
    },

    // 获取时间分组键
    getTimeKey(dateTime, minutesInterval = 5) {
      try {
        const d = new Date(dateTime);
        if (isNaN(d.getTime())) {
          return 'unknown';
        }

        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = Math.floor(d.getMinutes() / minutesInterval) * minutesInterval;
        return `${year}-${month}-${day} ${hours}:${minutes.toString().padStart(2, '0')}`;
      } catch (error) {
        return 'error';
      }
    },

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
        return '';
      }
    },

    getParentCommentContent(parentId) {
      const parentComment = this.comments.find(c => c.id === parentId);
      return parentComment ? parentComment.content : '原评论';
    },

    handleScroll() {
      const container = this.$refs.commentList;
      if (!container) return;

      const isNearTop = container.scrollTop <= this.scrollThreshold;

      // 判断是否在底部附近（距离底部50px以内）
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;
      const clientHeight = container.clientHeight;
      this.isNearBottom = Math.abs(scrollHeight - scrollTop - clientHeight) <= 50;

      if (isNearTop && !this.allLoadedTipVisible) {
        this.showAllLoadedTip();
      }
    },

    showAllLoadedTip() {
      this.allLoadedTipVisible = true;
    },

    replyToComment(comment) {
      if (!this.actualIsLoggedIn) {
        if (this.$Message) {
          this.$Message.warning('请先登录后再回复');
        } else {
          alert('请先登录后再回复');
        }
        this.$emit('require-login');
        return;
      }

      this.replyingTo = comment;
      this.$nextTick(() => {
        const input = this.$el.querySelector('.comment-input');
        if (input) {
          input.focus();
        }
      });
    },

    cancelReply() {
      this.replyingTo = null;
    },

    async submitComment() {
      if (!this.actualIsLoggedIn) {
        if (this.$Message) {
          this.$Message.warning('请先登录');
        } else {
          alert('请先登录');
        }
        this.$emit('require-login');
        return;
      }

      const currentText = this.commentText.trim();
      if (!currentText) {
        if (this.$Message) {
          this.$Message.warning('请输入评论内容');
        } else {
          alert('请输入评论内容');
        }
        return;
      }

      if (currentText.length > 500) {
        if (this.$Message) {
          this.$Message.warning('评论内容不能超过500字');
        } else {
          alert('评论内容不能超过500字');
        }
        return;
      }

      // 准备评论数据
      const commentData = {
        liveStreamId: this.liveId,
        content: currentText,
        parentId: this.replyingTo ? this.replyingTo.id : ''
      };

      this.submitting = true;

      try {
        // 通知父组件提交评论
        this.$emit('submit-comment', commentData);

        // 清空输入框
        this.commentText = '';

        // 如果有回复对象，清空回复状态
        if (this.replyingTo) {
          this.$emit('reply-comment', {
            commentData,
            replyTo: this.replyingTo
          });
          this.replyingTo = null;
        }
      } catch (error) {
        console.error('提交评论失败:', error);
      } finally {
        this.submitting = false;
      }
    },

    scrollToBottom() {
      const container = this.$refs.commentList;
      if (container) {
        // 使用requestAnimationFrame确保在DOM更新后执行
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    },

    gotoLogin() {
      this.$emit('require-login');
    },

    syncLoginStatus() {
      let userId = '';
      if (this.$store?.getters?.isLoggedIn) {
        const userInfo = this.$store.getters.userInfo;
        userId = userInfo?.id || userInfo?.userId || '';
      } else {
        const userInfoStr = localStorage.getItem('userInfo');
        const token = localStorage.getItem('token');
        if (userInfoStr && token) {
          try {
            const userInfo = JSON.parse(userInfoStr);
            const user = userInfo.user || userInfo;
            userId = user.id || user.userId || '';
          } catch (e) {
            console.error('解析登录态userInfo失败:', e);
            userId = '';
          }
        }
      }

      if (userId !== this.currentUserId) {
        this.currentUserId = userId;
      }

      return !!userId;
    },

    updateLoginState() {
      let userId = '';
      if (this.userId) {
        userId = this.userId;
      } else if (this.$store?.getters?.isLoggedIn) {
        const userInfo = this.$store.getters.userInfo;
        userId = userInfo?.id || userInfo?.userId || '';
      } else {
        const userInfoStr = localStorage.getItem('userInfo');
        if (userInfoStr) {
          try {
            const userInfo = JSON.parse(userInfoStr);
            const user = userInfo.user || userInfo;
            userId = user.id || user.userId || '';
          } catch (e) {
            userId = '';
          }
        }
      }

      if (userId !== this.currentUserId) {
        this.currentUserId = userId;
      }
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
  max-height: 90vh;

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

  .comment-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 15px;
    position: relative;

    .all-loaded-tip {
      color: #b0b0b0;
      text-align: center;
      padding: 10px 0;
    }

    .loading-more {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 0;
      color: #999;
      font-size: 14px;
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
          margin: 10px 0;

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
          transition: background-color 0.2s;
          position: relative;

          &:hover {
            background-color: #f9f9f9;
          }

          &:last-child {
            border-bottom: none;
          }

          &.own-comment {
            border-radius: 8px;
          }

          &.temp-comment {
            opacity: 0.7;

            .temp-comment-indicator {
              position: absolute;
              top: 0;
              right: 0;
              background: #f5f5f5;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 11px;
              color: #999;
            }
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

.comment-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 15px;
  position: relative;
  scroll-behavior: smooth;
  /* 添加平滑滚动效果 */
}

/* 确保评论容器的正确尺寸 */
.comments-container {
  min-height: 100%;
  padding: 10px 0;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .comment-list {
    padding: 0 15px;
    -webkit-overflow-scrolling: touch;
    /* iOS平滑滚动 */
  }
}
</style>