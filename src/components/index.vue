<template>
  <div class="player-page">
    <!-- 播放容器 -->
    <div class="player-container">
      <!-- M3U8播放器容器 -->
      <div v-if="isM3u8" class="video-js-container">
        <video id="videoPlayer" class="video-js vjs-default-skin" controls playsinline></video>

        <!-- 自定义播放按钮覆盖层（M3U8）- 未初始化时显示 -->
        <div v-if="!isPlaying && !isLoading" class="custom-play-overlay">
          <div class="play-button" @click="playM3u8">
            <div class="play-icon"></div>
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
      <div v-if="isFlv" class="flv-container">
        <video id="videoElement" crossOrigin="anonymous" controls playsinline @click="playFlv"></video>

        <!-- 自定义播放按钮覆盖层（FLV）- 未播放时显示 -->
        <div v-if="!isPlaying && !isLoading" class="custom-play-overlay">
          <div class="play-button" @click="playFlv">
            <div class="play-icon"></div>
          </div>
        </div>
      </div>

      <!-- 等待播放提示（初始状态） -->
      <div v-if="!isM3u8 && !isFlv && streamUrl" class="empty-tip">
        <div class="tip-content">
          <div class="tip-title">准备播放</div>
          <div class="tip-subtitle">正在准备播放器...</div>
          <div class="tip-info">
            <p><strong>流地址：</strong>{{ streamUrl }}</p>
            <p><strong>检测格式：</strong>{{ detectedFormat }}</p>
            <p><strong>状态：</strong>等待用户点击播放</p>
          </div>
        </div>
      </div>

      <!-- 没有流地址提示 -->
      <div v-if="!streamUrl" class="empty-tip">
        <div class="tip-content">
          <div class="tip-title">未找到流地址</div>
          <div class="tip-subtitle">请通过URL参数传入有效的直播地址</div>
          <div class="tip-info">
            <p>支持的参数：</p>
            <p><code>?url=直播地址</code></p>
            <p><code>?m3u8=M3U8地址</code></p>
            <p><code>?flv=FLV地址</code></p>
          </div>
        </div>
      </div>

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
import flvjs from 'flv.js'

export default {
  name: "LivePlayerPage",
  data() {
    return {
      streamUrl: "",
      proxyUrl: "",
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
      timerId: null,
    };
  },

  mounted() {
    console.log('页面加载，初始化参数');
    this.initFromUrlParams();
  },

  methods: {
    // 从URL参数初始化
    initFromUrlParams() {
      console.log('=== 开始解析URL参数 ===');

      // 获取URL参数
      const urlParams = new URLSearchParams(window.location.search);
      const flvParam = urlParams.get('flv');
      const m3u8Param = urlParams.get('m3u8');
      const urlParam = urlParams.get('url');

      // 优先使用特定格式参数，然后是通用参数
      let streamUrl = flvParam || m3u8Param || urlParam;

      if (streamUrl) {
        console.log('原始流地址:', streamUrl);

        // 解码URL参数
        try {
          // 尝试解码（可能被编码多次）
          while (streamUrl.includes('%')) {
            const decoded = decodeURIComponent(streamUrl);
            if (decoded === streamUrl) break;
            streamUrl = decoded;
          }
        } catch (e) {
          console.warn('URL参数解码失败:', e);
        }

        console.log('解码后流地址:', streamUrl);
        this.streamUrl = streamUrl;

        // 处理代理地址
        this.proxyUrl = this.getProxyUrl(streamUrl);
        console.log('代理地址:', this.proxyUrl);

        // 检测流格式并设置对应的播放器类型
        this.detectedFormat = this.detectStreamType(streamUrl);
        console.log('检测到的格式:', this.detectedFormat);

        // 根据检测到的格式设置播放器类型
        if (this.detectedFormat === 'm3u8') {
          this.isM3u8 = true;
          this.isFlv = false;
          // 提前初始化video.js容器，但不要加载视频
          this.$nextTick(() => {
            this.initM3u8PlayerContainer();
          });
        } else if (this.detectedFormat === 'flv') {
          this.isFlv = true;
          this.isM3u8 = false;
          // FLV播放器等待用户点击
        } else {
          console.warn('无法识别的流格式');
        }
      } else {
        console.warn('未找到有效的流地址参数');
      }
    },

    // 处理代理地址
    getProxyUrl(url) {
      if (!url) return "";
      const targetHost = "http://live.hbjcws.com.cn";
      if (url.startsWith(targetHost)) {
        return url.replace(targetHost, "/api-stream");
      }
      if (url.startsWith("/api-stream")) {
        return url;
      }
      return url;
    },

    // 识别流格式
    detectStreamType(url) {
      if (!url) return null;
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes(".m3u8") || lowerUrl.includes("m3u8")) return "m3u8";
      if (lowerUrl.includes(".flv") || lowerUrl.includes("flv")) return "flv";
      return null;
    },

    // 初始化M3U8播放器容器（不加载视频）
    initM3u8PlayerContainer() {
      console.log('初始化M3U8播放器容器');

      if (this.vjsPlayer) {
        this.vjsPlayer.dispose();
        this.vjsPlayer = null;
      }

      this.$nextTick(() => {
        const options = {
          aspectRatio: '16:9',
          notSupportedMessage: '此M3U8直播暂无法播放',
          autoplay: false, // 不自动播放
          muted: false,
          preload: "none", // 不预加载
          controls: true,
          fluid: true,
          liveui: true,
        };

        try {
          // 只初始化video.js播放器，不设置source
          this.vjsPlayer = videojs("videoPlayer", options);

          // 监听播放事件
          this.vjsPlayer.on('play', () => {
            console.log('M3U8播放开始');
            this.isPlaying = true;
            this.isLoading = false;
            this.showM3u8Error = false;
          });

          // 监听暂停事件
          this.vjsPlayer.on('pause', () => {
            console.log('M3U8播放暂停');
            this.isPlaying = false;
          });

          // 监听错误事件
          this.vjsPlayer.on('error', (error) => {
            console.error('M3U8播放错误:', error);
            this.isPlaying = false;
            this.isLoading = false;

            const errorCode = this.vjsPlayer.error()?.code || 0;
            let errorMessage = '播放失败';

            switch (errorCode) {
              case 1:
                errorMessage = '视频加载中断';
                break;
              case 2:
                errorMessage = '网络错误';
                break;
              case 3:
                errorMessage = '解码错误';
                break;
              case 4:
                errorMessage = '视频格式不支持或服务器错误';
                break;
              case 5:
                errorMessage = '视频编码错误';
                break;
              default:
                errorMessage = '播放错误';
            }

            this.m3u8ErrorMessage = errorMessage;
            this.showM3u8Error = true;
          });

          // 播放器准备好
          this.vjsPlayer.ready(() => {
            console.log('M3U8播放器容器准备就绪，等待用户点击播放');
            // 不自动加载视频，等待用户点击
          });

        } catch (error) {
          console.error('M3U8播放器容器初始化失败:', error);
        }
      });
    },

    // 播放M3U8（用户点击时调用）
    playM3u8() {
      console.log('用户点击播放M3U8');

      if (!this.vjsPlayer) {
        console.error('M3U8播放器未初始化');
        return;
      }

      this.isLoading = true;

      // 设置视频源并加载
      this.vjsPlayer.src({
        src: this.proxyUrl,
        type: 'application/x-mpegURL'
      });

      // 加载并播放
      this.vjsPlayer.load();
      this.vjsPlayer.play().catch(err => {
        console.error('M3U8播放失败:', err);
        this.isLoading = false;

        // 显示错误信息
        this.m3u8ErrorMessage = '播放失败，请重试';
        this.showM3u8Error = true;
      });
    },

    // M3U8重试
    retryM3u8() {
      console.log('M3U8重试');
      this.m3u8RetryCount++;

      if (this.m3u8RetryCount > this.maxM3u8Retry) {
        alert('多次重试失败，请检查视频地址是否正确');
        return;
      }

      this.showM3u8Error = false;
      this.isLoading = true;

      // 重新加载视频
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

    // 播放FLV（用户点击时调用）
    playFlv() {
      console.log('用户点击播放FLV');

      // 如果已经初始化并播放中，不重复操作
      if (this.isPlaying && this.flvPlayer) {
        return;
      }

      // 如果已经初始化但暂停了，恢复播放
      if (this.flvPlayer) {
        const videoElement = document.getElementById('videoElement');
        if (videoElement && videoElement.paused) {
          videoElement.play().catch(err => {
            console.error('恢复播放失败:', err);
          });
        }
        return;
      }

      // 初始化FLV播放器
      this.initFlvPlayer();
    },

    // 初始化FLV播放器
    initFlvPlayer() {
      console.log('初始化FLV播放器');

      // 检查浏览器支持
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
          // 创建FLV播放器
          this.flvPlayer = flvjs.createPlayer({
            type: 'flv',
            isLive: true,
            hasAudio: true,
            url: this.proxyUrl,
            enableWorker: false,
          }, {
            cors: true,
            enableStashBuffer: false,
          });

          // 关联媒体元素
          this.flvPlayer.attachMediaElement(videoElement);

          // 加载视频流
          this.flvPlayer.load();

          // 监听加载完成事件
          this.flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
            console.log('FLV加载完成');
            this.isLoading = false;
          });

          // 监听播放事件
          videoElement.addEventListener('play', () => {
            console.log('FLV播放开始');
            this.isPlaying = true;
            this.isLoading = false;
          });

          // 监听暂停事件
          videoElement.addEventListener('pause', () => {
            console.log('FLV播放暂停');
            this.isPlaying = false;
          });

          // 监听错误事件
          this.flvPlayer.on(flvjs.Events.ERROR, (err, errdet) => {
            console.error('FLV直播错误：', err, errdet);
            this.isPlaying = false;
            this.isLoading = false;

            // 错误重连
            if (this.reconnectCount < this.maxReconnect) {
              this.reconnectCount++;
              console.log(`FLV重连尝试: ${this.reconnectCount}`);

              setTimeout(() => {
                this.tryReconnectFlv();
              }, 3000);
            } else {
              alert('FLV直播连接失败，请检查网络和流地址');
            }
          });

          // 自动播放
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
      console.log('FLV重连');

      // 销毁当前播放器
      if (this.flvPlayer) {
        this.flvPlayer.destroy();
        this.flvPlayer = null;
      }

      // 重置重连计数
      this.reconnectCount = 0;

      // 重新初始化
      this.initFlvPlayer();
    },

    // 销毁所有播放器
    destroyAllPlayers() {
      console.log('销毁播放器');

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
  },

  beforeDestroy() {
    console.log('组件销毁，清理资源');
    this.destroyAllPlayers();
  },
};
</script>

<style scoped>
/* 页面容器 */
.player-page {
  padding: 20px 10px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* 播放器容器 */
.player-container {
  position: relative;
  width: 100%;
  max-width: 1200px;
  padding-top: 56.25%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

/* 播放器子容器 */
.video-js-container,
.flv-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 视频元素 */
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

/* 空提示文本 */
.empty-tip {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  background: rgba(0, 0, 0, 0.9);
  z-index: 5;
}

.tip-content {
  text-align: center;
  padding: 30px;
  max-width: 80%;
}

.tip-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 15px;
  color: #fff;
}

.tip-subtitle {
  font-size: 18px;
  margin-bottom: 30px;
  color: #ccc;
}

.tip-info {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 8px;
  text-align: left;
  font-size: 14px;
  color: #aaa;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 20px;
}

.tip-info p {
  margin: 10px 0;
  word-break: break-all;
}

.tip-info strong {
  color: #fff;
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

/* 响应式调整 */
@media (max-width: 768px) {
  .player-page {
    padding: 10px;
  }

  .player-container {
    border-radius: 4px;
  }

  .tip-title {
    font-size: 22px;
  }

  .tip-subtitle {
    font-size: 16px;
  }

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