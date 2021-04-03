'use strict';
var fs = require('fs'),
	url = require('url'),
	path = require('path'),
	util =  require('util'),
	zlib = require('zlib'),
	http = require('http'),
	http2 = require('http2'),
	https = require('https'),
	events = require('events'),
	crypto = require('crypto'),
	stream = require('stream'),
	AsyncFunction = (async _=>_).constructor,
	fs_promises_read = (...args) => new Promise((resolve, reject) => fs.read(...args, (err, bytes, buffer) => err ? reject(err) : resolve(buffer))),
	fs_promises_close = pointer => new Promise((resolve, reject) => fs.close(pointer, err => err ? reject(err) : resolve())),
	fs_promises_exists = path => new Promise((resolve, reject) => fs.promises.access(path, fs.F_OK).then(() => resolve(true)).catch(err => resolve(false)));

exports.find_arg = (args, type, fallback) => args.find(arg => typeof arg == type) || fallback;

exports.valid_json = json => {  try{ return JSON.parse(json) }catch(err){ return null } };

exports.http = {methods:['get','delete','patch','delete','post'],body:['put', 'patch', 'delete', 'post'],mimes:{html:"text/html",htm:"text/html",shtml:"text/html",css:"text/css",xml:"text/xml",gif:"image/gif",jpeg:"image/jpeg",jpg:"image/jpeg",js:"application/javascript",atom:"application/atom+xml",rss:"application/rss+xml",mml:"text/mathml",txt:"text/plain",jad:"text/vnd.sun.j2me.app-descriptor",wml:"text/vnd.wap.wml",htc:"text/x-component",png:"image/png",tif:"image/tiff",tiff:"image/tiff",wbmp:"image/vnd.wap.wbmp",ico:"image/x-icon",jng:"image/x-jng",bmp:"image/x-ms-bmp",svg:"image/svg+xml",svgz:"image/svg+xml",webp:"image/webp",woff:"application/font-woff",jar:"application/java-archive",war:"application/java-archive",ear:"application/java-archive",json:"application/json",hqx:"application/mac-binhex40",doc:"application/msword",pdf:"application/pdf",ps:"application/postscript",eps:"application/postscript",ai:"application/postscript",rtf:"application/rtf",m3u8:"application/vnd.apple.mpegurl",xls:"application/vnd.ms-excel",eot:"application/vnd.ms-fontobject",ppt:"application/vnd.ms-powerpoint",wmlc:"application/vnd.wap.wmlc",kml:"application/vnd.google-earth.kml+xml",kmz:"application/vnd.google-earth.kmz","7z":"application/x-7z-compressed",cco:"application/x-cocoa",jardiff:"application/x-java-archive-diff",jnlp:"application/x-java-jnlp-file",run:"application/x-makeself",pl:"application/x-perl",pm:"application/x-perl",prc:"application/x-pilot",pdb:"application/x-pilot",rar:"application/x-rar-compressed",rpm:"application/x-redhat-package-manager",sea:"application/x-sea",swf:"application/x-shockwave-flash",sit:"application/x-stuffit",tcl:"application/x-tcl",tk:"application/x-tcl",der:"application/x-x509-ca-cert",pem:"application/x-x509-ca-cert",crt:"application/x-x509-ca-cert",xpi:"application/x-xpinstall",xhtml:"application/xhtml+xml",xspf:"application/xspf+xml",zip:"application/zip",bin:"application/octet-stream",exe:"application/octet-stream",dll:"application/octet-stream",deb:"application/octet-stream",dmg:"application/octet-stream",iso:"application/octet-stream",img:"application/octet-stream",msi:"application/octet-stream",msp:"application/octet-stream",msm:"application/octet-stream",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",mid:"audio/midi",midi:"audio/midi",kar:"audio/midi",mp3:"audio/mpeg",ogg:"audio/ogg",m4a:"audio/x-m4a",ra:"audio/x-realaudio","3gpp":"video/3gpp","3gp":"video/3gpp",ts:"video/mp2t",mp4:"video/mp4",mpeg:"video/mpeg",mpg:"video/mpeg",mov:"video/quicktime",webm:"video/webm",flv:"video/x-flv",m4v:"video/x-m4v",mng:"video/x-mng",asx:"video/x-ms-asf",asf:"video/x-ms-asf",wmv:"video/x-ms-wmv",avi:"video/x-msvideo",wasm:"application/wasm",ttf:"font/ttf"}};

exports.hash = str => { var hash = 5381, i = str.length; while(i)hash = (hash * 33) ^ str.charCodeAt(--i); return hash >>> 0; };

exports.path_regex = /[\/\\]+/g;

exports.URL = class extends URL {
	get fullpath(){
		return this.url.href.substr(this.url.origin.length);
	}
};

exports.client_response = class {
	constructor(res){
		this.headers = new exports.headers(res.headers);
		
		var chunks = [];
		
		this.buf = new Promise(resolve => res.on('data', chunk => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))));
	}
	async buffer(){
		return await this.buf;
	}
	async text(){
		return (await this.buf).toString();
	}
	async json(){
		return JSON.parse((await this.buf).toString());
	}
};

/**
* Send a client request, similar to fetch
* @param {URL|string} URL
* @param {Object} [Options]
* @returns {Promise} exports.client_response
*/

exports.fetch = (url, opts = {}) => {
	var body = opts.body;
	
	opts = Object.assign({}, opts);
	
	url = new URL(url);
	
	opts.path = url.href.substr(url.origin);
	opts.hostname = url.hostname;
	opts.protocol = url.protocol;
	
	if(opts.headers instanceof exports.headers)opts.headers = opts.headers.toJSON();
	
	if(body)delete opts.body;
	
	if(body && (!opts.method || !exports.http.body.includes(opts.method.toLowerCase())))throw new TypeError('method ' + (opts.method || 'get').toUpperCase() + ' cannot have body');
	
	return new Promise((resolve, reject) => (url.protocol == 'https:' ? https : http).request(opts, res => resolve(new exports.client_response(res))).on('error', reject).on('error', reject).end(body));
};

/**
* Base request class
* @param {Object} request
* @param {Object} response
* @param {Object} server
* @property {Object} headers - Contains HTTP headers
* @property {Object|String|Array|Number} body - Contains POST body if applicable (once process is called)
* @property {URL} url - URL object from request (contains host)
*/

exports.request = class extends events {
	constructor(req, res, server){
		super();
		
		this.server = server;
		
		this.url = new exports.URL(req.url.replace(exports.path_regex, '/'), 'http' + (this.server.config.ssl ? 's' : '') + '://' + req.headers.host);
		
		if(this.server.aliases.has(this.url.pathname))this.url.pathname = this.server.aliases.get(this.url.pathname);
		
		this.date = new Date();
		
		this.headers = new exports.headers(req.headers);
		this.real_ip = this.headers.get('cf-connecting-ip') ||  this.headers.get('x-real-ip') || '127.0.0.1';
		
		this.query = Object.fromEntries([...this.url.searchParams.entries()]);
		this.method = req.method;
		this.cookies = exports.cookies.parse_object(req.headers.cookie);
		
		this.req = req;
		
		this.body = {};
		
		this.req.on('close', err => this.emit('close', err));
	}
	/**
	* Process the POST data if applicable
	* @returns {Promise}
	*/
	process(){
		return new Promise((resolve, reject) => {
			var post_chunks = [];
			
			this.req.on('data', chunk => post_chunks.push(chunk)).on('end', () => {
				this.raw_body = Buffer.concat(post_chunks);
				
				switch((this.headers.get('content-type') + '').replace(/;.*/, '')){
					case'text/plain':
						
						this.body = this.raw_body.toString();
						
						break;
					case'application/json':
						
						this.body = exports.valid_json(this.raw_body.toString()) || {};
						
						break;
					case'application/x-www-form-urlencoded':
						
						this.body = Object.fromEntries([...new URLSearchParams(this.raw_body.toString()).entries()]);
						
						break;
					default:
						
						this.body = this.raw_body;
						
						break;
				}
				
				resolve();
			});
		});
	}
}

exports.headers = class extends Map {
	constructor(headers){
		super();
		
		if(typeof headers == 'object')for(var name in headers)this.set(name, headers[name]);
	}
	normal_name(name){
		if(typeof name != 'string')throw new TypeError('`name` must be a string');
		
		return name.toLowerCase().replace(/((?:^|-)[a-z])/g, (match, char) => char.toUpperCase());
	}
	normal_value(value){
		if(typeof value == 'undefined' || value == null)throw new TypeError('`value` must be a value');
		
		return [...value.toString().trim()].filter(x => x.charCodeAt()).join('');
	}
	arr_to_str(mixed){
		return Array.isArray(mixed) ? mixed.join(', ') : mixed;
	}
	get(name){ 
		return this.arr_to_str(super.get(this.normal_name(name)));
	}
	has(name){
		return super.has(this.normal_name(name));
	}
	delete(name){
		return super.delete(this.normal_name(name));
	}
	set(name, value){
		return Array.isArray(value) ? value.forEach(data => this.append(name, data)) : super.set(this.normal_name(name), this.normal_value(value));
	}
	append(name, value){
		name = this.normal_name(name);
		value = this.normal_value(value);
		
		if(this.has(name)){
			var old_value = super.get(name);
			
			super.set(name, (Array.isArray(old_value) ? old_value : [ old_value ]).concat(value));
		}else super.set(name, value);
	}
	forEach(callback, thisArg){
		super.forEach((value, name) => callback.call(thisArg || this, this.normal_value(value), this.normal_name(name), this));
	}
	toJSON(){
		return Object.fromEntries([...super.entries()]);;
	}
}

/**
* Base response class
* @param {Object} request
* @param {Object} response
* @param {Object} server
* @property {Object} cookies - Cookies (if modified, set-cookies will be overwritten, format is { name: '', value: '', secure: true|false, httponly: true|false, domain: '', path: '/', expires: Date }
* @property {Object|String|Array|Number} body - Contains POST body if applicable (once process is called)
* @property {URL} headers - Set headers
*/
exports.response = class extends events {
	constructor(req, res, server){
		super();
		
		this.server = server;
		
		this.res = res;
		
		this.req = new exports.request(req, res, server);
		
		this.status_sent = 200;
		
		this.headers = new exports.headers();
		
		this.cookies = {};
	}
	/**
	* Set the response status code
	* @param {Number} HTTP Status
	*/
	status(code){
		this.status_sent = code;
		
		return this;
	}
	/**
	* Gets a set header
	* @param {String} Name
	* @param {String} Value
	*/
	get(name){
		return this.headers.get(name);
	}
	/**
	* Set a header
	* @param {String} Name
	* @param {String} Value
	*/
	set(name, value){
		this.headers.set(name, value);
		
		return this;
	}
	/**
	* Appends to a header
	* @param {String} Name
	* @param {String} Value
	*/
	append(name, value){
		this.headers.set(name, value);
		
		return this;
	}
	/**
	* Meant to be called internally, finalizes request preventing writing headers
	*/
	finalize(){
		if(this.head_sent)throw new TypeError('response headers already sent');
		
		this.head_sent = true;
		
		var status = this.status_sent;
		
		// remove trailers on chunked
		if(this.headers.get('content-encoding') == 'chunked' && this.headers.has('trailer'))this.headers.delete('trailers');
		
		exports.cookies.format_object(this.cookies).forEach(value => this.headers.append('set-cookie', value));
		
		this.res.writeHead(status, this.headers.toJSON());
	}
	/**
	* Pipes the stream to the response
	* @param {Stream} Stream
	*/
	pipe_from(stream){
		this.finalize();
		
		return stream.pipe(this.res);
	}
	/**
	* Pipes response into stream
	* @param {Stream} Stream
	*/
	pipe(stream){
		return this.res.pipe(stream);
	}
	/**
	* Writes data to the response
	* @param {String|Buffer} [Body]
	*/
	write(data){
		if(this.body_sent)throw new TypeError('response body already sent!');
		
		this.res.write(data);
		
		return this;
	}
	/**
	* Closes the response with any additional data
	* @param {String|Buffer} Body
	*/
	end(data){
		if(this.body_sent)throw new TypeError('response body already sent!');
		
		if(['boolean', 'number'].includes(typeof data))data += '';
		
		this.finalize();
		
		this.res.end(data);
		
		this.body_sent = true;
		
		return this;
	}
	/**
	* Closes the response with data and sends headers
	* @param {String|Buffer} Body
	*/
	send(body){
		if(this.body_sent)throw new TypeError('response body already sent!');
		
		this.end(body);
		
		return this;
	}
	/**
	* Calls send with JSON.stringifyied data from the body
	* @param {Object|Array|String|Number} Body
	*/
	json(object){
		this.contentType('application/json');
		this.send(JSON.stringify(object));
		
		return this;
	}
	/**
	* Pipes data from zlib to the response
	* @param {String|Buffer|Stream} [Body]
	 @param {String} Encoding ( can be gzip, br, and deflate ), defaults to auto
	*/
	compress(body){
		if(this.body_sent)throw new TypeError('response body already sent!');
		
		var accept_encoding = this.req.headers.has('accept-encoding') && this.req.headers.get('accept-encoding').split(', '),
			types = ['br', 'gzip', 'deflate'] || [],
			type = types.find(type => accept_encoding.includes(type));
		
		// anything below 1mb not worth compressing
		if(!type || !accept_encoding.includes(type))return body instanceof stream ? this.pipe_from(body) : this.send(body);
		
		var compressed = type == 'br' ? zlib.createBrotliCompress() : type == 'gzip' ? zlib.createGzip() : zlib.createDeflate();
		
		if(body instanceof stream)body.pipe(compressed);
		else compressed.end(body);
		
		return this.set('content-encoding', type).pipe_from(compressed);
	}
	/**
	* Displays an error message or status
	* @param {Number} HTTP status code
	* @param {String|Error|Number|Object|Array} Message, util.format is called on errors and has <pre> tags added
	*/
	error(code, message = http.STATUS_CODES[code], title = code){
		if(message instanceof Error)title = message.code, message = '<pre>' + exports.sanitize(util.format(message)) + '</pre>';
		
		return this.set('content-type', 'text/html').status(code).send('<!doctype html><html><head><meta charset="utf8"><title>' + util.format(title) + ' ' + util.format(message) + '</title></head><body><center><h1>' + util.format(title) + ' ' + util.format(message) + '</h1></center><hr><center>nodehttp</center></body></html>');
	}
	cgi_status(...args){
		console.warn('cgi_status is deprecated, change to error');
		return this.error(...args);
	}
	cgi_error(...args){
		console.warn('cgi_error is deprecated, change to error');
		return this.error(...args);
	}
	/**
	* Sets the status code and location header
	* @param {Number} [Status] Param can be the location and will be set to 302
	* @param {String|URL} URL
	*/
	redirect(status, redir){
		if(this.body_sent)throw new TypeError('response body already sent!');
		if(this.head_sent)throw new TypeError('response headers already sent!');
		
		if(!redir)redir = status, status = 302;
		
		// url.resolve(this.req.url.origin, redir);
		// redir = redir;
		
		this.set('location', redir);
		this.set('content-type', 'text/html');
		this.status(status);
		
		if(!this.execute_sent)this.send();
		
		return this;
	}
	/**
	* Sets the content-type header
	* @param {String} Content type
	*/
	contentType(value){
		this.set('content-type', value);
		
		return this;
	}
};

/**
* Sanitizes a string
* @param {String}
* @returns {String}
*/

exports.sanitize = string => (string + '').split('').map(char => '&#' + char.charCodeAt() + ';').join('');

exports.date = require('./date.js');

exports.cookies = require('./cookies.js');

exports.size = {
	b: 1,
	kb: 1e3,
	mb: 1e6,
	gb: 1e9,
	tb: 1e12,
	pb: 1e+15,
	string(bytes){
		if(bytes < this.kb)return bytes + ' B';
		else if(bytes < this.mb)return (bytes / this.kb).toFixed(1) + ' KB';
		else if(bytes < this.gb)return (bytes / this.mb).toFixed(1) + ' MB';
		else if(bytes < this.tb)return (bytes / this.gb).toFixed(1) + ' GB';
		else if(bytes < this.pb)return (bytes / this.pb).toFixed(1) + ' TB';
		else if(bytes > this.tb)return (bytes / this.tb).toFixed(1) + ' PB';
		else return bytes + ' B';
	},
};

exports.html = (fn, body, req, res, args = {}, ctx) => new Promise(resolve => {
	// replace and execute both in the same regex to avoid content being insert and ran
	
	body = body.toString();
	
	res.execute_sent = true;
	
	var fd = path.dirname(fn),
		output = '',
		dirname = path.dirname(fn),
		context = ctx || Object.assign({
			__dirname: dirname,
			__filename: fn,
			count(obj){
				if(typeof obj == 'string' || Array.isArray(arr))return obj.length;
				else if(typeof obj == 'object')return Object.keys(obj).length;
				
				throw new TypeError('`obj` must be a string or object');
			},
			file(file){
				return path.resolve(fd, file);
			},
			echo(...args){
				args.forEach(arg => output += util.format(arg));
				
				return true;
			},
			setTimeout: setTimeout,
			setInterval: setInterval,
			clearTimeout: clearTimeout,
			clearInterval: clearInterval,
			process: process,
			req: req,
			res: res,
			server: res.server,
			nodehttp: exports,
			fs: fs,
			path: path,
			btoa: str => Buffer.from(str || '', 'utf8').toString('base64'),
			atob: str => Buffer.from(str || '', 'base64').toString('utf8'),
			async include(file){
				file = context.file(file);
				
				if(typeof file != 'string')throw new TypeError('`file` must be a string');
				if(!(await fs_promises_exists(file)))throw new TypeError('`file` must exist');
				if(!res.server.config.execute.includes(path.extname(file)))throw new TypeError('`file` must be one  of the executable extensions: ' + res.server.config.execute.join(', '));
				
				var text = await fs.promises.readFile(file, 'utf8');
				
				if(path.extname(file) == '.js')text = '<?js\n' + text + '\n?>';
				
				// pass global
				return exports.html(file, text, req, res, {}, context).then(data => context.echo(data));
			},
			require(file){
				return require(context.file(file))
			},
			async afilemtime(file){
				file = context.file(file);
				
				if(!(await fs_promises_exists(file)))throw new TypeError('`file` must exist');
				
				return (await fs.promises.stat(file)).mtimeMs;
			},
			filemtime(file){
				file = context.file(file);
				
				if(!fs.existsSync(file))throw new TypeError('`file` must exist');
				
				return fs.statSync(file).mtimeMs;
			},
		}, args);
	
	context.global = context;
	
	try{
		new AsyncFunction('arguments', Object.keys(context), exports.syntax.parse(exports.syntax.format(body)).map(data => {
			if(data.type == 'syntax'){
				var code = data.value.slice(0, -2);
				
				if(code.startsWith('<?='))code = 'echo(' + code.slice(3) + ')';
				else if(code.startsWith('<?php'))code = code.slice(5);
				else if(code.startsWith('<?js'))code = code.slice(4);
				else if(code.startsWith('<?'))code = code.slice(2);
				
				return code;
			}
			
			return 'echo(' + JSON.stringify(data.value) + ')';
		}).join(';\n') + '\n//# sourceURL=' + fn).call(context, undefined, ...Object.values(context)).then(() => {
			resolve(output);
		}).catch(err => {
			console.error(err);
			resolve('<pre>' + exports.sanitize(util.format(err)) + '</pre>');
		}).finally(() => {
			context = null;
		});
	}catch(err){
		console.error(err);
		resolve('<pre>' + exports.sanitize(util.format(err)) + '</pre>');
	}
});

exports.url = {
	fake_ip(){
		return [0,0,0,0].map(_ => ~~(Math.random() * 255) + 1).join('.');
	},
	add_proto(url){
		return !url.match(/^(?:f|ht)tps?\:\/\//) ? 'https://' + url : url;
	},
};

exports.syntax = require('./syntax.js');

/** 
* Create an http(s) server with config provided
* @param {Object} [config]
* @param {Number} [config.port] - Listening port
* @param {String} [config.address] - Listening address
* @param {Object} [config.ssl ssl] - SSL data
* @param {String} [config.ssl.key] - SSL key data
* @param {String} [config.ssl.crt] - SSL certificate data
* @param {String} [config.type] - Server type, can be http, https, http2, defaults to if SSL is provided = https, otherwise http
*/

exports.server = class extends events {
	constructor(config = {}){
		super();
		
		this.config = Object.assign({
			execute: ['.php', '.jhtml'],
			index: [ 'index.html', 'index.jhtml', 'index.php' ],
			handler: async (req, res) => {
				if(exports.http.body.includes(req.method.toLowerCase()))await req.process();
				
				this.pick_route(req, res, [...this.routes]);
			},
			port: 8080,
			address: '127.0.0.1',
			type: config.ssl ? 'https' : 'http',
			log_ready: false,
		}, config);
		
		if(this.config.static)throw new TypeError('`static` has been changed. Check documentation or try: server.use(nodehttp.static(' + JSON.stringify(this.config.static) + '))');
		
		this.routes = [];
		this.aliases = new Map();
		
		this.server = ({ http: http, https: https, http2: http2 })[this.config.type].createServer(this.config.ssl, (req, res) => {
			var re = new exports.response(req, res, this);
			
			this.config.handler(re.req, re);
		}).listen(this.config.port, this.config.address, () => {
			this.emit('ready');
			
			if(this.config.log_ready)console.log(`[${process.pid}] server listening on ${this.url}`);
		}).on('error', err => this.emit('error', err));
		
		this.server.on('upgrade', (req, socket, head) => this.emit('upgrade', req, socket, head));
		this.server.on('connection', socket => this.emit('connection', socket));
		this.server.on('close', err => this.emit('close', err));
	}
	get address_alias(){
		return ['0.0.0.0', '127.0.0.1'].includes(this.config.address) ? 'localhost' : this.config.address;
	}
	get url(){
		return new URL('http' + (this.config.ssl ? 's' : '') + '://' + this.address_alias + ':' + this.config.port);
	}
	pick_route(req, res, routes){
		var end = routes.findIndex(([ method, path, input, callback ]) => {
			if(method != '*' && method != req.method.toLowerCase())return;
			else if(path == '*')return true;
			else if(path instanceof RegExp)return path.test(req.url.pathname);
			else return path == req.url.pathname;
		});
		
		if(routes[end])req.route = routes[end], routes[end][3](req, res, () => {
			routes.splice(end, 1);
			
			this.pick_route(req, res, routes);
		});
		else res.error(404);
	}
	/**
	* An internal redirect
	* @param {String} path
	* @param {String} alias
	*/
	alias(path, alias){
		this.aliases.set(path, alias);
		
		return this;
	}
};

/**
* Generates a ETag
* @param {String|Buffer|Stream|Number} Data
* @returns {String} ETag
*/

exports.etag = data => {
	var hash = crypto.createHash('sha1').update(data, 'utf8').digest('base64').substring(0, 27);
	
	return '"' + Buffer.byteLength(data).toString(16) + '-' + hash + '"';
};

[ [ 'use', '*' ], [ 'all', '*' ] ].concat(exports.http.methods).forEach(data => {
	var name, method;
	
	if(Array.isArray(data))name = data[0], method = data[1];
	else name = method = data;
	
	exports.server.prototype[name] = function(...args){
		var path = typeof args[1] == 'function' ? args[0] : '*',
			input = path,
			callback = typeof args[1] == 'function' ? args[1] : args[0],
			make_regex = path => new RegExp(path.replace(/[[\]\/()$^+|.?]/g, char => '\\' + char).replace(/\*/g, '.*?'));
		
		if(typeof callback != 'function')throw new TypeError('specify a callback (function)');
		
		if(path != '*' && path.includes('*'))path = make_regex(path);
		
		if(name == 'use'){
			if(!(path instanceof RegExp))path = make_regex(path);
			
			path = new RegExp(path.source + '.*?', path.flags);
		}
		
		this.routes.push([ method, path, input, callback ]);
	};
});

/**
* Static directory handler
* @param {String} root - Root directory
* @param {Object} [options.global] - Variables to add to execution context
* @param {Object} [options.cache] - Cache duration in seconds for static files, by default off
* @param {Array} [options.execute] - Extensions that will be executed like PHP eg [ '.html', '.php' ]
* @param {Array} [options.index] - Filenames that will be served as an index file eg [ 'index.html', 'index.php', 'homepage.php' ]
* @param {Array} [options.compress] - Extensions that will automatically be served with compression
* @param {Array} [options.listing] - Path to folders (relative to static specified) to show the default directory listing ( eg folder in static named "media" will be listing: [ "media" ] )
* @param {Boolean} [options.fallthrough] - If an error occurs, next(err) will be called, otherwise the default error page will show
* @param {Boolean} [options.error] - If this is set, fallthrough will be ignored and any error page will resolve to the file set by this property
* @param {Function} [options.setHeader] - Function that is called with (res, file, stats), intended to set headers, can be async
* @example
* var nodehttp = require('sys-nodehttp'),
* 	server = new nodehttp.server({ log_ready: true });
* 
* server.use(nodehttp.static('public', { listing: [ '/images' ] }));
* // The root of the server will be from a relative folder named public, visiting /images will show a directory listing of the folder named images (if it exists)
*/

exports.static = (root, options = {}) => {
	options = Object.assign({}, {
		listing: [],
		index: [ 'index.html', 'index.php' ],
		compress: [], // [ '.wasm', '.unityweb', '.css', '.js', '.ttf', '.otf', '.woff', '.woff2', '.eot', '.json' ],
		execute: ['.php', '.jhtml'],
		etag: true,
		fallthrough: true,
		error: false,
		lastModified: true,
		redirect: true,
		dotfiles: 'ignore',
	}, options);
	
	return async (req, res, next) => {
		var relative = path.posix.resolve('/', req.url.pathname.substr((req.route[2] == '*' ? '/' : req.route[2]).length)),
			file = path.join(root, relative),	
			error = async (...args) => {
				if(!options.error && options.fallthrough)return next(...args);
				
				if(message instanceof Error)title = message.code, message = '<pre>' + exports.sanitize(util.format(message)) + '</pre>';
				
				res.set('content-type', 'text/html').status(code);

				exports.html(file, options.error && await fs_promises_exists(options.error) ? await fs.promises.readFile(options.error) : '<!doctype html><html><head><meta charset="utf8"><title><?=error?></title></head><body><center><h1><?=error?></h1></center><hr><center>nodehttp</center></body></html>', req, res, {
					title: title,
					message: message,
					error: title + ' ' + message,
				}).then(data => res.send(data));
			};
		
		if(path.basename(file).startsWith('.') && options.dotfiles == 'ignore')return error(403);
		
		if(!(await fs_promises_exists(file)))return error(404);
		
		if(options.index && (await fs.promises.stat(file)).isDirectory()){
			if(!req.url.pathname.endsWith('/') && options.redirect)return res.redirect(301, req.url.pathname + '/');
			
			var resolved;
			
			for(var ind in options.index){
				if(await fs_promises_exists(resolved = path.join(file, options.index[ind])))break;
				else resolved = file;
			}
			
			file = resolved;
		}
		
		if(options.listing.includes(relative) && (await fs.promises.stat(file)).isDirectory())return fs.promises.readFile(path.join(__dirname, 'listing.php')).then(body => exports.html(file, body, req, res, { static_root: root })).then(data => res.send(data));
		
		// no index and no file
		if(!(await fs_promises_exists(file)) || (await fs.promises.stat(file)).isDirectory() || path.basename(file).startsWith('.') && options.dotfiles == 'ignore')return error(404);
		
		var ext = (path.extname(file) + ''),
			mime = options.execute.includes(ext) ? 'text/html' : exports.http.mimes[ext.substr(1)] || 'application/octet-stream',
			stats = await fs.promises.stat(file),
			handle = await fs.promises.open(file, 'r'),
			first_five = await fs_promises_read(handle.fd, Buffer.alloc(5, [0, 0, 0, 0, 0]), 0, 5, 0),
			encoding = first_five[0] === 0xEF && first_five[1] === 0xBB && first_five[2] === 0xBF
			? 'UTF-8'
			: first_five[0] === 0xFE && first_five[1] === 0xFF
				? 'UTF-16BE'
				: first_five[0] === 0xFF && first_five[1] === 0xFE
					? 'UTF-16LE'
					: null; // 'ascii';
		
		await handle.close();
		
		if(encoding)mime += '; charset=' + encoding;
		
		res.status(200);
		res.headers.set('content-type', mime);
		
		res.set('date', exports.date.format(res.req.date));
		
		// executable file
		if(options.execute.includes(ext))return fs.promises.readFile(file).then(body => exports.html(file, body, req, res, options.global).then(data => {
			if(!res.body_sent){
				res.set('content-length', Buffer.byteLength(data));
				res.set('etag',  exports.etag(data));
				res.send(data);
			}
		})).catch(err => console.error(err) + res.send(util.format(err)));
		
		if(req.headers.has('if-modified-since') && !exports.date.compare(stats.mtimeMs, req.headers.get('if-modified-since')))return res.status(304).end();
		
		if(options.lastModified)res.set('last-modified', exports.date.format(stats.mtimeMs));
		
		if(res.server.config.cache)res.set('cache-control', 'max-age=' + res.server.config.cache);
		
		if(options.etag && req.headers.has('if-none-match') && req.headers.get('if-none-match') == res.headers.get('etag'))return res.status(304).end();
		
		if(options.setHeaders)await options.setHeaders(res, file, stats);
		
		if(stats.size < (exports.size.mb * 2))fs.promises.readFile(file).then(data => {
			if(options.etag)res.set('etag',	exports.etag(data));
			res.set('content-length', Buffer.byteLength(data));
			res.send(data);
		}); else res.compress(fs.createReadStream(file));
	};
};