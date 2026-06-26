// ==UserScript==
// @name         巨量本地推停推助手
// @namespace    https://github.com/lovewold/YOUHOU
// @version      0.1.0
// @description  通过任务配置批量处理巨量本地推定向包行政区域 CSV 上传，支持预览、dryRun、日志导出。
// @author       YOUHOU
// @match        https://*.oceanengine.com/*
// @match        https://*.jinritemai.com/*
// @match        https://*.bytedance.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "youhou.stopPush.task.v1";
  const STATE = {
    task: null,
    logs: [],
    running: false,
    panelOpen: true,
  };

  const SELECTORS = {
    accountSearchInput: [
      'input[placeholder*="搜索"]',
      'input[placeholder*="账户"]',
      'input[placeholder*="备注"]',
      'input[type="search"]',
    ],
    modalClose: [
      ".byted-modal-close",
      ".semi-modal-close",
      ".arco-modal-close-icon",
      '[aria-label="Close"]',
      '[aria-label="关闭"]',
    ],
    fileInput: ['input[type="file"]'],
  };

  const TEXT = {
    tools: ["工具"],
    targetPackage: ["定向包"],
    edit: ["修改", "编辑"],
    userTargeting: ["用户定向"],
    region: ["行政区域"],
    batchAdd: ["批量添加"],
    saveAndClose: ["编辑并关闭", "保存并关闭", "确定", "保存"],
    success: ["成功", "保存成功", "编辑成功", "操作成功"],
  };

  function addStyles() {
    GM_addStyle(`
      #youhou-stop-push-panel {
        position: fixed;
        right: 16px;
        top: 88px;
        width: 380px;
        max-height: calc(100vh - 120px);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #1f2329;
        background: #fff;
        border: 1px solid #dee0e3;
        box-shadow: 0 8px 28px rgba(31, 35, 41, 0.18);
        border-radius: 8px;
        overflow: hidden;
      }
      #youhou-stop-push-panel * { box-sizing: border-box; }
      .youhou-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid #eff0f1;
        background: #f7f8fa;
        font-weight: 700;
      }
      .youhou-body {
        padding: 12px;
        max-height: calc(100vh - 178px);
        overflow: auto;
      }
      .youhou-field {
        display: grid;
        gap: 6px;
        margin-bottom: 10px;
      }
      .youhou-field label {
        font-size: 12px;
        color: #646a73;
      }
      .youhou-field textarea,
      .youhou-field input,
      .youhou-field select {
        width: 100%;
        border: 1px solid #d0d3d8;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
        line-height: 1.5;
      }
      .youhou-field textarea {
        height: 88px;
        resize: vertical;
        font-family: Consolas, "SFMono-Regular", monospace;
      }
      .youhou-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .youhou-check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #1f2329;
        margin: 2px 0 10px;
      }
      .youhou-check input {
        width: auto;
      }
      .youhou-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .youhou-btn {
        border: 1px solid #c9cdd4;
        background: #fff;
        color: #1f2329;
        border-radius: 6px;
        padding: 7px 10px;
        cursor: pointer;
        font-size: 12px;
      }
      .youhou-btn.primary {
        border-color: #1456f0;
        background: #1456f0;
        color: #fff;
      }
      .youhou-btn.danger {
        border-color: #d92d20;
        color: #d92d20;
      }
      .youhou-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .youhou-summary {
        border: 1px solid #eff0f1;
        border-radius: 6px;
        padding: 8px;
        background: #fafafa;
        margin-bottom: 10px;
        font-size: 12px;
        line-height: 1.6;
      }
      .youhou-log {
        height: 180px;
        overflow: auto;
        white-space: pre-wrap;
        border: 1px solid #eff0f1;
        border-radius: 6px;
        padding: 8px;
        background: #111827;
        color: #e5e7eb;
        font: 11px/1.5 Consolas, "SFMono-Regular", monospace;
      }
      .youhou-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 11px;
        background: #eef2ff;
        color: #3538cd;
        margin: 0 4px 4px 0;
      }
      #youhou-stop-push-toggle {
        position: fixed;
        right: 16px;
        top: 88px;
        z-index: 2147483647;
        border: 1px solid #1456f0;
        background: #1456f0;
        color: #fff;
        border-radius: 999px;
        padding: 8px 12px;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(20, 86, 240, 0.26);
      }
    `);
  }

  function defaultTask() {
    return {
      taskName: "家电停推",
      mode: "businessLine",
      filters: {
        businessLine: "家电",
        agent: ["红马"],
        accountRemarks: [],
      },
      target: {
        packageNames: ["空调停推包", "电视停推包"],
        regionCsvPath: "",
      },
      accounts: [
        {
          accountRemark: "周涛+同城电器维修服务预约店+红马+家电",
          agent: "红马",
          businessLine: "家电",
          enabled: true,
        },
      ],
      options: {
        dryRun: true,
        needConfirm: true,
        retryTimes: 1,
        stopOnContinuousFailures: 5,
      },
    };
  }

  function loadTask() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTask();
    try {
      return JSON.parse(raw);
    } catch (error) {
      log("error", "读取本地任务失败，已使用默认模板", { error: error.message });
      return defaultTask();
    }
  }

  function saveTask(task) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(task, null, 2));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function log(level, message, detail = {}) {
    const entry = { time: nowIso(), level, message, detail };
    STATE.logs.push(entry);
    renderLogs();
    return entry;
  }

  function renderLogs() {
    const logBox = document.querySelector("#youhou-log");
    if (!logBox) return;
    logBox.textContent = STATE.logs
      .map((item) => `[${item.time}] ${item.level.toUpperCase()} ${item.message}${Object.keys(item.detail).length ? ` ${JSON.stringify(item.detail)}` : ""}`)
      .join("\n");
    logBox.scrollTop = logBox.scrollHeight;
  }

  function parseTaskInput() {
    try {
      const task = buildTaskFromPanel();
      const errors = validateTask(task);
      if (errors.length) {
        throw new Error(errors.join("; "));
      }
      STATE.task = task;
      saveTask(task);
      log("info", "任务配置已加载", { taskName: task.taskName });
      renderSummary();
      return task;
    } catch (error) {
      log("error", "任务配置无效", { error: error.message });
      alert(`任务配置无效：${error.message}`);
      return null;
    }
  }

  function validateTask(task) {
    const errors = [];
    if (!task || typeof task !== "object") errors.push("任务不能为空");
    if (!task.taskName) errors.push("缺少 taskName");
    if (!["businessLine", "accountList"].includes(task.mode)) errors.push("mode 仅支持 businessLine 或 accountList");
    if (!Array.isArray(task.accounts) || task.accounts.length === 0) errors.push("请至少填写一个账户备注");
    if (!task.target || !Array.isArray(task.target.packageNames) || task.target.packageNames.length === 0) errors.push("target.packageNames 至少填写一个");
    if (task.mode === "businessLine" && !task.filters?.businessLine) errors.push("businessLine 模式缺少 filters.businessLine");
    if (task.mode === "accountList" && !Array.isArray(task.filters?.accountRemarks)) errors.push("accountList 模式缺少 filters.accountRemarks");
    return errors;
  }

  function buildTaskFromPanel() {
    const agent = getInputValue("#youhou-agent");
    const businessLine = getInputValue("#youhou-business-line");
    const accountRemarks = splitText(getInputValue("#youhou-account-remarks"));
    const packageNames = splitText(getInputValue("#youhou-package-names"));
    const csvFile = document.querySelector("#youhou-csv-file")?.files?.[0];
    const taskName = getInputValue("#youhou-task-name") || `${businessLine || "停推"}任务`;
    const mode = document.querySelector("#youhou-mode")?.value || "businessLine";
    const accounts = accountRemarks.map((accountRemark) => {
      const parsed = parseAccountRemark(accountRemark);
      return {
        accountRemark,
        agent: parsed.agent || agent,
        businessLine: parsed.businessLine || businessLine,
        enabled: true,
      };
    });

    return {
      taskName,
      mode,
      filters: {
        businessLine,
        agent: agent ? [agent] : [],
        accountRemarks,
      },
      target: {
        packageNames,
        regionCsvPath: csvFile?.name || "",
      },
      accounts,
      options: {
        dryRun: document.querySelector("#youhou-dry-run")?.checked !== false,
        needConfirm: true,
        retryTimes: Number(getInputValue("#youhou-retry-times") || 1),
        stopOnContinuousFailures: Number(getInputValue("#youhou-max-failures") || 5),
      },
    };
  }

  function fillPanelFromTask(task) {
    const accounts = Array.isArray(task.accounts) ? task.accounts : [];
    const accountRemarks = accounts.map((account) => account.accountRemark).filter(Boolean).join("\n");
    setInputValue("#youhou-task-name", task.taskName || "");
    setInputValue("#youhou-mode", task.mode || "businessLine");
    setInputValue("#youhou-agent", task.filters?.agent?.[0] || accounts[0]?.agent || "");
    setInputValue("#youhou-business-line", task.filters?.businessLine || accounts[0]?.businessLine || "");
    setInputValue("#youhou-package-names", (task.target?.packageNames || []).join("\n"));
    setInputValue("#youhou-account-remarks", accountRemarks);
    setInputValue("#youhou-retry-times", String(task.options?.retryTimes ?? 1));
    setInputValue("#youhou-max-failures", String(task.options?.stopOnContinuousFailures ?? 5));
    const dryRun = document.querySelector("#youhou-dry-run");
    if (dryRun) dryRun.checked = task.options?.dryRun !== false;
  }

  function getInputValue(selector) {
    return document.querySelector(selector)?.value?.trim() || "";
  }

  function setInputValue(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.value = value;
  }

  function splitText(value) {
    return value
      .split(/[\n,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseAccountRemark(accountRemark) {
    const parts = accountRemark.split("+").map((part) => part.trim());
    return {
      owner: parts[0] || "",
      storeName: parts[1] || "",
      agent: parts[2] || "",
      businessLine: parts[3] || "",
    };
  }

  function getMatchedAccounts(task) {
    const enabledAccounts = task.accounts.filter((account) => account.enabled !== false);
    if (task.mode === "businessLine") {
      return enabledAccounts.filter((account) => {
        const agentMatched = !task.filters.agent?.length || task.filters.agent.includes(account.agent);
        return account.businessLine === task.filters.businessLine && agentMatched;
      });
    }
    const remarks = new Set(task.filters.accountRemarks || []);
    return enabledAccounts.filter((account) => remarks.has(account.accountRemark));
  }

  function renderSummary() {
    const box = document.querySelector("#youhou-summary");
    if (!box) return;
    const task = STATE.task || loadTask();
    const errors = validateTask(task);
    if (errors.length) {
      box.innerHTML = `<strong>配置待修正</strong><br>${escapeHtml(errors.join("<br>"))}`;
      return;
    }
    const accounts = getMatchedAccounts(task);
    const packageNames = task.target.packageNames.map((name) => `<span class="youhou-pill">${escapeHtml(name)}</span>`).join("");
    box.innerHTML = `
      <div><strong>${escapeHtml(task.taskName)}</strong></div>
      <div>模式：${escapeHtml(task.mode)} ｜ dryRun：${task.options?.dryRun !== false ? "是" : "否"}</div>
      <div>命中账户：${accounts.length} 个</div>
      <div>定向包：${packageNames}</div>
      <div>CSV：${escapeHtml(task.target.regionCsvPath || "执行时选择文件")}</div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createPanel() {
    const task = loadTask();
    STATE.task = task;
    const panel = document.createElement("div");
    panel.id = "youhou-stop-push-panel";
    panel.innerHTML = `
      <div class="youhou-header">
        <span>巨量停推助手</span>
        <button class="youhou-btn" id="youhou-hide">收起</button>
      </div>
      <div class="youhou-body">
        <div class="youhou-grid">
          <div class="youhou-field">
            <label>任务名称</label>
            <input id="youhou-task-name" placeholder="例如：家电停推" />
          </div>
          <div class="youhou-field">
            <label>执行模式</label>
            <select id="youhou-mode">
              <option value="businessLine">按业务线筛选</option>
              <option value="accountList">按账户备注执行</option>
            </select>
          </div>
        </div>
        <div class="youhou-grid">
          <div class="youhou-field">
            <label>代理商</label>
            <input id="youhou-agent" placeholder="例如：红马" />
          </div>
          <div class="youhou-field">
            <label>业务线</label>
            <input id="youhou-business-line" placeholder="例如：家电" />
          </div>
        </div>
        <div class="youhou-field">
          <label>定向包名称</label>
          <textarea id="youhou-package-names" placeholder="一行一个，例如：&#10;空调停推包&#10;电视停推包"></textarea>
        </div>
        <div class="youhou-field">
          <label>账户备注</label>
          <textarea id="youhou-account-remarks" placeholder="一行一个账户备注，例如：&#10;周涛+同城电器维修服务预约店+红马+家电"></textarea>
        </div>
        <label class="youhou-check">
          <input type="checkbox" id="youhou-dry-run" />
          <span>dryRun 试跑，不上传 CSV，不保存</span>
        </label>
        <div class="youhou-grid">
          <div class="youhou-field">
            <label>失败重试</label>
            <input id="youhou-retry-times" type="number" min="0" max="5" />
          </div>
          <div class="youhou-field">
            <label>连续失败暂停</label>
            <input id="youhou-max-failures" type="number" min="1" max="20" />
          </div>
        </div>
        <div class="youhou-row">
          <button class="youhou-btn" id="youhou-load">保存配置</button>
          <button class="youhou-btn" id="youhou-preview">预览</button>
          <button class="youhou-btn primary" id="youhou-run">执行</button>
          <button class="youhou-btn danger" id="youhou-stop">停止</button>
        </div>
        <div class="youhou-row">
          <input type="file" id="youhou-csv-file" accept=".csv,text/csv" />
        </div>
        <div class="youhou-row">
          <button class="youhou-btn" id="youhou-copy-log">复制日志</button>
          <button class="youhou-btn" id="youhou-download-log">下载日志</button>
          <button class="youhou-btn" id="youhou-clear-log">清空日志</button>
        </div>
        <div id="youhou-summary" class="youhou-summary"></div>
        <div id="youhou-log" class="youhou-log"></div>
      </div>
    `;
    document.body.appendChild(panel);

    const toggle = document.createElement("button");
    toggle.id = "youhou-stop-push-toggle";
    toggle.textContent = "停推助手";
    toggle.style.display = "none";
    document.body.appendChild(toggle);

    document.querySelector("#youhou-hide").addEventListener("click", () => {
      panel.style.display = "none";
      toggle.style.display = "block";
    });
    toggle.addEventListener("click", () => {
      panel.style.display = "block";
      toggle.style.display = "none";
    });
    document.querySelector("#youhou-load").addEventListener("click", parseTaskInput);
    document.querySelector("#youhou-preview").addEventListener("click", previewTask);
    document.querySelector("#youhou-run").addEventListener("click", runTask);
    document.querySelector("#youhou-stop").addEventListener("click", stopTask);
    document.querySelector("#youhou-copy-log").addEventListener("click", copyLogs);
    document.querySelector("#youhou-download-log").addEventListener("click", downloadLogs);
    document.querySelector("#youhou-clear-log").addEventListener("click", clearLogs);
    fillPanelFromTask(task);
    renderSummary();
    log("info", "停推助手已加载");
  }

  function previewTask() {
    const task = parseTaskInput();
    if (!task) return;
    const accounts = getMatchedAccounts(task);
    log("info", "任务预览", {
      matchedCount: accounts.length,
      packageNames: task.target.packageNames,
      accounts: accounts.map((account) => account.accountRemark),
    });
    if (accounts.length === 0) {
      alert("没有命中账户，请检查业务线、代理商或账户备注。");
    } else {
      alert(`命中 ${accounts.length} 个账户，定向包 ${task.target.packageNames.length} 个。请检查日志确认范围。`);
    }
  }

  async function runTask() {
    const task = parseTaskInput();
    if (!task || STATE.running) return;
    const accounts = getMatchedAccounts(task);
    if (accounts.length === 0) {
      alert("没有命中账户，不能执行。");
      return;
    }
    const csvFile = document.querySelector("#youhou-csv-file").files[0];
    if (!task.options?.dryRun && !csvFile) {
      alert("正式执行前请选择本次要上传的 CSV 文件。");
      return;
    }
    const dryRun = task.options?.dryRun !== false;
    if (task.options?.needConfirm !== false) {
      const confirmed = confirm(`即将${dryRun ? "dryRun 试跑" : "正式执行"}：${accounts.length} 个账户，${task.target.packageNames.length} 个定向包。是否继续？`);
      if (!confirmed) return;
    }

    STATE.running = true;
    let continuousFailures = 0;
    log("info", "任务开始", { taskName: task.taskName, dryRun });
    setRunButtons(false);

    try {
      for (const account of accounts) {
        if (!STATE.running) break;
        const accountResult = await runAccountWithRetry(task, account, csvFile);
        if (accountResult.ok) {
          continuousFailures = 0;
        } else {
          continuousFailures += 1;
        }
        const maxFailures = task.options?.stopOnContinuousFailures || 5;
        if (continuousFailures >= maxFailures) {
          log("error", "连续失败达到阈值，任务暂停", { continuousFailures });
          break;
        }
      }
    } finally {
      STATE.running = false;
      setRunButtons(true);
      log("info", "任务结束");
    }
  }

  function setRunButtons(enabled) {
    document.querySelector("#youhou-run").disabled = !enabled;
    document.querySelector("#youhou-load").disabled = !enabled;
    document.querySelector("#youhou-preview").disabled = !enabled;
  }

  function stopTask() {
    STATE.running = false;
    log("warn", "收到停止指令，当前步骤结束后停止");
  }

  async function runAccountWithRetry(task, account, csvFile) {
    const retryTimes = Number(task.options?.retryTimes || 0);
    let lastResult = null;
    for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
      if (!STATE.running) return { ok: false };
      if (attempt > 0) {
        log("warn", "重试账户", { accountRemark: account.accountRemark, attempt });
      }
      lastResult = await runAccount(task, account, csvFile);
      if (lastResult.ok) return lastResult;
    }
    return lastResult || { ok: false };
  }

  async function runAccount(task, account, csvFile) {
    log("info", "开始处理账户", { accountRemark: account.accountRemark });
    try {
      const dryRun = task.options?.dryRun !== false;
      await findAndEnterAccount(account.accountRemark, dryRun);
      if (dryRun) {
        log("info", "dryRun 仅验证账户定位并记录计划处理定向包", {
          accountRemark: account.accountRemark,
          packageNames: task.target.packageNames,
        });
        return { ok: true };
      }
      await closePopupIfPresent();
      await openTargetPackagePage(false);

      for (const packageName of task.target.packageNames) {
        if (!STATE.running) break;
        await runPackage(task, account, packageName, csvFile);
      }
      log("info", "账户处理完成", { accountRemark: account.accountRemark });
      return { ok: true };
    } catch (error) {
      log("error", "账户处理失败", { accountRemark: account.accountRemark, error: error.message });
      return { ok: false, error };
    }
  }

  async function runPackage(task, account, packageName, csvFile) {
    const dryRun = task.options?.dryRun !== false;
    log("info", "开始处理定向包", { accountRemark: account.accountRemark, packageName, dryRun });
    await findAndOpenPackage(packageName, dryRun);
    await openRegionBatchImport(dryRun);
    if (dryRun) {
      log("info", "dryRun 跳过 CSV 上传和保存", { packageName });
      return;
    }
    await uploadCsv(csvFile);
    await saveAndWaitSuccess();
    log("info", "定向包处理完成", { packageName });
  }

  async function findAndEnterAccount(accountRemark, dryRun) {
    const searchInput = findFirstSelector(SELECTORS.accountSearchInput);
    if (searchInput) {
      await fillInput(searchInput, accountRemark);
      await sleep(1000);
      log("info", "已输入账户备注搜索", { accountRemark });
    } else {
      log("warn", "未找到搜索框，将尝试直接文本定位账户", { accountRemark });
    }

    const accountNode = findElementByText([accountRemark]);
    if (!accountNode) throw new Error(`ACCOUNT_NOT_FOUND: ${accountRemark}`);
    if (dryRun) {
      log("info", "dryRun 定位到账户，不点击进入", { accountRemark });
      return;
    }
    clickElement(accountNode);
    await sleep(1800);
  }

  async function closePopupIfPresent() {
    const closeButton = findFirstSelector(SELECTORS.modalClose);
    if (!closeButton) {
      log("info", "未发现弹窗");
      return;
    }
    clickElement(closeButton);
    log("info", "已尝试关闭弹窗");
    await sleep(500);
  }

  async function openTargetPackagePage(dryRun) {
    if (dryRun) {
      log("info", "dryRun 跳过进入工具定向包页面");
      return;
    }
    await clickText(TEXT.tools, "TOOLS_NOT_FOUND");
    await sleep(500);
    await clickText(TEXT.targetPackage, "TARGET_PACKAGE_MENU_NOT_FOUND");
    await sleep(1200);
    log("info", "已进入定向包页面");
  }

  async function findAndOpenPackage(packageName, dryRun) {
    const packageNode = findElementByText([packageName]);
    if (!packageNode) throw new Error(`PACKAGE_NOT_FOUND: ${packageName}`);
    if (dryRun) {
      log("info", "dryRun 定位到定向包，不点击修改", { packageName });
      return;
    }
    const row = packageNode.closest("tr") || packageNode.closest('[role="row"]') || packageNode.parentElement;
    const editNode = findElementByText(TEXT.edit, row || document.body);
    if (!editNode) throw new Error(`PACKAGE_EDIT_NOT_FOUND: ${packageName}`);
    clickElement(editNode);
    await sleep(1000);
  }

  async function openRegionBatchImport(dryRun) {
    if (dryRun) {
      log("info", "dryRun 跳过行政区域批量添加");
      return;
    }
    await clickText(TEXT.edit, "EDIT_BUTTON_NOT_FOUND");
    await sleep(500);
    await clickText(TEXT.userTargeting, "USER_TARGETING_NOT_FOUND");
    await sleep(500);
    await clickText(TEXT.region, "REGION_NOT_FOUND");
    await sleep(500);
    await clickText(TEXT.batchAdd, "BATCH_ADD_NOT_FOUND");
    await sleep(800);
  }

  async function uploadCsv(csvFile) {
    if (!csvFile) throw new Error("CSV_FILE_REQUIRED");
    const fileInput = findFirstSelector(SELECTORS.fileInput);
    if (!fileInput) throw new Error("CSV_FILE_INPUT_NOT_FOUND");
    const transfer = new DataTransfer();
    transfer.items.add(csvFile);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    log("info", "已选择 CSV 文件", { name: csvFile.name });
    await sleep(1000);
  }

  async function saveAndWaitSuccess() {
    await clickText(TEXT.saveAndClose, "SAVE_BUTTON_NOT_FOUND");
    await waitFor(() => Boolean(findElementByText(TEXT.success)), 10000, "SAVE_SUCCESS_NOT_FOUND");
    log("info", "检测到保存成功提示");
  }

  async function clickText(texts, errorCode) {
    const node = findElementByText(texts);
    if (!node) throw new Error(errorCode);
    clickElement(node);
  }

  function findFirstSelector(selectors, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (node && isVisible(node)) return node;
    }
    return null;
  }

  function findElementByText(texts, root = document.body) {
    const candidates = Array.from(root.querySelectorAll("button, a, span, div, td, th, p, label"));
    const exact = candidates.find((node) => isVisible(node) && texts.some((text) => normalizeText(node.textContent) === normalizeText(text)));
    if (exact) return exact;
    return candidates.find((node) => isVisible(node) && texts.some((text) => normalizeText(node.textContent).includes(normalizeText(text))));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function isVisible(node) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  async function fillInput(input, value) {
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
  }

  function clickElement(node) {
    node.scrollIntoView({ block: "center", inline: "center" });
    node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    node.click();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(predicate, timeout, errorCode) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (predicate()) return true;
      await sleep(300);
    }
    throw new Error(errorCode);
  }

  function copyLogs() {
    const content = formatLogs();
    GM_setClipboard(content);
    log("info", "日志已复制到剪贴板");
  }

  function downloadLogs() {
    const blob = new Blob([formatLogs()], { type: "application/jsonl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `youhou-stop-push-${Date.now()}.jsonl`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearLogs() {
    STATE.logs = [];
    renderLogs();
  }

  function formatLogs() {
    return STATE.logs.map((entry) => JSON.stringify(entry)).join("\n");
  }

  addStyles();
  createPanel();
})();
