const fs = require('fs');
const translate = require('@vitalets/google-translate-api');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

// 命令行参数定义
const optionDefinitions = [
  { name: 'from', alias: 'f', type: String, description: '原始语言' },
  { name: 'to', alias: 't', type: String, multiple: true, description: '目标语言' },
  { name: 'ignore', alias: 'i', type: String, multiple: true, description: '要忽略的行' },
];

// 命令行参数使用说明
const sections = [
  {
    header: 'Translate README',
    content: '将 README 翻译为指定语言，并在文件末尾添加翻译来源信息。',
  },
  {
    header: 'Options',
    optionList: optionDefinitions,
  },
];

const options = commandLineArgs(optionDefinitions);

// 根据命令行参数，从选定的语言中忽略特定行
function processReadme(lines) {
  const { ignore, from, to } = options;

  if (ignore) {
    const ignoredLines = new Set();
    ignore.forEach((line) => {
      if (line.includes('-')) {
        const [start, end] = line.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          ignoredLines.add(i);
        }
      } else {
        ignoredLines.add(Number(line));
      }
    });

    lines = lines.filter((_, index) => !ignoredLines.has(index + 1));
  }

  if (from) {
    lines.push(`\n*Translated from ${from} using Google Translate API.*`);
  }

  return lines;
}

const readmePath = 'README.md';

fs.readFile(readmePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading ${readmePath}:`, err);
    process.exit(1);
  }

  const lines = data.split('\n');
  const translatedContentPromises = [];

fs.readFile(readmePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading ${readmePath}:`, err);
    process.exit(1);
  }

  const lines = data.split('\n');
  const translatedContentPromises = [];

  options.to.forEach((targetLanguage) => {
    const translatedLines = lines.map((line, index) => {
      if (index + 1 <= (options.ignore ? Math.max(...options.ignore) : 0)) {
        return line; // 忽略指定的行
      } else {
      return translate(line, { to: targetLanguage })
        .then((translated) => translated.text)
        .catch((err) => {
          console.error('Error translating README:', err);
          return line; // 翻译失败，保留原始内容
        });
    });

    translatedContentPromises.push(
      Promise.all(translatedLines).then((translatedLinesArray) => {
        const translatedContent = processReadme(translatedLinesArray).join('\n');
        const outputPath = `README_${targetLanguage.toUpperCase()}.md`;
        fs.writeFile(outputPath, translatedContent, 'utf8', (err) => {
          if (err) {
            console.error(`Error writing ${outputPath}:`, err);
            process.exit(1);
          }
          console.log(`Successfully translated README to ${targetLanguage}`);
        });
      })
    );
  });

  Promise.all(translatedContentPromises)
    .then(() => {
      // Commit and push changes using GitHub Token
      const branch = process.env.GITHUB_REF.split('/').slice(2).join('/'); // Get the branch name
      octokit.repos.createOrUpdateFileContents({
        owner: process.env.GITHUB_REPOSITORY_OWNER,
        repo: process.env.GITHUB_REPOSITORY,
        path: 'README.md',
        message: 'Auto-translation of README',
        content: Buffer.from(processReadme(lines).join('\n')).toString('base64'),
        branch,
      });
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
});
