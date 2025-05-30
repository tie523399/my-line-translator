# LINE 中越翻譯機器人 🇹🇼🇻🇳

即時翻譯中文和越南文的 LINE 聊天機器人，支援個人對話和群組翻譯。

## 功能特色

- ✅ 中文 ⇄ 越南文雙向翻譯
- ✅ 自動語言偵測
- ✅ 支援群組翻譯
- ✅ 可開關自動翻譯模式
- ✅ 靜音模式不干擾對話

## 快速部署

### 1. 準備 LINE Channel

1. 前往 [LINE Developers](https://developers.line.biz/)
2. 建立 Messaging API Channel
3. 取得 Channel Secret 和 Access Token

### 2. 部署到 Render

1. Fork 這個專案
2. 在 [Render.com](https://render.com) 建立 Web Service
3. 設定環境變數：
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`

### 3. 設定 Webhook

在 LINE Developers Console 設定 Webhook URL：
