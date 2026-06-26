# 巨量本地推停推助手油猴脚本

## 1. 安装

1. 在四个代理商各自使用的浏览器中安装 Tampermonkey。
2. 打开 Tampermonkey 管理面板。
3. 新建脚本。
4. 将 `tampermonkey/juliang-stop-push.user.js` 内容粘贴进去。
5. 保存并启用脚本。
6. 打开巨量本地推升级版工作台页面。
7. 页面右侧出现「巨量停推助手」面板即安装成功。

## 2. 使用步骤

1. 打开当前代理商浏览器，并确认已登录巨量引擎。
2. 进入巨量本地推升级版工作台。
3. 在面板中编辑任务 JSON。
4. 填写当前代理商、业务线、定向包名称列表和本次 CSV。
5. 保持 `dryRun: true`，点击「预览」。
6. 确认命中账户和定向包正确后，点击「执行」进行 dryRun。
7. dryRun 日志无误后，将 `dryRun` 改为 `false`。
8. 选择本次要上传的 CSV 文件。
9. 再次点击「执行」正式处理。
10. 执行结束后复制或下载日志。

## 3. 任务 JSON 示例

```json
{
  "taskName": "2026-06-26_家电停推",
  "mode": "businessLine",
  "filters": {
    "businessLine": "家电",
    "agent": ["红马"],
    "accountRemarks": []
  },
  "target": {
    "packageNames": ["空调停推包", "电视停推包"],
    "regionCsvPath": "C:/stop-push/csv/current-stop-push.csv"
  },
  "accounts": [
    {
      "accountRemark": "周涛+同城电器维修服务预约店+红马+家电",
      "agent": "红马",
      "businessLine": "家电",
      "enabled": true
    }
  ],
  "options": {
    "dryRun": true,
    "needConfirm": true,
    "retryTimes": 1,
    "takeScreenshotOnFail": false,
    "stopOnContinuousFailures": 5
  }
}
```

## 4. 选择器校准

脚本顶部的 `SELECTORS` 和 `TEXT` 用于适配巨量页面：

| 配置 | 作用 |
| --- | --- |
| `SELECTORS.accountSearchInput` | 工作台账户搜索框 |
| `SELECTORS.modalClose` | 活动弹窗关闭按钮 |
| `SELECTORS.fileInput` | CSV 上传 input |
| `TEXT.tools` | 顶部或侧边「工具」入口 |
| `TEXT.targetPackage` | 「定向包」入口 |
| `TEXT.edit` | 修改或编辑按钮 |
| `TEXT.region` | 行政区域文本 |
| `TEXT.batchAdd` | 批量添加按钮 |
| `TEXT.saveAndClose` | 保存按钮 |
| `TEXT.success` | 保存成功提示 |

首次在真实页面试跑时，建议先用 `dryRun: true`，确认账户搜索、账户定位和定向包定位日志正确，再开启正式执行。

## 5. 验收标准

| 项目 | 标准 |
| --- | --- |
| 面板加载 | 巨量页面右侧出现停推助手面板 |
| 配置校验 | 缺少必填字段时能提示错误 |
| 任务预览 | 能显示命中账户数、定向包列表和 CSV |
| dryRun | 不上传 CSV，不保存，验证账户定位并记录计划处理的定向包 |
| 正式执行 | 能按账户逐个处理所有指定定向包 |
| 日志 | 能复制或下载 JSONL 日志 |
