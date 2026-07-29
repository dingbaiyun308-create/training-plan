# 第3阶段训练计划器部署包

把本目录所有文件上传到 GitHub 仓库根目录，然后在 Settings → Pages 中选择 main / root。

目标访问地址通常是：

https://dingbaiyun308-create.github.io/training-plan/

本版本：20260729-stage3-final-v1

## 核心修复

- 第三阶段最终训练计划已内置在 index.html。
- 完整备份导出包含 planSnapshot、exerciseDictionary、state、records.training、records.warmup。
- localStorage key: training_stage3_lower_back_v1。
- Service Worker 缓存名已更新，会清理旧缓存。
- 禁用：站立划船、辅助引体、史密斯、暂停深蹲、顶组、回退组。
- 使用：坐姿划船、海豹划船、保加利亚分腿蹲。
