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

### Installation:

${ti}sh
npm i sys-nodehttp
${ti}

### Usage:

${ti}js
var path = require('path'),
	nodehttp = require('sys-nodehttp'),
	server = new nodehttp.server({
		// relative to the script, /public/
		static: path.join(__dirname, 'public'),
		port: process.env.PORT || 8080,
		address: '0.0.0.0',
	});

server.get('/api', (req, res) => {
	res.send('Hello world!');
});

server.post('/api', (req, res) => {
	// req.body is an object
	console.log('Recieved POST with body:', req.body);
});
${ti}

### Execution:

Unlike express, a way to do calculations or use data serverside is included. The server objects ${t}execution${t} param will enable this, like php except with JS.

Notes:

- A small amount of PHP functions are implemented such as filemtime, echo, include
- ${t}file${t} is a function that will resolve any path from the webserver root
- ${t}require${t} is supported
- All code snippets are asynchronous, you can run async code as long as the response is echo'd and the snippet is resolved

An example of its usage is:

${ti}
<!-- index.jhtml -->
<h1>My web page</h1>

<p>1000 divided by 2:</p>
<?php
echo(1e3 / 2);
?>

<p>You are currently on <?=req.url.host?></p>
${ti}

Delaying the response:

${ti}
<?php

var duration = 1; // seconds

await new Promise(resolve => setTimeout(() => resolve(), duration * 1000));

echo('No echo is needed, the async function ends with or without');
?>

<p>Hello world!</p>
${ti}

### API:\n` + data)).then(() => console.log('finished writing docs, find output at ' + __dirname));