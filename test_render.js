
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const fa = require("react-icons/fa");
const sharp = require("sharp");

const { FaBrain } = fa;

console.log("FaBrain:", FaBrain);
console.log("FaBrain type:", typeof FaBrain);

// 尝试渲染
try {
  const element = React.createElement(FaBrain, { color: "#028090", size: "256" });
  console.log("Element created:", element);
  
  const svg = ReactDOMServer.renderToStaticMarkup(element);
  console.log("SVG rendered:", svg.substring(0, 100));
} catch (err) {
  console.error("Error:", err.message);
}
