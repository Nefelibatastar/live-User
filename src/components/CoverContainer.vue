<template>
  <div class="cover-container">
    <img v-if="coverImageUrl" :src="coverImageUrl" alt="直播封面" class="cover-image" />
    <div v-else class="cover-placeholder">
      <div class="placeholder-icon">📺</div>
      <div class="placeholder-text">直播封面</div>
    </div>

    <!-- 直播未开始提示 - 显示倒计时 -->
    <div v-if="startTime" class="countdown-overlay">
      <CountdownTimer 
        :startTime="startTime" 
        @countdown-end="handleCountdownEnd"
      />
    </div>
  </div>
</template>

<script>
import CountdownTimer from './CountdownTimer.vue';

export default {
  name: 'CoverContainer',
  components: {
    CountdownTimer
  },
  props: {
    coverImageUrl: {
      type: String,
      default: ''
    },
    startTime: {
      type: String,
      default: ''
    }
  },
  methods: {
    handleCountdownEnd() {
      this.$emit('refresh');
    }
  }
};
</script>

<style scoped>
.cover-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.placeholder-text {
  font-size: 16px;
}

/* 倒计时覆盖层 */
.countdown-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  color: white;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  /* background: rgba(255, 255, 255, 0.15); */
  backdrop-filter: blur(1px);
}
</style>