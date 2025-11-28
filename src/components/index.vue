<template>
  <div class="player-page">
    <!-- 播放容器（限制最大宽度+居中） -->
    <div class="player-container">
      <!-- M3U8播放器容器（video.js） -->
      <div v-if="isM3u8" class="video-js-container">
        <video id="videoPlayer" class="video-js vjs-default-skin" controls playsinline autoplay>
          <source :src="proxyUrl" type="application/x-mpegURL" />
        </video>
      </div>

      <!-- FLV播放器容器（flv.js） -->
      <div v-if="isFlv" class="flv-container">
        <video id="videoElement" crossOrigin="anonymous" controls autoplay muted></video>
      </div>

      <!-- 未选择格式提示 -->
      <div v-if="!isM3u8 && !isFlv" class="empty-tip">
        请输入有效的FLV/M3U8直播地址并点击播放
      </div>
    </div>
    <!-- 播放源输入区域（与播放器宽度对齐） -->
    <div class="input-area">
      <input v-model="streamUrl" placeholder="请输入FLV/M3U8直播地址" class="url-input" />
      <button @click="switchStream" class="play-btn">切换直播源</button>
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
      isM3u8: false,
      isFlv: false,
      vjsPlayer: null,
      flvPlayer: null,
      timerId: null,
      heartbeatTimer: null,
      reconnectCount: 0,
      maxReconnect: 5,
    };
  },
  methods: {
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
      if (url.includes(".m3u8")) return "m3u8";
      if (url.includes(".flv")) return "flv";
      return null;
    },

    // 安全播放：过滤特定错误
    safePlay(videoElem, playerType) {
      if (!videoElem) return;
      videoElem.play().catch(err => {
        const ignoreErrors = [
          "The play() request was interrupted",
          "video-only background media was paused"
        ];
        const isIgnore = ignoreErrors.some(msg => err.message.includes(msg));
        if (!isIgnore) {
          console.error(`${playerType}播放错误：`, err);
          if (playerType === "FLV") this.tryReconnectFlv();
        }
      });
    },

    // 销毁所有播放器
    destroyAllPlayers() {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
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
      if (this.timerId) clearInterval(this.timerId);
      this.reconnectCount = 0;
    },

    // M3U8直播初始化
    initM3u8Player() {
      this.isM3u8 = true;
      this.isFlv = false;
      this.$nextTick(() => {
        const options = {
          aspectRatio: '16:9',
          notSupportedMessage: '此M3U8直播暂无法播放',
          autoplay: true,
          muted: true,
          preload: "auto",
          controls: true,
        };
        this.vjsPlayer = videojs("videoPlayer", options);
        const videoElem = this.vjsPlayer.el().querySelector("video");

        this.vjsPlayer.on('error', () => {
          setTimeout(() => {
            if (this.vjsPlayer && !this.vjsPlayer.paused()) return;
            this.vjsPlayer.load();
            this.safePlay(videoElem, "M3U8");
          }, 2000);
        });

        this.vjsPlayer.on('stalled', () => {
          if (this.vjsPlayer) this.vjsPlayer.load();
        });

        this.heartbeatTimer = setInterval(() => {
          if (this.vjsPlayer && this.vjsPlayer.paused() && !this.vjsPlayer.error()) {
            this.safePlay(videoElem, "M3U8");
          }
        }, 5000);

        this.safePlay(videoElem, "M3U8");
      });
    },

    // FLV直播初始化
    initFlvPlayer() {
      this.isFlv = true;
      this.isM3u8 = false;
      if (this.reconnectCount >= this.maxReconnect) {
        alert('FLV直播多次重连失败，请检查推流状态');
        this.destroyAllPlayers();
        this.isFlv = false;
        return;
      }
      this.reconnectCount++;

      this.$nextTick(() => {
        if (!flvjs.isSupported()) {
          alert('当前浏览器不支持FLV直播');
          this.destroyAllPlayers();
          this.isFlv = false;
          return;
        }

        const videoElement = document.getElementById('videoElement');
        this.flvPlayer = flvjs.createPlayer({
          type: 'flv',
          isLive: true,
          hasAudio: true,
          url: this.proxyUrl,
          enableWorker: false,
          stashInitialSize: 32 * 1024,
          stashInitialTime: 0.2,
          seekType: "range",
          lazyLoad: false,
          lazyLoadMaxDuration: 0.2,
          deferLoadAfterSourceOpen: false,
        }, {
          cors: true,
          enableStashBuffer: false,
          autoCleanupSourceBuffer: true,
        });

        this.flvPlayer.attachMediaElement(videoElement);
        this.flvPlayer.load();
        this.safePlay(videoElement, "FLV");

        this.timerId = setInterval(() => {
          if (videoElement.buffered.length > 0) {
            const end = videoElement.buffered.end(0);
            const current = videoElement.currentTime;
            const diff = end - current;
            if (diff > 4) {
              videoElement.currentTime = end - 1.5;
            }
          }
        }, 1000);

        this.flvPlayer.on(flvjs.Events.NETWORK_RECONNECTED, () => {
          this.safePlay(videoElement, "FLV");
        });

        this.flvPlayer.on(flvjs.Events.ERROR, (err, errdet) => {
          const ignoreErrors = ["The play() request was interrupted"];
          if (!ignoreErrors.some(msg => errdet?.includes(msg))) {
            console.error('FLV直播错误：', err, errdet);
            setTimeout(() => this.tryReconnectFlv(), 3000);
          }
        });

        this.heartbeatTimer = setInterval(() => {
          if (videoElement.paused && this.flvPlayer) {
            this.safePlay(videoElement, "FLV");
          }
        }, 5000);
      });
    },

    // FLV重试连接
    tryReconnectFlv() {
      if (this.reconnectCount >= this.maxReconnect) return;
      if (this.flvPlayer) {
        this.flvPlayer.destroy();
        this.flvPlayer = null;
      }
      this.initFlvPlayer();
    },

    // 切换直播源
    switchStream() {
      if (!this.streamUrl.trim()) {
        alert('请输入有效的直播地址');
        return;
      }

      this.destroyAllPlayers();
      this.proxyUrl = this.getProxyUrl(this.streamUrl.trim());
      const type = this.detectStreamType(this.streamUrl);
      switch (type) {
        case "m3u8":
          this.initM3u8Player();
          break;
        case "flv":
          this.initFlvPlayer();
          break;
        default:
          alert('仅支持FLV/M3U8格式的直播地址');
      }
    },
  },
  beforeDestroy() {
    this.destroyAllPlayers();
  },
};
</script>

<style scoped>
/* 页面容器：控制整体宽度+居中 */
.player-page {
  padding: 20px 10px;
  max-width: 1200px; /* 与播放器最大宽度一致 */
  margin: 0 auto;
}

/* 播放器容器：限制最大宽度+16:9比例+居中 */
.player-container {
  position: relative;
  width: 100%;
  max-width: 1200px; /* 电脑端最大宽度（可根据需求调整） */
  padding-top: 56.25%; /* 保持16:9比例 */
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 auto 15px; /* 底部间距+居中 */
}

/* 播放器子容器：占满父容器 */
.video-js-container, .flv-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 视频元素：填满容器 */
#videoPlayer, #videoElement {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
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
  color: #999;
  font-size: 16px;
}

/* 输入区域：与播放器宽度对齐+紧凑布局 */
.input-area {
  display: flex;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 输入框样式 */
.url-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

/* 按钮样式 */
.play-btn {
  padding: 0 20px;
  height: 42px;
  line-height: 42px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.play-btn:hover {
  background: #0056b3;
}

/* video.js样式穿透 */
::v-deep .video-js {
  width: 100% !important;
  height: 100% !important;
}

::v-deep .vjs-big-play-button {
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
}
</style>