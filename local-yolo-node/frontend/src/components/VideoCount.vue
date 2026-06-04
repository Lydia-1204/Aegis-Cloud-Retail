<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import axios from 'axios';

const enteredCount = ref<number | string>('-');
const leftCount = ref<number | string>('-');
const currentCount = ref<number | string>('-');
const isLoading = ref(false);
const errorMessage = ref('');

let ws: WebSocket | null = null;

const handleVideoUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // 初始化状态
  enteredCount.value = 0;
  leftCount.value = 0;
  currentCount.value = 0;
  errorMessage.value = '';
  isLoading.value = true;

  // 如果当前还有遗留的 WebSocket 连接，先强行掐断
  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    // 1. 上传视频文件到后端
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post('http://localhost:8080/api/upload_video', formData);
    
    if (response.data.status === 'success') {
      const filename = response.data.filename;
      // 2. 上传成功，启动 WebSocket 触发后端开始处理
      startWebSocket(filename);
    } else {
      throw new Error("视频上传失败");
    }
  } catch (err) {
    errorMessage.value = "请求失败，请检查 Python 后端是否正常运行";
    isLoading.value = false;
  } finally {
    // 【关键小细节】：清空 input 的值，这样你下次再选同一个视频文件时，依然能触发 @change 事件
    target.value = '';
  }
};

const startWebSocket = (filename: string) => {
  ws = new WebSocket('ws://localhost:8080/ws/count_video');

  ws.onopen = () => {
    // 连接建立后，发送文件名让后端"开工"
    ws?.send(JSON.stringify({ filename: filename }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.status === 'processing') {
      // 接收实时数据并渲染
      enteredCount.value = data.entered;
      leftCount.value = data.left;
      currentCount.value = data.current_count;
    } else if (data.status === 'completed') {
      // 正常处理完毕
      isLoading.value = false;
      errorMessage.value = "✅ 视频检测已顺利完成";
      ws?.close();
    }
  };

  ws.onerror = () => {
    errorMessage.value = "❌ WebSocket 连接发生异常断开";
    isLoading.value = false;
  };
};

// 手动停止检测的方法
const stopDetection = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(); // 主动断开连接，这会触发后端的 WebSocketDisconnect 异常
    ws = null;
    isLoading.value = false;
    errorMessage.value = "🛑 已手动中止检测任务";
  }
};

// 离开当前页面时，确保切断连接，不浪费服务器算力
onBeforeUnmount(() => {
  if (ws) ws.close();
});
</script>

<template>
  <div class="dashboard-view">
    <h2>门店客流数据大屏 (边缘计算模拟)</h2>
    
    <div class="action-bar">
      <label class="btn btn-primary" :class="{ 'btn-disabled': isLoading }">
        {{ isLoading ? '检测任务进行中...' : '投递测试视频' }}
        <input 
          type="file" 
          accept="video/*" 
          @change="handleVideoUpload" 
          style="display: none"
          :disabled="isLoading"
        >
      </label>
      
      <button v-if="isLoading" @click="stopDetection" class="btn btn-danger">
        停止检测
      </button>
    </div>

    <div class="result-bar">
      <div v-if="isLoading" class="loading-container">
        <div class="spinner"></div>
        <span>正在接收边缘节点实时数据... 请查看弹出的监控画面</span>
      </div>
      
      <div class="stats-container">
        <div class="stat-box in">
          <span class="count-label">实时进店人数</span>
          <span class="count-val">{{ enteredCount }}</span>
        </div>
        <div class="stat-box current">
          <span class="count-label">当前画面人数</span>
          <span class="count-val">{{ currentCount }}</span>
        </div>
        <div class="stat-box out">
          <span class="count-label">实时出店人数</span>
          <span class="count-val">{{ leftCount }}</span>
        </div>
      </div>
    </div>
    
    <div 
      v-if="errorMessage" 
      class="message-bar"
      :class="{ 'is-error': errorMessage.includes('失败') || errorMessage.includes('异常') }"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

<style scoped>
.dashboard-view { padding: 20px; font-family: sans-serif; }

.action-bar { 
  display: flex; 
  gap: 15px; 
  margin-bottom: 20px; 
  align-items: center;
}

.btn { 
  padding: 10px 20px; 
  border-radius: 6px; 
  cursor: pointer; 
  border: none;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-primary { background: #42b983; color: white; display: inline-block; }
.btn-primary:hover:not(.btn-disabled) { background: #3aa876; }

.btn-danger { background: #ff4757; color: white; }
.btn-danger:hover { background: #ff3344; box-shadow: 0 2px 8px rgba(255, 71, 87, 0.4); }

.btn-disabled { 
  background: #a8d5c2; 
  cursor: not-allowed; 
}

.result-bar { background: #f8f9fa; padding: 40px 20px; border-radius: 8px; max-width: 640px; margin: 0 auto; text-align: center;}
.stats-container { display: flex; justify-content: space-around; margin-top: 20px; }
.stat-box { display: flex; flex-direction: column; align-items: center; background: #fff; padding: 20px 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); min-width: 150px; }
.stat-box.in .count-val { color: #42b983; font-size: 48px; font-weight: bold; margin-top: 10px; }
.stat-box.current .count-val { color: #f39c12; font-size: 48px; font-weight: bold; margin-top: 10px; }
.stat-box.out .count-val { color: #ff4757; font-size: 48px; font-weight: bold; margin-top: 10px; }
.spinner { border: 4px solid rgba(0, 0, 0, 0.1); width: 24px; height: 24px; border-radius: 50%; border-left-color: #42b983; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 10px;}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.message-bar {
  max-width: 640px;
  margin: 20px auto 0;
  padding: 12px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 4px;
  text-align: center;
  font-weight: bold;
}

.message-bar.is-error {
  background: #ffebee;
  color: #ff4757;
}
</style>