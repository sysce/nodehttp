// create documentation
// install the `documentation` module locally to run script

var fs = require('fs'),
	path = require('path'),
	doc = require('documentation'),
	file = path.join(__dirname, 'index.js');

console.log('starting..');

doc.build([ file ], {}).then(data => doc.formats.md(data, { markdownToc: true })).then(data => fs.promises.writeFile(path.join(__dirname, 'readme.md'), "# NODEHTTP\n## lightweight express alternative, similar syntax\n\n### adding to your package\n\n```sh\nnpm i sys-nodehttp\n```\n\n### usage:\n\n(make sure you do not have any conflicting package names)\n\n```js\nvar path = require('path'),\n\tnodehttp = require('sys-nodehttp'),\n\tserver = new nodehttp.server({\n\t\t// a directory named web serves static content\n\t\tstatic: path.join(__dirname, 'web'),\n\t\t// request routes\n\t\troutes: [\n\t\t\t[ 'GET', '/api', (req, res) => {\n\t\t\t\tres.send('Hello world!');\n\t\t\t} ],\n\t\t\t[ 'POST', '/api', (req, res) => {\n\t\t\t\tconsole.log('Recieved POST with body:', req.body);\n\t\t\t} ],\n\t\t],\n\t\tport: process.env.PORT || 8080,\n\t\taddress: '0.0.0.0',\n\t});```\n\n### API:\n```" + data)).then(() => {
	console.log('finished writing docs, find output at ' + __dirname);
});