# NODEHTTP
## Lightweight express alternative with similar syntax and usage.

|||
| --- | --- |
| <a href="https://www.npmjs.com/package/sys-nodehttp">![Download](https://img.shields.io/npm/dw/sys-nodehttp?style=for-the-badge)</a> | [API](./api.md) |

# ⚠ THIS PAGE IS UNDER MAINTENANCE, SOME DETAILS MAY BE INCOMPLETE/INACCURATE ⚠

### Installation:

```sh
npm i sys-nodehttp
```

### Usage:

```js
var path = require('path'),
	nodehttp = require('sys-nodehttp'),
	server = new nodehttp.Server({
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
```