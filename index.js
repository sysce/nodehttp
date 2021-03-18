'use strict';
var fs = require('fs'),
	url = require('url'),
	path = require('path'),
	util =  require('util'),
	zlib = require('zlib'),
	http = require('http'),
	https = require('https'),
	events = require('events'),
	crypto = require('crypto'),
	AsyncFunction = (async _=>_).constructor,
	fs_promises_exists = path => new Promise((resolve, reject) => fs.promises.access(path, fs.F_OK).then(() => resolve(true)).catch(err => resolve(false)));

// incase this is confused for util or sys module
exports.format = util.format;

exports.btoa = str => Buffer.from(str || '', 'utf8').toString('base64');
exports.atob = str => Buffer.from(str || '', 'base64').toString('utf8');
exports.wrap = str => JSON.stringify([ str ]).slice(1, -1);

exports.valid_json = json => {  try{ return JSON.parse(json) }catch(err){ return null } };

// mime types, status codes, 
exports.http = {days:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],months:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],body:['PUT','PATCH','DELETE','POST'],status_codes:{"100":"Continue","101":"Switching Protocols","102":"Processing","103":"Early Hints","200":"OK","201":"Created","202":"Accepted","203":"Non-Authoritative Information","204":"No Content","205":"Reset Content","206":"Partial Content","207":"Multi-Status","208":"Already Reported","226":"IM Used","300":"Multiple Choices","301":"Moved Permanently","302":"Found","303":"See Other","304":"Not Modified","305":"Use Proxy","307":"Temporary Redirect","308":"Permanent Redirect","400":"Bad Request","401":"Unauthorized","402":"Payment Required","403":"Forbidden","404":"Not Found","405":"Method Not Allowed","406":"Not Acceptable","407":"Proxy Authentication Required","408":"Request Timeout","409":"Conflict","410":"Gone","411":"Length Required","412":"Precondition Failed","413":"Payload Too Large","414":"URI Too Long","415":"Unsupported Media Type","416":"Range Not Satisfiable","417":"Expectation Failed","418":"I'm a Teapot","421":"Misdirected Request","422":"Unprocessable Entity","423":"Locked","424":"Failed Dependency","425":"Too Early","426":"Upgrade Required","428":"Precondition Required","429":"Too Many Requests","431":"Request Header Fields Too Large","451":"Unavailable For Legal Reasons","500":"Internal Server Error","501":"Not Implemented","502":"Bad Gateway","503":"Service Unavailable","504":"Gateway Timeout","505":"HTTP Version Not Supported","506":"Variant Also Negotiates","507":"Insufficient Storage","508":"Loop Detected","509":"Bandwidth Limit Exceeded","510":"Not Extended","511":"Network Authentication Required"},mimes:{html:"text/html",htm:"text/html",shtml:"text/html",css:"text/css",xml:"text/xml",gif:"image/gif",jpeg:"image/jpeg",jpg:"image/jpeg",js:"application/javascript",atom:"application/atom+xml",rss:"application/rss+xml",mml:"text/mathml",txt:"text/plain",jad:"text/vnd.sun.j2me.app-descriptor",wml:"text/vnd.wap.wml",htc:"text/x-component",png:"image/png",tif:"image/tiff",tiff:"image/tiff",wbmp:"image/vnd.wap.wbmp",ico:"image/x-icon",jng:"image/x-jng",bmp:"image/x-ms-bmp",svg:"image/svg+xml",svgz:"image/svg+xml",webp:"image/webp",woff:"application/font-woff",jar:"application/java-archive",war:"application/java-archive",ear:"application/java-archive",json:"application/json",hqx:"application/mac-binhex40",doc:"application/msword",pdf:"application/pdf",ps:"application/postscript",eps:"application/postscript",ai:"application/postscript",rtf:"application/rtf",m3u8:"application/vnd.apple.mpegurl",xls:"application/vnd.ms-excel",eot:"application/vnd.ms-fontobject",ppt:"application/vnd.ms-powerpoint",wmlc:"application/vnd.wap.wmlc",kml:"application/vnd.google-earth.kml+xml",kmz:"application/vnd.google-earth.kmz","7z":"application/x-7z-compressed",cco:"application/x-cocoa",jardiff:"application/x-java-archive-diff",jnlp:"application/x-java-jnlp-file",run:"application/x-makeself",pl:"application/x-perl",pm:"application/x-perl",prc:"application/x-pilot",pdb:"application/x-pilot",rar:"application/x-rar-compressed",rpm:"application/x-redhat-package-manager",sea:"application/x-sea",swf:"application/x-shockwave-flash",sit:"application/x-stuffit",tcl:"application/x-tcl",tk:"application/x-tcl",der:"application/x-x509-ca-cert",pem:"application/x-x509-ca-cert",crt:"application/x-x509-ca-cert",xpi:"application/x-xpinstall",xhtml:"application/xhtml+xml",xspf:"application/xspf+xml",zip:"application/zip",bin:"application/octet-stream",exe:"application/octet-stream",dll:"application/octet-stream",deb:"application/octet-stream",dmg:"application/octet-stream",iso:"application/octet-stream",img:"application/octet-stream",msi:"application/octet-stream",msp:"application/octet-stream",msm:"application/octet-stream",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",mid:"audio/midi",midi:"audio/midi",kar:"audio/midi",mp3:"audio/mpeg",ogg:"audio/ogg",m4a:"audio/x-m4a",ra:"audio/x-realaudio","3gpp":"video/3gpp","3gp":"video/3gpp",ts:"video/mp2t",mp4:"video/mp4",mpeg:"video/mpeg",mpg:"video/mpeg",mov:"video/quicktime",webm:"video/webm",flv:"video/x-flv",m4v:"video/x-m4v",mng:"video/x-mng",asx:"video/x-ms-asf",asf:"video/x-ms-asf",wmv:"video/x-ms-wmv",avi:"video/x-msvideo",wasm:"application/wasm",ttf:"font/ttf"}};

exports.hash = str => { var hash = 5381, i = str.length; while(i)hash = (hash * 33) ^ str.charCodeAt(--i); return hash >>> 0; };

exports.path_regex = /[\/\\]+/g;

exports.URL = class extends URL {
	get fullpath(){
		return this.url.href.substr(this.url.origin.length);
	}
}

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
		
		this.url = new exports.URL(req.url.replace(exports.path_regex, '/'), 'http' + (server.ssl ? 's' : '') + '://' + req.headers.host);
		
		this.date = new Date();
		
		this.headers = new exports.headers(req.headers);
		this.real_ip = this.headers.get('cf-connecting-ip') ||  this.headers.get('x-real-ip') || '127.0.0.1';
		
		this.query = Object.fromEntries([...this.url.searchParams.entries()]);
		this.method = req.method;
		this.cookies = Object.fromEntries(exports.response.prototype.deconstruct_cookies(req.headers.cookie).map(cookie => [ cookie.name, cookie.value ]));
		
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
			if(!exports.http.body.includes(this.method))return resolve();
			
			var post_chunks = [];
			
			this.req.on('data', chunk => post_chunks.push(chunk)).on('end', () => {
				this.raw_body = Buffer.concat(post_chunks);
				
				switch((this.headers.get('content-type') + '').replace(/;.*/, '')){
					case'text/plain':
						
						this.body = this.raw_body.toString('utf8');
						
						break;
					case'application/json':
						
						this.body = exports.valid_json(this.raw_body.toString('utf8')) || {};
						
						break;
					case'application/x-www-form-urlencoded':
						
						this.body = Object.fromEntries([...new URLSearchParams(this.raw_body.toString('utf8')).entries()]);
						
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
		
		if(typeof headers == 'object')for(var name in headers){
			this.set(name, headers[name]);
		}
	}
	normal_name(name){
		if(typeof name != 'string')throw new TypeError('`name` must be a string');
		
		return name.toLowerCase().replace(/((?:^|-)[a-z])/g, (match, char) => char.toUpperCase());
	}
	normal_value(value){
		if(typeof value == 'undefined' || value == null)throw new TypeError('`value` must be a value');
		
		return [...value.toString().trim()].filter(x => x.charCodeAt()).join('');
	}
	get(name){ 
		return super.get(this.normal_name(name));
	}
	has(name){
		return super.has(this.normal_name(name));
	}
	delete(name){
		return super.delete(this.normal_name(name));
	}
	set(name, value){
		return super.set(this.normal_name(name), this.normal_value(value));
	}
	append(name, value){
		name = this.normal_name(name);
		
		if(this.has(name)){
			var old_value = this.get(name);
			
			this.set(name, old_value.split(', ').concat(value).join(', '));
		}else super.set(name, this.normal_value(value));
	}
	forEach(callback, thisArg){
		super.forEach((value, name) => callback.call(thisArg || this, this.normal_value(value), this.normal_name(name), this));
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
		
		this.resp = { status: 200 };
		
		this.cookies = {};
		
		this.headers = new exports.headers();
	}
	/**
	* Set the response status code
	* @param {Number} HTTP Status
	*/
	status(code){
		this.resp.status = code;
		
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
	* Meant to be called internally, finalizes request preventing writing headers
	*/
	finalize(){
		if(this.resp.sent_head)throw new TypeError('response headers already sent');
		
		this.resp.sent_head = true;
		
		var status = this.resp.status;
		
		// remove trailers on chunked
		if(this.headers.get('content-encoding') == 'chunked' && this.headers.trailers)delete this.headers.trailers;
		
		// handle cookies
		
		if(Object.keys(this.cookies).length)this.headers.append('set-cookie', this.construct_cookies(Object.entries(this.cookies).map(([ key, val ]) => (val.name = key, val.path = val.path || '/', val.samesite = val.samesite || 'lax', val))));
		
		this.res.writeHead(status, Object.fromEntries([...this.headers.entries()]));
	}
	/**
	* Pipes the stream to the response
	* @param {Stream} Stream
	*/
	pipe_from(stream){
		this.finalize();
		
		stream.pipe(this.res);
	}
	/**
	* Writes data to the response
	* @param {String|Buffer} [Body]
	*/
	write(data){
		if(this.resp.sent_body)throw new TypeError('response body already sent!');
		
		this.res.write(data);
		
		return this;
	}
	/**
	* Closes the response with any additional data
	* @param {String|Buffer} Body
	*/
	end(data){
		if(this.resp.sent_body)throw new TypeError('response body already sent!');
		
		if(['boolean', 'number'].includes(typeof data))data += '';
		
		this.finalize();
		
		this.res.end(data);
		
		this.resp.sent_body = true;
		
		return this;
	}
	/**
	* Closes the response with data and sends headers
	* @param {String|Buffer} Body
	*/
	send(body){
		if(this.resp.sent_body)throw new TypeError('response body already sent!');
		
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
	* @param {String} Encoding ( can be gzip, br, and deflate )
	* @param {String|Buffer} [Body]
	*/
	compress(type, body){
		if(!['br', 'gzip', 'deflate'].includes(type))throw new TypeError('unknown compression `' + exports.wrap(type));
		
		if(this.resp.sent_body)throw new TypeError('response body already sent!');
		
		if(typeof body == 'string')body = Buffer.from(body);
		
		var accept_encoding = this.headers.has('accept-encoding') && this.headers.get('accept-encoding').split(' ');
		
		// anything below 1mb not worth compressing
		if(!accept_encoding || !accept_encoding.includes(type) || body.byteLength < 1024)return this.send(body);
		
		var stream = type == 'br' ? zlib.createBrotliCompress() : type == 'gzip' ? zlib.createGunzip() : zlib.createDeflate();
		
		stream.end(body);
		
		return this.set('content-encoding', type).pipe_from(stream);
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
	async static(pub_file = path.join(this.server.static, this.req.url.pathname)){
		if(this.req.url.pathname.startsWith('/cgi/'))return this.cgi_status(403);
		
		if(!(await fs_promises_exists(pub_file)))return this.cgi_status(404);
		
		if((await fs.promises.stat(pub_file)).isDirectory()){
			if(!this.req.url.pathname.endsWith('/'))return this.redirect(301, this.req.url.pathname + '/');
			
			var resolved;
			
			for(var ind in this.server.index){
				if(await fs_promises_exists(resolved = path.join(pub_file, this.server.index[ind])))break;
				else resolved = pub_file;
			}
			
			pub_file = resolved;
		}
		
		if(!(await fs_promises_exists(pub_file)) || (await fs.promises.stat(pub_file)).isDirectory())return this.cgi_status(404);
		
		var ext = (path.extname(pub_file) + ''),
			mime = this.server.execute.includes(ext) ? 'text/html' : exports.http.mimes[ext.substr(1)] || 'application/octet-stream',
			stats = await fs.promises.stat(pub_file);
		
		this.status(200);
		this.headers.set('content-type', mime);
		
		this.set('date', this.date(this.req.date));
		
		// executable file
		if(this.server.execute.includes(ext))return fs.promises.readFile(pub_file, 'utf8').then(body => exports.html(pub_file, body, this.req, this).then(data => {
			if(!this.resp.sent_body){
				this.set('content-length', Buffer.byteLength(data));
				this.set('etag', this.etag(data));
				this.send(data);
			}
		})).catch(err => console.error(err) + this.send(util.format(err)));
		
		if(this.req.headers.has('if-modified-since') && !this.compare_date(stats.mtimeMs, this.req.headers.get('if-modified-since')))return this.status(304).end();
		
		this.set('last-modified', this.date(stats.mtimeMs));
		this.set('content-length', stats.size);
		// this.set('cache-control', 'max-age=' + this.server.cache);
		
		fs.promises.readFile(pub_file).then(data => {
			this.set('ETag', this.etag(data));
			
			if(this.req.headers.has('if-none-match') && this.req.headers.get('if-none-match') == this.headers.get('etag'))return this.status(304).end();
			
			this.send(data);
		}).catch(err => console.error(err) + this.cgi_status(400, err));
	}
	/**
	* Sanitizes a string
	* @param {String}
	* @returns {String}
	*/
	sanitize(string){
		return (string + '').split('').map(char => '&#' + char.charCodeAt() + ';').join('')
	}
	/**
	* Sends a page from the `error.html` file in the `cgi` folder in the static folder, provides the variables $title and $reason in syntax
	* @param {Number} HTTP status code
	* @param {String|Error|Number|Object|Array} Message, util.format is called on errors and has <pre> tags added
	*/
	async cgi_status(code, message = exports.http.status_codes[code], title = code){
		if(this.resp.sent_body)throw new TypeError('response body already sent!');
		if(this.resp.sent_head)throw new TypeError('response headers already sent!');
		
		if(message instanceof Error)title = message.code, message = '<pre>' + this.sanitize(exports.format(message)) + '</pre>';
		else message = message;
		
		// exports.sanitize preferred
		
		var loca = path.join(this.server.static, 'cgi', 'error.html'),
			text = await fs_promises_exists(loca) ? await fs.promises.readFile(loca, 'utf8') : '<?js res.contentType("text/plain")?><?=$title?> <?=$reason?>';
		
		this.set('content-type', 'text/html');
		this.status(code);
		
		exports.html(loca, text, this.req, this, {
			title: title,
			reason: message,
		}).then(data => this.send(data));
		
		return this;
	}
	/**
	* Sets the status code and location header
	* @param {Number} [Status] Param can be the location and will be set to 302
	* @param {String|URL} URL
	*/
	redirect(status, redir){
		if(this.resp.sent_body)throw new TypeError('response body already sent!');
		if(this.resp.sent_head)throw new TypeError('response headers already sent!');
		
		if(!redir)redir = status, status = 302;
		
		// url.resolve(this.req.url.origin, redir);
		// redir = redir;
		
		this.set('location', redir);
		this.set('content-type', 'text/html');
		this.status(status);
		
		if(!this.resp.execute)this.send();
		
		return this;
	}
	/**
	* Sets the content-type header
	* @param {String} Content type
	*/
	content_type(value){
		this.set('content-type', value);
		
		return this;
	}
	/**
	* Sets the content-type header, alias of content_type
	* @param {String} Content type
	*/
	contentType(value){
		this.set('content-type', value);
		
		return this;
	}
	/**
	* Makes a parsable GMT string for the client 
	* @param {Date|Number} Date
	* @returns {String}
	*/
	date(date){
		if(typeof date == 'number')date = new Date(date);
		
		var day_name = exports.http.days[date.getUTCDay()],
			month = exports.http.months[date.getMonth()],
			timestamp = [ date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds() ].map(num => (num + '').padStart(2, 0)).join(':'),
			day = (date.getUTCDate() + '').padStart(2, 0),
			year = date.getUTCFullYear();
		
		// <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
		return day_name + ', ' + day + ' ' + month + ' ' + year + ' ' + timestamp + ' GMT';
	}
	/**
	* Parses a client date eg if-modifed-since
	* @param {String} Header
	* @returns {Date}
	*/
	parse_date(date){
		if(typeof date == 'number')return new Date(date);
		if(date instanceof Date)return date;
		
		var [ day_name, day, month, year, timestamp, timezone ] = date.split(' '),
			[ hours, minutes, seconds ] = (timestamp || '').split(':').map(num => parseInt(num)),
			out = new Date();
		
		out.setUTCMonth(exports.http.months.indexOf(month));
		out.setUTCDate(day);
		out.setUTCFullYear(year);
		out.setUTCHours(hours);
		out.setUTCMinutes(minutes);
		out.setUTCSeconds(seconds);
		
		out.setUTCMilliseconds(0);
		
		return out;
	}
	/**
	* Compares if date 1 is greater than date 2
	* @param {String|Date} Date 1
	* @param {String|Date} Date 2
	* @returns {Date}
	*/
	compare_date(date1, date2){
		var date1 = this.parse_date(date1),
			date2 = this.parse_date(date2);
		
		
		date1.setUTCMilliseconds(0);
		date2.setUTCMilliseconds(0);
		
		return date1.getTime() > date2.getTime();
	}
	construct_cookies(cookies){
		return cookies.filter(cookie => cookie && cookie.name && cookie.value).map(cookie => {
			var out = [];
			
			out.push(cookie.name + '=' + (cookie.value || ''));
			
			if(cookie.secure)out.push('Secure');
			
			if(cookie.http_only)out.push('HttpOnly');
			
			if(cookie.samesite)out.push('SameSite=' + cookie.samesite);
			
			return out.map(value => value + ';').join(' ');
		}).join(' ');
	}
	deconstruct_cookies(value){
		var cookies = [];
		
		if(value)value.split(';').forEach(data => {
			if(data[0] == ' ')data = data.substr(1);
			
			var [ name, value ] = data.split('='),
				lower_name = name.toLowerCase();
			
			if(['domain', 'expires', 'path', 'httponly', 'samesite', 'secure', 'max-age'].includes(lower_name)){
				var cookie = cookies[cookies.length - 1];
				
				if(cookie)switch(lower_name){
					case'expires':
						
						cookie.expires = new Date(value);
						
						break;
					case'path':
						
						cookie.path = value;
						
						break;
					case'httponly':
						
						cookie.http_only = true;
						
						break;
					case'samesite':
						
						cookie.same_site = value ? value.toLowerCase() : 'none';
						
						break;
					case'secure':
						
						cookie.secure = true;
						
						break;
					case'priority':
						
						cookie.priority = value.toLowerCase();
						
						break;
					case'domain':
						
						cookie.domain = value;
						
						break;
				}
			}else{
				cookies.push({ name: name, value: value });
			}
		});
		
		return cookies;
	}
};

exports.regex = {
	proto: /^(?:f|ht)tps?\:\/\//,
};

exports.html = (fn, body, req, res, args = {}, ctx) => new Promise(resolve => {
	// replace and execute both in the same regex to avoid content being insert and ran
	// args can contain additional globals for context
	
	res.resp.execute = true;
	
	var output = '',
		dirname = path.dirname(fn),
		context = ctx || Object.assign({
			count(obj){
				if(typeof obj == 'string' || Array.isArray(arr))return obj.length;
				else if(typeof obj == 'object')return Object.keys(obj).length;
				
				throw new TypeError('`obj` must be a string or object');
			},
			file(file){
				return path.isAbsolute(file) ? path.join(res.server.static, file) : path.join(dirname, file);
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
				if(!res.server.execute.includes(path.extname(file)))throw new TypeError('`file` must be one  of the executable extensions: ' + res.server.execute.join(', '));
				
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
		}, res.server.global, args);
	
	context.global = context;
	
	try{
		// "use strict"; ?
		new AsyncFunction('arguments', Object.keys(context), exports.syntax.parse(exports.syntax.format(body)).map(data => data.type == 'syntax' ? data.value : 'echo(' + JSON.stringify(data.value) + ')').join(';\n') + '\n//# sourceURL=' + fn).call(context, undefined, ...Object.values(context)).then(() => {
			resolve(output);
		}).catch(err => {
			console.error(err);
			resolve('<pre>' + res.sanitize(util.format(err)) + '</pre>');
		}).finally(() => {
			context = null;
		});
	}catch(err){
		console.error(err);
		resolve('<pre>' + res.sanitize(util.format(err)) + '</pre>');
	}
});

exports.fake_ip = [0,0,0,0].map(_ => ~~(Math.random() * 255) + 1).join('.');

exports.add_proto = url => !url.match(exports.regex.proto) ? 'https://' + url : url;

exports.syntax = {
	regex: /(?<!\\)<\?(=|js|php)([\s\S]*?)(?<!\\)\?>/g,
	variable_php: /\$(\S)/g,
	format(string){
		var entries = [];
		
		string = string.replace(this.variable_php, '$1');
		
		string.replace(this.regex, (match, type, code, offset) => entries.push([ type == '=' ? 'echo(' + code + ')' : code, offset, match.length ]));
		
		return [ string, entries ];
	},
	parse([ string, entries ]){
		var strings = [];

		strings.push({ type: 'string', value: string });
		
		entries.forEach(([ code, index, length ]) => {
			var size = 0, index_end = index + length, data;
			
			for(var ind in strings){
				data = strings[ind];
				
				if(data.type == 'syntax'){
					size += data.length;
					continue;
				}
				
				var real = size,
					real_end = size + data.value.length;
				
				if(real <= index && real_end >= index_end){
					var relative_index = index - size,
						relative_index_end = relative_index + length,
						first_half = data.value.slice(0, relative_index),
						last_half = data.value.slice(relative_index_end),
						extracted = data.value.slice(relative_index, relative_index_end);
					
					strings = [
						...strings.splice(0, ind),
						{ type: 'string', value: first_half },
						// use provided code variable
						{ length: length, type: 'syntax', value: code },
						{ type: 'string', value: last_half },
						...strings.splice(ind + 1),
					];
					
					break;
				}
				
				size += data.value.length
			}
		});
		
		return strings;
	},
};

exports.size = {
	b: 1,
	kb: 1e3,
	mb: 1e6,
	gb: 1e9,
	tb: 1e12,
	pb: 1e+15,
}

/** 
* Create an http(s) server with config provided
* @param {Object} [config]
* @param {Array} [config.routes] - all routes to go through, [ ['/regex or string', (req, res) => {} ] ]
* @param {Number} [config.port] - port to run server on
* @param {String} [config.address] - address to run server on
* @param {String} [config.static] - static directory to load files from
* @param {Object} [config.ssl ssl] - data to use with server, if not specified server will be HTTP only
* @param {Object} [config.ssl.key] - location to key file
* @param {Object} [config.ssl.crt] - location to crt file
* @param {Object} [config.global] - global arguments to pass to execution
* @param {Object} [config.cache] - Cache duration in seconds, default is 604800
* @param {Array} [config.execute] - An array of extensions that will be executed like PHP eg [ '.html', '.php' ]
* @param {Array} [config.index] - An array of filenames that will be served as an index file eg [ 'index.html', 'index.php', 'homepage.php' ]
* @param {Function} [config.ready] - function to call on server being ready 
*/

exports.server = class extends events {
	constructor(options = {}){
		super();
		
		this.options = options;
		
		this.ohandler = options.handler;
		
		this.cache = options.cache || 604800;
		this.execute = options.execute || ['.php', '.jhtml'];
		this.index = options.index || [ 'index.html', 'index.jhtml', 'index.php' ];
		
		this.global = options.global || {};
		
		this.global.fs = fs;
		this.global.path = path;
		this.global.atob = exports.atob;
		this.global.btoa = exports.btoa;
		this.global.nodehttp = exports;
		
		this.routes = options.endpoints || options.routes || [];
		this.ssl = options.ssl;
		
		this.port = options.port || 8080;
		this.address = options.address || '127.0.0.1';
		
		this.static = options.static || '';
		this.static_exists = this.static && fs.existsSync(this.static);
		
		this.server = (this.ssl ? https.createServer(this.ssl, this.handler.bind(this)) : http.createServer(this.handler.bind(this))).listen(this.port, this.address, this.ready.bind(this)).on('error', err => this.emit('error', err));
		
		this.server.on('upgrade', (req, socket, head) => this.emit('upgrade', req, socket, head));
		this.server.on('connection', socket => this.emit('connection', socket));
		this.server.on('close', err => this.emit('close', err));
	}
	get alias(){
		return ['0.0.0.0', '127.0.0.1'].includes(this.address) ? 'localhost' : this.address;
	}
	async handler(req, res){
		res = new exports.response(req, res, this);
		req = res.req;
		
		if(this.ohandler)return this.ohandler(req, res);
		
		await req.process();
		
		this.pick_route(req, res, [...this.routes]);
	}
	get url(){
		return new URL('http' + (this.ssl ? 's' : '') + '://' + this.alias + ':' + this.port);
		
	}
	pick_route(req, res, routes){
		var end = routes.findIndex(([ method, key, val, targ = 'pathname' ]) => {
				if(method != '*' && method != req.method)return;
				if(key instanceof RegExp)return key.test(req.url[targ]);
				
				var key = typeof key == 'function' ? key() : key;
				
				return key.endsWith('*') ? req.url[targ].startsWith(key.slice(0, -1)) : key == req.url[targ];
			});
		
		if(routes[end])routes[end][2](req, res, () => {
			routes.splice(end, 1);
			
			this.pick_route(req, res, routes);
		});
		else if(this.static_exists)res.static();
		else res.cgi_status(404);
	}
	/**
	* add a GET route
	* @param {string} Path
	* @param {function} Handler
	*/
	get(a1, a2){
		var path = typeof a1 == 'string' ? a1 : '*',
			handler = typeof a1 == 'function' ? a1 : a2;
		
		this.routes.push([ 'GET', path, handler ]);
	}
	/**
	* add a POST route
	* @param {string} Path
	* @param {function} Handler
	*/
	post(a1, a2){
		var path = typeof a1 == 'string' ? a1 : '*',
			handler = typeof a1 == 'function' ? a1 : a2;
		
		this.routes.push([ 'POST', path, handler ]);
	}
	/**
	* add a PUT route
	* @param {string} Path
	* @param {function} Handler
	*/
	put(a1, a2){
		var path = typeof a1 == 'string' ? a1 : '*',
			handler = typeof a1 == 'function' ? a1 : a2;
		
		this.routes.push([ 'PUT', path, handler ]);
	}
	/**
	* add a PATCH route
	* @param {string} Path
	* @param {function} Handler
	*/
	patch(a1, a2){
		var path = typeof a1 == 'string' ? a1 : '*',
			handler = typeof a1 == 'function' ? a1 : a2;
		
		this.routes.push([ 'PATCH', path, handler ]);
	}
	/**
	* add a DELETE route
	* @param {string} Path
	* @param {function} Handler
	*/
	delete(a1, a2){
		var path = typeof a1 == 'string' ? a1 : '*',
			handler = typeof a1 == 'function' ? a1 : a2;
		
		this.routes.push([ 'DELETE', path, handler ]);
	}
	/**
	* add a route for all
	* @param {string} Path
	* @param {function} Handler
	*/
	use(a1, a2){
		var path = typeof a1 == 'string' ? a1 : '*',
			handler = typeof a1 == 'function' ? a1 : a2;
		
		this.routes.push([ '*', path, handler ]);
	}
	ready(){
		this.emit('ready');
		
		if(this.options.ready)this.options.ready.call(this);
		else console.log(`[${process.pid}] server listening on ${this.url}`);
	}
}