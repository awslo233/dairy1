import type { MoodType, JournalEntry } from './types';
import { getAllEntriesForAnalysis } from './storage';

const moodLabels: Record<MoodType, string> = {
  happy: '开心',
  calm: '平静',
  anxious: '焦虑',
  irritated: '烦躁',
  sad: '低落',
  excited: '兴奋',
};

function getMoodDistribution(entries: JournalEntry[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const e of entries) {
    dist[e.mood] = (dist[e.mood] || 0) + 1;
  }
  return dist;
}

function getRecentEntries(days: number): JournalEntry[] {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return getAllEntriesForAnalysis().filter(
    (e) => new Date(e.createdAt).getTime() >= cutoff
  );
}

function extractKeywords(entries: JournalEntry[]): Map<string, number> {
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
    '什么', '怎么', '为什么', '但', '而', '或', '如果', '因为', '所以',
    '可以', '能', '还', '又', '再', '已经', '今天', '明天', '昨天',
    '就是', '还是', '比较', '觉得', '知道', '时候', '时候', '开始',
    '然后', '其实', '应该', '需要', '可能', '一些', '这个', '那个',
    '不是', '没', '做', '想', '来', '去', '个', '被', '把', '让',
  ]);
  const words = new Map<string, number>();
  for (const e of entries) {
    const text = e.content.replace(/<[^>]*>/g, '');
    const matches = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g);
    if (!matches) continue;
    for (const w of matches) {
      if (!stopWords.has(w)) {
        words.set(w, (words.get(w) || 0) + 1);
      }
    }
  }
  return words;
}

function getPlainText(entries: JournalEntry[]): string {
  return entries.map((e) => e.content.replace(/<[^>]*>/g, '')).join(' ');
}

function findEntriesContaining(keyword: string): JournalEntry[] {
  return getAllEntriesForAnalysis().filter((e) =>
    e.content.replace(/<[^>]*>/g, '').includes(keyword)
  );
}

export function generateAIResponse(userMessage: string): string {
  const allEntries = getAllEntriesForAnalysis();
  const msg = userMessage.toLowerCase();

  if (allEntries.length === 0) {
    return '你还没有写过日记呢。试着写下今天的第一篇吧，哪怕只是一句话也好。记录是了解自己的第一步，我在这里陪着你。';
  }

  const recent7 = getRecentEntries(7);
  const recent30 = getRecentEntries(30);
  const moodDist7 = getMoodDistribution(recent7);
  const moodDist30 = getMoodDistribution(recent30);

  // --- 情绪/心情分析 ---
  if (msg.includes('情绪') || msg.includes('心情') || msg.includes('感受') || msg.includes('状态')) {
    const topMoods = Object.entries(moodDist30)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    let response = `根据你最近30天的日记，我来帮你梳理一下情绪走势：\n\n`;
    if (topMoods.length > 0) {
      response += `你最常出现的情绪是：`;
      response += topMoods
        .map(([mood, count]) => `${moodLabels[mood as MoodType] || mood}（${count}次）`)
        .join('、');
      response += `\n\n`;
    }

    if (recent7.length > 0) {
      const recentMoods = getMoodDistribution(recent7);
      const anxiousCount = (recentMoods['anxious'] || 0) + (recentMoods['irritated'] || 0);
      const calmCount = (recentMoods['calm'] || 0) + (recentMoods['happy'] || 0);

      if (anxiousCount > calmCount) {
        response += `这周你的焦虑和烦躁情绪稍微多了一些。这很正常，每个人都有自己的低谷期。试试在日记里写下让你感到压力的具体事情，把它们从脑子里"倒"出来，会轻松一些。\n\n`;
        response += `一个小建议：当你感到焦虑时，试着做5次深呼吸，然后问自己"这件事一周后还重要吗？"`;
      } else if (calmCount > anxiousCount) {
        response += `这周你的整体情绪比较平稳和积极，这是一个好信号。记住这种感觉，在你状态不好的时候可以回看这些天的日记，提醒自己好的状态是存在的。`;
      } else {
        response += `这周你的情绪比较均衡，各种感受都有出现。情绪的起伏是自然的，重要的是你在持续记录和觉察，这本身就很有价值。`;
      }
    } else {
      response += `最近7天你还没有写日记。没关系，什么时候想写了都可以回来。哪怕只是记录一个词、一句话，都是在和自己对话。`;
    }

    return response;
  }

  // --- 困扰/烦恼/压力分析 ---
  if (msg.includes('困扰') || msg.includes('烦恼') || msg.includes('压力') || msg.includes('问题') || msg.includes('焦虑') || msg.includes('担心')) {
    const keywords = extractKeywords(recent30);
    const topWords = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let response = '';

    const anxiousEntries = recent30.filter(
      (e) => e.mood === 'anxious' || e.mood === 'irritated' || e.mood === 'sad'
    );

    if (topWords.length > 0) {
      response += `我注意到你最近的日记中反复出现这些词：`;
      response += topWords.map(([w]) => `"${w}"`).join('、');
      response += `\n\n`;
    }

    if (anxiousEntries.length > 0) {
      response += `你有${anxiousEntries.length}篇日记记录了不太舒服的情绪。`;
      if (anxiousEntries.length <= 3) {
        const snippets = anxiousEntries.map((e) => {
          const text = e.content.replace(/<[^>]*>/g, '');
          return text.length > 40 ? text.slice(0, 40) + '...' : text;
        });
        response += `比如：\n`;
        snippets.forEach((s) => {
          response += `- "${s}"\n`;
        });
        response += `\n`;
      }
      response += `反复出现的主题往往是内心真正在意的东西。你不需要一次性解决所有问题，但可以一次关注一个。\n\n`;
      response += `一个有用的练习：试着在日记里给这个困扰写一封信——不是要解决它，只是把你对它的所有感受都写下来。有时候，表达本身就是一种释放。`;
    } else if (topWords.length > 0) {
      response += `这些反复出现的词可能暗示了你当前关注的方向。试着围绕它们写一篇日记，看看能发现什么。\n\n`;
      response += `记住：觉察是改变的第一步。你已经在做了。`;
    } else {
      response += `从你的日记中我暂时还没有发现明显的重复主题。继续记录，慢慢地模式会浮现出来的。每个人的节奏不同，不用着急。`;
    }

    return response;
  }

  // --- 建议/改善 ---
  if (msg.includes('建议') || msg.includes('怎么办') || msg.includes('如何') || msg.includes('改善') || msg.includes('帮助')) {
    let response = `基于你的日记记录，我有几个小建议：\n\n`;
    response += `1. **保持记录习惯**：你已经有${allEntries.length}篇日记了，这很棒。ADHD 最大的挑战之一是坚持，而你正在做到。\n\n`;

    if (recent7.length < 3) {
      response += `2. **降低门槛**：这周你写得比较少。试试"两句话日记"——每天只写两句话就好。目标越小，越容易开始。\n\n`;
    }

    const negativeCount = (moodDist30['anxious'] || 0) + (moodDist30['irritated'] || 0) + (moodDist30['sad'] || 0);
    const totalCount = recent30.length;
    if (totalCount > 0 && negativeCount / totalCount > 0.4) {
      response += `2. **关注积极面**：最近负面情绪占比较大。试试每天在日记里写一件"今天还不错的事"，哪怕很小。\n\n`;
    }

    response += `3. **情绪命名**：每次写日记时认真选择情绪标签。研究表明，给情绪命名这个动作本身就能降低它的强度。\n\n`;
    response += `4. **回顾与感恩**：每周花5分钟回看之前的日记，看看自己经历了什么、成长了什么。这能帮你建立连续的自我认知。`;

    return response;
  }

  // --- 趋势/变化 ---
  if (msg.includes('趋势') || msg.includes('变化') || msg.includes('进步') || msg.includes('成长')) {
    let response = `来看看你的日记旅程：\n\n`;
    response += `你已经写了 **${allEntries.length}** 篇日记。\n\n`;

    if (recent30.length > 0) {
      const firstHalf = recent30.slice(Math.floor(recent30.length / 2));
      const secondHalf = recent30.slice(0, Math.floor(recent30.length / 2));
      const moods1 = getMoodDistribution(firstHalf);
      const moods2 = getMoodDistribution(secondHalf);

      const positive1 = (moods1['happy'] || 0) + (moods1['calm'] || 0) + (moods1['excited'] || 0);
      const positive2 = (moods2['happy'] || 0) + (moods2['calm'] || 0) + (moods2['excited'] || 0);

      if (positive2 > positive1) {
        response += `好消息！最近你的积极情绪有上升趋势。继续保持，你正在往好的方向走。`;
      } else if (positive2 < positive1) {
        response += `最近你的情绪可能遇到了一些波动。这是正常的起伏，不代表退步。每一次记录都是在照顾自己。`;
      } else {
        response += `你的情绪状态比较稳定，这是一种难得的能力。`;
      }
    }

    return response;
  }

  // --- 统计/总结 ---
  if (msg.includes('统计') || msg.includes('总结') || msg.includes('多少') || msg.includes('总共') || msg.includes('一共')) {
    let response = `你的日记统计：\n\n`;
    response += `- 总共写了 **${allEntries.length}** 篇日记\n`;

    const allMoods = getMoodDistribution(allEntries);
    response += `- 情绪分布：\n`;
    Object.entries(allMoods)
      .sort((a, b) => b[1] - a[1])
      .forEach(([mood, count]) => {
        const pct = Math.round((count / allEntries.length) * 100);
        response += `  - ${moodLabels[mood as MoodType] || mood}：${count}次（${pct}%）\n`;
      });

    if (allEntries.length > 0) {
      const firstDate = new Date(allEntries[allEntries.length - 1].createdAt);
      const daysSince = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      response += `\n- 从 ${firstDate.toLocaleDateString('zh-CN')} 开始记录，已经坚持了 ${daysSince} 天`;
    }

    return response;
  }

  // --- 搜索特定内容 ---
  if (msg.includes('写过') || msg.includes('提到') || msg.includes('记录') || msg.includes('有没有')) {
    const possibleKeywords = userMessage.match(/[\u4e00-\u9fa5]{2,4}/g);
    if (possibleKeywords) {
      const stopWords = new Set(['写过', '提到', '记录', '有没有', '日记', '里面', '我的', '最近', '以前', '之前']);
      const searchWords = possibleKeywords.filter((w) => !stopWords.has(w));

      if (searchWords.length > 0) {
        const searchWord = searchWords[searchWords.length - 1];
        const found = findEntriesContaining(searchWord);

        if (found.length > 0) {
          let response = `你在 **${found.length}** 篇日记中提到过"${searchWord}"：\n\n`;
          found.slice(0, 3).forEach((e) => {
            const text = e.content.replace(/<[^>]*>/g, '');
            const snippet = text.length > 60 ? text.slice(0, 60) + '...' : text;
            const date = new Date(e.createdAt).toLocaleDateString('zh-CN');
            response += `- ${date}：${snippet}\n`;
          });
          if (found.length > 3) {
            response += `\n...还有${found.length - 3}篇`;
          }
          return response;
        } else {
          return `我在你的日记中没有找到关于"${searchWord}"的记录。也许你可以现在写一篇关于它的日记？`;
        }
      }
    }
  }

  // --- 今天/昨天/这周 ---
  if (msg.includes('今天') || msg.includes('昨天') || msg.includes('这周') || msg.includes('本周')) {
    let targetEntries: JournalEntry[];
    let timeLabel: string;

    if (msg.includes('今天')) {
      const today = new Date().toISOString().split('T')[0];
      targetEntries = getRecentEntries(1).filter((e) => e.createdAt.startsWith(today));
      timeLabel = '今天';
    } else if (msg.includes('昨天')) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      targetEntries = allEntries.filter((e) => e.createdAt.startsWith(yesterday));
      timeLabel = '昨天';
    } else {
      targetEntries = recent7;
      timeLabel = '这周';
    }

    if (targetEntries.length === 0) {
      return `${timeLabel}你还没有写日记呢。${msg.includes('今天') ? '现在开始写也不晚！' : '下次记得记录哦。'}`;
    }

    const moods = getMoodDistribution(targetEntries);
    let response = `${timeLabel}你写了 **${targetEntries.length}** 篇日记：\n\n`;
    Object.entries(moods)
      .sort((a, b) => b[1] - a[1])
      .forEach(([mood, count]) => {
        response += `- ${moodLabels[mood as MoodType] || mood}：${count}次\n`;
      });

    const latestEntry = targetEntries[0];
    const text = latestEntry.content.replace(/<[^>]*>/g, '');
    if (text.length > 0) {
      response += `\n最近一篇的摘要：\n"${text.length > 80 ? text.slice(0, 80) + '...' : text}"`;
    }

    return response;
  }

  // --- 睡眠/工作/学习/社交等特定话题 ---
  const topicKeywords: Record<string, string[]> = {
    '睡眠': ['睡', '失眠', '熬夜', '早起', '梦', '困', '累', '疲惫', '休息'],
    '工作': ['工作', '上班', '同事', '老板', '加班', '项目', '任务', '开会'],
    '学习': ['学习', '考试', '作业', '课程', '读书', '研究', '论文'],
    '社交': ['朋友', '社交', '聚会', '聊天', '约会', '人际', '关系'],
    '运动': ['运动', '跑步', '健身', '锻炼', '瑜伽', '散步', '游泳'],
    '饮食': ['吃', '饭', '餐', '饿', '美食', '做饭', '外卖', '零食'],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (msg.includes(topic)) {
      const relatedEntries = recent30.filter((e) => {
        const text = e.content.replace(/<[^>]*>/g, '');
        return keywords.some((kw) => text.includes(kw));
      });

      if (relatedEntries.length > 0) {
        let response = `关于"${topic}"，你在最近30天有${relatedEntries.length}篇日记提到了相关内容：\n\n`;
        relatedEntries.slice(0, 3).forEach((e) => {
          const text = e.content.replace(/<[^>]*>/g, '');
          const relevantSentences = text.split(/[。！？\n]/).filter((s) =>
            keywords.some((kw) => s.includes(kw))
          );
          const snippet = relevantSentences.length > 0
            ? relevantSentences[0].trim()
            : (text.length > 60 ? text.slice(0, 60) + '...' : text);
          const date = new Date(e.createdAt).toLocaleDateString('zh-CN');
          response += `- ${date}：${snippet}\n`;
        });

        if (topic === '睡眠') {
          response += `\n好的睡眠对 ADHD 尤其重要。如果睡眠困扰持续，可以试试在日记里记录每天的入睡时间和起床时间，看看有没有规律。`;
        } else if (topic === '运动') {
          response += `\n运动对 ADHD 非常有帮助，它能提高注意力和情绪稳定性。哪怕只是每天散步10分钟也是好的开始。`;
        }

        return response;
      } else {
        return `你在最近的日记中没有提到关于"${topic}"的内容。如果你在这方面有困扰或想法，可以写一篇日记记录下来。`;
      }
    }
  }

  // --- 你好/打招呼 ---
  if (msg.includes('你好') || msg.includes('嗨') || msg.includes('hello') || msg.includes('hi') || msg === '在吗') {
    return `你好呀！我是你的 AI 助手，可以帮你分析日记中的情绪模式和趋势。\n\n你可以问我：\n- "我这周的情绪怎么样？"\n- "我最近有什么反复提到的困扰？"\n- "帮我总结一下日记统计"\n- "我写过关于睡眠的内容吗？"\n- "给我一些改善建议"`;
  }

  // --- 谢谢 ---
  if (msg.includes('谢谢') || msg.includes('感谢') || msg.includes('thx')) {
    return `不用客气！能帮到你我很开心。记得随时来找我聊天，或者在日记里写下你的想法。你做得很好，继续加油。`;
  }

  // --- 默认回复：更智能的兜底 ---
  const possibleKeywords = userMessage.match(/[\u4e00-\u9fa5]{2,4}/g);
  if (possibleKeywords) {
    const stopWords = new Set(['帮我', '分析', '看看', '告诉', '一下', '什么', '怎么', '这个', '那个', '可以', '能不能', '想', '问问']);
    const searchWords = possibleKeywords.filter((w) => !stopWords.has(w));

    if (searchWords.length > 0) {
      const searchWord = searchWords[searchWords.length - 1];
      const found = findEntriesContaining(searchWord);

      if (found.length > 0) {
        let response = `关于"${searchWord}"，我在你的日记中找到了${found.length}篇相关内容：\n\n`;
        found.slice(0, 2).forEach((e) => {
          const text = e.content.replace(/<[^>]*>/g, '');
          const snippet = text.length > 60 ? text.slice(0, 60) + '...' : text;
          const date = new Date(e.createdAt).toLocaleDateString('zh-CN');
          const mood = moodLabels[e.mood];
          response += `- ${date}（${mood}）：${snippet}\n`;
        });
        response += `\n你想了解更多关于"${searchWord}"的内容吗？或者可以问我其他问题。`;
        return response;
      }
    }
  }

  // Final fallback - varied tips
  const tips = [
    `你的日记是你和自己对话的空间。没有对错，没有好坏，只有真实的你。`,
    `试试在日记里画一个简单的"能量曲线"——从1到10，给今天的精力打分。这能帮你更好地了解自己的节奏。`,
    `ADHD 的大脑不是有缺陷的大脑，只是 differently wired 的大脑。你在用一种独特的方式感知世界。`,
    `如果今天不知道写什么，试试这个：用三个词形容今天，然后解释为什么选这三个词。`,
    `记录不一定要深刻。"今天吃了一碗好吃的面"也是值得记住的一天。`,
    `你已经在做一件很了不起的事了——面对自己。很多人连这一步都不敢迈出来。`,
    `试试问我更具体的问题，比如"我这周的心情怎么样"、"我写过关于工作的内容吗"、"帮我总结一下日记"。`,
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  let response = `${randomTip}\n\n`;
  response += `你可以试试问我这些问题：\n`;
  response += `- "我这周的情绪怎么样？"\n`;
  response += `- "我最近有什么反复提到的困扰？"\n`;
  response += `- "帮我总结一下日记统计"\n`;
  response += `- "我写过关于睡眠/工作/运动的内容吗？"\n`;
  response += `- "给我一些改善建议"\n`;
  response += `- "我的情绪趋势如何？"`;

  return response;
}
