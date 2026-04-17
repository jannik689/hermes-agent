const PptxGenJS = require('pptxgenjs');

// 创建演示文稿
const pres = new PptxGenJS();

// 配色方案 - Teal Trust (投资主题 - 传达信任和专业)
const colors = {
  primary: '028090',    // 深青色 - 主色
  secondary: '00A896',  // 海泡沫绿 - 辅助色
  accent: '02C39A',     // 薄荷绿 - 强调色
  dark: '024959',       // 深蓝绿 - 深色背景
  light: 'E8F4F4',      // 浅青色 - 浅色背景
  white: 'FFFFFF',
  text: '1A1A1A',
  gray: '666666'
};

// 设置默认字体和布局
pres.layout = 'LAYOUT_16x9';
pres.rtl = false;

// ==================== 幻灯片 1: 封面 ====================
let slide1 = pres.addSlide();
slide1.background = { color: colors.dark };

// 标题
slide1.addText('投资心态管理', {
  x: 0.5, y: 2, w: 9, h: 1,
  fontSize: 44,
  color: colors.white,
  bold: true,
  align: 'center',
  fontFace: '微软雅黑'
});

// 副标题
slide1.addText('掌控情绪 · 理性决策 · 长期致胜', {
  x: 0.5, y: 3.2, w: 9, h: 0.6,
  fontSize: 20,
  color: colors.accent,
  align: 'center',
  fontFace: '微软雅黑'
});

// 装饰线条
slide1.addShape(pres.ShapeType.rect, {
  x: 3.5, y: 4, w: 3, h: 0.1,
  fill: { color: colors.accent }
});

// 底部信息
slide1.addText('专业投资者必修课程', {
  x: 0.5, y: 5, w: 9, h: 0.5,
  fontSize: 14,
  color: colors.light,
  align: 'center',
  fontFace: '微软雅黑'
});

// ==================== 幻灯片 2: 目录 ====================
let slide2 = pres.addSlide();
slide2.background = { color: colors.white };

// 标题
slide2.addText('课程目录', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.primary,
  bold: true,
  fontFace: '微软雅黑'
});

// 目录项
const agenda = [
  { num: '01', title: '什么是投资心态', desc: '理解心态对投资的影响' },
  { num: '02', title: '常见心理陷阱', desc: '识别并避免认知偏差' },
  { num: '03', title: '情绪管理策略', desc: '控制情绪对决策的干扰' },
  { num: '04', title: '培养良好心态', desc: '建立长期成功的基础' },
  { num: '05', title: '实用技巧工具', desc: '日常练习与方法' },
  { num: '06', title: '总结与行动', desc: '制定个人改进计划' }
];

agenda.forEach((item, index) => {
  const y = 1.5 + (index * 1.1);
  
  // 序号圆圈
  slide2.addShape(pres.ShapeType.ellipse, {
    x: 0.5, y: y, w: 0.8, h: 0.8,
    fill: { color: colors.primary },
    line: { color: colors.primary, width: 0 }
  });
  
  // 序号
  slide2.addText(item.num, {
    x: 0.5, y: y + 0.15, w: 0.8, h: 0.5,
    fontSize: 16,
    color: colors.white,
    bold: true,
    align: 'center',
    fontFace: '微软雅黑'
  });
  
  // 标题
  slide2.addText(item.title, {
    x: 1.5, y: y + 0.1, w: 3, h: 0.4,
    fontSize: 18,
    color: colors.dark,
    bold: true,
    fontFace: '微软雅黑'
  });
  
  // 描述
  slide2.addText(item.desc, {
    x: 1.5, y: y + 0.5, w: 3.5, h: 0.3,
    fontSize: 14,
    color: colors.gray,
    fontFace: '微软雅黑'
  });
});

// ==================== 幻灯片 3: 什么是投资心态 ====================
let slide3 = pres.addSlide();
slide3.background = { color: colors.light };

// 标题
slide3.addText('什么是投资心态？', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.primary,
  bold: true,
  fontFace: '微软雅黑'
});

// 定义框
slide3.addShape(pres.ShapeType.roundRect, {
  x: 0.5, y: 1.3, w: 9, h: 1.5,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 },
  rectRadius: 0.2
});

slide3.addText('投资心态是投资者在面对市场波动、盈亏变化时，\n所表现出的心理状态和思维模式的总和。', {
  x: 0.7, y: 1.6, w: 8.6, h: 1,
  fontSize: 18,
  color: colors.text,
  align: 'center',
  fontFace: '微软雅黑',
  valign: 'middle'
});

// 三个关键点
const keyPoints = [
  { icon: '🧠', title: '认知层面', desc: '如何理解市场、风险和机会' },
  { icon: '💝', title: '情绪层面', desc: '面对盈亏时的心理反应' },
  { icon: '🎯', title: '行为层面', desc: '决策和执行的一致性' }
];

keyPoints.forEach((point, index) => {
  const x = 0.7 + (index * 3);
  const y = 3.2;
  
  slide3.addShape(pres.ShapeType.roundRect, {
    x: x, y: y, w: 2.8, h: 2,
    fill: { color: colors.white },
    line: { color: colors.secondary, width: 1.5 },
    rectRadius: 0.15
  });
  
  slide3.addText(point.icon, {
    x: x + 1.1, y: y + 0.2, w: 0.6, h: 0.6,
    fontSize: 32,
    align: 'center',
    fontFace: '微软雅黑'
  });
  
  slide3.addText(point.title, {
    x: x, y: y + 0.9, w: 2.8, h: 0.4,
    fontSize: 16,
    color: colors.primary,
    bold: true,
    align: 'center',
    fontFace: '微软雅黑'
  });
  
  slide3.addText(point.desc, {
    x: x + 0.2, y: y + 1.3, w: 2.4, h: 0.5,
    fontSize: 12,
    color: colors.gray,
    align: 'center',
    fontFace: '微软雅黑'
  });
});

// ==================== 幻灯片 4: 常见心理陷阱 ====================
let slide4 = pres.addSlide();
slide4.background = { color: colors.white };

// 标题
slide4.addText('六大常见投资心理陷阱', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.primary,
  bold: true,
  fontFace: '微软雅黑'
});

// 2x3 网格布局
const traps = [
  { name: '损失厌恶', desc: '对损失的痛苦感是对收益快乐感的 2-3 倍', icon: '⚠️' },
  { name: '确认偏误', desc: '只关注支持自己观点的信息', icon: '🔍' },
  { name: '过度自信', desc: '高估自己的判断能力和预测准确性', icon: '📈' },
  { name: '从众心理', desc: '盲目跟随大众行为，忽视独立分析', icon: '👥' },
  { name: '锚定效应', desc: '过度依赖首次获得的信息做决策', icon: '⚓' },
  { name: '处置效应', desc: '过早卖出盈利股票，长期持有亏损股票', icon: '🔄' }
];

traps.forEach((trap, index) => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const x = 0.5 + (col * 3.1);
  const y = 1.3 + (row * 2);
  
  // 卡片背景
  slide4.addShape(pres.ShapeType.roundRect, {
    x: x, y: y, w: 2.9, h: 1.8,
    fill: { color: colors.light },
    line: { color: colors.primary, width: 2 },
    rectRadius: 0.15
  });
  
  // 图标
  slide4.addText(trap.icon, {
    x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.5,
    fontSize: 24,
    fontFace: '微软雅黑'
  });
  
  // 名称
  slide4.addText(trap.name, {
    x: x + 0.8, y: y + 0.25, w: 1.9, h: 0.4,
    fontSize: 16,
    color: colors.dark,
    bold: true,
    fontFace: '微软雅黑'
  });
  
  // 描述
  slide4.addText(trap.desc, {
    x: x + 0.2, y: y + 0.7, w: 2.5, h: 0.9,
    fontSize: 12,
    color: colors.gray,
    fontFace: '微软雅黑'
  });
});

// ==================== 幻灯片 5: 情绪对决策的影响 ====================
let slide5 = pres.addSlide();
slide5.background = { color: colors.dark };

// 标题
slide5.addText('情绪如何影响投资决策', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.white,
  bold: true,
  fontFace: '微软雅黑'
});

// 情绪循环图
// 恐惧区域
slide5.addShape(pres.ShapeType.ellipse, {
  x: 1, y: 1.5, w: 3.5, h: 2.5,
  fill: { color: '8B0000', transparency: 70 },
  line: { color: 'FF6B6B', width: 2 }
});

slide5.addText('恐惧', {
  x: 1, y: 1.7, w: 3.5, h: 0.5,
  fontSize: 20,
  color: 'FF6B6B',
  bold: true,
  align: 'center',
  fontFace: '微软雅黑'
});

slide5.addText('• 恐慌性抛售\n• 错失底部机会\n• 过度保守', {
  x: 1.2, y: 2.3, w: 3, h: 1,
  fontSize: 13,
  color: colors.white,
  fontFace: '微软雅黑'
});

// 贪婪区域
slide5.addShape(pres.ShapeType.ellipse, {
  x: 5.5, y: 1.5, w: 3.5, h: 2.5,
  fill: { color: '006400', transparency: 70 },
  line: { color: '90EE90', width: 2 }
});

slide5.addText('贪婪', {
  x: 5.5, y: 1.7, w: 3.5, h: 0.5,
  fontSize: 20,
  color: '90EE90',
  bold: true,
  align: 'center',
  fontFace: '微软雅黑'
});

slide5.addText('• 追高买入\n• 忽视风险\n• 过度交易', {
  x: 5.7, y: 2.3, w: 3, h: 1,
  fontSize: 13,
  color: colors.white,
  fontFace: '微软雅黑'
});

// 中间箭头 (使用三角形替代)
slide5.addShape(pres.ShapeType.triangle, {
  x: 4.5, y: 2.5, w: 0.8, h: 0.4,
  fill: { color: colors.accent },
  line: { color: colors.accent, width: 0 }
});

slide5.addShape(pres.ShapeType.triangle, {
  x: 4.5, y: 2.8, w: 0.8, h: 0.4,
  fill: { color: colors.accent },
  line: { color: colors.accent, width: 0 },
  flipV: true
});

// 底部建议
slide5.addShape(pres.ShapeType.roundRect, {
  x: 0.5, y: 4.3, w: 9, h: 1.2,
  fill: { color: colors.white },
  line: { color: colors.accent, width: 2 },
  rectRadius: 0.15
});

slide5.addText('💡 关键洞察：成功投资者不是没有情绪，而是能够识别并管理情绪', {
  x: 0.7, y: 4.5, w: 8.6, h: 0.8,
  fontSize: 16,
  color: colors.text,
  align: 'center',
  fontFace: '微软雅黑',
  valign: 'middle'
});

// ==================== 幻灯片 6: 培养良好心态 ====================
let slide6 = pres.addSlide();
slide6.background = { color: colors.light };

// 标题
slide6.addText('如何培养良好的投资心态', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.primary,
  bold: true,
  fontFace: '微软雅黑'
});

// 五个支柱
const pillars = [
  { title: '建立投资框架', desc: '明确的投资理念和策略体系', percent: 100 },
  { title: '制定交易计划', desc: '事前规划入场、出场和仓位', percent: 85 },
  { title: '持续学习反思', desc: '从成功和失败中总结经验', percent: 75 },
  { title: '控制仓位风险', desc: '合理配置，避免情绪化决策', percent: 90 },
  { title: '保持耐心纪律', desc: '等待最佳机会，严格执行计划', percent: 80 }
];

pillars.forEach((pillar, index) => {
  const y = 1.4 + (index * 1);
  
  // 标题
  slide6.addText(pillar.title, {
    x: 0.5, y: y, w: 2.5, h: 0.4,
    fontSize: 15,
    color: colors.dark,
    bold: true,
    fontFace: '微软雅黑'
  });
  
  // 进度条背景
  slide6.addShape(pres.ShapeType.rect, {
    x: 3.2, y: y + 0.1, w: 5, h: 0.25,
    fill: { color: 'DDDDDD' }
  });
  
  // 进度条填充
  slide6.addShape(pres.ShapeType.rect, {
    x: 3.2, y: y + 0.1, w: 5 * (pillar.percent / 100), h: 0.25,
    fill: { color: colors.primary }
  });
  
  // 百分比
  slide6.addText(`${pillar.percent}%`, {
    x: 8.4, y: y, w: 0.8, h: 0.4,
    fontSize: 14,
    color: colors.primary,
    bold: true,
    fontFace: '微软雅黑'
  });
  
  // 描述
  slide6.addText(pillar.desc, {
    x: 3.2, y: y + 0.4, w: 6, h: 0.3,
    fontSize: 12,
    color: colors.gray,
    fontFace: '微软雅黑'
  });
});

// ==================== 幻灯片 7: 实用技巧 ====================
let slide7 = pres.addSlide();
slide7.background = { color: colors.white };

// 标题
slide7.addText('实用心态管理技巧', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.primary,
  bold: true,
  fontFace: '微软雅黑'
});

// 左侧 - 日常练习
slide7.addShape(pres.ShapeType.roundRect, {
  x: 0.5, y: 1.3, w: 4.3, h: 4,
  fill: { color: colors.light },
  line: { color: colors.primary, width: 2 },
  rectRadius: 0.15
});

slide7.addText('📋 日常练习', {
  x: 0.7, y: 1.4, w: 4, h: 0.5,
  fontSize: 18,
  color: colors.dark,
  bold: true,
  fontFace: '微软雅黑'
});

const dailyTips = [
  '写投资日记，记录决策理由和情绪状态',
  '定期复盘，分析成功和失败的原因',
  '设定"冷静期"，大额决策前等待 24 小时',
  '冥想练习，提升情绪觉察能力',
  '限制查看账户频率，避免情绪波动'
];

dailyTips.forEach((tip, index) => {
  slide7.addText(`• ${tip}`, {
    x: 0.9, y: 2 + (index * 0.6), w: 3.7, h: 0.5,
    fontSize: 12,
    color: colors.text,
    fontFace: '微软雅黑'
  });
});

// 右侧 - 应急策略
slide7.addShape(pres.ShapeType.roundRect, {
  x: 5.2, y: 1.3, w: 4.3, h: 4,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 2 },
  rectRadius: 0.15
});

slide7.addText('🚨 应急策略', {
  x: 5.4, y: 1.4, w: 4, h: 0.5,
  fontSize: 18,
  color: colors.dark,
  bold: true,
  fontFace: '微软雅黑'
});

const emergencyTips = [
  '感到焦虑时：暂停交易，深呼吸 10 次',
  '想追涨杀跌时：问自己"如果空仓会买吗？"',
  '亏损超 5% 时：强制休息，重新评估逻辑',
  '连续盈利时：警惕过度自信，降低仓位',
  '市场极端时：回归投资框架，不随波逐流'
];

emergencyTips.forEach((tip, index) => {
  slide7.addText(`• ${tip}`, {
    x: 5.6, y: 2 + (index * 0.6), w: 3.7, h: 0.5,
    fontSize: 12,
    color: colors.text,
    fontFace: '微软雅黑'
  });
});

// ==================== 幻灯片 8: 投资检查清单 ====================
let slide8 = pres.addSlide();
slide8.background = { color: colors.light };

// 标题
slide8.addText('投资决策检查清单', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.primary,
  bold: true,
  fontFace: '微软雅黑'
});

// 检查项
const checklist = [
  { q: '这笔投资符合我的整体策略吗？', cat: '策略' },
  { q: '我是否做了充分的研究和分析？', cat: '研究' },
  { q: '最坏情况下我会损失多少？', cat: '风险' },
  { q: '我现在的情绪状态如何？', cat: '情绪' },
  { q: '如果下跌 20%，我还能持有吗？', cat: '承受' },
  { q: '这个决定是理性的还是冲动的？', cat: '理性' }
];

checklist.forEach((item, index) => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const x = 0.5 + (col * 3.1);
  const y = 1.4 + (row * 1.8);
  
  // 复选框
  slide7.addShape(pres.ShapeType.roundRect, {
    x: x, y: y, w: 2.9, h: 1.5,
    fill: { color: colors.white },
    line: { color: colors.primary, width: 2 },
    rectRadius: 0.1
  });
  
  // 复选标记 (使用圆角矩形模拟)
  slide8.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 0.2, w: 0.4, h: 0.4,
    fill: { color: colors.white },
    line: { color: colors.primary, width: 2 },
    rectRadius: 0.05
  });
  
  // 对勾
  slide8.addText('✓', {
    x: x + 0.22, y: y + 0.22, w: 0.36, h: 0.36,
    fontSize: 18,
    color: colors.primary,
    bold: true,
    align: 'center',
    fontFace: '微软雅黑'
  });
  
  // 类别标签
  slide8.addText(item.cat, {
    x: x + 0.7, y: y + 0.2, w: 0.6, h: 0.3,
    fontSize: 11,
    color: colors.accent,
    bold: true,
    fontFace: '微软雅黑'
  });
  
  // 问题
  slide8.addText(item.q, {
    x: x + 0.2, y: y + 0.6, w: 2.5, h: 0.7,
    fontSize: 13,
    color: colors.text,
    fontFace: '微软雅黑'
  });
});

// ==================== 幻灯片 9: 总结与行动 ====================
let slide9 = pres.addSlide();
slide9.background = { color: colors.dark };

// 标题
slide9.addText('总结与行动计划', {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36,
  color: colors.white,
  bold: true,
  fontFace: '微软雅黑'
});

// 核心要点
slide9.addText('核心要点', {
  x: 0.5, y: 1.3, w: 9, h: 0.5,
  fontSize: 20,
  color: colors.accent,
  bold: true,
  fontFace: '微软雅黑'
});

const takeaways = [
  '✓ 投资心态决定长期收益，技术只是辅助',
  '✓ 识别并管理情绪是成功的关键',
  '✓ 建立系统化的投资框架和纪律',
  '✓ 持续学习和反思是成长的必经之路'
];

takeaways.forEach((item, index) => {
  slide9.addText(item, {
    x: 0.7, y: 1.9 + (index * 0.6), w: 8.6, h: 0.5,
    fontSize: 16,
    color: colors.light,
    fontFace: '微软雅黑'
  });
});

// 行动号召
slide9.addShape(pres.ShapeType.roundRect, {
  x: 0.5, y: 4, w: 9, h: 1.3,
  fill: { color: colors.accent },
  line: { color: colors.accent, width: 0 },
  rectRadius: 0.15
});

slide9.addText('🎯 从今天开始：选择一个技巧，坚持练习 30 天！', {
  x: 0.5, y: 4.3, w: 9, h: 0.7,
  fontSize: 20,
  color: colors.white,
  bold: true,
  align: 'center',
  fontFace: '微软雅黑',
  valign: 'middle'
});

// ==================== 幻灯片 10: 结束页 ====================
let slide10 = pres.addSlide();
slide10.background = { color: colors.dark };

// 感谢语
slide10.addText('感谢聆听', {
  x: 0.5, y: 2, w: 9, h: 1,
  fontSize: 44,
  color: colors.white,
  bold: true,
  align: 'center',
  fontFace: '微软雅黑'
});

slide10.addText('Q & A', {
  x: 0.5, y: 3.2, w: 9, h: 0.8,
  fontSize: 28,
  color: colors.accent,
  align: 'center',
  fontFace: '微软雅黑'
});

// 装饰线条
slide10.addShape(pres.ShapeType.rect, {
  x: 3.5, y: 4.2, w: 3, h: 0.1,
  fill: { color: colors.accent }
});

slide10.addText('投资是一场修行，心态决定高度', {
  x: 0.5, y: 4.8, w: 9, h: 0.5,
  fontSize: 14,
  color: colors.light,
  align: 'center',
  fontFace: '微软雅黑'
});

// 保存文件
pres.writeFile({ fileName: 'investment_mindset.pptx' })
  .then(fileName => {
    console.log(`PPT 文件已创建：${fileName}`);
  })
  .catch(err => {
    console.error('创建 PPT 时出错:', err);
  });
