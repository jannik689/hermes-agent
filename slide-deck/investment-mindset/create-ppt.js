const PptxGenJS = require('pptxgenjs');

// Create a new presentation
const pres = new PptxGenJS();

// Define color palette - Warm Terracotta theme for investment/education
const colors = {
  primary: 'B85042',      // terracotta
  secondary: 'E7E8D1',    // sand
  accent: 'A7BEAE',       // sage
  dark: '2C3E50',         // dark blue-gray
  light: 'FDFBF7',        // cream
  white: 'FFFFFF',
  coral: 'F96167',
  navy: '2F3C7E'
};

// Set presentation properties
pres.layout = 'LAYOUT_16x9';
pres.title = '投资心态管理';
pres.author = 'Hermes Agent';

// Master slide with background
pres.defineSlideMaster({
  title: 'MASTER_CONTENT',
  background: { color: colors.light },
  objects: [
    // Top accent bar
    { rect: { x: 0, y: 0, w: '100%', h: 0.3, fill: { color: colors.primary } } },
    // Bottom accent bar
    { rect: { x: 0, y: 7.2, w: '100%', h: 0.2, fill: { color: colors.accent } } }
  ],
  slideNumber: { x: 0.3, y: 7.3, color: colors.dark, fontSize: 12 }
});

// Title slide master
pres.defineSlideMaster({
  title: 'MASTER_TITLE',
  background: { color: colors.navy },
  objects: [
    { rect: { x: 0, y: 0, w: '100%', h: 7.5, fill: { color: colors.navy } } }
  ]
});

// ============ SLIDE 1: COVER ============
let slide = pres.addSlide({ masterName: 'MASTER_TITLE' });
slide.addText('投资心态管理', {
  x: 0.5, y: 2, w: 9, h: 1.5,
  fontSize: 54, color: colors.white, bold: true, align: 'center',
  fontFace: 'Arial Black'
});
slide.addText('掌控情绪，理性决策', {
  x: 0.5, y: 3.5, w: 9, h: 0.8,
  fontSize: 28, color: colors.secondary, align: 'center', italic: true
});
slide.addText('成为更聪明的投资者', {
  x: 0.5, y: 4.5, w: 9, h: 0.6,
  fontSize: 18, color: colors.accent, align: 'center'
});

// ============ SLIDE 2: TABLE OF CONTENTS ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('目录', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

const topics = [
  '为什么心态决定投资成败',
  '常见的投资心理陷阱',
  '情绪管理策略',
  '建立理性投资框架',
  '长期主义思维',
  '实战练习与总结'
];

topics.forEach((topic, i) => {
  const yPos = 1.8 + (i * 0.9);
  // Number circle
  slide.addShape(pres.ShapeType.ellipse, {
    x: 0.7, y: yPos, w: 0.5, h: 0.5,
    fill: { color: colors.primary }, line: { color: colors.primary }
  });
  slide.addText(`${i + 1}`, {
    x: 0.7, y: yPos + 0.12, w: 0.5, h: 0.3,
    fontSize: 16, color: colors.white, bold: true, align: 'center'
  });
  // Topic text
  slide.addText(topic, {
    x: 1.4, y: yPos + 0.15, w: 8, h: 0.5,
    fontSize: 20, color: colors.dark, fontFace: 'Calibri'
  });
});

// ============ SLIDE 3: WHY MINDSET MATTERS ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('为什么心态决定投资成败', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Left column - Investment is cognitive realization
slide.addText('投资是认知的变现', {
  x: 0.5, y: 1.6, w: 4.5, h: 0.5,
  fontSize: 24, color: colors.navy, bold: true
});
slide.addText([
  { text: '70% 心理因素', options: { bold: true, color: colors.coral } },
  { text: ' vs ', options: { color: colors.dark } },
  { text: '30% 技术分析', options: { bold: true, color: colors.accent } }
], {
  x: 0.5, y: 2.3, w: 4.5, h: 0.4, fontSize: 18, color: colors.dark
});
slide.addText('同样的策略，不同的心态 = 不同的结果', {
  x: 0.5, y: 2.9, w: 4.5, h: 0.4, fontSize: 16, color: colors.dark, italic: true
});
slide.addText('市场波动考验的是人性，不是智商', {
  x: 0.5, y: 3.5, w: 4.5, h: 0.4, fontSize: 16, color: colors.dark, italic: true
});

// Right column - Success traits
slide.addText('成功投资者的共同特质', {
  x: 5.2, y: 1.6, w: 4.3, h: 0.5,
  fontSize: 20, color: colors.navy, bold: true
});

const traits = ['情绪稳定', '纪律性强', '持续学习', '承认错误'];
traits.forEach((trait, i) => {
  const yPos = 2.3 + (i * 0.7);
  slide.addText('✓', {
    x: 5.2, y: yPos, w: 0.3, h: 0.5,
    fontSize: 20, color: colors.accent, bold: true
  });
  slide.addText(trait, {
    x: 5.6, y: yPos + 0.05, w: 4, h: 0.5,
    fontSize: 18, color: colors.dark
  });
});

// ============ SLIDE 4: PSYCHOLOGICAL TRAPS (1) ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('常见的投资心理陷阱 (1)', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Loss Aversion
slide.addShape(pres.ShapeType.roundRect, {
  x: 0.5, y: 1.6, w: 8.5, h: 2.5,
  fill: { color: 'F5F5F5' }, line: { color: colors.primary, width: 2 }, radius: 0.2
});
slide.addText('🎯 损失厌恶 (Loss Aversion)', {
  x: 0.7, y: 1.7, w: 8.1, h: 0.5,
  fontSize: 20, color: colors.navy, bold: true
});
slide.addText('损失 100 元的痛苦 > 获得 100 元的快乐', {
  x: 0.7, y: 2.3, w: 8.1, h: 0.35,
  fontSize: 16, color: colors.dark
});
slide.addText('表现：', { x: 0.7, y: 2.75, w: 0.6, h: 0.3, fontSize: 14, color: colors.coral, bold: true });
slide.addText('过早卖出盈利股，死守亏损股', { x: 1.3, y: 2.75, w: 7.5, h: 0.3, fontSize: 14, color: colors.dark });
slide.addText('对策：', { x: 0.7, y: 3.15, w: 0.6, h: 0.3, fontSize: 14, color: colors.accent, bold: true });
slide.addText('设定止损/止盈点，严格执行', { x: 1.3, y: 3.15, w: 7.5, h: 0.3, fontSize: 14, color: colors.dark });

// Confirmation Bias
slide.addShape(pres.ShapeType.roundRect, {
  x: 0.5, y: 4.4, w: 8.5, h: 2.5,
  fill: { color: 'F5F5F5' }, line: { color: colors.accent, width: 2 }, radius: 0.2
});
slide.addText('🎯 确认偏误 (Confirmation Bias)', {
  x: 0.7, y: 4.5, w: 8.1, h: 0.5,
  fontSize: 20, color: colors.navy, bold: true
});
slide.addText('只关注支持自己观点的信息', {
  x: 0.7, y: 5.1, w: 8.1, h: 0.35,
  fontSize: 16, color: colors.dark
});
slide.addText('表现：', { x: 0.7, y: 5.55, w: 0.6, h: 0.3, fontSize: 14, color: colors.coral, bold: true });
slide.addText('忽视风险信号，只听利好消息', { x: 1.3, y: 5.55, w: 7.5, h: 0.3, fontSize: 14, color: colors.dark });
slide.addText('对策：', { x: 0.7, y: 5.95, w: 0.6, h: 0.3, fontSize: 14, color: colors.accent, bold: true });
slide.addText('主动寻找反面证据，挑战自己的假设', { x: 1.3, y: 5.95, w: 7.5, h: 0.3, fontSize: 14, color: colors.dark });

// ============ SLIDE 5: PSYCHOLOGICAL TRAPS (2) ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('常见的投资心理陷阱 (2)', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

const traps = [
  {
    title: '🎯 从众心理 (Herd Mentality)',
    desc: '别人买我也买，别人卖我也卖',
    behavior: '追涨杀跌，高位接盘',
    solution: '独立思考，逆向思维'
  },
  {
    title: '🎯 过度自信 (Overconfidence)',
    desc: '高估自己的能力，低估市场风险',
    behavior: '频繁交易，重仓单一标的',
    solution: '记录交易日志，复盘错误'
  },
  {
    title: '🎯 锚定效应 (Anchoring)',
    desc: '过度依赖某个价格参考点',
    behavior: '「等回到成本价就卖」',
    solution: '关注基本面，而非成本价'
  }
];

traps.forEach((trap, i) => {
  const yPos = 1.6 + (i * 1.9);
  slide.addText(trap.title, {
    x: 0.5, y: yPos, w: 9, h: 0.45,
    fontSize: 18, color: colors.navy, bold: true
  });
  slide.addText(trap.desc, {
    x: 0.5, y: yPos + 0.45, w: 9, h: 0.3,
    fontSize: 14, color: colors.dark, italic: true
  });
  slide.addText(`表现：${trap.behavior}`, {
    x: 0.5, y: yPos + 0.85, w: 4.4, h: 0.3,
    fontSize: 13, color: colors.dark
  });
  slide.addText(`对策：${trap.solution}`, {
    x: 5.1, y: yPos + 0.85, w: 4.4, h: 0.3,
    fontSize: 13, color: colors.dark, bold: true
  });
});

// ============ SLIDE 6: EMOTION MANAGEMENT ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('情绪管理策略', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Emotion table
slide.addText('🧘 识别情绪信号', {
  x: 0.5, y: 1.6, w: 4, h: 0.5,
  fontSize: 22, color: colors.navy, bold: true
});

// Table header
const tableY = 2.2;
slide.addShape(pres.ShapeType.rect, { x: 0.5, y: tableY, w: 8.5, h: 0.5, fill: { color: colors.primary } });
slide.addText('情绪', { x: 0.6, y: tableY + 0.12, w: 1.5, h: 0.3, fontSize: 14, color: colors.white, bold: true });
slide.addText('身体信号', { x: 2.2, y: tableY + 0.12, w: 2.5, h: 0.3, fontSize: 14, color: colors.white, bold: true });
slide.addText('投资风险', { x: 5.5, y: tableY + 0.12, w: 3, h: 0.3, fontSize: 14, color: colors.white, bold: true });

const emotions = [
  ['贪婪', '心跳加速，兴奋', '追高，重仓'],
  ['恐惧', '焦虑，失眠', '割肉，踏空'],
  ['FOMO', '急躁，不安', '盲目跟风']
];

emotions.forEach((row, i) => {
  const yPos = tableY + 0.6 + (i * 0.55);
  const bgColor = i % 2 === 0 ? 'FAFAFA' : 'FFFFFF';
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: yPos, w: 8.5, h: 0.5, fill: { color: bgColor }, line: { color: 'DDDDDD' } });
  slide.addText(row[0], { x: 0.6, y: yPos + 0.12, w: 1.5, h: 0.3, fontSize: 13, color: colors.coral, bold: true });
  slide.addText(row[1], { x: 2.2, y: yPos + 0.12, w: 2.5, h: 0.3, fontSize: 13, color: colors.dark });
  slide.addText(row[2], { x: 5.5, y: yPos + 0.12, w: 3, h: 0.3, fontSize: 13, color: colors.dark });
});

// Firewall strategies
slide.addText('🛡️ 建立情绪防火墙', {
  x: 0.5, y: 4.3, w: 4, h: 0.5,
  fontSize: 22, color: colors.navy, bold: true
});

const strategies = [
  '24 小时规则：重大决策前冷静一天',
  '写下来：记录买入/卖出理由',
  '设定限额：单笔不超过总资金的 X%',
  '定期复盘：每周/每月回顾交易'
];

strategies.forEach((strat, i) => {
  const yPos = 5.0 + (i * 0.55);
  slide.addText(`${i + 1}.`, {
    x: 0.5, y: yPos, w: 0.4, h: 0.5,
    fontSize: 16, color: colors.accent, bold: true
  });
  slide.addText(strat, {
    x: 1.0, y: yPos + 0.05, w: 8, h: 0.5,
    fontSize: 15, color: colors.dark
  });
});

// ============ SLIDE 7: INVESTMENT FRAMEWORK ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('建立理性投资框架', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Checklist
slide.addText('📋 投资检查清单', {
  x: 0.5, y: 1.6, w: 4.5, h: 0.5,
  fontSize: 22, color: colors.navy, bold: true
});

const checklist = [
  '这笔投资符合我的长期目标吗？',
  '我理解这个标的的盈利模式吗？',
  '最坏情况下会损失多少？',
  '如果下跌 30%，我会加仓还是卖出？',
  '我是在投资还是在投机？'
];

checklist.forEach((item, i) => {
  const yPos = 2.3 + (i * 0.65);
  slide.addText('☐', {
    x: 0.5, y: yPos, w: 0.4, h: 0.5,
    fontSize: 18, color: colors.primary
  });
  slide.addText(item, {
    x: 1.0, y: yPos + 0.08, w: 8, h: 0.5,
    fontSize: 15, color: colors.dark
  });
});

// Position management
slide.addShape(pres.ShapeType.roundRect, {
  x: 5.2, y: 1.6, w: 4.3, h: 4.5,
  fill: { color: colors.secondary }, line: { color: colors.accent, width: 2 }, radius: 0.2
});
slide.addText('📊 仓位管理原则', {
  x: 5.4, y: 1.7, w: 4, h: 0.5,
  fontSize: 20, color: colors.navy, bold: true
});
slide.addText('单只股票 ≤ 10% 总仓位', {
  x: 5.4, y: 2.4, w: 4, h: 0.5,
  fontSize: 17, color: colors.dark, bold: true
});
slide.addText('单一行业 ≤ 30% 总仓位', {
  x: 5.4, y: 3.0, w: 4, h: 0.5,
  fontSize: 17, color: colors.dark, bold: true
});
slide.addText('永远保留 20% 现金', {
  x: 5.4, y: 3.6, w: 4, h: 0.5,
  fontSize: 17, color: colors.dark, bold: true
});
slide.addText('应对机会', {
  x: 5.4, y: 4.1, w: 4, h: 0.4,
  fontSize: 14, color: colors.dark, italic: true
});

// ============ SLIDE 8: LONG-TERM THINKING ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('长期主义思维', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Left - Power of time
slide.addText('⏰ 时间是你的朋友', {
  x: 0.5, y: 1.6, w: 4.5, h: 0.5,
  fontSize: 22, color: colors.navy, bold: true
});
slide.addText('复利的力量：', {
  x: 0.5, y: 2.3, w: 4.5, h: 0.4,
  fontSize: 17, color: colors.dark, bold: true
});
slide.addText('年化 15%，10 年=4 倍', {
  x: 0.5, y: 2.75, w: 4.5, h: 0.35,
  fontSize: 16, color: colors.coral, bold: true
});
slide.addText('短期波动是噪音，长期趋势是信号', {
  x: 0.5, y: 3.3, w: 4.5, h: 0.35,
  fontSize: 15, color: colors.dark, italic: true
});
slide.addText('优秀公司需要时间成长', {
  x: 0.5, y: 3.8, w: 4.5, h: 0.35,
  fontSize: 15, color: colors.dark, italic: true
});

// Right - Planter vs Hunter
slide.addText('🌱 种植者思维 vs 猎人思维', {
  x: 5.2, y: 1.6, w: 4.3, h: 0.5,
  fontSize: 20, color: colors.navy, bold: true
});

// Planter column
slide.addShape(pres.ShapeType.roundRect, {
  x: 5.2, y: 2.3, w: 2, h: 2.8,
  fill: { color: 'E8F5E9' }, line: { color: colors.accent, width: 2 }, radius: 0.2
});
slide.addText('种植者', {
  x: 5.2, y: 2.4, w: 2, h: 0.4,
  fontSize: 16, color: colors.accent, bold: true, align: 'center'
});
['耐心培育', '关注成长', '长期持有', '收获季节'].forEach((item, i) => {
  slide.addText('✓ ' + item, {
    x: 5.3, y: 2.85 + (i * 0.55), w: 1.8, h: 0.4,
    fontSize: 13, color: colors.dark, align: 'center'
  });
});

// Hunter column
slide.addShape(pres.ShapeType.roundRect, {
  x: 7.5, y: 2.3, w: 2, h: 2.8,
  fill: { color: 'FFEBEE' }, line: { color: colors.coral, width: 2 }, radius: 0.2
});
slide.addText('猎人', {
  x: 7.5, y: 2.4, w: 2, h: 0.4,
  fontSize: 16, color: colors.coral, bold: true, align: 'center'
});
['快速捕获', '关注价格', '频繁交易', '随时出击'].forEach((item, i) => {
  slide.addText('✗ ' + item, {
    x: 7.6, y: 2.85 + (i * 0.55), w: 1.8, h: 0.4,
    fontSize: 13, color: colors.dark, align: 'center'
  });
});

// Bottom tagline
slide.addText('做时间的盟友，不做市场的奴隶', {
  x: 0.5, y: 5.8, w: 9, h: 0.6,
  fontSize: 20, color: colors.primary, bold: true, align: 'center', italic: true
});

// ============ SLIDE 9: PRACTICE EXERCISES ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('实战练习：心态自检', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Weekly questions
slide.addText('📝 每周自问', {
  x: 0.5, y: 1.6, w: 4, h: 0.5,
  fontSize: 22, color: colors.navy, bold: true
});

const questions = [
  '本周最有情绪化的交易是什么？',
  '有没有违背自己的投资原则？',
  '从错误中学到了什么？',
  '下周如何改进？'
];

questions.forEach((q, i) => {
  const yPos = 2.3 + (i * 0.7);
  slide.addText(`${i + 1}.`, {
    x: 0.5, y: yPos, w: 0.4, h: 0.6,
    fontSize: 16, color: colors.accent, bold: true
  });
  slide.addText(q, {
    x: 1.0, y: yPos + 0.08, w: 7.5, h: 0.6,
    fontSize: 15, color: colors.dark
  });
});

// Investment journal
slide.addShape(pres.ShapeType.roundRect, {
  x: 5.2, y: 1.6, w: 4.3, h: 4.8,
  fill: { color: '2C3E50' }, line: { color: colors.navy, width: 2 }, radius: 0.2
});
slide.addText('📈 建立投资日志', {
  x: 5.4, y: 1.7, w: 4, h: 0.5,
  fontSize: 20, color: colors.white, bold: true
});

const journalTemplate = [
  '日期：2024-XX-XX',
  '标的：XXX',
  '操作：买入/卖出',
  '理由：_______',
  '情绪状态：_______',
  '结果反思：_______'
];

journalTemplate.forEach((line, i) => {
  slide.addText(line, {
    x: 5.4, y: 2.3 + (i * 0.55), w: 4, h: 0.45,
    fontSize: 13, color: colors.secondary, fontFace: 'Consolas'
  });
});

// ============ SLIDE 10: MINDSET PYRAMID ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('总结：投资心态金字塔', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

// Pyramid visualization
const pyramidY = 1.8;
// Base
slide.addShape(pres.ShapeType.triangle, {
  x: 2.5, y: pyramidY, w: 5, h: 4.5, flip: 'v',
  fill: { color: colors.light }, line: { color: colors.dark, width: 1 }
});

// Base level
slide.addShape(pres.ShapeType.rect, {
  x: 2.5, y: pyramidY + 3, w: 5, h: 1.5,
  fill: { color: colors.accent }, line: { color: colors.accent }
});
slide.addText('情绪觉察', {
  x: 2.5, y: pyramidY + 3.5, w: 5, h: 0.5,
  fontSize: 16, color: colors.white, bold: true, align: 'center'
});
slide.addText('底层：识别自己的情绪', {
  x: 2.5, y: pyramidY + 4.05, w: 5, h: 0.35,
  fontSize: 12, color: colors.white, align: 'center'
});

// Middle level
slide.addShape(pres.ShapeType.rect, {
  x: 3.5, y: pyramidY + 2, w: 3, h: 1,
  fill: { color: colors.primary }, line: { color: colors.primary }
});
slide.addText('理性框架', {
  x: 3.5, y: pyramidY + 2.3, w: 3, h: 0.4,
  fontSize: 14, color: colors.white, bold: true, align: 'center'
});
slide.addText('中层：建立投资系统', {
  x: 3.5, y: pyramidY + 2.75, w: 3, h: 0.3,
  fontSize: 11, color: colors.white, align: 'center'
});

// Top level
slide.addShape(pres.ShapeType.rect, {
  x: 4.25, y: pyramidY + 1, w: 1.5, h: 1,
  fill: { color: colors.coral }, line: { color: colors.coral }
});
slide.addText('知行合一', {
  x: 4.25, y: pyramidY + 1.3, w: 1.5, h: 0.4,
  fontSize: 12, color: colors.white, bold: true, align: 'center'
});
slide.addText('顶层：纪律性行动', {
  x: 4.25, y: pyramidY + 1.75, w: 1.5, h: 0.3,
  fontSize: 10, color: colors.white, align: 'center'
});

// Key points on right
slide.addText('核心要点', {
  x: 6, y: pyramidY + 0.5, w: 3.5, h: 0.5,
  fontSize: 18, color: colors.navy, bold: true
});

const keyPoints = [
  '觉察：识别自己的情绪',
  '理解：知道心理陷阱',
  '框架：建立投资系统',
  '执行：纪律性行动'
];

keyPoints.forEach((point, i) => {
  slide.addText(`${i + 1}.`, {
    x: 6, y: pyramidY + 1.2 + (i * 0.7), w: 0.4, h: 0.6,
    fontSize: 14, color: colors.primary, bold: true
  });
  slide.addText(point, {
    x: 6.5, y: pyramidY + 1.28 + (i * 0.7), w: 3, h: 0.6,
    fontSize: 14, color: colors.dark
  });
});

// ============ SLIDE 11: KEY TAKEAWAYS ============
slide = pres.addSlide({ masterName: 'MASTER_CONTENT' });
slide.addText('核心要点回顾', {
  x: 0.5, y: 0.5, w: 9, h: 0.8,
  fontSize: 36, color: colors.primary, bold: true, fontFace: 'Arial Black'
});

const takeaways = [
  {
    icon: '🧠',
    title: '心态决定 70% 的投资结果',
    desc: '情绪管理比技术分析更重要'
  },
  {
    icon: '⚠️',
    title: '警惕 5 大心理陷阱',
    desc: '损失厌恶、确认偏误、从众心理、过度自信、锚定效应'
  },
  {
    icon: '🛡️',
    title: '建立情绪防火墙',
    desc: '24 小时规则、写下来、设限额、定期复盘'
  },
  {
    icon: '📋',
    title: '使用检查清单和仓位管理',
    desc: '单只≤10%，单行业≤30%，保留 20% 现金'
  },
  {
    icon: '⏰',
    title: '做长期主义者',
    desc: '复利需要时间，短期波动是噪音'
  }
];

takeaways.forEach((item, i) => {
  const yPos = 1.6 + (i * 1.15);
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: yPos, w: 9, h: 1,
    fill: { color: i % 2 === 0 ? 'F5F5F5' : 'FFFFFF' },
    line: { color: colors.accent, width: 1 }, radius: 0.15
  });
  slide.addText(item.icon, {
    x: 0.6, y: yPos + 0.1, w: 0.6, h: 0.8,
    fontSize: 32, align: 'center'
  });
  slide.addText(item.title, {
    x: 1.3, y: yPos + 0.15, w: 8, h: 0.4,
    fontSize: 18, color: colors.navy, bold: true
  });
  slide.addText(item.desc, {
    x: 1.3, y: yPos + 0.55, w: 8, h: 0.35,
    fontSize: 14, color: colors.dark
  });
});

// ============ SLIDE 12: BACK COVER ============
slide = pres.addSlide({ masterName: 'MASTER_TITLE' });
slide.addText('谢谢观看', {
  x: 0.5, y: 2, w: 9, h: 1.5,
  fontSize: 48, color: colors.white, bold: true, align: 'center',
  fontFace: 'Arial Black'
});
slide.addText('投资是一场修行', {
  x: 0.5, y: 3.8, w: 9, h: 0.8,
  fontSize: 28, color: colors.secondary, align: 'center', italic: true
});
slide.addText('心态决定高度', {
  x: 0.5, y: 4.6, w: 9, h: 0.8,
  fontSize: 28, color: colors.secondary, align: 'center', italic: true
});

// Recommended reading
slide.addText('📚 推荐阅读：', {
  x: 0.5, y: 5.8, w: 9, h: 0.5,
  fontSize: 18, color: colors.accent, bold: true, align: 'center'
});
slide.addText('《思考，快与慢》 | 《投资最重要的事》 | 《穷查理宝典》', {
  x: 0.5, y: 6.3, w: 9, h: 0.4,
  fontSize: 14, color: colors.secondary, align: 'center'
});

// Save the presentation
(async () => {
  await pres.writeFile({ fileName: '/Users/tuim/Documents/GitHub/aiproject/typeclaw/slide-deck/investment-mindset/investment-mindset.pptx' });
  console.log('PPTX file created successfully!');
})();
