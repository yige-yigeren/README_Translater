const fs = require('fs');
const translate = require('@vitalets/google-translate-api');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GH_TOKEN });

const optionDefinitions = [
  { name: 'from', alias: 'f', type: String, description: '原始语言' },
  { name: 'to', alias: 't', type: String, multiple: true, description: '目标语言' },
  { name: 'ignore', alias: 'i', type: String, multiple: true, description: '要忽略的行' },
];

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

const optionUsage = commandLineUsage(sections);

// Parse command line options
const options = commandLineArgs(optionDefinitions);

// Check if required options are provided
if (!options.from || !options.to) {
  console.log(optionUsage);
  process.exit(1);
}

// Read the README.md file
const readmePath = options._unknown && options._unknown.length > 0 ? options._unknown[0] : 'README.md';
fs.readFile(readmePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading ${readmePath}:`, err);
    process.exit(1);
  }

  const lines = data.split('\n');
  const translatedContentPromises = [];

  // Ignore specified lines from the selected language
  if (options.ignore && options.ignore.length > 0) {
    options.ignore.forEach((range) => {
      const [start, end] = range.split('-').map((val) => parseInt(val, 10));
      if (end) {
        for (let i = start - 1; i <= end - 1; i++) {
          lines[i] = '';
        }
      } else {
        lines[start - 1] = '';
      }
    });
  }

  // Translate and store the promises for each target language
  options.to.forEach((targetLanguage) => {
    const translatedLines = lines.map((line, index) => {
      if (line !== '') {
        return translate(line, { to: targetLanguage })
          .then((translated) => translated.text)
          .catch((err) => {
            console.error('Error translating README:', err);
            return line;
          });
      } else {
        return line;
      }
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

  // Commit and push changes using GitHub Token
  Promise.all(translatedContentPromises)
    .then(() => {
      const branch = process.env.GITHUB_REF.split('/').slice(2).join('/');
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

function processReadme(lines) {
  const languageTag = 'Translated by Google Translate API - ';
  return [...lines, '', `${languageTag}${new Date().toISOString()}`];
}
