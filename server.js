const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// 群組設定儲存
const groupSettings = new Map();
const defaultGroupSettings = {
  autoTranslate: false,
  translatePrefix: '@翻譯',
  silentMode: false
};

// 取得群組設定
function getGroupSettings(groupId) {
  if (!groupSettings.has(groupId)) {
    groupSettings.set(groupId, { ...defaultGroupSettings });
  }
  return groupSettings.get(groupId);
}

// 偵測越南文
function isVietnamese(text) {
  const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/;
  return vietnamesePattern.test(text);
}

// 偵測中文
function isChinese(text) {
  const chinesePattern = /[\u4e00-\u9fa5]/;
  return chinesePattern.test(text);
}

// 翻譯 API
async function translateText(text, from, to) {
  try {
    const langPair = `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    
    const response = await axios.get(url);
    
    if (response.data.responseStatus === 200) {
      return response.data.responseData.translatedText;
    }
    return null;
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

// Webhook 路由
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// 處理事件
async function handleEvent(event) {
  // 處理加入群組
  if (event.type === 'join') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `🎉 大家好！我是中越翻譯機器人！

🇹🇼🇻🇳 我可以幫助大家即時翻譯

📱 使用方式：
- 輸入「@翻譯 」來翻譯文字
- 或用 /auto on 開啟自動翻譯

輸入 /help 查看更多指令`
    });
  }

  // 只處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userText = event.message.text;
  const source = event.source;
  
  // 個人對話
  if (source.type === 'user') {
    if (userText === '/help' || userText === '說明') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `🇹🇼🇻🇳 中越翻譯機器人

📝 使用方式：
- 輸入中文 → 翻譯成越南文
- 輸入越南文 → 翻譯成中文

📱 群組功能：
- 將我加入群組即可使用
- 預設使用 @翻譯 觸發
- 可開啟自動翻譯模式`
      });
    }
    
    // 直接翻譯
    return performTranslation(event, userText);
  }
  
  // 群組對話
  if (source.type === 'group' || source.type === 'room') {
    const groupId = source.groupId || source.roomId;
    const settings = getGroupSettings(groupId);
    
    // 處理指令
    if (userText.startsWith('/')) {
      return handleGroupCommand(event, userText, groupId);
    }
    
    // 檢查是否需要翻譯
    let shouldTranslate = false;
    let textToTranslate = userText;
    
    if (settings.autoTranslate) {
      shouldTranslate = true;
    } else if (userText.startsWith(settings.translatePrefix)) {
      shouldTranslate = true;
      textToTranslate = userText.substring(settings.translatePrefix.length).trim();
    }
    
    if (shouldTranslate && textToTranslate) {
      return performTranslation(event, textToTranslate, settings.silentMode);
    }
  }
  
  return null;
}

// 處理群組指令
async function handleGroupCommand(event, command, groupId) {
  const settings = getGroupSettings(groupId);
  const cmd = command.toLowerCase();
  
  if (cmd === '/auto on') {
    settings.autoTranslate = true;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '✅ 已開啟自動翻譯'
    });
  }
  
  if (cmd === '/auto off') {
    settings.autoTranslate = false;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 已關閉自動翻譯'
    });
  }
  
  if (cmd === '/silent on') {
    settings.silentMode = true;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔇 已開啟靜音模式'
    });
  }
  
  if (cmd === '/silent off') {
    settings.silentMode = false;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔊 已關閉靜音模式'
    });
  }
  
  if (cmd === '/status') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `📊 目前設定：
自動翻譯：${settings.autoTranslate ? '開啟 ✅' : '關閉 ❌'}
靜音模式：${settings.silentMode ? '開啟 ✅' : '關閉 ❌'}`
    });
  }
  
  if (cmd === '/help') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `📱 群組指令：
/auto on - 開啟自動翻譯
/auto off - 關閉自動翻譯
/silent on - 開啟靜音模式
/silent off - 關閉靜音模式
/status - 查看設定
/help - 顯示說明`
    });
  }
  
  return null;
}

// 執行翻譯
async function performTranslation(event, text, silentMode = false) {
  let translatedText = '';
  let targetLang = '';
  
  if (isVietnamese(text)) {
    targetLang = 'zh-TW';
    translatedText = await translateText(text, 'vi', 'zh-TW');
  } else if (isChinese(text)) {
    targetLang = 'vi';
    translatedText = await translateText(text, 'zh-TW', 'vi');
  } else {
    targetLang = 'vi';
    translatedText = await translateText(text, 'auto', 'vi');
  }
  
  if (translatedText) {
    const langEmoji = targetLang === 'vi' ? '🇻🇳' : '🇹🇼';
    
    if (silentMode) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `${langEmoji} ${translatedText}`
      });
    }
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `${langEmoji} ${translatedText}\n\n📝 ${text}`
    });
  }
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '❌ 翻譯失敗，請稍後再試'
  });
}

// 首頁
app.get('/', (req, res) => {
  res.send('🇹🇼🇻🇳 中越翻譯機器人運行中！');
});

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
