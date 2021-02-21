// create documentation
var fs = require('fs'),
	path = require('path'),
	doc = require('documentation'),
	file = path.join(__dirname, 'index.js'),
	ti = '```',
	t = '`';

console.log('starting..');

doc.build([ file ], { shallow: true }).then(data => doc.formats.md(data, { markdownToc: true })).then(data => fs.promises.writeFile(path.join(__dirname, 'readme.md'), `# NODEHTTP
## Lightweight express alternative, similar syntax

<a href="https://www.npmjs.com/package/sys-nodehttp">![Download](https://img.shields.io/npm/dw/sys-nodehttp?style=for-the-badge)</a>

### adding to your package

${ti}sh
npm i sys-nodehttp
${ti}

### usage:

(make sure you do not have any conflicting package names)

${ti}js
var path = require('path'),
	nodehttp = require('sys-nodehttp'),
	server = new nodehttp.server({
		// a directory named web serves static content
		static: path.join(__dirname, 'web'),
		// request routes
		routes: [
			[ 'GET', '/api', (req, res) => {
				res.send('Hello world!');
			} ],
			[ 'POST', '/api', (req, res) => {
				console.log('Recieved POST with body:', req.body);
			} ],
		],
		port: process.env.PORT || 8080,
		address: '0.0.0.0',
	});
${ti}

### API:\n` + data)).then(() => {
	console.log('finished writing docs, find output at ' + __dirname);
});