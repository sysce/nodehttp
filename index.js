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
	fs_promises_exists = path => new Promise((resolve, reject) => fs.promises.access(path, fs.F_OK).then(() => resolve(true)).catch(err => resolve(false)));

exports.find_arg = (args, type, fallback) => args.find(arg => typeof arg == type) || fallback;

exports.btoa = str => Buffer.from(str || '', 'utf8').toString('base64');
exports.atob = str => Buffer.from(str || '', 'base64').toString('utf8');
exports.wrap = str => JSON.stringify([ str ]).slice(1, -1);

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
	compress(body, type){
		var types = ['br', 'gzip', 'deflate']
		
		if(this.body_sent)throw new TypeError('response body already sent!');
		
		if(typeof body == 'string')body = Buffer.from(body);
		
		var accept_encoding = this.req.headers.has('accept-encoding') && this.req.headers.get('accept-encoding').split(', ');
		
		if(!type)type = types.find(type => accept_encoding.includes(type));
		
		// anything below 1mb not worth compressing
		if(!type || !accept_encoding || !accept_encoding.includes(type))return this.send(body);
		
		var compressed = type == 'br' ? zlib.createBrotliCompress() : type == 'gzip' ? zlib.createGzip() : zlib.createDeflate();
		
		if(body instanceof stream)body.pipe(compressed);
		else compressed.end(body);
		
		return this.set('content-encoding', type).pipe_from(compressed);
	}
	/**
	* Generates an etag
	* @param {String|Buffer} Entity
	* @returns {String}
	*/
	etag(ent){
		var length = Buffer.byteLength(ent);
		
		if(!length)return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
		
		var hash = crypto.createHash('sha1').update(ent, 'utf8').digest('base64').substring(0, 27);
		
		return '"' + length.toString(16) + '-' + hash + '"';
	}
	/**
	* Sends a static file with a mime type, good for sending video files or anything streamed
	* @param {String} [File] By default the file is resolved by servers static path
	*/
	async static(pub_file = path.join(this.server.config.static, this.req.url.pathname)){
		if(this.req.url.pathname.startsWith('/cgi/'))return this.cgi_error(403);
		
		if(!(await fs_promises_exists(pub_file)))return this.cgi_error(404);
		
		// show directory listing?
		var listing = false;
		
		if((await fs.promises.stat(pub_file)).isDirectory()){
			if(!this.req.url.pathname.endsWith('/'))return this.redirect(301, this.req.url.pathname + '/');
			
			var resolved;
			
			for(var ind in this.server.config.index){
				if(await fs_promises_exists(resolved = path.join(pub_file, this.server.config.index[ind])))break;
				else resolved = pub_file;
			}
			
			pub_file = resolved;
		}
		
		if(!(await fs_promises_exists(pub_file)) || (await fs.promises.stat(pub_file)).isDirectory()){
			if((await fs.promises.stat(pub_file)).isDirectory() && this.server.config.listing.includes(path.relative(this.server.config.static, pub_file)))listing = this.server.config.cgi_listing;
			else return this.cgi_error(404);
		}
		
		var ext = (path.extname(listing || pub_file) + ''),
			mime = this.server.config.execute.includes(ext) ? 'text/html' : exports.http.mimes[ext.substr(1)] || 'application/octet-stream',
			stats = await fs.promises.stat(listing || pub_file);
		
		this.status(200);
		this.headers.set('content-type', mime);
		
		this.set('date', exports.date.format(this.req.date));
		
		// executable file
		if(listing || this.server.config.execute.includes(ext))return fs.promises.readFile(listing || pub_file).then(body => exports.html(pub_file, body, this.req, this).then(data => {
			if(!this.body_sent){
				this.set('content-length', Buffer.byteLength(data));
				this.set('etag', this.etag(data));
				this.send(data);
			}
		})).catch(err => console.error(err) + this.send(util.format(err)));
		
		if(this.req.headers.has('if-modified-since') && !exports.date.compare(stats.mtimeMs, this.req.headers.get('if-modified-since')))return this.status(304).end();
		
		this.set('last-modified', exports.date.format(stats.mtimeMs));
		
		if(this.server.config.cache)this.set('cache-control', 'max-age=' + this.server.config.cache);
		
		if(stats.size < (exports.size.gb / 10))fs.promises.readFile(pub_file).then(data => {
			this.set('content-length', stats.size);
			this.set('ETag', this.etag(data));
			
			if(this.req.headers.has('if-none-match') && this.req.headers.get('if-none-match') == this.headers.get('etag'))return this.status(304).end();
			
			this.send(data);
		}).catch(err => console.error(err) + this.cgi_error(400, err));
		else{
			var fst = fs.createReadStream(pub_file),
				accept_encoding = this.req.headers.has('accept-encoding') && this.req.headers.get('accept-encoding').split(', ');
			
			if(this.server.config.compress.includes(ext) && accept_encoding && accept_encoding.includes('gzip'))this.compress(fst);
			else this.pipe_from(fst);
		}
	}
	/**
	* Sends a page from the `error.html` file in the `cgi` folder in the static folder, provides the variables $title and $reason in syntax
	* @param {Number} HTTP status code
	* @param {String|Error|Number|Object|Array} Message, util.format is called on errors and has <pre> tags added
	*/
	async cgi_error(code, message = http.STATUS_CODES[code], title = code){
		if(this.body_sent)throw new TypeError('response body already sent!');
		if(this.sent_head)throw new TypeError('response headers already sent!');
		
		if(message instanceof Error)title = message.code, message = '<pre>' + exports.sanitize(util.format(message)) + '</pre>';
		else message = message;
		
		var text = await fs_promises_exists(this.server.config.cgi_error) ? await fs.promises.readFile(this.server.config.cgi_error) : '<!doctype html><html><head><meta charset="utf8"><title><?=error?></title></head><body><center><h1><?=error?></h1></center><hr><center>nodehttp</center></body></html>';
		
		this.set('content-type', 'text/html');
		this.status(code);
		
		exports.html(this.server.config.cgi_error, text, this.req, this, {
			title: title,
			reason: message,
			message: message,
			error: title + ' ' + message,
		}).then(data => this.send(data));
		
		return this;
	}
	cgi_status(...args){
		console.warn('cgi_status is deprecated, change to cgi_error');
		return this.cgi_error(...args);
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
	// args can contain additional globals for context
	
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
			echo(str){
				return output += str, '';
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
		}, res.server.config.global, args);
	
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
* @param {String} [config.static] - Static files
* @param {Object} [config.ssl ssl] - SSL data
* @param {String} [config.ssl.key] - SSL key data
* @param {String} [config.ssl.crt] - SSL certificate data
* @param {String} [config.type] - Server type, can be http, https, http2, defaults to if SSL is provided = https, otherwise http
* @param {Object} [config.cache] - Cache duration in seconds for static files, by default off
* @param {Object} [config.global] - Variables to add to execution context
* @param {Array} [config.execute] - Extensions that will be executed like PHP eg [ '.html', '.php' ]
* @param {Array} [config.index] - Filenames that will be served as an index file eg [ 'index.html', 'index.php', 'homepage.php' ]
* @param {Array} [config.compress] - Extensions that will automatically be served with compression
* @param {Array} [config.listing] - Path to folders (relative to static specified) to show the default directory listing ( eg folder in static named "media" will be listing: [ "media" ] )
*/

exports.server = class extends events {
	constructor(config = {}){
		super();
		
		this.config = Object.assign({
			cache: false,
			execute: ['.php', '.jhtml'],
			index: [ 'index.html', 'index.jhtml', 'index.php' ],
			global: {
				fs: fs,
				path: path,
				atob: exports.atob,
				btoa: exports.btoa,
				nodehttp: exports,
			},
			handler: async (req, res) => {
				if(exports.http.body.includes(req.method.toLowerCase()))await req.process();
				
				this.pick_route(req, res, [...this.routes], this.config.static && await fs_promises_exists(this.config.static));
			},
			compress: [ '.wasm', '.unityweb', '.css', '.js', '.ttf', '.otf', '.woff', '.woff2', '.eot', '.json' ],
			listing: [],
			port: 8080,
			address: '127.0.0.1',
			static: '',
			type: config.ssl ? 'https' : 'http',
			log_ready: false,
		}, config);
		
		this.routes = [];
		
		this.config.cgi = path.join(this.config.static, 'cgi');
		this.config.cgi_error = path.join(this.config.static, 'cgi', 'error.php');
		this.config.cgi_listing = path.join(__dirname, 'listing.php');
		
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
	get alias(){
		return ['0.0.0.0', '127.0.0.1'].includes(this.config.address) ? 'localhost' : this.config.address;
	}
	get url(){
		return new URL('http' + (this.config.ssl ? 's' : '') + '://' + this.alias + ':' + this.config.port);
	}
	pick_route(req, res, routes, static_exists){
		var end = routes.findIndex(([ path, callback, method ]) => {
			if(method != '*' && method != req.method)return;
			else if(path == '*')return true;
			else if(path instanceof RegExp)return path.test(req.url.pathname);
			else return path == req.url.pathname;
		});
		
		if(routes[end])routes[end][1](req, res, () => {
			routes.splice(end, 1);
			
			this.pick_route(req, res, routes, static_exists);
		});
		else if(static_exists)res.static();
		else res.cgi_error(404);
	}
};

[ [ 'use', '*' ] ].concat(exports.http.methods).forEach(data => {
	var name, method;
	
	if(Array.isArray(data))name = data[0], method = data[1];
	else name = data;
	
	exports.server.prototype[name] = function(...args){
		var path = exports.find_arg(args, 'string', '*'),
			callback = exports.find_arg(args, 'function');
		
		if(path != '*' && path.includes('*'))path = new RegExp(path.replace(/[[\]\/()$^+|.?]/g, char => '\\' + char).replace(/\*/g, '.*?'));
		
		if(typeof callback != 'function')throw new TypeError('specify a callback (function)');
		
		this.routes.push([ path, callback, method ]);
	}
});