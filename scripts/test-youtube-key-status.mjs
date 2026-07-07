import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(html.includes('id="yt-key-status"'), 'Classroom must include a visible YouTube key status element.');
assert(/function\s+setYtKeyStatus\s*\(/.test(html), 'Classroom must define setYtKeyStatus().');
assert(/function\s+describeYouTubeApiError\s*\(/.test(html), 'Classroom must define describeYouTubeApiError().');
assert(/function\s+testYtKey\s*\(/.test(html), 'Classroom must define testYtKey().');
assert(/onclick="testYtKey\(\)"/.test(html), 'Classroom must include a Test Key button.');

let scripts = [];
let cursor = 0;
while (true) {
  const start = html.indexOf('<script', cursor);
  if (start < 0) break;
  const tagEnd = html.indexOf('>', start);
  const tag = html.slice(start, tagEnd + 1);
  const end = html.indexOf('</script>', tagEnd);
  if (!/src=/i.test(tag)) {
    scripts.push(html.slice(tagEnd + 1, end));
  }
  cursor = end + 9;
}

scripts.forEach((script, index) => {
  new vm.Script(script, { filename: `inline-${index}.js` });
});

console.log('youtube key status test passed');
