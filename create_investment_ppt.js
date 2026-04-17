const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const md = require("react-icons/md");

const { 
  FaBrain, FaChartLine, FaExclamationTriangle, FaHeart, 
  FaUsers, FaLightbulb, FaBullseye, FaShieldAlt, FaClock,
  FaCheckCircle, FaArrowRight, FaBook, FaBalanceScale
} = fa;
const { MdTrendingUp, MdTrendingDown, MdPsychology } = md;

// 颜色方案 - Teal Trust (专业、信任感)
const COLORS = {
  primary: "028090",      // 青色 - 主色
  secondary: "00A896",    // 海泡沫色 - 辅助色
  accent: "02C39A",       // 薄荷色 - 强调色
  dark: "1E293B",         // 深灰蓝 - 深色文字
  light: "F0F9FF",        // 浅蓝白 - 浅色背景
  white: "FFFFFF",
  gray: "64748B",
  coral: "F96167",        // 珊瑚色 - 警示/重点
  gold: "F9E795"          // 金色 - 亮点
};

// 渲染图标为 SVG
function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

// 图标转 PNG base64
async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// 创建演示文稿
async function createPresentation() {
  let pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = '投资心态管理';
  pres.title = '投资心态管理指南';

  // 预加载图标
  const icons = {
    brain: await iconToBase64Png(FaBrain, `#${COLORS.primary}`, 256),
    chart: await iconToBase64Png(FaChartLine, `#${COLORS.secondary}`, 256),
    warning: await iconToBase64Png(FaExclamationTriangle, `#${COLORS.coral}`, 256),
    heart: await iconToBase64Png(FaHeart, `#${COLORS.accent}`, 256),
    users: await iconToBase64Png(FaUsers, `#${COLORS.primary}`, 256),
    lightbulb: await iconToBase64Png(FaLightbulb, `#${COLORS.gold}`, 256),
    bullseye: await iconToBase64Png(FaBullseye, `#${COLORS.primary}`, 256),
    shield: await iconToBase64Png(FaShieldAlt, `#${COLORS.secondary}`, 256),
    clock: await iconToBase64Png(FaClock, `#${COLORS.dark}`, 256),
    check: await iconToBase64Png(FaCheckCircle, `#${COLORS.accent}`, 256),
    arrow: await iconToBase64Png(FaArrowRight, `#${COLORS.white}`, 256),
    book: await iconToBase64Png(FaBook, `#${COLORS.primary}`, 256),
    balance: await iconToBase64Png(FaBalanceScale, `#${COLORS.dark}`, 256),
    trendUp: await iconToBase64Png(MdTrendingUp, `#${COLORS.accent}`, 256),
    trendDown: await iconToBase64Png(MdTrendingDown, `#${COLORS.coral}`, 256),
    psychology: await iconToBase64Png(MdPsychology, `#${COLORS.primary}`, 256),
  };

  // ========== 幻灯片 1: 封面 ==========
  let slide1 = pres.addSlide();
  slide1.background = { color: COLORS.primary };
  
  // 标题
  slide1.addText("投资心态管理", {
    x: 1, y: 1.8, w: 8, h: 1.2,
    fontSize: 54, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.white, align: "center"
  });
  
  // 副标题
  slide1.addText("掌握心理规律 · 做出理性决策 · 实现长期收益", {
    x: 1, y: 3, w: 8, h: 0.6,
    fontSize: 24, fontFace: "Microsoft YaHei",
    color: COLORS.light, align: "center", italic: true
  });
  
  // 装饰图标
  slide1.addImage({
    data: icons.chart,
    x: 4.5, y: 0.5, w: 1, h: 1
  });

  // ========== 幻灯片 2: 目录 ==========
  let slide2 = pres.addSlide();
  slide2.background = { color: COLORS.light };
  
  slide2.addText("目录", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 目录项
  const chapters = [
    { num: "01", title: "什么是投资心态", icon: icons.brain },
    { num: "02", title: "常见投资心理误区", icon: icons.warning },
    { num: "03", title: "四大心理陷阱详解", icon: icons.psychology },
    { num: "04", title: "如何培养良好心态", icon: icons.lightbulb },
    { num: "05", title: "情绪管理与纪律", icon: icons.shield },
    { num: "06", title: "建立长期思维", icon: icons.clock },
  ];
  
  chapters.forEach((chapter, idx) => {
    const y = 1.3 + idx * 0.75;
    // 序号背景
    slide2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: y, w: 0.8, h: 0.6,
      fill: { color: COLORS.primary },
      rectRadius: 0.1
    });
    // 序号
    slide2.addText(chapter.num, {
      x: 0.5, y: y, w: 0.8, h: 0.6,
      fontSize: 20, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.white, align: "center", valign: "middle", margin: 0
    });
    // 标题
    slide2.addText(chapter.title, {
      x: 1.5, y: y + 0.15, w: 7, h: 0.45,
      fontSize: 22, fontFace: "Microsoft YaHei",
      color: COLORS.dark
    });
  });

  // ========== 幻灯片 3: 什么是投资心态 ==========
  let slide3 = pres.addSlide();
  slide3.background = { color: COLORS.light };
  
  slide3.addText("什么是投资心态？", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 左侧图标
  slide3.addImage({
    data: icons.brain,
    x: 0.5, y: 1.3, w: 2.5, h: 2.5
  });
  
  // 右侧内容
  slide3.addText("投资心态是投资者在市场波动中保持的\n心理状态和思维方式", {
    x: 3.3, y: 1.5, w: 6, h: 0.8,
    fontSize: 24, fontFace: "Microsoft YaHei",
    color: COLORS.dark, lineSpacing: 36
  });
  
  // 三个要点
  const points = [
    { title: "认知层面", desc: "如何理解市场和风险", icon: icons.book },
    { title: "情绪层面", desc: "如何管理恐惧与贪婪", icon: icons.heart },
    { title: "行为层面", desc: "如何做出理性决策", icon: icons.bullseye },
  ];
  
  points.forEach((point, idx) => {
    const x = 3.3 + (idx * 2.2);
    const y = 2.8;
    // 背景卡片
    slide3.addShape(pres.shapes.RECTANGLE, {
      x: x, y: y, w: 2, h: 1.3,
      fill: { color: COLORS.white },
      shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
    });
    // 图标
    slide3.addImage({
      data: point.icon,
      x: x + 0.75, y: y + 0.15, w: 0.5, h: 0.5
    });
    // 标题
    slide3.addText(point.title, {
      x: x, y: y + 0.7, w: 2, h: 0.35,
      fontSize: 16, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.primary, align: "center"
    });
    // 描述
    slide3.addText(point.desc, {
      x: x, y: y + 1.05, w: 2, h: 0.25,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: COLORS.gray, align: "center"
    });
  });

  // ========== 幻灯片 4: 常见投资心理误区 ==========
  let slide4 = pres.addSlide();
  slide4.background = { color: COLORS.light };
  
  slide4.addText("常见投资心理误区", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 警示图标
  slide4.addImage({
    data: icons.warning,
    x: 8.5, y: 0.4, w: 0.8, h: 0.8
  });
  
  const mistakes = [
    { title: "追涨杀跌", desc: "看到上涨就买入，看到下跌就恐慌卖出", color: COLORS.coral },
    { title: "频繁交易", desc: "过度交易导致手续费累积和决策失误", color: COLORS.coral },
    { title: "全仓押注", desc: "把所有资金投入单一标的，风险过度集中", color: COLORS.coral },
    { title: "听消息炒股", desc: "盲目跟随他人建议，缺乏独立判断", color: COLORS.coral },
    { title: "不愿止损", desc: "亏损时死扛，期待反弹却越陷越深", color: COLORS.coral },
    { title: "过早止盈", desc: "稍有盈利就卖出，错失更大收益", color: COLORS.coral },
  ];
  
  mistakes.forEach((mistake, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const x = 0.5 + col * 4.5;
    const y = 1.4 + row * 1.2;
    
    // 卡片背景
    slide4.addShape(pres.shapes.RECTANGLE, {
      x: x, y: y, w: 4.2, h: 1,
      fill: { color: COLORS.white },
      line: { color: mistake.color, width: 3 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.1 }
    });
    
    // 标题
    slide4.addText(mistake.title, {
      x: x + 0.25, y: y + 0.15, w: 3.7, h: 0.35,
      fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
      color: mistake.color
    });
    
    // 描述
    slide4.addText(mistake.desc, {
      x: x + 0.25, y: y + 0.5, w: 3.7, h: 0.4,
      fontSize: 13, fontFace: "Microsoft YaHei",
      color: COLORS.gray
    });
  });

  // ========== 幻灯片 5: 四大心理陷阱 - 损失厌恶 ==========
  let slide5 = pres.addSlide();
  slide5.background = { color: COLORS.light };
  
  slide5.addText("心理陷阱 1: 损失厌恶", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 左侧内容
  slide5.addText("损失的痛苦是同等收益快乐的 2-2.5 倍", {
    x: 0.5, y: 1.3, w: 5, h: 0.6,
    fontSize: 24, fontFace: "Microsoft YaHei",
    color: COLORS.dark, italic: true
  });
  
  slide5.addText([
    { text: "典型表现", options: { breakLine: true, bold: true, fontSize: 18, color: COLORS.primary } },
    { text: "• 亏损时死扛不卖，期待回本", options: { breakLine: true, fontSize: 16, color: COLORS.dark } },
    { text: "• 稍有盈利就急忙卖出", options: { breakLine: true, fontSize: 16, color: COLORS.dark } },
    { text: "• 过度关注账户浮亏", options: { breakLine: true, fontSize: 16, color: COLORS.dark } },
  ], { x: 0.5, y: 2, w: 5, h: 2 });
  
  // 右侧对比图
  slide5.addShape(pres.shapes.RECTANGLE, {
    x: 5.8, y: 1.3, w: 3.5, h: 2.5,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide5.addText("理性做法", {
    x: 6, y: 1.45, w: 3.1, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.accent
  });
  
  slide5.addText([
    { text: "✓ 设定明确止损点", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 让利润奔跑", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 关注投资逻辑而非价格", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 6, y: 1.9, w: 3.1, h: 1.8 });

  // ========== 幻灯片 6: 四大心理陷阱 - 从众心理 ==========
  let slide6 = pres.addSlide();
  slide6.background = { color: COLORS.light };
  
  slide6.addText("心理陷阱 2: 从众心理", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 图标
  slide6.addImage({
    data: icons.users,
    x: 8.5, y: 0.4, w: 0.8, h: 0.8
  });
  
  slide6.addText("别人买我也买，别人卖我也卖", {
    x: 0.5, y: 1.3, w: 5, h: 0.5,
    fontSize: 22, fontFace: "Microsoft YaHei",
    color: COLORS.dark, italic: true
  });
  
  const herdBehaviors = [
    { label: "追热点", desc: "盲目追逐市场热点板块" },
    { label: "听消息", desc: "跟风买入他人推荐的股票" },
    { label: "恐慌抛售", desc: "市场下跌时集体恐慌卖出" },
    { label: "FOMO", desc: "害怕错过而高位接盘" },
  ];
  
  herdBehaviors.forEach((item, idx) => {
    const y = 2 + idx * 0.8;
    slide6.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: y, w: 8.5, h: 0.65,
      fill: { color: idx % 2 === 0 ? COLORS.white : COLORS.light }
    });
    slide6.addText(item.label, {
      x: 0.7, y: y + 0.15, w: 1.5, h: 0.35,
      fontSize: 16, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.primary
    });
    slide6.addText(item.desc, {
      x: 2.3, y: y + 0.15, w: 6.5, h: 0.35,
      fontSize: 15, fontFace: "Microsoft YaHei",
      color: COLORS.dark
    });
  });
  
  slide6.addText("破解之道：独立思考，建立自己的投资体系", {
    x: 0.5, y: 5.2, w: 9, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei",
    color: COLORS.accent, align: "center", bold: true
  });

  // ========== 幻灯片 7: 四大心理陷阱 - 过度自信 ==========
  let slide7 = pres.addSlide();
  slide7.background = { color: COLORS.light };
  
  slide7.addText("心理陷阱 3: 过度自信", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 左右两栏
  slide7.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.3, w: 4.2, h: 3,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide7.addText("过度自信表现", {
    x: 0.7, y: 1.45, w: 3.8, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.coral
  });
  
  slide7.addText([
    { text: "• 高估自己的选股能力", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 认为能预测市场走势", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 把运气当实力", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 忽视风险和不确定性", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 0.7, y: 1.9, w: 3.8, h: 2.2 });
  
  slide7.addShape(pres.shapes.RECTANGLE, {
    x: 5, y: 1.3, w: 4.2, h: 3,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide7.addText("保持谦逊", {
    x: 5.2, y: 1.45, w: 3.8, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.accent
  });
  
  slide7.addText([
    { text: "✓ 承认市场不可预测", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 分散投资降低风险", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 持续学习反思", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 记录决策过程复盘", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 5.2, y: 1.9, w: 3.8, h: 2.2 });

  // ========== 幻灯片 8: 四大心理陷阱 - 锚定效应 ==========
  let slide8 = pres.addSlide();
  slide8.background = { color: COLORS.light };
  
  slide8.addText("心理陷阱 4: 锚定效应", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  slide8.addText("过度依赖某个参考点做决策", {
    x: 0.5, y: 1.3, w: 5, h: 0.5,
    fontSize: 22, fontFace: "Microsoft YaHei",
    color: COLORS.dark, italic: true
  });
  
  // 示例框
  const examples = [
    { title: "买入价锚定", desc: "\"我 100 块买的，现在 80 块不能卖\"" },
    { title: "历史高点锚定", desc: "\"之前涨到 200，现在 150 很便宜\"" },
    { title: "他人成本锚定", desc: "\"朋友 50 块买的，我 80 块买贵了\"" },
  ];
  
  examples.forEach((ex, idx) => {
    const y = 2 + idx * 1;
    slide8.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: y, w: 8.5, h: 0.85,
      fill: { color: COLORS.white },
      line: { color: COLORS.primary, width: 2 },
      shadow: { type: "outer", color: "000000", blur: 6, offset: 1, angle: 135, opacity: 0.08 }
    });
    slide8.addText(ex.title, {
      x: 0.7, y: y + 0.15, w: 2, h: 0.35,
      fontSize: 16, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.primary
    });
    slide8.addText(ex.desc, {
      x: 2.8, y: y + 0.15, w: 6, h: 0.55,
      fontSize: 15, fontFace: "Microsoft YaHei",
      color: COLORS.dark
    });
  });
  
  slide8.addText("破解：关注当前价值，忘掉成本价", {
    x: 0.5, y: 5.2, w: 9, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei",
    color: COLORS.accent, align: "center", bold: true
  });

  // ========== 幻灯片 9: 如何培养良好投资心态 ==========
  let slide9 = pres.addSlide();
  slide9.background = { color: COLORS.light };
  
  slide9.addText("如何培养良好投资心态", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 灯泡图标
  slide9.addImage({
    data: icons.lightbulb,
    x: 8.5, y: 0.4, w: 0.8, h: 0.8
  });
  
  const tips = [
    { num: "1", title: "建立投资体系", desc: "明确投资目标、风险承受能力和选股标准", icon: icons.book },
    { num: "2", title: "制定投资计划", desc: "买入前想好买入理由、目标价和止损点", icon: icons.bullseye },
    { num: "3", title: "控制仓位", desc: "单只股票不超过总仓位的 20%", icon: icons.balance },
    { num: "4", title: "定期复盘", desc: "记录决策过程，分析成功与失败原因", icon: icons.clock },
    { num: "5", title: "持续学习", desc: "阅读经典，向成功投资者学习", icon: icons.brain },
  ];
  
  tips.forEach((tip, idx) => {
    const y = 1.2 + idx * 0.85;
    // 序号圆圈
    slide9.addShape(pres.shapes.OVAL, {
      x: 0.5, y: y, w: 0.6, h: 0.6,
      fill: { color: COLORS.primary }
    });
    slide9.addText(tip.num, {
      x: 0.5, y: y, w: 0.6, h: 0.6,
      fontSize: 22, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.white, align: "center", valign: "middle", margin: 0
    });
    // 标题
    slide9.addText(tip.title, {
      x: 1.3, y: y + 0.05, w: 7, h: 0.35,
      fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.dark
    });
    // 描述
    slide9.addText(tip.desc, {
      x: 1.3, y: y + 0.4, w: 7, h: 0.35,
      fontSize: 14, fontFace: "Microsoft YaHei",
      color: COLORS.gray
    });
  });

  // ========== 幻灯片 10: 情绪管理技巧 ==========
  let slide10 = pres.addSlide();
  slide10.background = { color: COLORS.light };
  
  slide10.addText("情绪管理技巧", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 心形图标
  slide10.addImage({
    data: icons.heart,
    x: 8.5, y: 0.4, w: 0.8, h: 0.8
  });
  
  // 左右两栏
  slide10.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.3, w: 4.2, h: 3.8,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide10.addText("当感到焦虑时", {
    x: 0.7, y: 1.45, w: 3.8, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.coral
  });
  
  slide10.addText([
    { text: "• 深呼吸，暂停 10 分钟再做决定", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 问自己：如果空仓，现在会买吗？", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 回顾投资逻辑是否改变", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 远离盘面，出去走走", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 与理性的人交流", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 0.7, y: 1.9, w: 3.8, h: 3 });
  
  slide10.addShape(pres.shapes.RECTANGLE, {
    x: 5, y: 1.3, w: 4.2, h: 3.8,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide10.addText("当感到兴奋时", {
    x: 5.2, y: 1.45, w: 3.8, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.accent
  });
  
  slide10.addText([
    { text: "• 冷静 24 小时再决定是否加仓", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 检查是否 FOMO 情绪驱动", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 评估风险收益比", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 设定明确的止盈点", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "• 不要借钱投资", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 5.2, y: 1.9, w: 3.8, h: 3 });

  // ========== 幻灯片 11: 建立投资纪律 ==========
  let slide11 = pres.addSlide();
  slide11.background = { color: COLORS.light };
  
  slide11.addText("建立投资纪律", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 盾牌图标
  slide11.addImage({
    data: icons.shield,
    x: 8.5, y: 0.4, w: 0.8, h: 0.8
  });
  
  const disciplines = [
    { title: "买入纪律", items: ["只买自己理解的公司", "必须有明确的投资逻辑", "设定好买入价格区间", "分批建仓不梭哈"] },
    { title: "持有纪律", items: ["定期检视投资逻辑", "不因短期波动改变计划", "关注基本面而非股价", "避免频繁查看账户"] },
    { title: "卖出纪律", items: ["达到目标价分批止盈", "触及止损点果断卖出", "投资逻辑改变时退出", "发现更好机会时换仓"] },
  ];
  
  disciplines.forEach((disc, idx) => {
    const x = 0.5 + idx * 3;
    // 卡片
    slide11.addShape(pres.shapes.RECTANGLE, {
      x: x, y: 1.3, w: 2.8, h: 3.8,
      fill: { color: COLORS.white },
      shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
    });
    // 标题栏
    slide11.addShape(pres.shapes.RECTANGLE, {
      x: x, y: 1.3, w: 2.8, h: 0.6,
      fill: { color: COLORS.primary }
    });
    slide11.addText(disc.title, {
      x: x, y: 1.3, w: 2.8, h: 0.6,
      fontSize: 16, fontFace: "Microsoft YaHei", bold: true,
      color: COLORS.white, align: "center", valign: "middle", margin: 0
    });
    // 列表
    disc.items.forEach((item, i) => {
      slide11.addText(item, {
        x: x + 0.2, y: 2 + i * 0.65, w: 2.4, h: 0.55,
        fontSize: 13, fontFace: "Microsoft YaHei",
        color: COLORS.dark
      });
    });
  });

  // ========== 幻灯片 12: 建立长期思维 ==========
  let slide12 = pres.addSlide();
  slide12.background = { color: COLORS.light };
  
  slide12.addText("建立长期思维", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.dark, align: "left"
  });
  
  // 时钟图标
  slide12.addImage({
    data: icons.clock,
    x: 8.5, y: 0.4, w: 0.8, h: 0.8
  });
  
  // 对比图
  slide12.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.3, w: 4.2, h: 3.5,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide12.addText("短期思维", {
    x: 0.7, y: 1.45, w: 3.8, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.coral
  });
  
  slide12.addText([
    { text: "❌ 追求快速致富", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "❌ 每天盯盘", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "❌ 频繁买卖", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "❌ 被情绪左右", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "❌ 关注短期涨跌", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 0.7, y: 1.9, w: 3.8, h: 2.8 });
  
  slide12.addShape(pres.shapes.RECTANGLE, {
    x: 5, y: 1.3, w: 4.2, h: 3.5,
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 135, opacity: 0.1 }
  });
  
  slide12.addText("长期思维", {
    x: 5.2, y: 1.45, w: 3.8, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.accent
  });
  
  slide12.addText([
    { text: "✓ 追求复利增长", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 定期查看即可", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 长期持有优质资产", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 理性分析决策", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
    { text: "✓ 关注企业价值", options: { breakLine: true, fontSize: 14, color: COLORS.dark } },
  ], { x: 5.2, y: 1.9, w: 3.8, h: 2.8 });
  
  // 底部金句
  slide12.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 5, w: 9, h: 0.7,
    fill: { color: COLORS.primary }
  });
  slide12.addText("\"投资是一场马拉松，不是百米冲刺\"", {
    x: 0.5, y: 5, w: 9, h: 0.7,
    fontSize: 20, fontFace: "Microsoft YaHei", italic: true,
    color: COLORS.white, align: "center", valign: "middle", margin: 0
  });

  // ========== 幻灯片 13: 总结 ==========
  let slide13 = pres.addSlide();
  slide13.background = { color: COLORS.primary };
  
  slide13.addText("总结", {
    x: 0.5, y: 0.5, w: 9, h: 0.7,
    fontSize: 40, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.white, align: "center"
  });
  
  const summary = [
    "认识并警惕常见心理陷阱",
    "建立自己的投资体系和纪律",
    "学会管理情绪，保持理性",
    "坚持长期思维，追求复利",
    "持续学习，不断复盘改进",
  ];
  
  summary.forEach((item, idx) => {
    const y = 1.6 + idx * 0.65;
    // 对勾图标
    slide13.addImage({
      data: icons.check,
      x: 3, y: y + 0.05, w: 0.4, h: 0.4
    });
    // 文字
    slide13.addText(item, {
      x: 3.5, y: y + 0.1, w: 6, h: 0.45,
      fontSize: 22, fontFace: "Microsoft YaHei",
      color: COLORS.white
    });
  });
  
  // 底部鼓励语
  slide13.addText("良好的投资心态 = 成功投资的一半", {
    x: 0.5, y: 5.2, w: 9, h: 0.5,
    fontSize: 24, fontFace: "Microsoft YaHei", bold: true,
    color: COLORS.gold, align: "center", italic: true
  });

  // 保存文件
  pres.writeFile({ fileName: "/Users/tuim/Documents/GitHub/aiproject/typeclaw/投资心态管理.pptx" })
    .then(fileName => {
      console.log("PPT 创建成功:", fileName);
    })
    .catch(err => {
      console.error("创建 PPT 失败:", err);
    });
}

createPresentation();
