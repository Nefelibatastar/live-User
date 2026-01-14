<template>
  <Modal 
    :value="visible"
    :title="modalTitle"
    width="500"
    :mask-closable="false"
    @on-ok="handleSubmit"
    @on-cancel="handleCancel"
    @on-visible-change="handleVisibleChange"
    class-name="registration-modal"
  >
    <div class="registration-modal-content">
      <!-- 标题区域 -->
      <div class="modal-header-section">
        <Alert v-if="isRegistered" type="info" show-icon>
          您已报名，可修改信息
        </Alert>

        <div class="registration-title">
          {{ modalTitle }}
        </div>
      </div>

      <!-- 表单内容区域 -->
      <div class="modal-form-section">
        <Form ref="registrationForm" :model="registrationData" :rules="registrationRules" label-position="top">
          <!-- 动态表单项 -->
          <Form-item v-for="(field, index) in entryFromData" 
            :key="field.uniqueKey || field.type + index"
            :label="(index + 1).toString().padStart(2, '0') + ' ' + field.name" 
            :prop="field.uniqueKey">
            
            <!-- 性别选择框 -->
            <Select v-if="field.type === 'gender'" v-model="registrationData[field.uniqueKey]" 
              placeholder="请选择性别" clearable>
              <Option value="male">男</Option>
              <Option value="female">女</Option>
            </Select>

            <!-- 出生年月选择器 -->
            <DatePicker v-else-if="field.type === 'birthday'" type="date"
              :value="registrationData[field.uniqueKey] ? new Date(registrationData[field.uniqueKey]) : null"
              @on-change="(date) => handleDateChange(date, field.uniqueKey)"
              placeholder="请选择出生日期" style="width: 100%" clearable format="yyyy-MM-dd" />

            <!-- 文本输入框 -->
            <Input v-else v-model="registrationData[field.uniqueKey]"
              :placeholder="field.placeholder || '请输入' + field.name" clearable />
          </Form-item>
        </Form>
      </div>
    </div>
  </Modal>
</template>

<script>
export default {
  name: 'RegistrationForm',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    liveShowName: {
      type: String,
      default: ''
    },
    entryFromData: {
      type: Array,
      default: () => []
    },
    isRegistered: {
      type: Boolean,
      default: false
    },
    liveId: {
      type: String,
      required: true
    },
    userId: {
      type: String,
      default: ''
    },
    entryFromId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      registrationData: {},
      registrationRules: {},
      registrationLoading: false,
      registrationId: null,
      formInitialized: false
    };
  },
  computed: {
    modalTitle() {
      return this.isRegistered ? '修改报名信息' : this.liveShowName + ' - 报名表';
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.initForm();
      }
    },
    entryFromData: {
      handler(newData) {
        if (newData && newData.length > 0) {
          this.buildForm(newData);
        }
      },
      immediate: true,
      deep: true
    }
  },
  methods: {
    // 处理弹框可见性变化
    handleVisibleChange(visible) {
      this.$emit('update:visible', visible);
    },
    
    // 初始化表单
    initForm() {
      this.loadLocalData();
      this.$nextTick(() => {
        if (this.$refs.registrationForm) {
          this.$refs.registrationForm.resetFields();
        }
      });
    },
    
    // 构建表单结构
    buildForm(fields) {
      this.registrationData = {};
      this.registrationRules = {};
      
      const typeCount = {};
      
      fields.forEach((field, index) => {
        if (!typeCount[field.type]) {
          typeCount[field.type] = 0;
        }
        typeCount[field.type]++;
        
        const uniqueKey = `${field.type}_${index}`;
        field.uniqueKey = uniqueKey;
        
        // 初始化数据
        this.$set(this.registrationData, uniqueKey, '');
        
        // 构建验证规则
        const rules = [];
        
        if (field.required) {
          rules.push({
            required: true,
            message: `${field.name}不能为空`,
            trigger: []
          });
        }
        
        // 字段类型验证
        if (field.type === 'phone') {
          rules.push({
            validator: (rule, value, callback) => {
              if (!value && !field.required) {
                callback();
                return;
              }
              const phonePattern = /^1[3-9]\d{9}$/;
              if (value && !phonePattern.test(value)) {
                callback(new Error('请输入正确的手机号码'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        } else if (field.type === 'idCard') {
          rules.push({
            validator: (rule, value, callback) => {
              if (!value && !field.required) {
                callback();
                return;
              }
              const idCardPattern = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
              if (value && !idCardPattern.test(value)) {
                callback(new Error('请输入正确的身份证号'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        } else if (field.type === 'email') {
          rules.push({
            validator: (rule, value, callback) => {
              if (!value && !field.required) {
                callback();
                return;
              }
              const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (value && !emailPattern.test(value)) {
                callback(new Error('请输入正确的邮箱地址'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        } else if (field.type === 'age') {
          rules.push({
            validator: (rule, value, callback) => {
              if (!value && !field.required) {
                callback();
                return;
              }
              const age = parseInt(value);
              if (value && (isNaN(age) || age < 0 || age > 150)) {
                callback(new Error('请输入有效的年龄(0-150)'));
              } else {
                callback();
              }
            },
            trigger: []
          });
        }
        
        this.$set(this.registrationRules, uniqueKey, rules);
      });
      
      this.formInitialized = true;
    },
    
    // 加载本地数据
    async loadLocalData() {
      try {
        const storageKey = `registration_${this.liveId}`;
        const localData = localStorage.getItem(storageKey);
        
        if (localData) {
          const parsedData = JSON.parse(localData);
          this.registrationId = parsedData.registrationId || null;
          
          const storedData = parsedData.registrationData || {};
          
          // 填充表单数据
          this.entryFromData.forEach(field => {
            if (!field.uniqueKey) return;
            
            let value = '';
            if (storedData[field.name] !== undefined) {
              value = storedData[field.name];
            } else {
              // 尝试其他匹配方式
              const matchingKey = Object.keys(storedData).find(key =>
                key.includes(field.name) || field.name.includes(key)
              );
              if (matchingKey) {
                value = storedData[matchingKey];
              }
            }
            
            // 性别字段转换
            if (field.type === 'gender' && value) {
              if (value === '男') value = 'male';
              else if (value === '女') value = 'female';
            }
            
            if (value !== undefined && value !== '' && value !== null) {
              this.$set(this.registrationData, field.uniqueKey, value);
            }
          });
        }
      } catch (error) {
        console.error('加载本地数据失败:', error);
      }
    },
    
    // 处理日期变化
    handleDateChange(date, uniqueKey) {
      if (date) {
        try {
          if (typeof date === 'string') {
            this.registrationData[uniqueKey] = date;
          } else if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            this.registrationData[uniqueKey] = `${year}-${month}-${day}`;
          } else {
            this.registrationData[uniqueKey] = String(date);
          }
        } catch (error) {
          console.error('处理日期出错:', error);
          this.registrationData[uniqueKey] = '';
        }
      } else {
        this.registrationData[uniqueKey] = '';
      }
    },
    
    // 提交表单
    async handleSubmit() {
      this.$refs.registrationForm.validate(async (valid) => {
        if (!valid) {
          this.$Message.error('请填写完整的报名信息');
          return;
        }
        
        if (this.registrationLoading) return;
        
        this.registrationLoading = true;
        
        try {
          // 准备数据
          const chineseData = {};
          this.entryFromData.forEach(field => {
            const value = this.registrationData[field.uniqueKey];
            if (this.hasValue(value) && field.name) {
              chineseData[field.name] = this.transformValueForStorage(field.type, value);
            }
          });
          
          const submitData = {
            liveStreamId: this.liveId,
            entryFromId: this.entryFromId || undefined,
            registrationData: chineseData
          };
          
          // 提交到服务器
          const res = this.registrationId 
            ? await this.$api.update({ id: this.registrationId, ...submitData })
            : await this.$api.add(submitData);
          
          if (res.code === 200) {
            // 更新本地存储
            await this.saveToLocalStorage(res.data, chineseData);
            
            this.$Message.success(this.registrationId ? '修改成功！' : '报名成功！');
            this.$emit('success', {
              registrationId: res.data?.id || this.registrationId,
              isRegistered: true,
              data: res.data
            });
            
            this.handleCancel();
          }
        } catch (error) {
          console.error('提交失败:', error);
          this.$Message.error('提交失败，请重试');
        } finally {
          this.registrationLoading = false;
        }
      });
    },
    
    // 保存到本地存储
    async saveToLocalStorage(serverData, chineseData) {
      try {
        const storageKey = `registration_${this.liveId}`;
        const storageData = {
          registrationId: serverData?.id || this.registrationId,
          registrationData: chineseData,
          liveStreamId: this.liveId,
          entryFromId: serverData?.entryFromId || this.entryFromId,
          serverData: serverData,
          saveTime: new Date().getTime(),
          userId: this.userId,
          submittedToServer: true,
          lastSubmitTime: new Date().toISOString()
        };
        
        localStorage.setItem(storageKey, JSON.stringify(storageData));
      } catch (error) {
        console.error('保存到本地存储失败:', error);
      }
    },
    
    // 取消
    handleCancel() {
      this.$emit('update:visible', false);
    },
    
    // 判断是否有值
    hasValue(value) {
      return value !== undefined && value !== null && value !== '';
    },
    
    // 转换值用于存储
    transformValueForStorage(fieldType, value) {
      if (fieldType === 'gender') {
        if (value === 'male') return '男';
        if (value === 'female') return '女';
      }
      return value;
    }
  }
};
</script>

<style scoped>
/* 样式保持不变 */
.registration-modal-content {
  display: flex;
  flex-direction: column;
  height: 500px;
  max-height: 70vh;
}

.modal-header-section {
  flex-shrink: 0;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 15px;
}

.registration-title {
  font-size: 15px;
  font-weight: 600;
  color: #646464;
}

.modal-form-section {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 15px;
}

/* 自定义滚动条样式 */
.modal-form-section::-webkit-scrollbar {
  width: 6px;
}

.modal-form-section::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.modal-form-section::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.modal-form-section::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .registration-modal-content {
    height: 450px;
    max-height: 60vh;
  }
}

@media (max-width: 480px) {
  .registration-modal-content {
    height: 400px;
    max-height: 55vh;
  }
}
</style>