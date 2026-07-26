const fullContent = `✅ Código gerado! A tela de revisão foi aberta automaticamente.

\`\`\`json
{
  "component_code": "export default function App() {}"
}
\`\`\``;
let jsonStr = fullContent.trim();
if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');

const firstBrace = jsonStr.indexOf('{');
const lastBrace = jsonStr.lastIndexOf('}');
if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
}

try {
  const sanitizeJsonString = (str) => {
    let isInsideString = false;
    let isEscaped = false;
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '\\\\' && !isEscaped) {
        isEscaped = true;
        result += char;
        continue;
      }
      if (char === '"' && !isEscaped) {
        isInsideString = !isInsideString;
        result += char;
        continue;
      }
      isEscaped = false;
      if (isInsideString && char === '\n') {
        result += '\\n';
      } else if (isInsideString && char === '\r') {
        result += '\\r';
      } else if (isInsideString && char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    }
    return result;
  }
  const sanitizedJson = sanitizeJsonString(jsonStr);
  const parsedJson = JSON.parse(sanitizedJson);
  console.log('Success:', !!parsedJson.component_code);
} catch (e) {
  console.error('Parse failed:', e.message);
}
