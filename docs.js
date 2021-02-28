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

### JHTML:

Unlike express, a way to do calculations or use data serverside is included. The server objects ${t}execution${t} param will enable this, like php except with JS.

- A lot of PHP functions are implemented such as filemtime, echo, include.
-  Variables and NodeJS functions are implemented too such as: __dirname, require
- ${t}file${t} is a function that will resolve any path from the webserver root.

An example of its usage is:

${ti}
<!-- index.html -->
<h1>My web page</h1>

<p>1e3 divided by 2:</p>
<?js
echo(1e3 / 2);
?>

<p>You are currently on <?=req.url.host?></p>
?>
${ti}

### API:\n` + data)).then(() => {
	console.log('finished writing docs, find output at ' + __dirname);
});