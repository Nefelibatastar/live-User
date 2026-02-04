<template>
  <div class="live-info">
    <div class="live-meta">
      <div class="live-time">{{ liveShowName }}</div>
      <div class="countdown-header">
        <Icon type="md-clock" size="20" color="#ccc" />
        <span class="countdown-label">{{ formattedStartTime }}</span>
      </div>
    </div>

    <!-- 直播介绍 -->
    <h3 class="section-title">直播介绍</h3>
    <div class="intro-content">
      <slot name="intro">
        <p>{{ introduce }}</p>
      </slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LiveInfo',
  props: {
    liveShowName: {
      type: String,
      default: ''
    },
    startTime: {
      type: String,
      default: ''
    },
    introduce:{
      type: String,
      default: ''
    }
  },
  computed: {
    formattedStartTime() {
      if (!this.startTime) return '';
      try {
        const date = new Date(this.startTime);
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        return this.startTime;
      }
    }
  }
};
</script>

<style scoped>
.live-info {
  text-align: left;
  margin-top: 20px;
  padding: 10px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.live-meta {
  gap: 8px;
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
}

.live-time {
  margin: 8px 0;
  font-weight: 800;
  font-size: 16px;
  color: #434343;
}

.countdown-header {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.countdown-label {
  margin-left: 8px;
  font-size: 14px;
  color: #666;
}

.section-title {
  font-size: 14px;
  color: #333;
  margin: 0 0 15px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.intro-content {
  font-size: 14px;
  line-height: 1.6;
  color: #666;
}

.intro-content p {
  margin: 0 0 10px 0;
}

.intro-content p:last-child {
  margin-bottom: 0;
}
</style>