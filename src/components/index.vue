<template>
  <div class="live-container">
    <!-- 左侧直播区域 -->
    <div class="live-left">
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
        <div v-if="liveStatus === '0'" class="cover-container">
          <img :src="coverImageUrl" alt="直播封面" class="cover-image" v-if="coverImageUrl" />
          <div class="cover-placeholder" v-else>
            <div class="placeholder-icon">📺</div>
            <div class="placeholder-text">直播封面</div>
          </div>

          <!-- 直播未开始提示 - 现在只显示倒计时 -->
          <div v-if="liveStatus === '0' && startTime" class="live-status-info countdown-overlay">
            <!-- 倒计时区域 -->
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
          </div>
        </div>

        <!-- 加载中提示 -->
        <div v-if="isLoading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载视频流...</div>
        </div>
      </div>

      <!-- 直播标题和状态 -->
      <div class="live-info">
        <div class="live-meta">
          <div class="live-time">{{ liveShowName }}</div>
          <div class="countdown-header">
            <Icon type="md-clock" size="20" color="#ccc" />
            <span class="countdown-label">{{ startTime }}</span>
          </div>
          <!-- 移除这里的倒计时 -->
        </div>

        <!-- 直播介绍 -->
        <h3 class="section-title" style="font-size: 14px;">直播介绍</h3>
        <div class="intro-content">
          <p>本次会议将围绕医院感染质量管理与控制展开深入讨论，分享最新研究成果和实践经验。会议采用线上线下相结合的方式，方便更多医疗工作者参与。欢迎各位医疗同仁积极参与交流！</p>
        </div>
      </div>
    </div>

    <!-- 右侧信息区域 -->
    <div class="live-right">
      <!-- 互动区域 -->
      <div class="interaction-section">
        <h3 class="section-title">互动</h3>
        <div class="comment-area">
          <div class="comment-empty">
            <div class="empty-icon">💬</div>
            <div class="empty-text">还没有评论</div>
          </div>
        </div>
        <div class="comment-input-area">
          <input type="text" placeholder="说点什么~" class="comment-input" v-model="commentText"
            @keyup.enter="submitComment" />
          <button class="comment-submit" @click="submitComment">发送</button>
        </div>
      </div>
    </div>

    <!-- 报名表单悬浮按钮 -->
    <div class="registration-fab" @click="showRegistrationModal = true">
      <div class="fab-icon">📝</div>
      <div class="fab-text">报名表</div>
    </div>

    <!-- 报名表单弹框 -->
    <Modal v-model="showRegistrationModal" :title="liveShowName" width="500" :mask-closable="false"
      @on-ok="submitRegistration" @on-cancel="cancelRegistration" class-name="registration-modal">
      <Form ref="registrationForm" :model="registrationData" :rules="registrationRules" label-position="top">
        <div style="font-size: 15px;font-weight: 600;margin-bottom: 10px;">请如实填写以下信息</div>

        <!-- 根据 entryFromData 动态生成表单项 -->
        <Form-item v-for="field in entryFromData" :key="field.type + field.name" :label="field.name" :prop="field.type" :required="field.required">
          <!-- 性别选择框 -->
          <Select v-if="field.type === 'gender'" v-model="registrationData[field.type]" placeholder="请选择性别" clearable>
            <Option value="male">男</Option>
            <Option value="female">女</Option>
          </Select>

          <!-- 出生年月选择器 -->
          <DatePicker v-else-if="field.type === 'birthday'" type="date" v-model="registrationData[field.type]"
            :placeholder="field.placeholder" style="width: 100%" clearable />

          <!-- 其他字段使用输入框 -->
          <Input v-else v-model="registrationData[field.type]" :placeholder="field.placeholder" clearable />
        </Form-item>
      </Form>
      <div slot="footer">
        <Button @click="cancelRegistration">取消</Button>
        <Button type="primary" @click="submitRegistration" :loading="registrationLoading">提交</Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import videojs from "video.js";
import "video.js/dist/video-js.css";
import flvjs from 'flv.js'
import { config } from '../config'

export default {
  name: "LivePlayerPage",
  data() {
    return {
      // 直播数据
      liveShowName: '',
      startTime: '',
      liveStatus: '0', // '0': 未开始, '1': 直播中
      coverImageUrl: '',

      // 播放器相关
      streamUrl: "",
      proxyUrl: "",
      id: '',
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
      streamType: null,

      // 倒计时相关
      countdown: {
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00'
      },
      countdownTimer: null,
      hasRefreshedAfterCountdown: false,
      isRefreshing: false,

      // 互动
      commentText: '',

      // 报名表单相关
      showRegistrationModal: false,
      registrationLoading: false,
      entryFromData: [], // 从接口获取的报名表配置
      registrationData: {}, // 动态表单数据
      registrationRules: {} // 动态表单验证规则
    };
  },

  mounted() {
    console.log('页面加载，初始化参数');
    this.initFromUrlParams();

    // 微信浏览器授权逻辑（保留原有逻辑）
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    console.log('code', urlParams, code)

    if (this.isWechatBrowser()) {
      if (code) {
        this.handleWechatCallback();
      } else {
        this.wechatAuth();
      }
    }
  },

  beforeDestroy() {
    console.log('组件销毁，清理资源');
    this.destroyAllPlayers();
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  methods: {
    // 检测是否是微信浏览器
    isWechatBrowser() {
      const userAgent = navigator.userAgent.toLowerCase();
      return userAgent.includes('micromessenger');
    },

    // 微信授权登录主方法
    wechatAuth() {
      const appid = 'wx9e05ef34b2bc54b6';
      const redirectUri = encodeURIComponent(window.location.href);
      const scope = 'snsapi_userinfo';
      const state = Math.random().toString(36).substr(2, 10);

      localStorage.setItem('wechat_auth_state', state);
      const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
      window.location.href = authUrl;
    },

    // 处理微信授权回调
    handleWechatCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const storedState = localStorage.getItem('wechat_auth_state');
      console.log('??', code, state, storedState)

      if (state && state === storedState) {
        localStorage.removeItem('wechat_auth_state');
        if (code) {
          // 调用后端接口逻辑
        }
      }
    },

    // 从URL参数初始化
    async initFromUrlParams() {
      console.log('=== 开始解析URL参数 ===');

      const urlParams = new URLSearchParams(window.location.search);
      this.id = urlParams.get('id');
      this.streamType = urlParams.get('type');

      if (!this.id) {
        this.$Message.error('未找到直播ID参数');
        return;
      }

      this.isLoading = true;

      try {
        await this.getStreamDataById(this.id);
      } catch (error) {
        console.error('获取流地址信息失败:', error);
        this.isLoading = false;
        this.$Message.error('获取直播信息失败，请检查网络连接');
      }
    },

    // 根据ID获取流地址信息
    async getStreamDataById(id) {
      console.log('调用接口获取流地址信息，ID:', id);

      try {
        const res = await this.$api.getById({ id: id });

        if (res.code === 200) {
          const data = res.data;
          this.liveShowName = data.liveShowName;
          this.startTime = data.startTime;
          this.liveStatus = data.liveStatus;

          // 处理报名表数据
          this.processEntryFromData(data.entryFromData);

          // 重置刷新标志
          this.hasRefreshedAfterCountdown = false;

          if (data.liveCover) {
            this.coverImageUrl = `${config.playerBaseUrl}/api/sysFile/image/${data.liveCover}`;
          }

          // 启动倒计时
          this.startCountdown();

          // 只有当直播状态为1时，才初始化播放器
          if (this.liveStatus === '1') {
            await this.parseStreamData(data);
          } else {
            this.isLoading = false;
          }
        }
      } catch (error) {
        this.isLoading = false;
        throw error;
      }
    },

    // 处理报名表数据
    processEntryFromData(entryFromData) {
      if (!entryFromData || !Array.isArray(entryFromData)) {
        this.entryFromData = [];
        this.registrationData = {};
        this.registrationRules = {};
        return;
      }

      this.entryFromData = entryFromData;
      this.registrationData = {};
      this.registrationRules = {};
      // 初始化表单数据和验证规则
      entryFromData.forEach(field => {
        // 初始化字段数据
        this.registrationData[field.type] = '';

        // 初始化验证规则
        this.registrationRules[field.type] = [];

        // 只对必填字段添加必填验证
        if (field.required) {
          this.registrationRules[field.type].push({
            required: true,
            message: `${field.name}不能为空`,
            trigger: field.type === 'gender' ? 'change' : 'blur'
          });
        }

        // 根据字段类型添加格式验证（无论是否必填，只要填写了就验证格式）
        if (field.type === 'phone') {
          this.registrationRules[field.type].push({
            validator: (rule, value, callback) => {
              if (!value) {
                // 如果非必填且为空，直接通过
                if (!field.required) {
                  callback();
                } else {
                  // 必填字段已经在上面验证了，这里不再处理
                  callback();
                }
              } else {
                // 如果有值，验证格式
                const phonePattern = /^1[3-9]\d{9}$/;
                if (!phonePattern.test(value)) {
                  callback(new Error('请输入正确的手机号码'));
                } else {
                  callback();
                }
              }
            },
            trigger: 'blur'
          });
        } else if (field.type === 'idCard') {
          this.registrationRules[field.type].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) {
                  callback();
                } else {
                  callback();
                }
              } else {
                const idCardPattern = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
                if (!idCardPattern.test(value)) {
                  callback(new Error('请输入正确的身份证号'));
                } else {
                  callback();
                }
              }
            },
            trigger: 'blur'
          });
        } else if (field.type === 'email') {
          this.registrationRules[field.type].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) {
                  callback();
                } else {
                  callback();
                }
              } else {
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(value)) {
                  callback(new Error('请输入正确的邮箱地址'));
                } else {
                  callback();
                }
              }
            },
            trigger: 'blur'
          });
        } else if (field.type === 'age') {
          this.registrationRules[field.type].push({
            validator: (rule, value, callback) => {
              if (!value) {
                if (!field.required) {
                  callback();
                } else {
                  callback();
                }
              } else {
                const age = parseInt(value);
                if (isNaN(age) || age < 0 || age > 150) {
                  callback(new Error('请输入有效的年龄(0-150)'));
                } else {
                  callback();
                }
              }
            },
            trigger: 'blur'
          });
        }
      });
      
    },
    
    // 解析流数据
    async parseStreamData(data) {
      console.log('开始解析流数据，指定格式:', this.streamType);

      let streamUrl = '';

      if (this.streamType) {
        if (this.streamType.toLowerCase() === 'flv' && data.pullFlvUrl) {
          streamUrl = data.pullFlvUrl;
          this.detectedFormat = 'flv';
        } else if (this.streamType.toLowerCase() === 'm3u8' && data.pullM3u8Url) {
          streamUrl = data.pullM3u8Url;
          this.detectedFormat = 'm3u8';
        }
      } else {
        if (data.pullFlvUrl) {
          streamUrl = data.pullFlvUrl;
          this.detectedFormat = 'flv';
        } else if (data.pullM3u8Url) {
          streamUrl = data.pullM3u8Url;
          this.detectedFormat = 'm3u8';
        }
      }

      if (!streamUrl) {
        console.error('未找到有效的流地址');
        this.isLoading = false;
        this.$Message.error('未找到有效的流地址');
        return;
      }

      this.streamUrl = streamUrl;
      this.proxyUrl = this.getProxyUrl(streamUrl);

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

    // 处理代理地址
    getProxyUrl(url) {
      return url || '';
    },

    // 初始化M3U8播放器容器
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
            console.log('M3U8播放开始');
            this.isPlaying = true;
            this.isLoading = false;
            this.showM3u8Error = false;
          });

          this.vjsPlayer.on('pause', () => {
            console.log('M3U8播放暂停');
            this.isPlaying = false;
          });

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

          this.vjsPlayer.ready(() => {
            console.log('M3U8播放器容器准备就绪，等待用户点击播放');
          });

        } catch (error) {
          console.error('M3U8播放器容器初始化失败:', error);
        }
      });
    },

    // 播放M3U8
    playM3u8() {
      console.log('用户点击播放M3U8');

      if (!this.vjsPlayer) {
        console.error('M3U8播放器未初始化');
        return;
      }

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
      console.log('M3U8重试');
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
      console.log('用户点击播放FLV');

      if (this.isPlaying && this.flvPlayer) {
        return;
      }

      if (this.flvPlayer) {
        const videoElement = document.getElementById('videoElement');
        if (videoElement && videoElement.paused) {
          videoElement.play().catch(err => {
            console.error('恢复播放失败:', err);
          });
        }
        return;
      }

      this.initFlvPlayer();
    },

    // 初始化FLV播放器
    initFlvPlayer() {
      console.log('初始化FLV播放器');

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
            console.log('FLV加载完成');
            this.isLoading = false;
          });

          videoElement.addEventListener('play', () => {
            console.log('FLV播放开始');
            this.isPlaying = true;
            this.isLoading = false;
          });

          videoElement.addEventListener('pause', () => {
            console.log('FLV播放暂停');
            this.isPlaying = false;
          });

          this.flvPlayer.on(flvjs.Events.ERROR, (err, errdet) => {
            console.error('FLV直播错误：', err, errdet);
            this.isPlaying = false;
            this.isLoading = false;

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

      if (this.flvPlayer) {
        this.flvPlayer.destroy();
        this.flvPlayer = null;
      }

      this.reconnectCount = 0;
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

    // 倒计时相关方法
    startCountdown() {
      // 若startTime仍为空，直接返回（兜底处理）
      if (!this.startTime) {
        console.warn('开始时间为空，无法启动倒计时');
        return;
      }

      // 清除原有定时器，防止重复创建
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
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

          // 如果已经过了开始时间
          if (now >= start) {
            console.log('开始时间已到达，停止倒计时');
            this.clearCountdown();

            // 只在第一次到达时刷新状态
            if (!this.hasRefreshedAfterCountdown) {
              this.hasRefreshedAfterCountdown = true;
              // 延迟500ms后刷新状态，避免频繁调用
              setTimeout(() => {
                this.refreshLiveStatus();
              }, 500);
            }
            return;
          }

          // 计算并更新倒计时
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

      // 初始化刷新标志
      this.hasRefreshedAfterCountdown = false;

      // 立即执行一次，避免延迟
      updateCountdown();
      // 每秒更新一次
      this.countdownTimer = setInterval(updateCountdown, 1000);
    },

    // 清除倒计时的方法
    clearCountdown() {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.countdown = { days: '00', hours: '00', minutes: '00', seconds: '00' };
    },

    padZero(num) {
      return num.toString().padStart(2, '0');
    },

    // 刷新直播状态
    async refreshLiveStatus() {
      if (!this.id) return;

      // 防止短时间内多次刷新
      if (this.isRefreshing) {
        console.log('正在刷新中，跳过此次请求');
        return;
      }

      try {
        console.log('刷新直播状态...');
        this.isRefreshing = true;

        // 调用接口获取最新状态
        const res = await this.$api.getById({ id: this.id });

        if (res.code === 200) {
          const data = res.data;
          const oldStatus = this.liveStatus;
          const newStatus = data.liveStatus;

          // 更新数据
          this.liveShowName = data.liveShowName;
          this.startTime = data.startTime;
          this.liveStatus = newStatus;

          // 更新报名表数据
          this.processEntryFromData(data.entryFromData);

          if (data.liveCover) {
            this.coverImageUrl = `${config.playerBaseUrl}/api/sysFile/image/${data.liveCover}`;
          }

          // 只有在状态发生变化时才重新启动倒计时
          if (oldStatus !== newStatus) {
            console.log(`直播状态变化: ${oldStatus} -> ${newStatus}`);

            // 如果变成直播中，初始化播放器
            if (newStatus === '1') {
              await this.parseStreamData(data);
            }

            // 重新启动倒计时（如果是未开始状态）
            if (newStatus === '0') {
              this.startCountdown();
            } else {
              this.clearCountdown();
            }
          } else {
            console.log('直播状态未变化，保持当前状态');

            // 如果状态仍然是未开始，且没有倒计时，重新启动倒计时
            if (newStatus === '0' && !this.countdownTimer) {
              this.startCountdown();
            }
          }
        }
      } catch (error) {
        console.error('刷新直播状态失败:', error);

        // 如果刷新失败，但直播状态是未开始，仍然尝试重新启动倒计时
        if (this.liveStatus === '0') {
          // 延迟重试
          setTimeout(() => {
            if (!this.countdownTimer) {
              this.startCountdown();
            }
          }, 3000);
        }
      } finally {
        this.isRefreshing = false;
      }
    },

    // 格式化时间
    formatDateTime(dateTime) {
      if (!dateTime) return '';
      const date = new Date(dateTime);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}月${day}日 ${hours}:${minutes}`;
    },

    formatStartTime(dateTime) {
      if (!dateTime) return '';
      const date = new Date(dateTime);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // 新增时间格式化方法
    formatMonthDay(dateTime) {
      if (!dateTime) return '';
      const date = new Date(dateTime);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    },

    formatHourMinute(dateTime) {
      if (!dateTime) return '';
      const date = new Date(dateTime);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    // 提交评论
    submitComment() {
      if (!this.commentText.trim()) {
        this.$Message.warning('请输入评论内容');
        return;
      }

      console.log('提交评论:', this.commentText);
      // 这里可以调用API提交评论
      this.$Message.success('评论已发送');
      this.commentText = '';
    },

    // 提交报名表单
    submitRegistration() {
      this.$refs.registrationForm.validate((valid) => {
        if (valid) {
          this.registrationLoading = true;

          // 准备提交的数据
          const submitData = {
            liveId: this.id,
            fields: []
          };

          // 根据 entryFromData 构建提交数据
          this.entryFromData.forEach(field => {
            submitData.fields.push({
              type: field.type,
              name: field.name,
              value: this.registrationData[field.type] || ''
            });
          });

          console.log('提交报名信息:', submitData);

          // 调用API提交报名信息
          this.$api.submitRegistration(submitData)
            .then(res => {
              if (res.code === 200) {
                this.$Message.success('报名信息提交成功！');
                this.registrationLoading = false;
                this.showRegistrationModal = false;
                this.resetRegistrationForm();
              } else {
                this.$Message.error(res.message || '提交失败');
                this.registrationLoading = false;
              }
            })
            .catch(err => {
              console.error('提交报名信息失败:', err);
              this.$Message.error('提交失败，请重试');
              this.registrationLoading = false;
            });
        } else {
          this.$Message.error('请填写完整的报名信息');
        }
      });
    },

    // 取消报名
    cancelRegistration() {
      this.showRegistrationModal = false;
      this.resetRegistrationForm();
    },

    // 重置报名表单
    resetRegistrationForm() {
      // 清空所有表单字段
      Object.keys(this.registrationData).forEach(key => {
        this.registrationData[key] = '';
      });

      if (this.$refs.registrationForm) {
        this.$refs.registrationForm.resetFields();
      }
    }
  }
};
</script>

<style scoped>
body {
  box-sizing: border-box;
}

/* 整体布局 */
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
}

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

/* 封面图容器 */
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
.live-status-info.countdown-overlay {
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
}

/* 倒计时显示区域 - 透明样式 */
.countdown-display {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  backdrop-filter: blur(1px);
}

.countdown-header {
  margin-bottom: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.date-icon {
  margin-right: 8px;
  font-size: 16px;
}

.countdown-label {
  font-weight: 500;
  opacity: 0.9;
  margin-left: 5px;
}

/* 倒计时计时器 */
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

/* 直播信息 */
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

/* 右侧区域 */
.live-right {
  display: flex;
  flex-direction: column;
}

.interaction-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: 650px;
  position: sticky;
  top: 20px;
}

/* 评论区样式 */
.comment-area {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 15px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  padding: 10px;
}

.comment-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.empty-text {
  font-size: 14px;
}

.comment-input-area {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.comment-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.comment-input:focus {
  outline: none;
  border-color: #1890ff;
}

.comment-submit {
  padding: 8px 20px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.comment-submit:hover {
  background: #40a9ff;
}

.section-title {
  font-size: 18px;
  color: #333;
  margin: 0 0 15px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

/* 直播介绍 */
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

/* 报名表单悬浮按钮 */
.registration-fab {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: white;
  width: 60px;
  height: 60px;
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
  margin-bottom: 4px;
}

.fab-text {
  font-size: 12px;
  font-weight: 500;
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

/* 自定义弹框样式 - 解决padding问题 */
::v-deep .registration-modal {
  display: flex;
  align-items: center;
  justify-content: center;
}

::v-deep .registration-modal .ivu-modal {
  top: 0;
  margin: 0 auto;
}

::v-deep .registration-modal .ivu-modal-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

::v-deep .registration-modal .ivu-modal-content {
  max-height: 80vh;
  overflow-y: auto;
}
/* 响应式调整 */
@media (max-width: 768px) {
  .live-container {
    flex-direction: column;
    padding: 10px;
  }

  .live-left,
  .live-right {
    width: 100%;
  }

  .live-meta {
    flex-direction: column;
    gap: 10px;
  }

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

  .countdown-header {
    font-size: 13px;
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

  .interaction-section {
    height: 400px;
    position: static;
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

  /* 移动端弹框样式 */
  ::v-deep .registration-modal .ivu-modal {
    width: 90% !important;
    margin: 0 auto;
  }
}

@media (max-width: 480px) {
  .countdown-number {
    font-size: 12px;
    min-width: 22px;
    padding: 2px 4px;
  }

  .countdown-timer {
    gap: 4px;
  }

  .interaction-section {
    height: 350px;
  }

  .registration-fab {
    bottom: 15px;
    right: 15px;
    width: 45px;
    height: 45px;
  }
}
</style>