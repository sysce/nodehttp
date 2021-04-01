// create documentation
var fs = require('fs'),
	path = require('path'),
	doc = require('documentation'),
	file = path.join(__dirname, 'index.js'),
	ttt = '```',
	t = '`';

console.log('starting..');

doc.build([ file ], { shallow: true }).then(data => doc.formats.md(data, { markdownToc: true })).then(data => fs.promises.writeFile(path.join(__dirname, 'readme.md'), `# NODEHTTP
## Lightweight express alternative with similar syntax and usage.

<a href="https://www.npmjs.com/package/sys-nodehttp">![Download](https://img.shields.io/npm/dw/sys-nodehttp?style=for-the-badge)</a>

### Installation:

${ttt}sh
npm i sys-nodehttp
${ttt}

### Usage:

${ttt}js
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

server.use(nodehttp.static(path.join(__dirname, 'public')));
${ttt}

### Execution:

Unlike express, a way to do calculations or use data serverside is included. The server objects ${t}execution${t} param contains file extensions that will be capable of executing code, like php except with JS.

## Notes:

- A small amount of PHP functions are implemented such as filemtime, echo, count, include
- ${t}file${t} is a function that will resolve any path from the webserver root
- ${t}require${t} is supported
- ${t}include${t} is async, you will need ${t}await${t} before it
- ${t}filemtime${t} does work but it is recommended to use the async function ${t}afilemtimems${t}
- All code snippets are asynchronous, you can run async code as long as async functions are awaited for and the snippet is resolved
- a folder in your static folder called ${t}cgi${t} is needed to store stuff eg error.php
- error.php has the variables ${t}title${t} and ${t}message${t}

## Usage:

Example 1:

${ttt}
<!-- index.php -->
<h1>My web page</h1>

<p>1000 divided by 2:</p>
<?php
echo(1e3 / 2);
?>

<p>You are currently on <?=req.url.host?></p>
${ttt}

Example 2, delaying the response:

${ttt}
<?php

var duration = 3; // seconds

await new Promise(resolve => setTimeout(() => resolve(), duration * 1000));

echo('No echo is needed, the async function ends with or without');
?>
<p>Hello world!</p>
${ttt}

Example 3, including "relative.php":

${ttt}
<!--
folder structure looks like:
- index.php
- relative.php
-->


<main>
	<?=await include('./relative.php')?>
</main>
${ttt}

### API:\n` + data)).then(() => console.log('finished writing docs, find output at ' + __dirname));