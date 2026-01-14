<!-- src/components/login/login.vue -->
<template>
  <Modal v-model="showModal" title="登录" width="400" :mask-closable="false" :closable="true"
    class-name="phone-login-modal" @on-visible-change="handleVisibleChange">
    <div class="phone-login-content">
      <div class="login-header">
        <div class="login-title">手机号登录</div>
        <div class="login-subtitle">输入手机号获取验证码登录</div>
      </div>

      <div class="login-body">
        <Form ref="loginForm" :model="formData" :rules="formRules" label-position="top">
          <FormItem prop="phone" label="手机号码">
            <Input v-model="formData.phone" placeholder="请输入手机号码" size="large" clearable :maxlength="11"
              @keyup.enter="handleLogin">
            <!-- <Select slot="prepend" v-model="formData.countryCode" style="width: 80px">
              <Option value="+86">+86</Option>
            </Select> -->
            </Input>
          </FormItem>

          <FormItem prop="code" label="验证码">
            <div class="sms-code-input">
              <Input v-model="formData.code" placeholder="请输入验证码" size="large" clearable :maxlength="6"
                @keyup.enter="handleLogin" />
              <Button :disabled="smsCountdown > 0 || sendingSms" @click="sendSmsCode" type="primary" size="large"
                class="sms-btn">
                {{ smsBtnText }}
              </Button>
            </div>
          </FormItem>
        </Form>
      </div>

      <div class="login-footer">
        <div class="agreement">
          <Checkbox v-model="agreed">
            我已阅读并同意
            <a href="javascript:void(0)" @click="showAgreement">《用户协议》</a>
            和
            <a href="javascript:void(0)" @click="showPrivacy">《隐私政策》</a>
          </Checkbox>
        </div>

        <Button type="primary" size="large" long :loading="submitting" :disabled="!agreed" @click="handleLogin"
          class="login-btn">
          登录
        </Button>
      </div>
    </div>
  </Modal>
</template>

<script>
export default {
  name: 'PhoneLoginModal',
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      showModal: this.value,
      formData: {
        phone: '',
        // countryCode: '+86',
        code: ''
      },
      formRules: {
        phone: [
          { required: true, message: '请输入手机号码', trigger: 'blur' },
          { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }
        ],
        code: [
          { required: true, message: '请输入验证码', trigger: 'blur' },
          // { pattern: /^\d{6}$/, message: '验证码为6位数字', trigger: 'blur' }
        ]
      },
      smsCountdown: 0,
      sendingSms: false,
      submitting: false,
      agreed: false
    };
  },

  computed: {
    smsBtnText() {
      if (this.smsCountdown > 0) {
        return `${this.smsCountdown}秒后重试`;
      }
      return this.sendingSms ? '发送中...' : '获取验证码';
    }
  },

  watch: {
    value(newVal) {
      this.showModal = newVal;
      if (newVal) {
        this.resetForm();
      }
    },

    showModal(newVal) {
      this.$emit('input', newVal);
    }
  },

  mounted() {
    // 检查本地是否有记住的手机号
    const savedPhone = localStorage.getItem('remembered_phone');
    if (savedPhone) {
      this.formData.phone = savedPhone;
    }
  },

  methods: {
    // 发送短信验证码
    async sendSmsCode() {
      const phone = this.formData.phone;

      // 验证手机号
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        this.$Message.error('请输入正确的手机号码');
        return;
      }

      this.sendingSms = true;
      try {
        const res = await this.$api.sendCode({ phone:phone });

        if (res.code === 200) {
          this.$Message.success('验证码已发送');
          this.startCountdown();
        } else {
          this.$Message.error(res.message || '发送失败');
        }
      } catch (error) {
        console.error('发送验证码失败:', error);
        this.$Message.error('发送失败，请重试');
      } finally {
        this.sendingSms = false;
      }
    },

    // 开始倒计时
    startCountdown() {
      this.smsCountdown = 60;
      const timer = setInterval(() => {
        this.smsCountdown--;
        if (this.smsCountdown <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    },

    // 处理登录
    async handleLogin() {
      // 验证表单
      const valid = await this.$refs.loginForm.validate();
      if (!valid) return;

      if (!this.agreed) {
        this.$Message.warning('请阅读并同意用户协议和隐私政策');
        return;
      }

      this.submitting = true;

      try {
        // 调用 Vuex 的登录 action
        const result = await this.$store.dispatch('login', {
          phone: this.formData.phone,
          code: this.formData.code
        });

        if (result.success) {
          // 登录成功
          this.$Message.success('登录成功');

          // 记住手机号
          localStorage.setItem('remembered_phone', this.formData.phone);

          // 关闭弹框
          this.showModal = false;

          // 触发登录成功事件
          this.$emit('login-success', result.data);

          // 重置表单
          this.resetForm();
        } else {
          this.$Message.error(result.message || '登录失败');
        }
      } catch (error) {
        console.error('登录失败:', error);
        this.$Message.error('登录失败，请重试');
      } finally {
        this.submitting = false;
      }
    },

    // 重置表单
    resetForm() {
      this.formData.code = '';
      this.smsCountdown = 0;
      this.agreed = false;

      if (this.$refs.loginForm) {
        this.$refs.loginForm.resetFields();
      }
    },

    // 显示用户协议
    showAgreement() {
      window.open('/agreement', '_blank');
    },

    // 显示隐私政策
    showPrivacy() {
      window.open('/privacy', '_blank');
    },

    // 处理弹框显示/隐藏
    handleVisibleChange(visible) {
      if (!visible) {
        this.resetForm();
      }
    }
  }
};
</script>

<style scoped>
.phone-login-content {
  padding: 0;
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.login-subtitle {
  font-size: 14px;
  color: #666;
}

.login-body {
  margin-bottom: 24px;
}

.sms-code-input {
  display: flex;
  gap: 10px;
}

.sms-btn {
  width: 120px;
  flex-shrink: 0;
}

.login-footer {
  margin-top: 20px;
}

.agreement {
  margin-bottom: 20px;
  font-size: 12px;
  color: #666;
}

.agreement a {
  color: #1890ff;
}

.agreement a:hover {
  text-decoration: underline;
}

.login-btn {
  height: 40px;
  font-size: 16px;
}
</style>