
const fa = require("react-icons/fa");
const md = require("react-icons/md");

const icons = [
  "FaBrain", "FaChartLine", "FaExclamationTriangle", "FaHeart", 
  "FaUsers", "FaLightbulb", "FaTarget", "FaShieldAlt", "FaClock",
  "FaCheckCircle", "FaArrowRight", "FaBook", "FaBalanceScale"
];

const mdIcons = ["MdTrendingUp", "MdTrendingDown", "MdPsychology"];

console.log("FA Icons:");
icons.forEach(name => {
  const icon = fa[name];
  console.log(`  ${name}: ${icon ? "OK" : "UNDEFINED"}`);
});

console.log("\nMD Icons:");
mdIcons.forEach(name => {
  const icon = md[name];
  console.log(`  ${name}: ${icon ? "OK" : "UNDEFINED"}`);
});
