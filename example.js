const { parse } = require("@flyqie/azurlane-protocol-parser");
const fs = require('fs');
const path = require('path');

const directoryPath = 'protocol/';
const fileExtension = '.lua';

fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    return;
  }

  const filteredFiles = files.filter(file => path.extname(file) === fileExtension);

  filteredFiles.forEach(file => {
    const fileNameWithoutExtension = path.basename(file, path.extname(file));
    fs.writeFileSync(directoryPath + fileNameWithoutExtension + ".proto", parse(fs.readFileSync(directoryPath + fileNameWithoutExtension + ".lua", "utf8")));
  });
});