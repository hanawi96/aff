const fs = require("fs");

const filePath = "d:/CTV/public/assets/js/referral-form.js";
const code = fs.readFileSync(filePath, "utf8");

let stack = [];
let inSingle = false;
let inDouble = false;

function isEsc(pos) {
  let c = 0;
  for (let k = pos - 1; k >= 0 && code[k] === "\\"; k--) c++;
  return c % 2 === 1;
}

let line = 1;
let col = 0;

for (let i = 0; i < code.length; i++) {
  const ch = code[i];
  const next = code[i + 1];

  // Skip comments and delimiters inside strings.
  if (!inSingle && !inDouble) {
    // Line comment //
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < code.length && code[i] !== "\n") i++;
      i--;
      continue;
    }

    // Block comment /* ... */
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i++; // consume trailing /
      continue;
    }

    // Enter strings
    if (ch === '"' && !isEsc(i)) {
      inDouble = true;
    } else if (ch === "'" && !isEsc(i)) {
      inSingle = true;
    } else {
      // Delimiters
      if (ch === "{" || ch === "(" || ch === "[") {
        stack.push({ ch, line, col });
      } else if (ch === "}" || ch === ")" || ch === "]") {
        const want = ch === "}" ? "{" : ch === ")" ? "(" : "[";
        if (stack.length === 0) {
          console.log(`extra closing ${ch} at ${line}:${col}`);
          process.exit(0);
        }
        const top = stack[stack.length - 1];
        if (top.ch !== want) {
          console.log(
            `mismatch closing ${ch} at ${line}:${col} top ${top.ch} opened ${top.line}:${top.col}`
          );
          process.exit(0);
        }
        stack.pop();
      }
    }
  } else if (inSingle) {
    if (ch === "'" && !isEsc(i)) inSingle = false;
  } else if (inDouble) {
    if (ch === '"' && !isEsc(i)) inDouble = false;
  }

  // Update line/col
  if (ch === "\n") {
    line++;
    col = 0;
  } else {
    col++;
  }
}

console.log("unclosed count:", stack.length);
console.log("last opened:", stack.slice(-15));

