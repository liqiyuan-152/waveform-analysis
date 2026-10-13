# 0.1.75 发布说明

动画系统及分页淡入的正式版本说明维护于仓库根目录 [RELEASE_NOTES.md](../../../RELEASE_NOTES.md)，GitHub/Gitea 发布工作流从该文件读取发布正文。

本次发布加入系列入场、数据更新、标注动画、分页淡入，以及31种D3缓动和公开动画引擎/预设接口。动画默认开启，消费者可使用`animationEnabled=false`恢复静态展示；分页复用`animationUpdate`，没有新增公共属性。

历史完整动画验收见 `evidence/final-acceptance-verification.json`，分页专项见 `evidence/pagination/verification.json`。发布准备与最终验证见 `evidence/release-0.1.75/verification.json`。移动端不在本次验收范围，原物理内存目标仍为非阻塞诊断指标。
