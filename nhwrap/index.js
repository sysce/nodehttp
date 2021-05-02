// basic wrapper
'use strict';

var fs = require('fs'),
	mod = require('module'),
	path = require('path'),
	zlib = require('zlib'),
	util = require('util'),
	crypto = require('crypto'),
	stream = require('stream'),
	events = require('events'),
	AsyncFunction = (async _=>_).constructor,
	fs_promises_exists = path => new Promise((resolve, reject) => fs.promises.access(path, fs.F_OK).then(() => resolve(true)).catch(err => resolve(false))),
	html = {
		sanitize: string => (string + '').split('').map(char => '&#' + char.charCodeAt() + ';').join(''),
		redirect: url => `<meta http-equiv='refresh' content='0;url=${url}' />`,
	},
	create_require = (ctx, res, base, cache = {}, base_require = mod.createRequire(base + '/')) => fn => {
		var resolved = base_require.resolve(fn);
		
		// internal module
		if(!fs.existsSync(resolved))return require(resolved);
		
		if(cache[resolved])return cache[resolved].exports;
		
		var mod = cache[resolved] = Object.setPrototypeOf({ _exports: {}, get exports(){ return this._exports }, set exports(v){ return this._exports = v }, filename: resolved, id: resolved, path: path.dirname(resolved), loaded: true, children: [] }, null),
			ext = path.extname(resolved),
			script = (ext == '.json' ? 'module.exports=' : '') + fs.readFileSync(resolved) + '\n//@ sourceURL=' + resolved,
			args = res.execute_base(ctx, resolved);
		
		new Function('module', 'exports', Object.keys(args), script)(mod, mod.exports, ...Object.values(args));
		
		return mod.exports;
	},
	date = require('./date'),
	fetch = require('./fetch'),
	syntax = require('./syntax'),
	reader = require('../reader'),
	cookies = require('./cookies'),
	Headers = require('./headers');

class HTTPNodehttpRequest extends events {
	constructor(impl){
		super();
		
		this[reader.http_impl] = impl;
		this.headers = new Headers(impl.headers);
		this.time = new Date();
		this.cookies = new cookies(this.headers.get('cookie'));
	}
	// relative from route
	get relative(){
		return this.route ? path.posix.resolve('/', this.url.pathname.substr(((this.route.path == '*' ? '/' : this.route.path) || '').length)) : this.url.pathname;
	}
};

class HTTPNodehttpResponse extends events {
	constructor(impl){
		super();
		
		this.headers = new Headers(impl.headers);
		this[reader.http_impl] = impl;
		impl.wrapped_headers = () => Object.fromEntries([...this.headers.entries()]);
	}
	etag(data){
		return '"' + Buffer.byteLength(data || '').toString(16) + '-' + crypto.createHash('sha1').update(data || '', 'utf8').digest('base64').substring(0, 27) + '"';
	}
	send(data){
		if(typeof data != 'undefined')this.headers.set('etag', this.etag(data));
		this.end(data);
	}
	json(data){
		this.headers.set('content-type', 'application/json');
		this.send(JSON.stringify(data));
	}
	redirect(...args){
		var url = args.find(arg => typeof arg == 'string');
		
		if(typeof url == 'undefined')throw new Error('Invalid URL.');
		
		return this.status(args.find(arg => typeof arg == 'number') || 302), this.headers.set('location', url), this.end();
	}
	write_head(status, headers){
		this.request.cookies.modifications.forEach(value => this.headers.append('set-cookie', value));
		
		if(headers instanceof Headers)headers = Object.fromEntries([...headers.entriesAll()]);
		
		return this[reader.http_impl].write_head(status, headers);
	}
	parse_accept(string){
		var accept = new Map();
		
		string.split(/,\s+/g).forEach(data => data.replace(/([a-zA-Z]+)(?:;q=([\d.]+))?/, (label, weight) => accept.set(label.startsWith('x-' ? label.substr(2) : label, weight))));
		
		return accept;
	}
	compress(body){
		var accept_encoding = this.parse_accept(this.request.headers.get('accept-encoding') || ''),
			types = [ 'gzip', 'deflate' ].concat(this.version > 1 ? 'br' : []),
			type = types.find(type => accept_encoding.has(type));
		
		if(!type || accept_encoding.has('identity'))return body instanceof stream ? body.pipe(this) : this.end(body);
		
		var compressed = type == 'br' ? zlib.createBrotliCompress() : type == 'gzip' ? zlib.createGzip() : zlib.createDeflate();
		
		this.headers.set(this.version > 1 ? 'content-encoding' : 'content-coding', type);
		
		if(body instanceof stream)body.pipe(compressed);
		else compressed.end(body);
		
		return compressed.pipe(this);
	}
	do_cache(do_etag, modified){
		if(this.request.headers.get(this.version > 1 ? 'cache-control' : 'pragma') == 'no-cache')return;
		
		if(
			this.request.headers.has('if-modified-since') && !date.compare(modified, this.request.headers.get('if-modified-since')) ||
			do_etag && this.request.headers.has('if-none-match') && this.request.headers.get('if-none-match') == this.headers.get('etag')
		)return this.status(304), this.end(), true;
	}
	send_file(file, options = {}){
		return new Promise(async (resolve, reject) => {
			var ext = path.extname(file) || '',
				mime = options.execute.includes(ext) ? 'text/html' : HTTPNodehttpResponse.mimes[ext.substr(1)] || 'application/octet-stream',
				stats = await fs.promises.stat(file),
				fserr = err => {
					if(err.code == 'EISDIR')reject(404);
					else console.error(err), reject(404);
				};
			
			this.status(200);
			this.headers.set('content-type', mime);
			this.headers.set('date', date.format(this.request.time));
			
			// executable file
			if(options.execute.includes(ext))return this.execute(file, await fs.promises.readFile(file).catch(reject), true, options.global);
			
			if(options.last_modified)this.headers.set('last-modified', date.format(stats.mtimeMs));
			
			if(!isNaN(options.max_age))this.headers.set('cache-control', 'max-age=' + options.max_age);
			
			if(options.set_headers)await options.set_headers(this, file, stats);
			
			if(this.do_cache(false, stats.mtimeMs))return;
			
			if(stats.size < 2e6)fs.promises.readFile(file).then(data => {
				if(options.etag)this.headers.set('etag', this.etag(data));
				if(this.do_cache(options.etag, stats.mtimeMs))return;
				this.end(data);
				resolve();
			}).catch(fserr); else this.compress(fs.createReadStream(file).on('error', fserr)), resolve();
		});
	}
	execute_base(ctx, filename){
		var base = {
			__dirname: path.dirname(filename),
			__filename: filename,
			count(obj){
				if(typeof obj == 'string' || Array.isArray(arr))return obj.length;
				else if(typeof obj == 'object')return Object.keys(obj).length;
				
				throw new TypeError('`obj` must be a string or object');
			},
			file(file){
				return path.resolve(base.__dirname, file);
			},
			html: html,
			fetch: fetch,
			setTimeout: setTimeout,
			setInterval: setInterval,
			clearTimeout: clearTimeout,
			clearInterval: clearInterval,
			process: process,
			req: this.request,
			res: this,
			server: this.request.server,
			nodehttp: exports,
			fetch: fetch,
			fs: fs,
			path: path,
			btoa: str => Buffer.from(str || '', 'utf8').toString('base64'),
			atob: str => Buffer.from(str || '', 'base64').toString('utf8'),
			include: async file => {
				file = base.file(file);
				
				if(typeof file != 'string')throw new TypeError('`file` must be a string');
				
				var text = await fs.promises.readFile(file, 'utf8');
				
				if(path.extname(file) == '.js')text = '<?js\n' + text + '\n?>';
				
				// pass global
				return this.execute(file, text, false, ctx);
			},
			require: create_require(ctx, this, path.dirname(filename)),
			filemtime: async file => (await fs.promises.stat(base.file(file))).mtimeMs,
			handle_uncaught: err => {
				base.echo('<pre>' + html.sanitize(err instanceof Error ? err.toString() : err) + '</pre>');
				
				console.error(err);
			},
			echo: (...args) => (args.forEach(arg => this.write(util.format(arg))), true),
			header: (raw, replace = true, status) => {
				var add_http = raw.toLowerCase().startsWith('http/'),
					data = reader.read_response(add_http ? raw + '\r\n' : 'GET / HTTP/' + (this.version == 1 ? '1.0' : '1.1') + '\r\n' + raw + '\r\n');
				
				if(typeof status == 'number')this.status(status);
				else if(add_http && typeof data.status == 'number')this.status(data.status, data.message);
				
				new Headers(data.headers).forEach((value, header) => {
					if(header == 'Location' && typeof status != 'number' && (!add_http || typeof data.status == 'number'))this.status(302);
					
					if(replace)this.headers.append(header, value);
					else this.headers.set(header, value);
				});
			},
		};
		
		base.global = ctx;
		
		return base;
	}
	async execute(source, body, end_auto, ctx = {}){
		this.execute_sent = true;
		
		var base = this.execute_base(ctx, source);
		
		try{
			await new AsyncFunction(Object.keys(base), Object.keys(ctx), syntax(body.toString(), source, true)).call(ctx, ...Object.values(base), ...Object.values(ctx));
		}catch(err){
			console.error(err);
			return this[end_auto ? 'end' : 'write']('<pre>' + html.sanitize(util.format(err)) + '</pre>');
		}
		
		if(end_auto)this.end();
	}
};

HTTPNodehttpResponse.mimes = {html:'text/html',htm:'text/html',shtml:'text/html',css:'text/css',xml:'text/xml',gif:'image/gif',jpeg:'image/jpeg',jpg:'image/jpeg',js:'application/javascript',atom:'application/atom+xml',rss:'application/rss+xml',mml:'text/mathml',txt:'text/plain',jad:'text/vnd.sun.j2me.app-descriptor',wml:'text/vnd.wap.wml',htc:'text/x-component',png:'image/png',tif:'image/tiff',tiff:'image/tiff',wbmp:'image/vnd.wap.wbmp',ico:'image/x-icon',jng:'image/x-jng',bmp:'image/x-ms-bmp',svg:'image/svg+xml',svgz:'image/svg+xml',webp:'image/webp',woff:'application/font-woff',jar:'application/java-archive',war:'application/java-archive',ear:'application/java-archive',json:'application/json',hqx:'application/mac-binhex40',doc:'application/msword',pdf:'application/pdf',ps:'application/postscript',eps:'application/postscript',ai:'application/postscript',rtf:'application/rtf',m3u8:'application/vnd.apple.mpegurl',xls:'application/vnd.ms-excel',eot:'application/vnd.ms-fontobject',ppt:'application/vnd.ms-powerpoint',wmlc:'application/vnd.wap.wmlc',kml:'application/vnd.google-earth.kml+xml',kmz:'application/vnd.google-earth.kmz','7z':'application/x-7z-compressed',cco:'application/x-cocoa',jardiff:'application/x-java-archive-diff',jnlp:'application/x-java-jnlp-file',run:'application/x-makeself',pl:'application/x-perl',pm:'application/x-perl',prc:'application/x-pilot',pdb:'application/x-pilot',rar:'application/x-rar-compressed',rpm:'application/x-redhat-package-manager',sea:'application/x-sea',swf:'application/x-shockwave-flash',sit:'application/x-stuffit',tcl:'application/x-tcl',tk:'application/x-tcl',der:'application/x-x509-ca-cert',pem:'application/x-x509-ca-cert',crt:'application/x-x509-ca-cert',xpi:'application/x-xpinstall',xhtml:'application/xhtml+xml',xspf:'application/xspf+xml',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',mid:'audio/midi',midi:'audio/midi',kar:'audio/midi',mp3:'audio/mpeg',ogg:'audio/ogg',m4a:'audio/x-m4a',ra:'audio/x-realaudio','3gpp':'video/3gpp','3gp':'video/3gpp',ts:'video/mp2t',mp4:'video/mp4',mpeg:'video/mpeg',mpg:'video/mpeg',mov:'video/quicktime',webm:'video/webm',flv:'video/x-flv',m4v:'video/x-m4v',mng:'video/x-mng',asx:'video/x-ms-asf',asf:'video/x-ms-asf',wmv:'video/x-ms-wmv',avi:'video/x-msvideo',wasm:'application/wasm',ttf:'font/ttf'};

var proxy_impl = (target, ...props) => props.forEach(prop => Object.defineProperty(target.prototype, prop, {
	get(){ return typeof this[reader.http_impl][prop] == 'function' ? this[reader.http_impl][prop].bind(this[reader.http_impl]) : this[reader.http_impl][prop] },
	set(value){ return this[reader.http_impl][prop] = value },
}));

proxy_impl(HTTPNodehttpRequest, 'method', 'route', 'server', 'raw_url', 'url', 'body');
proxy_impl(HTTPNodehttpResponse, 'head_sent', 'body_sent', 'end', 'write', 'status');

exports.request = HTTPNodehttpRequest;
exports.response = HTTPNodehttpResponse;
exports.static = (root, options = {}, _static) => _static = Object.assign(async (req, res, next) => {
	var file = path.join(_static.root, req.relative),	
		error = async (code, message, title = code) => {
			var error_page = !_static.error && _static.fallthrough || !_static.error || await fs.promises.readFile(_static.error).catch(_=>_);
			
			if(!Buffer.isBuffer(error_page))return next();
			
			res.status(code);
			res.headers.set('content-type', 'text/html');
			
			var args = { error: {
				title: code + ' ' + reader.status_codes[code],
				code: code,
				message: message,
			} };
			
			if(message){
				var formatted = util.format(message);
				
				if(message instanceof Error)formatted = '<pre>' + formatted + '</pre>';
				
				args.error.message = formatted;
			};
			
			res.execute(_static.error, error_page, true, args);
		},
		stat = await fs.promises.stat(file).catch(err => false);
	
	if(!stat)return error(404);
	
	if(path.basename(file).startsWith('.') && _static.dot_files != 'allow')return error(_static.dot_files == 'ignore' ? 404 : 403);
	
	if(_static.index && stat.isDirectory())for(var ind in _static.index)if(await fs_promises_exists(path.join(file, _static.index[ind]))){
		// index found but trailing slash needed
		if(!req.url.pathname.endsWith('/') && _static.redirect){
			res.status(301);
			res.headers.set('location', req.url.pathname + '/');
			return res.end();
		}
		
		file = path.join(file, _static.index[ind]);
		stat = await fs.promises.stat(file);
		
		break;
	}
	
	if(path.basename(file).startsWith('.') && _static.dot_files == 'ignore')return error(404);
	
	res.send_file(file, _static).catch(err => error(404));
}, {
	root: root,
	listing: [],
	index: [ 'index.html', 'index.php' ],
	execute: ['.php', '.jhtml'],
	etag: true,
	fallthrough: true,
	error: false,
	last_modified: true,
	redirect: true,
	dot_files: 'ignore',
	max_age: 31536000,
}, options);

exports.listing = folder => async (req, res, next) => {
	var current = folder + path.posix.resolve(folder, req.relative);
	
	if(!(await fs.promises.stat(current).catch(_=>({isDirectory(){}}))).isDirectory())return next();
	
	res.headers.set('content-type', 'text/html');
	res.execute(folder, await fs.promises.readFile(path.join(__dirname, 'listing.php')), true, { folder: current });
};