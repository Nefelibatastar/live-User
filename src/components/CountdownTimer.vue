<template>
  <div class="countdown-display">
    <div class="countdown-timer">
      <div class="countdown-item">
        <span class="countdown-number">{{ countdown.days }}</span>
        <span class="countdown-unit">天</span>
      </div>
      <div class="countdown-item">
        <span class="countdown-number">{{ countdown.hours }}</span>
        <span class="countdown-unit">时</span>
      </div>
      <div class="countdown-item">
        <span class="countdown-number">{{ countdown.minutes }}</span>
        <span class="countdown-unit">分</span>
      </div>
      <div class="countdown-item">
        <span class="countdown-number">{{ countdown.seconds }}</span>
        <span class="countdown-unit">秒</span>
      </div>
      <div class="countdown-item">
        <span class="countdown-text">后开播</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CountdownTimer',
  props: {
    startTime: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      countdown: {
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00'
      },
      countdownTimer: null,
      hasEnded: false
    };
  },
  mounted() {
    this.startCountdown();
  },
  beforeDestroy() {
    this.clearCountdown();
  },
  methods: {
    startCountdown() {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
      }

      const updateCountdown = () => {
        try {
          const [datePart, timePart] = this.startTime.split(' ');
          const [year, month, day] = datePart.split('-').map(Number);
          let sHours = 0, sMinutes = 0, sSeconds = 0;
          if (timePart) {
            const [h, m, s] = timePart.split(':').map(Number);
            sHours = h;
            sMinutes = m;
            sSeconds = s;
          }

          const start = new Date(year, month - 1, day, sHours, sMinutes, sSeconds);
          const now = new Date();

          if (isNaN(start.getTime())) {
            console.error('开始时间解析失败:', this.startTime);
            this.clearCountdown();
            return;
          }

          if (now >= start) {
            this.clearCountdown();
            if (!this.hasEnded) {
              this.hasEnded = true;
              this.$emit('countdown-end');
            }
            return;
          }

          const diff = start.getTime() - now.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          this.countdown = {
            days: this.padZero(days),
            hours: this.padZero(hours),
            minutes: this.padZero(minutes),
            seconds: this.padZero(seconds)
          };

        } catch (error) {
          console.error('倒计时计算异常:', error);
          this.clearCountdown();
        }
      };

      this.hasEnded = false;
      updateCountdown();
      this.countdownTimer = setInterval(updateCountdown, 1000);
    },
    
    clearCountdown() {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.countdown = { days: '00', hours: '00', minutes: '00', seconds: '00' };
    },
    
    padZero(num) {
      return num.toString().padStart(2, '0');
    }
  },
  watch: {
    startTime: {
      handler() {
        this.startCountdown();
      },
      immediate: false
    }
  }
};
</script>

<style scoped>
.countdown-display {
  width: 100%;
}

.countdown-timer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.countdown-item {
  display: flex;
  align-items: center;
}

.countdown-number {
  display: inline-block;
  min-width: 32px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  border-radius: 4px;
  margin-right: 4px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.countdown-unit {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin-right: 6px;
  font-weight: 500;
}

.countdown-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin-left: 2px;
}

@media (max-width: 768px) {
  .countdown-timer {
    gap: 6px;
  }
  
  .countdown-number {
    font-size: 14px;
    min-width: 26px;
    padding: 3px 6px;
  }
  
  .countdown-unit {
    font-size: 12px;
    margin-right: 4px;
  }
  
  .countdown-text {
    font-size: 12px;
  }
}
</style>