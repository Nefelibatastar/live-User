<template>
  <div class="video-player">
    <!-- 播放容器 -->
    <div class="player-container">
      <!-- M3U8播放器容器 -->
      <div v-if="isM3u8 && liveStatus === '1'" class="video-js-container">
        <video id="videoPlayer" class="video-js vjs-default-skin" controls playsinline></video>

        <!-- 自定义播放按钮覆盖层（M3U8）- 未初始化时显示 -->
        <div v-if="!isPlaying && !isLoading" class="custom-play-overlay">
          <div class="play-button" @click="playM3u8">
            <div class="play-icon"></div>
            <div class="play-text">点击播放</div>
          </div>
        </div>

        <!-- M3U8错误提示 -->
        <div v-if="showM3u8Error" class="error-overlay">
          <div class="error-content">
            <div class="error-title">播放失败</div>
            <div class="error-message">{{ m3u8ErrorMessage }}</div>
            <button class="retry-button" @click="retryM3u8">重试</button>
          </div>
        </div>
      </div>

      <!-- FLV播放器容器 -->
      <div v-if="isFlv && liveStatus === '1'" class="flv-container">
        <video id="videoElement" crossOrigin="anonymous" controls playsinline @click="playFlv"></video>

        <!-- 自定义播放按钮覆盖层（FLV）- 未播放时显示 -->
        <div v-if="!isPlaying && !isLoading" class="custom-play-overlay">
          <div class="play-button" @click="playFlv">
            <div class="play-icon"></div>
            <div class="play-text">点击播放</div>
          </div>
        </div>
      </div>

      <!-- 未直播状态：显示封面图 -->
      <CoverContainer v-if="liveStatus === '0'" :coverImageUrl="coverImageUrl" :startTime="startTime"
        @refresh="refreshLiveStatus" />

      <!-- 加载中提示 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载视频流...</div>
      </div>
    </div>
  </div>
</template>

<script>
import videojs from "video.js";
import "video.js/dist/video-js.css";
import flvjs from 'flv.js';
import CoverContainer from './CoverContainer.vue';

export default {
  name: "VideoPlayer",
  components: {
    CoverContainer
  },
  props: {
    streamUrl: {
      type: String,
      default: ''
    },
    liveStatus: {
      type: String,
      default: '0'
    },
    streamType: {
      type: String,
      default: null
    },
    startTime: {
      type: String,
      default: ''
    },
    coverImageUrl: {
      type: String,
      default: ''
    },
    streamData: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      detectedFormat: null,
      isM3u8: false,
      isFlv: false,
      isPlaying: false,
      isLoading: false,
      vjsPlayer: null,
      flvPlayer: null,
      showM3u8Error: false,
      m3u8ErrorMessage: "",
      m3u8RetryCount: 0,
      maxM3u8Retry: 3,
      heartbeatTimer: null,
      reconnectCount: 0,
      maxReconnect: 5,
      timerId: null
    };
  },
  watch: {
    streamUrl: {
      handler(newVal) {
        if (newVal && this.liveStatus === '1') {
          this.parseStreamData();
        }
      },
      immediate: true
    },
    liveStatus(newVal) {
      if (newVal === '1') {
        this.parseStreamData();
      } else {
        this.destroyAllPlayers();
      }
    }
  },
  beforeDestroy() {
    this.destroyAllPlayers();
  },
  methods: {
    // 解析流数据
    async parseStreamData() {
      if (!this.streamUrl) return;

      this.detectedFormat = this.detectFormat();

      if (this.detectedFormat === 'm3u8') {
        this.isM3u8 = true;
        this.isFlv = false;
        this.$nextTick(() => {
          this.initM3u8PlayerContainer();
        });
      } else if (this.detectedFormat === 'flv') {
        this.isFlv = true;
        this.isM3u8 = false;
      }

      this.isLoading = false;
    },

    // 检测格式
    detectFormat() {
      if (this.streamType) {
        return this.streamType.toLowerCase();
      }

      if (this.streamUrl.includes('.m3u8')) {
        return 'm3u8';
      } else if (this.streamUrl.includes('.flv')) {
        return 'flv';
      }

      return 'm3u8'; // 默认
    },

    // 初始化M3U8播放器容器
    initM3u8PlayerContainer() {
      if (this.vjsPlayer) {
        this.vjsPlayer.dispose();
        this.vjsPlayer = null;
      }

      this.$nextTick(() => {
        const options = {
          aspectRatio: '16:9',
          notSupportedMessage: '此M3U8直播暂无法播放',
          autoplay: false,
          muted: false,
          preload: "none",
          controls: true,
          fluid: true,
          liveui: true,
        };

        try {
          this.vjsPlayer = videojs("videoPlayer", options);

          this.vjsPlayer.on('play', () => {
            this.isPlaying = true;
            this.isLoading = false;
            this.showM3u8Error = false;
          });

          this.vjsPlayer.on('pause', () => {
            this.isPlaying = false;
          });

          this.vjsPlayer.on('error', () => {
            this.isPlaying = false;
            this.isLoading = false;

            const errorCode = this.vjsPlayer.error()?.code || 0;
            let errorMessage = '播放失败';

            switch (errorCode) {
              case 1: errorMessage = '视频加载中断'; break;
              case 2: errorMessage = '网络错误'; break;
              case 3: errorMessage = '解码错误'; break;
              case 4: errorMessage = '视频格式不支持或服务器错误'; break;
              case 5: errorMessage = '视频编码错误'; break;
              default: errorMessage = '播放错误';
            }

            this.m3u8ErrorMessage = errorMessage;
            this.showM3u8Error = true;
          });

        } catch (error) {
          console.error('M3U8播放器容器初始化失败:', error);
        }
      });
    },

    // 播放M3U8
    playM3u8() {
      if (!this.vjsPlayer) return;

      this.isLoading = true;

      this.vjsPlayer.src({
        src: this.streamUrl,
        type: 'application/x-mpegURL'
      });

      this.vjsPlayer.load();
      this.vjsPlayer.play().catch(err => {
        console.error('M3U8播放失败:', err);
        this.isLoading = false;
        this.m3u8ErrorMessage = '播放失败，请重试';
        this.showM3u8Error = true;
      });
    },

    // M3U8重试
    retryM3u8() {
      this.m3u8RetryCount++;

      if (this.m3u8RetryCount > this.maxM3u8Retry) {
        alert('多次重试失败，请检查视频地址是否正确');
        return;
      }

      this.showM3u8Error = false;
      this.isLoading = true;

      if (this.vjsPlayer) {
        this.vjsPlayer.load();
        this.vjsPlayer.play().catch(err => {
          console.error('重试播放失败:', err);
          this.isLoading = false;
          this.m3u8ErrorMessage = '重试播放失败';
          this.showM3u8Error = true;
        });
      }
    },

    // 播放FLV
    playFlv() {
      if (this.isPlaying && this.flvPlayer) {
        return;
      }

      if (this.flvPlayer) {
        const videoElement = document.getElementById('videoElement');
        if (videoElement && videoElement.paused) {
          videoElement.play();
        }
        return;
      }

      this.initFlvPlayer();
    },

    // 初始化FLV播放器
    initFlvPlayer() {
      if (!flvjs.isSupported()) {
        alert('当前浏览器不支持FLV直播');
        this.isFlv = false;
        return;
      }

      this.isLoading = true;

      this.$nextTick(() => {
        const videoElement = document.getElementById('videoElement');
        if (!videoElement) {
          console.error('视频元素不存在');
          this.isLoading = false;
          return;
        }

        try {
          this.flvPlayer = flvjs.createPlayer({
            type: 'flv',
            isLive: true,
            hasAudio: true,
            url: this.streamUrl,
            enableWorker: false,
          }, {
            cors: true,
            enableStashBuffer: false,
          });

          this.flvPlayer.attachMediaElement(videoElement);
          this.flvPlayer.load();

          this.flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
            this.isLoading = false;
          });

          videoElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.isLoading = false;
          });

          videoElement.addEventListener('pause', () => {
            this.isPlaying = false;
          });

          this.flvPlayer.on(flvjs.Events.ERROR, () => {
            this.isPlaying = false;
            this.isLoading = false;

            if (this.reconnectCount < this.maxReconnect) {
              this.reconnectCount++;
              setTimeout(() => {
                this.tryReconnectFlv();
              }, 3000);
            } else {
              alert('FLV直播连接失败，请检查网络和流地址');
            }
          });

          videoElement.play().catch(err => {
            console.error('自动播放失败:', err);
            this.isLoading = false;
          });

        } catch (error) {
          console.error('FLV播放器初始化失败:', error);
          this.isLoading = false;
          alert('FLV播放器初始化失败，请刷新页面重试');
        }
      });
    },

    // FLV重试连接
    tryReconnectFlv() {
      if (this.flvPlayer) {
        this.flvPlayer.destroy();
        this.flvPlayer = null;
      }

      this.reconnectCount = 0;
      this.initFlvPlayer();
    },

    // 销毁所有播放器
    destroyAllPlayers() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (this.vjsPlayer) {
        this.vjsPlayer.dispose();
        this.vjsPlayer = null;
      }

      if (this.flvPlayer) {
        this.flvPlayer.pause();
        this.flvPlayer.unload();
        this.flvPlayer.detachMediaElement();
        this.flvPlayer.destroy();
        this.flvPlayer = null;
      }

      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }

      this.isPlaying = false;
      this.isLoading = false;
      this.showM3u8Error = false;
      this.reconnectCount = 0;
      this.m3u8RetryCount = 0;
    },

    // 刷新直播状态
    refreshLiveStatus() {
      this.$emit('refresh');
    }
  }
};
</script>

<style scoped>
/* 播放器容器 */
.player-container {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #000;
  border-radius: 3px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 视频播放器样式 */
.video-js-container,
.flv-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

#videoPlayer,
#videoElement {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  background: #000;
}

/* 自定义播放按钮覆盖层 */
.custom-play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10;
  cursor: pointer;
}

.play-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  transition: transform 0.3s ease;
}

.play-button:hover {
  transform: scale(1.1);
}

.play-icon {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  position: relative;
  margin-bottom: 15px;
}

.play-icon::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 55%;
  transform: translate(-50%, -50%);
  border-width: 15px 0 15px 25px;
  border-style: solid;
  border-color: transparent transparent transparent #333;
}

.play-text {
  color: #fff;
  font-size: 18px;
  font-weight: 500;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
}

/* M3U8错误覆盖层 */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: 20;
  color: #fff;
  text-align: center;
}

.error-content {
  padding: 30px;
  max-width: 80%;
}

.error-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 15px;
  color: #ff6b6b;
}

.error-message {
  font-size: 16px;
  margin-bottom: 25px;
  color: #ddd;
  line-height: 1.5;
}

.retry-button {
  padding: 10px 25px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.retry-button:hover {
  background: #3a80d2;
}

/* 加载中提示 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  z-index: 15;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
}

/* video.js样式穿透 */
::v-deep .video-js {
  width: 100% !important;
  height: 100% !important;
  background-color: #000 !important;
}

::v-deep .vjs-big-play-button {
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  font-size: 3em !important;
  width: 1.5em !important;
  height: 1.5em !important;
  line-height: 1.5em !important;
  border-radius: 50% !important;
}

@media (max-width: 768px) {
  .play-icon {
    width: 60px;
    height: 60px;
  }

  .play-icon::after {
    border-width: 12px 0 12px 20px;
  }

  .play-text {
    font-size: 16px;
  }
}
</style>